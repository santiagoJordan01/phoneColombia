<?php

namespace App\Services;

use Barryvdh\DomPDF\Facade\Pdf;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use App\Support\PaymentMethods;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CashRegisterReportExporter
{
    private const COLOR_BRAND = 'FF1E3A5F';

    private const COLOR_HEADER_TEXT = 'FFFFFFFF';

    private const COLOR_ALT_ROW = 'FFF8FAFC';

    private const COLOR_BORDER = 'FFCBD5E1';

    private const COLLECTION_LABELS = [
        'venta' => 'Cobro venta',
        'apartado' => 'Abono apartado',
        'abono' => 'Abono crédito',
        'retoma' => 'Pago retoma',
        'otro' => 'Cobro',
    ];

    /** @param array<string, mixed> $report */
    public function toPdf(array $report, string $dateLabel): StreamedResponse
    {
        $filename = 'libro_caja_'.$dateLabel.'.pdf';

        $pdf = Pdf::loadView('reports.cash-register-pdf', [
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
    public function toExcel(array $report, string $dateLabel): StreamedResponse
    {
        $filename = 'libro_caja_'.$dateLabel.'.xlsx';
        $generatedAt = now()->timezone('America/Bogota');
        $periodLabel = $this->formatPeriodLabel($report, $dateLabel);

        $spreadsheet = new Spreadsheet;
        $spreadsheet->getDefaultStyle()->getFont()->setName('Calibri')->setSize(11);

        $this->buildSummarySheet($spreadsheet->getActiveSheet(), $report, $periodLabel, $generatedAt);

        $ledgerSheet = $spreadsheet->createSheet();
        $this->buildLedgerSheet($ledgerSheet, $report, $periodLabel);

        $spreadsheet->setActiveSheetIndex(0);

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
            $spreadsheet->disconnectWorksheets();
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /** @param array<string, mixed> $report */
    private function buildSummarySheet(
        Worksheet $sheet,
        array $report,
        string $periodLabel,
        \DateTimeInterface $generatedAt,
    ): void {
        $sheet->setTitle('Resumen');

        $sheet->setCellValue('A1', 'PHONE COLOMBIA');
        $sheet->setCellValue('A2', 'Libro de caja');
        $sheet->setCellValue('A3', 'Período: '.$periodLabel);
        $sheet->setCellValue('A4', 'Generado: '.$generatedAt->format('d/m/Y H:i').' (hora Colombia)');

        $sheet->mergeCells('A1:F1');
        $sheet->mergeCells('A2:F2');
        $sheet->mergeCells('A3:F3');
        $sheet->mergeCells('A4:F4');

        $sheet->getStyle('A1:F1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['argb' => self::COLOR_HEADER_TEXT]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_BRAND]],
        ]);
        $sheet->getStyle('A2:F4')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF475569']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFE8EEF4']],
        ]);

        $summary = [
            ['Ventas del período', (int) ($report['sales_count'] ?? 0)],
            ['Ingresos (ventas)', (float) ($report['total_expected'] ?? 0)],
            ['Cobrado en período', (float) ($report['cash_collected_in_period'] ?? $report['total_collected'] ?? 0)],
            ['Pendiente (ventas)', (float) ($report['pending_credits'] ?? 0)],
            ['Conciliación ventas', (float) ($report['difference'] ?? 0)],
            ['Cobros ventas del período', (float) ($report['collections_on_period_sales'] ?? 0)],
            ['Apartados y abonos previos', (float) ($report['collections_on_other_sales'] ?? 0)],
            ['Costo total', (float) ($report['total_cost'] ?? 0)],
            ['Utilidad bruta', (float) ($report['total_profit'] ?? 0)],
            ['Margen', ($report['margin_percent'] ?? null) !== null ? ($report['margin_percent'].'%') : '—'],
        ];
        if (($report['retake_outflows'] ?? 0) > 0) {
            $summary[] = ['Pagos retoma', -1 * abs((float) $report['retake_outflows'])];
        }

        $row = 6;
        $sheet->setCellValue('A'.$row, 'Indicadores del cuadre');
        $sheet->mergeCells('A'.$row.':F'.$row);
        $this->styleSectionTitle($sheet, 'A'.$row.':F'.$row);
        $row++;

        $sheet->fromArray(['Indicador', 'Valor'], null, 'A'.$row);
        $this->styleTableHeader($sheet, 'A'.$row.':B'.$row);
        $row++;

        foreach ($summary as $index => [$label, $value]) {
            $sheet->setCellValue('A'.$row, $label);
            if (is_int($value)) {
                $sheet->setCellValue('B'.$row, $value);
            } elseif (is_string($value)) {
                $sheet->setCellValue('B'.$row, $value);
            } else {
                $sheet->setCellValue('B'.$row, $value);
                $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
            }
            $this->styleDataRow($sheet, 'A'.$row.':B'.$row, $index % 2 === 1);
            $row++;
        }

        $row += 1;
        $sheet->setCellValue('A'.$row, 'Neto del período por método');
        $sheet->mergeCells('A'.$row.':F'.$row);
        $this->styleSectionTitle($sheet, 'A'.$row.':F'.$row);
        $row++;

        $sheet->fromArray(['Método', 'Neto'], null, 'A'.$row);
        $this->styleTableHeader($sheet, 'A'.$row.':B'.$row);
        $row++;

        $byMethod = $report['by_payment_method'] ?? [];
        if ($byMethod === []) {
            $sheet->setCellValue('A'.$row, 'Sin movimientos por método.');
            $sheet->mergeCells('A'.$row.':B'.$row);
        } else {
            foreach ($byMethod as $method => $amount) {
                $sheet->setCellValue('A'.$row, $this->paymentLabel((string) $method));
                $sheet->setCellValue('B'.$row, (float) $amount);
                $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
                $this->styleDataRow($sheet, 'A'.$row.':B'.$row, false);
                $row++;
            }
        }

        if (! empty($report['methodology'])) {
            $row += 2;
            $sheet->setCellValue('A'.$row, 'Metodología: '.$report['methodology']);
            $sheet->mergeCells('A'.$row.':F'.$row);
            $sheet->getStyle('A'.$row)->getFont()->setItalic(true)->getColor()->setARGB('FF64748B');
        }

        $sheet->getColumnDimension('A')->setWidth(28);
        $sheet->getColumnDimension('B')->setWidth(18);
    }

    /** @param array<string, mixed> $report */
    private function buildLedgerSheet(Worksheet $sheet, array $report, string $periodLabel): void
    {
        $sheet->setTitle('Libro de caja');

        $sheet->setCellValue('A1', 'Libro de cobros y retomas — '.$periodLabel);
        $sheet->mergeCells('A1:I1');
        $this->styleSectionTitle($sheet, 'A1:I1');

        $headers = ['Fecha', 'Remisión', 'Tipo', 'Equipo', 'Cliente', 'Método', 'Monto', 'Vendedor', 'Notas'];
        $sheet->fromArray($headers, null, 'A3');
        $this->styleTableHeader($sheet, 'A3:I3');

        $ledger = array_values(collect($report['ledger'] ?? [])->all());
        $row = 4;

        if ($ledger === []) {
            $sheet->setCellValue('A'.$row, 'No hay movimientos de caja en este período.');
            $sheet->mergeCells('A'.$row.':I'.$row);

            return;
        }

        foreach ($ledger as $index => $line) {
            $paidAt = $line['paid_at'] ?? null;
            $carbon = $paidAt ? \Carbon\Carbon::parse($paidAt)->timezone('America/Bogota') : null;

            $sheet->setCellValue('A'.$row, $carbon ? Date::PHPToExcel($carbon) : null);
            $sheet->setCellValue('B'.$row, $line['remission_number'] ?? '—');
            $sheet->setCellValue('C'.$row, $line['type_label'] ?? $this->collectionLabel((string) ($line['type'] ?? '')));
            $sheet->setCellValue('D'.$row, $line['item'] ?? '—');
            $sheet->setCellValue('E'.$row, $line['customer'] ?? '—');
            $sheet->setCellValue('F'.$row, $this->paymentLabel((string) ($line['method'] ?? '')));
            $sheet->setCellValue('G'.$row, (float) ($line['amount'] ?? 0));
            $sheet->setCellValue('H'.$row, $line['seller'] ?? '—');
            $sheet->setCellValue('I'.$row, $line['notes'] ?? '—');

            $this->styleDataRow($sheet, 'A'.$row.':I'.$row, $index % 2 === 1);
            $sheet->getStyle('A'.$row)->getNumberFormat()->setFormatCode('dd/mm/yyyy hh:mm');
            $sheet->getStyle('G'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
            $row++;
        }

        $widths = ['A' => 16, 'B' => 14, 'C' => 14, 'D' => 22, 'E' => 18, 'F' => 12, 'G' => 12, 'H' => 14, 'I' => 20];
        foreach ($widths as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }
    }

    private function styleSectionTitle(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => self::COLOR_BRAND]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF1F5F9']],
            'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
        ]);
    }

    private function styleTableHeader(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => self::COLOR_HEADER_TEXT]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_BRAND]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => self::COLOR_BORDER]]],
        ]);
    }

    private function styleDataRow(Worksheet $sheet, string $range, bool $alternate): void
    {
        $style = [
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => self::COLOR_BORDER]]],
            'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
        ];
        if ($alternate) {
            $style['fill'] = ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_ALT_ROW]];
        }
        $sheet->getStyle($range)->applyFromArray($style);
    }

    private function paymentLabel(string $method): string
    {
        return PaymentMethods::label($method !== '' ? $method : '—');
    }

    private function collectionLabel(string $type): string
    {
        return self::COLLECTION_LABELS[$type] ?? ($type !== '' ? $type : '—');
    }

    /** @param array<string, mixed> $report */
    private function formatPeriodLabel(array $report, string $fallback): string
    {
        $from = $report['period_from'] ?? null;
        $to = $report['period_to'] ?? null;

        if ($from && $to && $from !== $to) {
            return $from.' — '.$to;
        }

        if ($to) {
            return $to;
        }

        return str_replace('_', ' — ', $fallback);
    }
}
