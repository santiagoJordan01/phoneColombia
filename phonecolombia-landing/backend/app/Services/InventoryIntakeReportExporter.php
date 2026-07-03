<?php

namespace App\Services;

use Barryvdh\DomPDF\Facade\Pdf;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class InventoryIntakeReportExporter
{
    private const COLOR_BRAND = 'FF1E3A5F';

    private const COLOR_HEADER_TEXT = 'FFFFFFFF';

    private const COLOR_ALT_ROW = 'FFF8FAFC';

    /** @param array<string, mixed> $report */
    public function toPdf(array $report, string $dateLabel): StreamedResponse
    {
        $filename = 'ingresos_inventario_'.$dateLabel.'.pdf';

        $pdf = Pdf::loadView('reports.inventory-intake-pdf', [
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
        $filename = 'ingresos_inventario_'.$dateLabel.'.xlsx';
        $periodLabel = $this->formatPeriodLabel($report, $dateLabel);
        $generatedAt = now()->timezone('America/Bogota');

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
    private function formatPeriodLabel(array $report, string $fallback): string
    {
        $from = $report['period_from'] ?? null;
        $to = $report['period_to'] ?? null;
        if ($from && $to) {
            return $from === $to ? $from : $from.' — '.$to;
        }

        return $fallback;
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
        $sheet->setCellValue('A2', 'Informe de ingresos al inventario');
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

        $summary = [
            ['Equipos ingresados', (int) ($totals['count'] ?? 0)],
            ['Costo total compra', (float) ($totals['purchase_total'] ?? 0)],
            ['Valor venta referencia', (float) ($totals['sale_value_total'] ?? 0)],
            ['Proveedores', (int) ($totals['supplier_count'] ?? 0)],
        ];

        $row = 6;
        $sheet->setCellValue('A'.$row, 'Indicadores');
        $sheet->mergeCells('A'.$row.':B'.$row);
        $this->styleSectionTitle($sheet, 'A'.$row.':B'.$row);
        $row++;
        $sheet->fromArray(['Indicador', 'Valor'], null, 'A'.$row);
        $this->styleTableHeader($sheet, 'A'.$row.':B'.$row);
        $row++;

        foreach ($summary as $index => [$label, $value]) {
            $sheet->setCellValue('A'.$row, $label);
            $sheet->setCellValue('B'.$row, $value);
            if (! is_int($value)) {
                $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
            }
            $this->styleDataRow($sheet, 'A'.$row.':B'.$row, $index % 2 === 1);
            $row++;
        }

        $groups = array_values(collect($report['by_supplier'] ?? [])->all());
        if ($groups !== []) {
            $row += 2;
            $sheet->setCellValue('A'.$row, 'Por proveedor');
            $sheet->mergeCells('A'.$row.':D'.$row);
            $this->styleSectionTitle($sheet, 'A'.$row.':D'.$row);
            $row++;
            $sheet->fromArray(['Proveedor', 'Cantidad', 'Costo compra', 'Valor venta'], null, 'A'.$row);
            $this->styleTableHeader($sheet, 'A'.$row.':D'.$row);
            $row++;
            foreach ($groups as $index => $group) {
                $sheet->setCellValue('A'.$row, $group['supplier_name'] ?? '—');
                $sheet->setCellValue('B'.$row, (int) ($group['count'] ?? 0));
                $sheet->setCellValue('C'.$row, (float) ($group['purchase_total'] ?? 0));
                $sheet->setCellValue('D'.$row, (float) ($group['sale_value_total'] ?? 0));
                $this->styleDataRow($sheet, 'A'.$row.':D'.$row, $index % 2 === 1);
                foreach (['C', 'D'] as $col) {
                    $sheet->getStyle($col.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
                }
                $row++;
            }
        }

        $sheet->getColumnDimension('A')->setWidth(28);
        $sheet->getColumnDimension('B')->setWidth(14);
        $sheet->getColumnDimension('C')->setWidth(16);
        $sheet->getColumnDimension('D')->setWidth(16);
    }

    /** @param array<string, mixed> $report */
    private function buildDetailSheet(Worksheet $sheet, array $report, string $periodLabel): void
    {
        $sheet->setTitle('Detalle ingresos');

        $sheet->setCellValue('A1', 'Detalle de ingresos — '.$periodLabel);
        $sheet->mergeCells('A1:K1');
        $this->styleSectionTitle($sheet, 'A1:K1');

        $headers = ['Fecha ingreso', 'Equipo', 'IMEI', 'Código', 'Color', 'Proveedor', 'Costo', 'Precio venta', 'Batería', 'Estado', 'Notas'];
        $sheet->fromArray($headers, null, 'A3');
        $this->styleTableHeader($sheet, 'A3:K3');

        $items = array_values(collect($report['items'] ?? [])->all());
        $row = 4;

        if ($items === []) {
            $sheet->setCellValue('A'.$row, 'No hay equipos ingresados en este período con los filtros aplicados.');
            $sheet->mergeCells('A'.$row.':K'.$row);

            return;
        }

        foreach ($items as $index => $item) {
            $acquiredAt = $item['acquired_at'] ?? null;
            $dateLabel = $acquiredAt
                ? \Carbon\Carbon::parse($acquiredAt)->timezone('America/Bogota')->format('d/m/Y')
                : '—';

            $sheet->setCellValue('A'.$row, $dateLabel);
            $sheet->setCellValue('B'.$row, $item['name'] ?? '—');
            $sheet->setCellValue('C'.$row, $item['imei'] ?? '—');
            $sheet->setCellValue('D'.$row, $item['barcode'] ?? '—');
            $sheet->setCellValue('E'.$row, $item['color'] ?? '—');
            $sheet->setCellValue('F'.$row, $item['supplier'] ?? '—');
            $sheet->setCellValue('G'.$row, (float) ($item['purchase_price'] ?? 0));
            $sheet->setCellValue('H'.$row, (float) ($item['sale_price'] ?? 0));
            $sheet->setCellValue('I'.$row, $item['battery'] ?? '—');
            $sheet->setCellValue('J'.$row, $item['status_label'] ?? ($item['status'] ?? '—'));
            $sheet->setCellValue('K'.$row, $item['notes'] ?? '—');

            $this->styleDataRow($sheet, 'A'.$row.':K'.$row, $index % 2 === 1);
            foreach (['G', 'H'] as $col) {
                $sheet->getStyle($col.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
            }
            $row++;
        }

        foreach (['A' => 14, 'B' => 24, 'C' => 16, 'D' => 14, 'E' => 12, 'F' => 18, 'G' => 12, 'H' => 12, 'I' => 10, 'J' => 14, 'K' => 24] as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }
    }

    private function styleSectionTitle(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => self::COLOR_HEADER_TEXT]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF475569']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT],
        ]);
    }

    private function styleTableHeader(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => ['bold' => true, 'color' => ['argb' => self::COLOR_HEADER_TEXT]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_BRAND]],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFCBD5E1']]],
        ]);
    }

    private function styleDataRow(Worksheet $sheet, string $range, bool $alt): void
    {
        $style = [
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE2E8F0']]],
        ];
        if ($alt) {
            $style['fill'] = ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_ALT_ROW]];
        }
        $sheet->getStyle($range)->applyFromArray($style);
    }
}
