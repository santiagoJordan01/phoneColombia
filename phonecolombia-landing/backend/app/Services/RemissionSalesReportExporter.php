<?php

namespace App\Services;

use App\Models\Sale;
use App\Support\MoneyFormatter;
use App\Support\SaleCostResolver;
use App\Support\SaleReservationStatus;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RemissionSalesReportExporter
{
    private const BRANCH = 'PHONE COLOMBIA';

    private const COST_CENTER = 'Principal';

    private const WAREHOUSE = 'Principal';

    private const COUNTRY = 'Colombia';

    /** @var list<string> */
    private const HEADERS = [
        'Sucursal',
        'Centro de costos',
        'ID remisión',
        'ID venta ecommerce',
        'Nombre venta ecommerce',
        'Ecommerce',
        'Bodega',
        'Cliente',
        'ID. cliente',
        'Teléfono',
        'País',
        'Departamento',
        'Ciudad',
        'DANE Ciudad',
        'Dirección',
        'Tipo de markting',
        'Vendedor',
        'Total bruto',
        'Descuentos',
        'Subtotal',
        'Impuestos',
        'Retenciones',
        'Propina voluntaria',
        'Total neto',
        'Devoluciones vigentes',
        'Costo manual',
        'Utilidad (costo manual)',
        'Margen de utilidad (costo manual)',
        'Costo promedio',
        'Utilidad (costo promedio)',
        'Margen de utilidad (costo promedio)',
        'Pdte. de cobro',
        'Estado CXC',
        'Días mora',
        'Valor mora',
        'Fecha de entrega',
        'Observación',
        'Garantía',
        'Estado remisión',
        'Fecha de creación',
        'Responsable de creación',
        'Observación de anulación',
        'Fecha de anulación',
        'Responsable de anulación',
        'Relación de despacho',
        'Guía interna de transporte',
        'Guía inicial de transportadora',
        'Estado transportadora guía inicial',
        'Estado global guía inicial',
        'Valor flete guía inicial',
        'Guía adicional de transportadora',
        'Estado transportadora guía adicional',
        'Estado global guía adicional',
        'Distribuidor Dropshipping',
        'Proveedor Dropshipping',
        'Compra del distribuidor',
        'Total compra del distribuidor',
        'Venta del distribuidor',
        'Total venta del distribuidor',
        'Venta del proveedor',
        'Total venta del proveedor',
        'Guía transportadora Dropshipping',
        'Estado guía Dropshipping',
        'Valor a recaudar por el proveedor',
        'Convenio Dropshipping',
        'Estado transacción de Dropshipping',
        'URL Guía Dropshipping',
        'Adjuntos',
        'Adjunto con enlace',
    ];

    /** @param array<string, mixed> $report */
    public function toPdf(array $report, string $dateLabel): StreamedResponse
    {
        $filename = 'informe_por_remision_'.$dateLabel.'.pdf';

        $pdf = Pdf::loadView('reports.by-remission-pdf', [
            'report' => $report,
            'dateLabel' => $dateLabel,
            'periodLabel' => $this->formatPeriodLabel($report, $dateLabel),
            'generatedAt' => now()->timezone('America/Bogota')->format('d/m/Y H:i'),
        ])->setPaper('letter', 'portrait');

        return response()->streamDownload(
            fn () => print ($pdf->output()),
            $filename,
            ['Content-Type' => 'application/pdf'],
        );
    }

    /** @param array<string, mixed> $report */
    private function formatPeriodLabel(array $report, string $dateLabel): string
    {
        if (! empty($report['is_range']) && ! empty($report['period_from']) && ! empty($report['period_to'])) {
            return $report['period_from'].' — '.$report['period_to'];
        }

        return $report['period_to'] ?? $report['period_from'] ?? $dateLabel;
    }

    /** @param Collection<int, Sale> $sales */
    public function toXls(Collection $sales, string $dateLabel): StreamedResponse
    {
        $generatedAt = now()->timezone('America/Bogota');
        $filename = 'Reporte de remisiones de venta '.$generatedAt->format('Y-m-d H_i_s').'.xls';

        return response()->streamDownload(function () use ($sales) {
            echo $this->buildExcelDocument($sales);
        }, $filename, [
            'Content-Type' => 'application/vnd.ms-excel; charset=windows-1252',
        ]);
    }

    /** @param Collection<int, Sale> $sales */
    private function buildExcelDocument(Collection $sales): string
    {
        $table = $this->buildTableHtml($sales);
        $document = '<html xmlns:o="urn:schemas-microsoft-com:office:office" '
            .'xmlns:x="urn:schemas-microsoft-com:office:excel" '
            .'xmlns="http://www.w3.org/TR/REC-html40">'
            .'<head><meta http-equiv="Content-Type" content="text/html; charset=windows-1252"></head>'
            .'<body>'.$table.'</body></html>';

        $encoded = @mb_convert_encoding($document, 'Windows-1252', 'UTF-8');

        return $encoded !== false ? $encoded : $document;
    }

    /** @param Collection<int, Sale> $sales */
    private function buildTableHtml(Collection $sales): string
    {
        $html = '<table border="1" cellpadding="10" cellspacing="0" style="border-collapse:collapse;">';
        $html .= '<thead><tr>';
        foreach (self::HEADERS as $header) {
            $html .= '<th class="text-center">'.htmlspecialchars($header, ENT_QUOTES, 'UTF-8').'</th>';
        }
        $html .= '</tr></thead><tbody id="bodyTabla">';

        foreach ($sales as $sale) {
            $html .= $this->buildRow($sale);
        }

        $html .= '</tbody></table>';

        return $html;
    }

    private function buildRow(Sale $sale): string
    {
        $cells = $this->mapSaleToCells($sale);
        $html = '<tr>';

        foreach ($cells as $index => $cell) {
            $html .= $this->renderCell($cell, $index);
        }

        $html .= '</tr>';

        return $html;
    }

    /** @return list<array{type: string, value: mixed}> */
    private function mapSaleToCells(Sale $sale): array
    {
        $salePrice = MoneyFormatter::parse($sale->sale_price);
        $cost = SaleCostResolver::purchasePriceAtSale($sale);
        $profit = SaleCostResolver::netProfit($sale);
        $margin = $salePrice > 0 ? round($profit / $salePrice, 4) : 0.0;
        $amountDue = (float) $sale->amount_due;
        $isReturned = $sale->isReturned();
        $isApartado = $sale->reservation_status === SaleReservationStatus::ACTIVE;
        $dueAt = $sale->credit_due_at;
        $isOverdue = ! $isApartado && ! $isReturned && $dueAt && $dueAt->isPast() && $amountDue > 0;
        $daysOverdue = $isOverdue ? (int) $dueAt->diffInDays(now()) : 0;
        $overdueAmount = $isOverdue ? $amountDue : 0.0;

        $customerName = $sale->serviceCustomer?->name ?? $sale->customer_name ?? 'CONSUMIDOR FINAL';
        $customerDocument = $this->formatCustomerDocument($sale);
        $customerPhone = $sale->customer_phone ?? $sale->serviceCustomer?->phone ?? '';
        $sellerName = $sale->user?->name ?? '';
        $createdAt = $sale->created_at?->timezone('America/Bogota');
        $deliveryDate = $sale->sold_at ?? $sale->reserved_at;
        $responsible = $this->formatResponsible($sale->user?->name, $sale->user?->email);

        return [
            ['type' => 'text', 'value' => self::BRANCH],
            ['type' => 'text', 'value' => self::COST_CENTER],
            ['type' => 'text', 'value' => $sale->remission_number ?? ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => self::WAREHOUSE],
            ['type' => 'text', 'value' => $customerName],
            ['type' => 'text', 'value' => $customerDocument],
            ['type' => 'text', 'value' => $customerPhone],
            ['type' => 'text', 'value' => self::COUNTRY],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => $sellerName],
            ['type' => 'money', 'value' => $salePrice],
            ['type' => 'money', 'value' => 0.0],
            ['type' => 'money', 'value' => $salePrice],
            ['type' => 'money', 'value' => 0.0],
            ['type' => 'money', 'value' => 0.0],
            ['type' => 'money', 'value' => 0.0],
            ['type' => 'money', 'value' => $salePrice],
            ['type' => 'money', 'value' => 0.0],
            ['type' => 'money', 'value' => $cost],
            ['type' => 'money', 'value' => $profit],
            ['type' => 'percent', 'value' => $margin],
            ['type' => 'money', 'value' => $cost],
            ['type' => 'money', 'value' => $profit],
            ['type' => 'percent', 'value' => $margin],
            ['type' => 'money', 'value' => $amountDue],
            ['type' => 'text', 'value' => $this->cxcStatus($sale, $isReturned, $amountDue)],
            ['type' => 'integer', 'value' => $daysOverdue],
            ['type' => 'money', 'value' => $overdueAmount],
            ['type' => 'date', 'value' => $deliveryDate],
            ['type' => 'text', 'value' => $isReturned ? '' : ($sale->notes ?? '')],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => $this->remissionStatus($sale, $isReturned, $isApartado)],
            ['type' => 'datetime', 'value' => $createdAt],
            ['type' => 'text', 'value' => $responsible],
            ['type' => 'text', 'value' => $isReturned ? ($sale->notes ?? '') : ''],
            ['type' => 'datetime', 'value' => $isReturned ? $sale->returned_at?->timezone('America/Bogota') : null],
            ['type' => 'text', 'value' => $isReturned ? $responsible : ''],
            ['type' => 'text', 'value' => 'No registra.'],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'money', 'value' => 0.0],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
            ['type' => 'text', 'value' => ''],
        ];
    }

    /** @param array{type: string, value: mixed} $cell */
    private function renderCell(array $cell, int $index): string
    {
        $value = $cell['value'];
        $nowrap = in_array($index, [2, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 34, 52], true)
          ? ' class="text-nowrap"'
          : '';

        return match ($cell['type']) {
            'money' => '<td'.$nowrap.' style="mso-number-format:\'$#,##0.00\';">'.$this->formatMoney($value).'</td>',
            'percent' => '<td class="text-nowrap" style="mso-number-format:\'0%\';">'.$this->formatPercent($value).'</td>',
            'integer' => '<td>'.$this->formatInteger($value).'</td>',
            'date' => '<td>'.$this->formatDate($value).'</td>',
            'datetime' => '<td>'.$this->formatDateTime($value).'</td>',
            default => '<td'.($index === 3 ? ' style="mso-number-format:\'@\';"' : $nowrap).'>'.htmlspecialchars((string) ($value ?? ''), ENT_QUOTES, 'UTF-8').'</td>',
        };
    }

    private function formatMoney(mixed $value): string
    {
        $number = round((float) $value, 2);

        return number_format($number, 2, ',', '');
    }

    private function formatPercent(mixed $value): string
    {
        $number = round((float) $value, 2);

        return number_format($number, 2, ',', '');
    }

    private function formatInteger(mixed $value): string
    {
        return (string) (int) round((float) $value);
    }

    private function formatDate(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return $value->timezone('America/Bogota')->format('Y-m-d');
    }

    private function formatDateTime(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return $value->timezone('America/Bogota')->format('Y-m-d H:i:s');
    }

    private function formatCustomerDocument(Sale $sale): string
    {
        $document = trim((string) ($sale->serviceCustomer?->document ?? ''));

        if ($document === '') {
            return 'CC 222222222222';
        }

        if (preg_match('/^(CC|NIT|CE|TI|PA|RC)\s/i', $document)) {
            return $document;
        }

        return 'CC '.$document;
    }

    private function formatResponsible(?string $name, ?string $email): string
    {
        $name = trim((string) $name);
        $email = trim((string) $email);

        if ($name === '' && $email === '') {
            return '';
        }

        if ($email === '') {
            return $name;
        }

        return $name === '' ? $email : "{$name} ({$email})";
    }

    private function cxcStatus(Sale $sale, bool $isReturned, float $amountDue): string
    {
        if ($isReturned) {
            return 'Anulado';
        }

        if ($amountDue <= 0) {
            return 'Pago total';
        }

        if ($sale->credit_status === 'pending') {
            return 'Pendiente de cobro';
        }

        return 'Pendiente de cobro';
    }

    private function remissionStatus(Sale $sale, bool $isReturned, bool $isApartado): string
    {
        if ($isReturned) {
            return 'Anulado';
        }

        if ($isApartado) {
            return 'Apartado';
        }

        return 'Pendiente de facturar';
    }
}
