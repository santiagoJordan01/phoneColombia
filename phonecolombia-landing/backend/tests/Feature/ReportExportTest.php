<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\User;
use App\Support\InventoryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ReportExportTest extends TestCase
{
    use RefreshDatabase;

    private function tokenFor(string $role): string
    {
        $user = User::factory()->create([
            'password' => Hash::make('password'),
            'role' => $role,
            'is_admin' => $role === User::ROLE_SUPER_ADMIN,
        ]);

        return $user->createToken('test')->plainTextToken;
    }

    private function createSale(): void
    {
        $item = InventoryItem::create([
            'name' => 'IPHONE 14 128GB',
            'imei' => '352099001761481',
            'sale_price' => '2500000',
            'status' => InventoryStatus::VENDIDO,
            'quantity' => 1,
        ]);

        Sale::create([
            'inventory_item_id' => $item->id,
            'user_id' => User::factory()->create(['role' => User::ROLE_SELLER])->id,
            'sale_price' => '2500000',
            'payment_method' => 'efectivo',
            'credit_status' => 'paid',
            'amount_paid' => 2500000,
            'amount_due' => 0,
            'sold_at' => now(),
        ]);
    }

    public function test_daily_report_pdf_export(): void
    {
        $this->createSale();
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $date = now()->toDateString();

        $this->withToken($token)
            ->get("/api/reports/daily/export/pdf?date={$date}")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_daily_report_excel_export(): void
    {
        $this->createSale();
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $date = now()->toDateString();

        $response = $this->withToken($token)
            ->get("/api/reports/daily/export/xlsx?date={$date}")
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $temp = tempnam(sys_get_temp_dir(), 'xlsx_').'.xlsx';
        file_put_contents($temp, $response->streamedContent());

        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($temp);
        @unlink($temp);

        $this->assertSame('Resumen', $spreadsheet->getSheet(0)->getTitle());
        $this->assertSame('Detalle ventas', $spreadsheet->getSheet(1)->getTitle());
        $this->assertSame('PHONE COLOMBIA', $spreadsheet->getSheet(0)->getCell('A1')->getValue());
        $this->assertSame('Fecha', $spreadsheet->getSheet(1)->getCell('A3')->getValue());
        $this->assertSame('IPHONE 14 128GB', $spreadsheet->getSheet(1)->getCell('C4')->getValue());
    }

    public function test_daily_report_supports_date_range(): void
    {
        $this->createSale();
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $from = now()->subDays(2)->toDateString();
        $to = now()->toDateString();

        $this->withToken($token)
            ->getJson("/api/reports/daily?from={$from}&to={$to}")
            ->assertOk()
            ->assertJsonPath('is_range', true)
            ->assertJsonPath('period_from', $from)
            ->assertJsonPath('period_to', $to)
            ->assertJsonPath('totals.count', 1);

        $this->withToken($token)
            ->getJson("/api/reports/daily?date={$to}")
            ->assertOk()
            ->assertJsonPath('is_range', false)
            ->assertJsonPath('totals.count', 1);
    }

    public function test_content_role_cannot_export_daily_report(): void
    {
        $token = $this->tokenFor(User::ROLE_CONTENT);

        $this->withToken($token)
            ->get('/api/reports/daily/export/pdf')
            ->assertForbidden();
    }

    public function test_by_seller_report_pdf_export(): void
    {
        $this->createSale();
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $from = now()->startOfMonth()->toDateString();
        $to = now()->toDateString();

        $this->withToken($token)
            ->get("/api/reports/by-seller/export/pdf?from={$from}&to={$to}")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_by_seller_report_excel_export(): void
    {
        $this->createSale();
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $from = now()->startOfMonth()->toDateString();
        $to = now()->toDateString();

        $response = $this->withToken($token)
            ->get("/api/reports/by-seller/export/xlsx?from={$from}&to={$to}")
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $temp = tempnam(sys_get_temp_dir(), 'xlsx_').'.xlsx';
        file_put_contents($temp, $response->streamedContent());

        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($temp);
        @unlink($temp);

        $this->assertSame('Resumen', $spreadsheet->getSheet(0)->getTitle());
        $this->assertSame('Detalle por vendedor', $spreadsheet->getSheet(1)->getTitle());
        $this->assertSame('Informe por vendedor', $spreadsheet->getSheet(0)->getCell('A2')->getValue());
    }
}
