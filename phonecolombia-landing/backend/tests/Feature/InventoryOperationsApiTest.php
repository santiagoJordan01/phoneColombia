<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\InventoryItem;
use App\Models\Supplier;
use App\Models\User;
use App\Support\InventoryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class InventoryOperationsApiTest extends TestCase
{
    use RefreshDatabase;

    private function tokenFor(string $role, array $extra = []): string
    {
        $user = User::factory()->create(array_merge([
            'password' => Hash::make('password'),
            'role' => $role,
            'is_admin' => $role === User::ROLE_SUPER_ADMIN,
        ], $extra));

        return $user->createToken('test')->plainTextToken;
    }

    private function createItem(array $overrides = []): InventoryItem
    {
        return InventoryItem::create(array_merge([
            'name' => 'IPHONE 13 128GB',
            'imei' => '352099001761481',
            'sale_price' => '3200000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
        ], $overrides));
    }

    public function test_content_role_cannot_login(): void
    {
        User::factory()->create([
            'email' => 'content@test.com',
            'password' => Hash::make('secret'),
            'role' => User::ROLE_CONTENT,
            'is_admin' => false,
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'content@test.com',
            'password' => 'secret',
        ])->assertForbidden();
    }

    public function test_content_role_cannot_access_inventory(): void
    {
        $token = $this->tokenFor(User::ROLE_CONTENT);

        $this->withToken($token)
            ->getJson('/api/inventory')
            ->assertForbidden();
    }

    public function test_seller_cannot_create_inventory_item(): void
    {
        $token = $this->tokenFor(User::ROLE_SELLER);

        $this->withToken($token)
            ->postJson('/api/inventory', [
                'name' => 'IPHONE 14',
                'status' => InventoryStatus::DISPONIBLE,
            ])
            ->assertForbidden();
    }

    public function test_supplier_cannot_update_inventory_item(): void
    {
        $supplier = Supplier::create(['name' => 'PROVEEDOR TEST']);
        $token = $this->tokenFor(User::ROLE_SUPPLIER, ['supplier_id' => $supplier->id]);
        $item = $this->createItem(['supplier_id' => $supplier->id, 'supplier' => $supplier->name]);

        $this->withToken($token)
            ->putJson("/api/inventory/{$item->id}", ['sale_price' => '999'])
            ->assertForbidden();
    }

    public function test_mixed_sale_without_payments_is_rejected(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem();

        $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '1000000',
                'payment_method' => 'mixto',
            ])
            ->assertStatus(422);
    }

    public function test_mixed_sale_with_two_payments_succeeds(): void
    {
        $token = $this->tokenFor(User::ROLE_SELLER);
        $item = $this->createItem();

        $response = $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '1000000',
                'payment_method' => 'mixto',
                'payments' => [
                    ['method' => 'efectivo', 'amount' => 600000],
                    ['method' => 'transferencia', 'amount' => 400000],
                ],
            ]);

        $response->assertCreated()
            ->assertJsonPath('amount_paid', '1000000.00')
            ->assertJsonPath('credit_status', 'paid');

        $this->assertDatabaseHas('inventory_items', [
            'id' => $item->id,
            'status' => InventoryStatus::VENDIDO,
        ]);
    }

    public function test_credito_sale_creates_full_pending_balance(): void
    {
        $token = $this->tokenFor(User::ROLE_SELLER);
        $item = $this->createItem();

        $this->withToken($token)
            ->postJson('/api/sales', [
                'inventory_item_id' => $item->id,
                'sale_price' => '1000000',
                'payment_method' => 'credito',
            ])
            ->assertCreated()
            ->assertJsonPath('credit_status', 'pending')
            ->assertJsonPath('amount_paid', '0.00')
            ->assertJsonPath('amount_due', '1000000.00');
    }

    public function test_sales_bootstrap_includes_separado_items(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem(['status' => InventoryStatus::SEPARADO]);

        $this->withToken($token)
            ->getJson('/api/bootstrap/sales')
            ->assertOk()
            ->assertJsonFragment(['id' => $item->id]);
    }

    public function test_retake_flow_vendido_to_retomado_to_disponible(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem(['status' => InventoryStatus::VENDIDO]);

        $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/retake")
            ->assertOk()
            ->assertJsonPath('status', InventoryStatus::RETOMADO);

        $this->withToken($token)
            ->postJson("/api/inventory/{$item->id}/retake")
            ->assertOk()
            ->assertJsonPath('status', InventoryStatus::DISPONIBLE);
    }

    public function test_imei_can_be_reused_after_soft_delete(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $item = $this->createItem(['imei' => '111222333444555']);
        $item->delete();

        $this->withToken($token)
            ->postJson('/api/inventory', [
                'name' => 'IPHONE REINGRESO',
                'imei' => '111222333444555',
                'status' => InventoryStatus::DISPONIBLE,
            ])
            ->assertCreated();
    }

    public function test_user_create_writes_audit_log(): void
    {
        $token = $this->tokenFor(User::ROLE_SUPER_ADMIN);

        $this->withToken($token)
            ->postJson('/api/users', [
                'name' => 'Vendedor Test',
                'email' => 'seller@test.com',
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'role' => User::ROLE_SELLER,
            ])
            ->assertCreated();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'created',
            'auditable_type' => User::class,
        ]);
    }

    public function test_super_admin_can_list_audit_logs(): void
    {
        $token = $this->tokenFor(User::ROLE_SUPER_ADMIN);

        $this->withToken($token)
            ->getJson('/api/audit-logs')
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'summary' => ['total', 'by_action', 'by_entity'],
                'filters' => ['actions', 'entities'],
            ]);
    }

    public function test_sale_lookup_by_barcode(): void
    {
        $token = $this->tokenFor(User::ROLE_SELLER);
        $item = $this->createItem([
            'barcode' => '7701234567890',
            'status' => InventoryStatus::DISPONIBLE,
        ]);

        $this->withToken($token)
            ->getJson('/api/inventory?barcode=7701234567890&status=disponible')
            ->assertOk()
            ->assertJsonPath('0.id', $item->id)
            ->assertJsonPath('0.barcode', '7701234567890');
    }

    public function test_content_cannot_access_sales(): void
    {
        $token = $this->tokenFor(User::ROLE_CONTENT);

        $this->withToken($token)
            ->getJson('/api/sales')
            ->assertForbidden();
    }

    public function test_seller_can_access_sales_but_not_reports_inventory_mutations(): void
    {
        $token = $this->tokenFor(User::ROLE_SELLER);

        $this->withToken($token)->getJson('/api/sales')->assertOk();
        $this->withToken($token)->getJson('/api/inventory')->assertOk();
        $this->withToken($token)->postJson('/api/device-colors', ['name' => 'ROJO'])->assertForbidden();
    }
}
