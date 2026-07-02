<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\User;
use App\Support\InventoryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AccountantRoleTest extends TestCase
{
    use RefreshDatabase;

    private function tokenForAccountant(): string
    {
        $user = User::factory()->create([
            'password' => Hash::make('password'),
            'role' => User::ROLE_ACCOUNTANT,
        ]);

        return $user->createToken('test')->plainTextToken;
    }

    public function test_super_admin_can_create_accountant_user(): void
    {
        $admin = User::factory()->create([
            'password' => Hash::make('password'),
            'role' => User::ROLE_SUPER_ADMIN,
            'is_admin' => true,
        ]);

        $this->withToken($admin->createToken('test')->plainTextToken)
            ->postJson('/api/users', [
                'name' => 'Contador Externo',
                'email' => 'contador@phonecolombia.com',
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'role' => User::ROLE_ACCOUNTANT,
            ])
            ->assertCreated()
            ->assertJsonPath('role', User::ROLE_ACCOUNTANT);
    }

    public function test_accountant_can_access_dashboard_bootstrap_and_reports(): void
    {
        $token = $this->tokenForAccountant();
        $date = now()->toDateString();

        $this->withToken($token)
            ->getJson('/api/bootstrap/dashboard')
            ->assertOk()
            ->assertJsonStructure(['dashboard' => ['inventory', 'sales', 'trends']]);

        $this->withToken($token)
            ->getJson("/api/reports/daily?from={$date}&to={$date}")
            ->assertOk();

        $this->withToken($token)
            ->getJson('/api/reports/cash-register/export/pdf?from='.$date.'&to='.$date)
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_accountant_cannot_manage_inventory_or_sales(): void
    {
        $token = $this->tokenForAccountant();

        $this->withToken($token)
            ->postJson('/api/inventory', [
                'name' => 'IPHONE 15',
                'imei' => '352099001761599',
                'sale_price' => '2000000',
                'status' => InventoryStatus::DISPONIBLE,
            ])
            ->assertForbidden();

        $item = InventoryItem::create([
            'name' => 'IPHONE 14',
            'imei' => '352099001761598',
            'sale_price' => '1800000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ]);

        $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '1800000',
                'payment_method' => 'efectivo',
            ])
            ->assertForbidden();
    }

    public function test_accountant_can_view_remission_document(): void
    {
        $this->seed(\Database\Seeders\CreditPaymentMethodSeeder::class);
        $inventory = User::factory()->create(['role' => User::ROLE_INVENTORY]);
        $accountantToken = $this->tokenForAccountant();

        $item = InventoryItem::create([
            'name' => 'IPHONE 13',
            'imei' => '352099001761597',
            'sale_price' => '1600000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ]);

        $saleId = $this->withToken($inventory->createToken('test')->plainTextToken)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '1600000',
                'payment_method' => 'efectivo',
            ])
            ->assertCreated()
            ->json('id');

        $this->withToken($accountantToken)
            ->getJson("/api/sales/{$saleId}/remission")
            ->assertOk()
            ->assertJsonStructure(['remission_number', 'sale_price', 'payments']);

        $this->withToken($accountantToken)
            ->get("/api/sales/{$saleId}/remission/pdf")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }
}
