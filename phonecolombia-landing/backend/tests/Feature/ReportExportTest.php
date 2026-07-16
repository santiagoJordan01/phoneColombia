<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\Sale;
use App\Models\User;
use App\Support\InventoryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use PhpOffice\PhpSpreadsheet\IOFactory;
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
            'remission_number' => 'R-'.now()->format('Y').'-000001',
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

        $spreadsheet = IOFactory::load($temp);
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

    public function test_daily_settlement_uses_colombia_calendar_day_for_sold_at(): void
    {
        $item = InventoryItem::create([
            'name' => 'IPHONE 13 128GB',
            'imei' => '352099001761482',
            'sale_price' => '1800000',
            'status' => InventoryStatus::VENDIDO,
            'quantity' => 1,
        ]);

        // 15 jul 2026 22:00 en Colombia = 16 jul 03:00 UTC (stored in app TZ)
        Sale::create([
            'inventory_item_id' => $item->id,
            'user_id' => User::factory()->create(['role' => User::ROLE_SELLER])->id,
            'sale_price' => '1800000',
            'payment_method' => 'efectivo',
            'credit_status' => 'paid',
            'amount_paid' => 1800000,
            'amount_due' => 0,
            'sold_at' => Carbon::parse('2026-07-15 22:00:00', 'America/Bogota')->timezone('UTC'),
            'remission_number' => 'R-2026-000099',
        ]);

        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $this->withToken($token)
            ->getJson('/api/reports/daily-settlement?from=2026-07-15&to=2026-07-15')
            ->assertOk()
            ->assertJsonPath('equipos_count', 1);

        $this->withToken($token)
            ->getJson('/api/reports/daily-settlement?from=2026-07-16&to=2026-07-16')
            ->assertOk()
            ->assertJsonPath('equipos_count', 0);
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

        $spreadsheet = IOFactory::load($temp);
        @unlink($temp);

        $this->assertSame('Resumen', $spreadsheet->getSheet(0)->getTitle());
        $this->assertSame('Detalle por vendedor', $spreadsheet->getSheet(1)->getTitle());
        $this->assertSame('Informe por vendedor', $spreadsheet->getSheet(0)->getCell('A2')->getValue());
    }

    public function test_cash_register_report_pdf_export(): void
    {
        $this->createSale();
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $date = now()->toDateString();

        $this->withToken($token)
            ->get("/api/reports/cash-register/export/pdf?from={$date}&to={$date}")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_cash_register_report_excel_export(): void
    {
        $this->createSale();
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $date = now()->toDateString();

        $response = $this->withToken($token)
            ->get("/api/reports/cash-register/export/xlsx?from={$date}&to={$date}")
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $temp = tempnam(sys_get_temp_dir(), 'xlsx_').'.xlsx';
        file_put_contents($temp, $response->streamedContent());

        $spreadsheet = IOFactory::load($temp);
        @unlink($temp);

        $this->assertSame('Resumen', $spreadsheet->getSheet(0)->getTitle());
        $this->assertSame('Libro de caja', $spreadsheet->getSheet(1)->getTitle());
        $this->assertSame('Libro de caja', $spreadsheet->getSheet(0)->getCell('A2')->getValue());
    }

    public function test_receivables_report_pdf_export(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $this->withToken($token)
            ->get('/api/reports/receivables/export/pdf')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_receivables_report_excel_export(): void
    {
        $token = $this->tokenFor(User::ROLE_INVENTORY);

        $response = $this->withToken($token)
            ->get('/api/reports/receivables/export/xlsx')
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $temp = tempnam(sys_get_temp_dir(), 'xlsx_').'.xlsx';
        file_put_contents($temp, $response->streamedContent());

        $spreadsheet = IOFactory::load($temp);
        @unlink($temp);

        $this->assertSame('Resumen', $spreadsheet->getSheet(0)->getTitle());
        $this->assertSame('Detalle cartera', $spreadsheet->getSheet(1)->getTitle());
        $this->assertSame('Informe de cartera', $spreadsheet->getSheet(0)->getCell('A2')->getValue());
    }

    public function test_by_remission_report_xls_export(): void
    {
        $this->createSale();
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $date = now()->toDateString();

        $response = $this->withToken($token)
            ->get("/api/reports/by-remission/export/xls?from={$date}&to={$date}")
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.ms-excel; charset=windows-1252');

        $content = $response->streamedContent();
        $decoded = mb_convert_encoding($content, 'UTF-8', 'Windows-1252');

        $this->assertStringContainsString('<table border="1"', $decoded);
        $this->assertStringContainsString('ID remisión', $decoded);
        $this->assertStringContainsString('R-'.now()->format('Y').'-000001', $decoded);
        $this->assertStringContainsString('PHONE COLOMBIA', $decoded);
        $this->assertStringContainsString('Pago total', $decoded);
    }

    public function test_by_remission_report_pdf_export(): void
    {
        $this->createSale();
        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $date = now()->toDateString();

        $this->withToken($token)
            ->get("/api/reports/by-remission/export/pdf?from={$date}&to={$date}")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_inventory_intake_report_json_and_exports(): void
    {
        InventoryItem::create([
            'name' => 'IPHONE 15 128GB',
            'supplier' => 'Proveedor Test',
            'purchase_price' => '1800000',
            'sale_price' => '2200000',
            'status' => InventoryStatus::DISPONIBLE,
            'quantity' => 1,
            'acquired_at' => now(),
        ]);

        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $date = now()->toDateString();

        $this->withToken($token)
            ->getJson("/api/reports/inventory-intake?from={$date}&to={$date}")
            ->assertOk()
            ->assertJsonPath('totals.count', 1)
            ->assertJsonPath('by_supplier.0.supplier_name', 'Proveedor Test');

        $this->withToken($token)
            ->get("/api/reports/inventory-intake/export/pdf?from={$date}&to={$date}")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $this->withToken($token)
            ->get("/api/reports/inventory-intake/export/xlsx?from={$date}&to={$date}")
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }

    public function test_service_tickets_report_json_and_exports(): void
    {
        \App\Models\ServiceTicket::create([
            'ticket_type' => 'cliente_externo',
            'device_name' => 'SAMSUNG A54',
            'status' => 'proceso_revision',
            'issue_description' => 'Pantalla rota',
            'repair_cost' => 150000,
            'customer_price' => 280000,
            'customer_name' => 'Cliente ST',
            'received_at' => now(),
        ]);

        $token = $this->tokenFor(User::ROLE_INVENTORY);
        $date = now()->toDateString();

        $this->withToken($token)
            ->getJson("/api/reports/service-tickets?from={$date}&to={$date}")
            ->assertOk()
            ->assertJsonPath('totals.count', 1)
            ->assertJsonPath('tickets.0.display_name', 'SAMSUNG A54');

        $this->withToken($token)
            ->get("/api/reports/service-tickets/export/pdf?from={$date}&to={$date}")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $this->withToken($token)
            ->get("/api/reports/service-tickets/export/xlsx?from={$date}&to={$date}")
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
}
