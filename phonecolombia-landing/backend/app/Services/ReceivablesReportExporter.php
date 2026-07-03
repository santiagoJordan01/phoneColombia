<?php

namespace App\Services;

use Barryvdh\DomPDF\Facade\Pdf;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReceivablesReportExporter
{
    private const COLOR_BRAND = 'FF1E3A5F';

    private const COLOR_HEADER_TEXT = 'FFFFFFFF';

    private const COLOR_ALT_ROW = 'FFF8FAFC';

    private const COLOR_BORDER = 'FFCBD5E1';

    /** @param array<string, mixed> $report */
    public function toPdf(array $report, string $dateLabel): StreamedResponse
    {
        $filename = 'cartera_'.$dateLabel.'.pdf';

        $pdf = Pdf::loadView('reports.receivables-pdf', [
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
        $filename = 'cartera_'.$dateLabel.'.xlsx';
        $generatedAt = now()->timezone('America/Bogota');
        $periodLabel = $this->formatPeriodLabel($report, $dateLabel);

        $spreadsheet = new Spreadsheet;
        $spreadsheet->getDefaultStyle()->getFont()->setName('Calibri')->setSize(11);

        $this->buildSummarySheet($spreadsheet->getActiveSheet(), $report, $periodLabel, $generatedAt);

        $detailSheet = $spreadsheet->createSheet();
        $this->buildDetailSheet($detailSheet, $report, $periodLabel);

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
        $totals = $report['totals'] ?? [];

        $sheet->setCellValue('A1', 'PHONE COLOMBIA');
        $sheet->setCellValue('A2', 'Informe de cartera');
        $sheet->setCellValue('A3', 'Corte: '.$periodLabel);
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
            ['Cuentas con saldo', (int) ($totals['count'] ?? 0)],
            ['Pendiente total', (float) ($totals['total_due'] ?? 0)],
            ['Total pagado', (float) ($totals['total_paid'] ?? 0)],
            ['Apartados (cantidad)', (int) ($totals['apartados_count'] ?? 0)],
            ['Saldo apartados', (float) ($totals['apartados_due'] ?? 0)],
            ['Créditos (cantidad)', (int) ($totals['creditos_count'] ?? 0)],
            ['Saldo créditos', (float) ($totals['creditos_due'] ?? 0)],
            ['Vencidos (cantidad)', (int) ($totals['overdue_count'] ?? 0)],
            ['Saldo vencido', (float) ($totals['overdue_amount'] ?? 0)],
            ['Valor ventas', (float) ($totals['revenue'] ?? 0)],
            ['Costo total', (float) ($totals['total_cost'] ?? 0)],
            ['Utilidad bruta', (float) ($totals['total_profit'] ?? 0)],
            ['Margen', ($totals['margin_percent'] ?? null) !== null ? ($totals['margin_percent'].'%') : '—'],
        ];

        $row = 6;
        $sheet->setCellValue('A'.$row, 'Indicadores de cartera');
        $sheet->mergeCells('A'.$row.':F'.$row);
        $this->styleSectionTitle($sheet, 'A'.$row.':F'.$row);
        $row++;

        $sheet->fromArray(['Indicador', 'Valor'], null, 'A'.$row);
        $this->styleTableHeader($sheet, 'A'.$row.':B'.$row);
        $row++;

        foreach ($summary as $index => [$label, $value]) {
            $sheet->setCellValue('A'.$row, $label);
            $sheet->setCellValue('B'.$row, $value);
            if (! is_int($value) && ! is_string($value)) {
                $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
            }
            $this->styleDataRow($sheet, 'A'.$row.':B'.$row, $index % 2 === 1);
            $row++;
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
    private function buildDetailSheet(Worksheet $sheet, array $report, string $periodLabel): void
    {
        $sheet->setTitle('Detalle cartera');

        $sheet->setCellValue('A1', 'Detalle de cartera — '.$periodLabel);
        $sheet->mergeCells('A1:M1');
        $this->styleSectionTitle($sheet, 'A1:K1');

        $headers = ['Tipo', 'Remisión', 'Equipo', 'IMEI', 'Cliente', 'Teléfono', 'Total', 'Pagado', 'Pendiente', 'Vence', 'Vendedor', 'Financiera', 'Estado'];
        $sheet->fromArray($headers, null, 'A3');
        $this->styleTableHeader($sheet, 'A3:M3');

        $items = array_values(collect($report['items'] ?? [])->all());
        $row = 4;

        if ($items === []) {
            $sheet->setCellValue('A'.$row, 'No hay saldos pendientes por cobrar con los filtros aplicados.');
            $sheet->mergeCells('A'.$row.':M'.$row);

            return;
        }

        foreach ($items as $index => $item) {
            $dueAt = $item['due_at'] ?? null;
            $carbon = $dueAt ? \Carbon\Carbon::parse($dueAt)->timezone('America/Bogota') : null;
            $status = ($item['is_overdue'] ?? false)
                ? 'Vencido'.(($item['days_overdue'] ?? 0) > 0 ? ' ('.$item['days_overdue'].'d)' : '')
                : 'Al día';

            $sheet->setCellValue('A'.$row, $item['type_label'] ?? $item['type'] ?? '—');
            $sheet->setCellValue('B'.$row, $item['remission_number'] ?? '—');
            $sheet->setCellValue('C'.$row, $item['item'] ?? '—');
            $sheet->setCellValue('D'.$row, $item['imei'] ?? '—');
            $sheet->setCellValue('E'.$row, $item['customer'] ?? '—');
            $sheet->setCellValue('F'.$row, $item['customer_phone'] ?? '—');
            $sheet->setCellValue('G'.$row, (float) ($item['sale_price'] ?? 0));
            $sheet->setCellValue('H'.$row, (float) ($item['amount_paid'] ?? 0));
            $sheet->setCellValue('I'.$row, (float) ($item['amount_due'] ?? 0));
            $sheet->setCellValue('J'.$row, $carbon ? Date::PHPToExcel($carbon) : null);
            $sheet->setCellValue('K'.$row, $item['seller'] ?? '—');
            $sheet->setCellValue('L'.$row, $item['credit_payment_method'] ?? '—');
            $sheet->setCellValue('M'.$row, $status);

            $this->styleDataRow($sheet, 'A'.$row.':M'.$row, $index % 2 === 1);
            foreach (['G', 'H', 'I'] as $col) {
                $sheet->getStyle($col.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
            }
            $sheet->getStyle('J'.$row)->getNumberFormat()->setFormatCode('dd/mm/yyyy');
            $row++;
        }

        $widths = ['A' => 12, 'B' => 14, 'C' => 22, 'D' => 16, 'E' => 18, 'F' => 14, 'G' => 12, 'H' => 12, 'I' => 12, 'J' => 12, 'K' => 14, 'L' => 14, 'M' => 12];
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

    /** @param array<string, mixed> $report */
    private function formatPeriodLabel(array $report, string $fallback): string
    {
        $asOf = $report['as_of'] ?? null;
        if ($asOf) {
            return 'Al corte de '.\Carbon\Carbon::parse($asOf)->timezone('America/Bogota')->format('d/m/Y H:i');
        }

        return 'Al corte de '.$fallback;
    }
}
