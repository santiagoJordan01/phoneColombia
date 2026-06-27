<?php

namespace App\Services;

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DailySalesReportExporter
{
    private const COLOR_BRAND = 'FF1E3A5F';

    private const COLOR_BRAND_LIGHT = 'FFE8EEF4';

    private const COLOR_HEADER_TEXT = 'FFFFFFFF';

    private const COLOR_SECTION = 'FFF1F5F9';

    private const COLOR_ALT_ROW = 'FFF8FAFC';

    private const COLOR_BORDER = 'FFCBD5E1';

    private const PAYMENT_LABELS = [
        'efectivo' => 'Efectivo',
        'transferencia' => 'Transferencia',
        'credito' => 'Crédito',
        'mixto' => 'Mixto',
    ];

    /** @param array<string, mixed> $report */
    public function toPdf(array $report, string $dateLabel): StreamedResponse
    {
        $filename = 'informe_ventas_'.$dateLabel.'.pdf';

        $pdf = Pdf::loadView('reports.daily-sales-pdf', [
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
        $filename = 'informe_ventas_'.$dateLabel.'.xlsx';
        $generatedAt = now()->timezone('America/Bogota');
        $periodLabel = $this->formatPeriodLabel($report, $dateLabel);
        $totals = $report['totals'] ?? [];
        /** @var Collection<int, array<string, mixed>> $sales */
        $sales = collect($report['sales'] ?? []);

        $spreadsheet = new Spreadsheet;
        $spreadsheet->getDefaultStyle()->getFont()->setName('Calibri')->setSize(11);

        $this->buildSummarySheet(
            $spreadsheet->getActiveSheet(),
            $periodLabel,
            $generatedAt,
            $totals,
        );

        $detailSheet = $spreadsheet->createSheet();
        $this->buildDetailSheet($detailSheet, $sales, $periodLabel);

        $spreadsheet->setActiveSheetIndex(0);

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
            $spreadsheet->disconnectWorksheets();
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /** @param array<string, mixed> $totals */
    private function buildSummarySheet(
        Worksheet $sheet,
        string $periodLabel,
        \DateTimeInterface $generatedAt,
        array $totals,
    ): void {
        $sheet->setTitle('Resumen');

        $count = (int) ($totals['count'] ?? 0);
        $collected = (float) ($totals['collected'] ?? 0);
        $pending = (float) ($totals['pending'] ?? 0);
        $avgTicket = $count > 0 ? $collected / $count : 0;

        $sheet->setCellValue('A1', 'PHONE COLOMBIA');
        $sheet->setCellValue('A2', 'Informe de ventas');
        $sheet->setCellValue('A3', 'Período: '.$periodLabel);
        $sheet->setCellValue('A4', 'Generado: '.$generatedAt->format('d/m/Y H:i').' (hora Colombia)');

        $sheet->mergeCells('A1:D1');
        $sheet->mergeCells('A2:D2');
        $sheet->mergeCells('A3:D3');
        $sheet->mergeCells('A4:D4');

        $sheet->getStyle('A1:D1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['argb' => self::COLOR_HEADER_TEXT]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_BRAND]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->getStyle('A2:D2')->applyFromArray([
            'font' => ['bold' => true, 'size' => 12, 'color' => ['argb' => self::COLOR_HEADER_TEXT]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_BRAND]],
        ]);
        $sheet->getStyle('A3:D4')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF475569']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_BRAND_LIGHT]],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(28);

        $sheet->setCellValue('A6', 'Indicadores del período');
        $sheet->mergeCells('A6:D6');
        $this->styleSectionTitle($sheet, 'A6:D6');

        $kpis = [
            ['Total ventas', $count, NumberFormat::FORMAT_NUMBER],
            ['Recaudado', $collected, '"$"#,##0'],
            ['Pendiente (crédito)', $pending, '"$"#,##0'],
            ['Ticket promedio', $avgTicket, '"$"#,##0'],
        ];

        $col = 'A';
        foreach ($kpis as [$label, $value, $format]) {
            $sheet->setCellValue($col.'7', $label);
            $sheet->setCellValue($col.'8', $value);
            $sheet->getStyle($col.'7')->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF64748B']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_SECTION]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
            $sheet->getStyle($col.'8')->applyFromArray([
                'font' => ['bold' => true, 'size' => 14, 'color' => ['argb' => self::COLOR_BRAND]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
                'borders' => ['outline' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => self::COLOR_BORDER]]],
            ]);
            $sheet->getStyle($col.'8')->getNumberFormat()->setFormatCode($format);
            $sheet->getColumnDimension($col)->setWidth(22);
            $col++;
        }

        $byMethod = $totals['by_method'] ?? [];
        $methodStart = 10;
        $sheet->setCellValue('A'.$methodStart, 'Recaudo por método de pago');
        $sheet->mergeCells('A'.$methodStart.':D'.$methodStart);
        $this->styleSectionTitle($sheet, 'A'.$methodStart.':D'.$methodStart);

        $headerRow = $methodStart + 1;
        $sheet->fromArray(['Método', 'Recaudado', '% del total'], null, 'A'.$headerRow);
        $this->styleTableHeader($sheet, 'A'.$headerRow.':C'.$headerRow);

        $row = $headerRow + 1;
        if (is_array($byMethod) && $byMethod !== []) {
            $methodTotal = array_sum($byMethod);
            foreach ($byMethod as $method => $amount) {
                $amount = (float) $amount;
                $pct = $methodTotal > 0 ? ($amount / $methodTotal) * 100 : 0;
                $sheet->fromArray([
                    $this->paymentLabel((string) $method),
                    $amount,
                    $pct / 100,
                ], null, 'A'.$row);
                $this->styleDataRow($sheet, 'A'.$row.':C'.$row, ($row - $headerRow) % 2 === 0);
                $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0');
                $sheet->getStyle('C'.$row)->getNumberFormat()->setFormatCode('0.0%');
                $row++;
            }

            $sheet->fromArray(['Total', $methodTotal, 1], null, 'A'.$row);
            $this->styleTableHeader($sheet, 'A'.$row.':C'.$row);
            $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0');
            $sheet->getStyle('C'.$row)->getNumberFormat()->setFormatCode('0.0%');
        } else {
            $sheet->setCellValue('A'.$row, 'Sin movimientos por método de pago en este período.');
            $sheet->mergeCells('A'.$row.':C'.$row);
            $sheet->getStyle('A'.$row)->getFont()->setItalic(true)->getColor()->setARGB('FF64748B');
        }

        $sheet->getColumnDimension('B')->setWidth(18);
        $sheet->getColumnDimension('C')->setWidth(14);
        $sheet->getColumnDimension('D')->setWidth(14);
    }

    /** @param Collection<int, array<string, mixed>> $sales */
    private function buildDetailSheet(Worksheet $sheet, Collection $sales, string $periodLabel): void
    {
        $sheet->setTitle('Detalle ventas');

        $headers = [
            'Fecha',
            'Hora',
            'Equipo',
            'IMEI',
            'Cliente',
            'Vendedor',
            'Precio venta',
            'Pagado',
            'Pendiente',
            'Método pago',
        ];

        $sheet->setCellValue('A1', 'Detalle de ventas — '.$periodLabel);
        $sheet->mergeCells('A1:J1');
        $this->styleSectionTitle($sheet, 'A1:J1');

        $headerRow = 3;
        $sheet->fromArray($headers, null, 'A'.$headerRow);
        $this->styleTableHeader($sheet, 'A'.$headerRow.':J'.$headerRow);

        $dataStart = $headerRow + 1;
        $row = $dataStart;

        if ($sales->isEmpty()) {
            $sheet->setCellValue('A'.$row, 'Sin ventas registradas para este período.');
            $sheet->mergeCells('A'.$row.':J'.$row);
            $sheet->getStyle('A'.$row)->getFont()->setItalic(true)->getColor()->setARGB('FF64748B');
        } else {
            foreach ($sales as $sale) {
                $soldAt = $sale['sold_at'] ?? null;
                $carbon = $soldAt
                    ? \Carbon\Carbon::parse($soldAt)->timezone('America/Bogota')
                    : null;

                $sheet->setCellValue('A'.$row, $carbon ? Date::PHPToExcel($carbon) : null);
                $sheet->setCellValue('B'.$row, $carbon ? Date::PHPToExcel($carbon) : null);
                $sheet->setCellValue('C'.$row, $sale['item'] ?? '—');
                $sheet->setCellValue('D'.$row, $sale['imei'] ?? '—');
                $sheet->setCellValue('E'.$row, $sale['customer'] ?? '—');
                $sheet->setCellValue('F'.$row, $sale['seller'] ?? '—');
                $sheet->setCellValue('G'.$row, $this->parseMoney($sale['sale_price'] ?? 0));
                $sheet->setCellValue('H'.$row, (float) ($sale['amount_paid'] ?? 0));
                $sheet->setCellValue('I'.$row, (float) ($sale['amount_due'] ?? 0));
                $sheet->setCellValue('J'.$row, $this->paymentLabel((string) ($sale['payment_method'] ?? '')));

                $this->styleDataRow($sheet, 'A'.$row.':J'.$row, ($row - $dataStart) % 2 === 1);
                $sheet->getStyle('A'.$row)->getNumberFormat()->setFormatCode('dd/mm/yyyy');
                $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('hh:mm');
                foreach (['G', 'H', 'I'] as $col) {
                    $sheet->getStyle($col.$row)->getNumberFormat()->setFormatCode('"$"#,##0');
                }

                $row++;
            }

            $totalsRow = $row + 1;
            $lastDataRow = $row - 1;
            $sheet->setCellValue('F'.$totalsRow, 'TOTALES');
            $sheet->setCellValue('G'.$totalsRow, "=SUM(G{$dataStart}:G{$lastDataRow})");
            $sheet->setCellValue('H'.$totalsRow, "=SUM(H{$dataStart}:H{$lastDataRow})");
            $sheet->setCellValue('I'.$totalsRow, "=SUM(I{$dataStart}:I{$lastDataRow})");
            $this->styleTableHeader($sheet, 'F'.$totalsRow.':I'.$totalsRow);
            foreach (['G', 'H', 'I'] as $col) {
                $sheet->getStyle($col.$totalsRow)->getNumberFormat()->setFormatCode('"$"#,##0');
            }

            $sheet->setAutoFilter('A'.$headerRow.':J'.$lastDataRow);
            $sheet->freezePane('A'.$dataStart);
        }

        $widths = ['A' => 12, 'B' => 8, 'C' => 28, 'D' => 18, 'E' => 22, 'F' => 18, 'G' => 14, 'H' => 14, 'I' => 14, 'J' => 14];
        foreach ($widths as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }
    }

    private function styleSectionTitle(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => self::COLOR_BRAND]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_SECTION]],
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
        if ($method === '') {
            return '—';
        }

        return self::PAYMENT_LABELS[$method] ?? ucfirst($method);
    }

    private function parseMoney(mixed $value): float
    {
        if (is_string($value)) {
            return (float) preg_replace('/[^\d.]/', '', $value);
        }

        return (float) $value;
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
