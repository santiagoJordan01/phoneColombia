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
use Symfony\Component\HttpFoundation\StreamedResponse;

class BySellerReportExporter
{
    private const COLOR_BRAND = 'FF1E3A5F';

    private const COLOR_BRAND_LIGHT = 'FFE8EEF4';

    private const COLOR_HEADER_TEXT = 'FFFFFFFF';

    private const COLOR_SECTION = 'FFF1F5F9';

    private const COLOR_ALT_ROW = 'FFF8FAFC';

    private const COLOR_BORDER = 'FFCBD5E1';

    /** @param array<string, mixed> $report */
    public function toPdf(array $report, string $dateLabel): StreamedResponse
    {
        $filename = 'informe_por_vendedor_'.$dateLabel.'.pdf';

        $pdf = Pdf::loadView('reports.by-seller-pdf', [
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
        $filename = 'informe_por_vendedor_'.$dateLabel.'.xlsx';
        $generatedAt = now()->timezone('America/Bogota');
        $periodLabel = $this->formatPeriodLabel($report, $dateLabel);
        $totals = $report['totals'] ?? [];
        /** @var list<array<string, mixed>> $sellers */
        $sellers = array_values(collect($report['sellers'] ?? [])->all());

        $spreadsheet = new Spreadsheet;
        $spreadsheet->getDefaultStyle()->getFont()->setName('Calibri')->setSize(11);

        $this->buildSummarySheet(
            $spreadsheet->getActiveSheet(),
            $periodLabel,
            $generatedAt,
            $totals,
            $sellers,
        );

        $detailSheet = $spreadsheet->createSheet();
        $this->buildDetailSheet($detailSheet, $sellers, $periodLabel);

        $spreadsheet->setActiveSheetIndex(0);

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
            $spreadsheet->disconnectWorksheets();
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /**
     * @param array<string, mixed> $totals
     * @param list<array<string, mixed>> $sellers
     */
    private function buildSummarySheet(
        Worksheet $sheet,
        string $periodLabel,
        \DateTimeInterface $generatedAt,
        array $totals,
        array $sellers,
    ): void {
        $sheet->setTitle('Resumen');

        $sheet->setCellValue('A1', 'PHONE COLOMBIA');
        $sheet->setCellValue('A2', 'Informe por vendedor');
        $sheet->setCellValue('A3', 'Período: '.$periodLabel);
        $sheet->setCellValue('A4', 'Generado: '.$generatedAt->format('d/m/Y H:i').' (hora Colombia)');

        $sheet->mergeCells('A1:G1');
        $sheet->mergeCells('A2:G2');
        $sheet->mergeCells('A3:G3');
        $sheet->mergeCells('A4:G4');

        $sheet->getStyle('A1:G1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['argb' => self::COLOR_HEADER_TEXT]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_BRAND]],
        ]);
        $sheet->getStyle('A2:G2')->applyFromArray([
            'font' => ['bold' => true, 'size' => 12, 'color' => ['argb' => self::COLOR_HEADER_TEXT]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_BRAND]],
        ]);
        $sheet->getStyle('A3:G4')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF475569']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_BRAND_LIGHT]],
        ]);

        $sheet->setCellValue('A6', 'Totales del período');
        $sheet->mergeCells('A6:G6');
        $this->styleSectionTitle($sheet, 'A6:G6');

        $summaryRow = 7;
        $sheet->fromArray(
            ['Ventas', 'Recaudado', 'Pendiente', 'Ingresos', 'Costo', 'Utilidad'],
            null,
            'A'.$summaryRow,
        );
        $this->styleTableHeader($sheet, 'A'.$summaryRow.':F'.$summaryRow);
        $sheet->fromArray([
            (int) ($totals['count'] ?? 0),
            (float) ($totals['collected'] ?? 0),
            (float) ($totals['pending'] ?? 0),
            (float) ($totals['revenue'] ?? 0),
            (float) ($totals['cost'] ?? 0),
            (float) ($totals['profit'] ?? 0),
        ], null, 'A'.($summaryRow + 1));
        $this->styleDataRow($sheet, 'A'.($summaryRow + 1).':F'.($summaryRow + 1), false);
        foreach (['B', 'C', 'D', 'E', 'F'] as $col) {
            $sheet->getStyle($col.($summaryRow + 1))->getNumberFormat()->setFormatCode('"$"#,##0');
        }

        $sellerStart = $summaryRow + 3;
        $sheet->setCellValue('A'.$sellerStart, 'Resumen por vendedor');
        $sheet->mergeCells('A'.$sellerStart.':G'.$sellerStart);
        $this->styleSectionTitle($sheet, 'A'.$sellerStart.':G'.$sellerStart);

        $headerRow = $sellerStart + 1;
        $sheet->fromArray(
            ['Vendedor', 'Ventas', 'Recaudado', 'Pendiente', 'Ingresos', 'Costo', 'Utilidad'],
            null,
            'A'.$headerRow,
        );
        $this->styleTableHeader($sheet, 'A'.$headerRow.':G'.$headerRow);

        $row = $headerRow + 1;
        if ($sellers === []) {
            $sheet->setCellValue('A'.$row, 'Sin ventas por vendedor en este período.');
            $sheet->mergeCells('A'.$row.':G'.$row);
            $sheet->getStyle('A'.$row)->getFont()->setItalic(true)->getColor()->setARGB('FF64748B');
        } else {
            foreach ($sellers as $index => $group) {
                $sheet->fromArray([
                    $group['seller'] ?? 'Sin vendedor',
                    (int) ($group['count'] ?? 0),
                    (float) ($group['collected'] ?? 0),
                    (float) ($group['pending'] ?? 0),
                    (float) ($group['revenue'] ?? 0),
                    (float) ($group['cost'] ?? 0),
                    (float) ($group['profit'] ?? 0),
                ], null, 'A'.$row);
                $this->styleDataRow($sheet, 'A'.$row.':G'.$row, $index % 2 === 1);
                foreach (['C', 'D', 'E', 'F', 'G'] as $col) {
                    $sheet->getStyle($col.$row)->getNumberFormat()->setFormatCode('"$"#,##0');
                }
                $row++;
            }
        }

        foreach (range('A', 'G') as $col) {
            $sheet->getColumnDimension($col)->setWidth($col === 'A' ? 24 : 14);
        }
    }

    /**
     * @param list<array<string, mixed>> $sellers
     */
    private function buildDetailSheet(Worksheet $sheet, array $sellers, string $periodLabel): void
    {
        $sheet->setTitle('Detalle por vendedor');

        $sheet->setCellValue('A1', 'Detalle por vendedor — '.$periodLabel);
        $sheet->mergeCells('A1:H1');
        $this->styleSectionTitle($sheet, 'A1:H1');

        $row = 3;
        if ($sellers === []) {
            $sheet->setCellValue('A'.$row, 'Sin ventas registradas para este período.');
            $sheet->mergeCells('A'.$row.':H'.$row);

            return;
        }

        foreach ($sellers as $group) {
            $sellerName = $group['seller'] ?? 'Sin vendedor';
            $sheet->setCellValue('A'.$row, $sellerName);
            $sheet->mergeCells('A'.$row.':H'.$row);
            $this->styleSectionTitle($sheet, 'A'.$row.':H'.$row);
            $row++;

            $sheet->setCellValue('A'.$row, sprintf(
                '%d ventas · Recaudado $%s · Utilidad $%s',
                (int) ($group['count'] ?? 0),
                number_format((float) ($group['collected'] ?? 0), 0, ',', '.'),
                number_format((float) ($group['profit'] ?? 0), 0, ',', '.'),
            ));
            $sheet->mergeCells('A'.$row.':H'.$row);
            $row++;

            $headers = ['Fecha', 'Equipo', 'IMEI', 'Precio venta', 'Costo', 'Utilidad', 'Método', 'Cliente'];
            $sheet->fromArray($headers, null, 'A'.$row);
            $this->styleTableHeader($sheet, 'A'.$row.':H'.$row);
            $row++;

            $sales = array_values(collect($group['sales'] ?? [])->all());
            if ($sales === []) {
                $sheet->setCellValue('A'.$row, 'Sin ventas.');
                $sheet->mergeCells('A'.$row.':H'.$row);
                $row += 2;

                continue;
            }

            foreach ($sales as $index => $sale) {
                $soldAt = $sale['sold_at'] ?? null;
                $carbon = $soldAt
                    ? \Carbon\Carbon::parse($soldAt)->timezone('America/Bogota')
                    : null;

                $sheet->setCellValue('A'.$row, $carbon ? Date::PHPToExcel($carbon) : null);
                $sheet->setCellValue('B'.$row, $sale['item'] ?? '—');
                $sheet->setCellValue('C'.$row, $sale['imei'] ?? '—');
                $sheet->setCellValue('D'.$row, (float) ($sale['sale_price_num'] ?? 0));
                $sheet->setCellValue('E'.$row, (float) ($sale['purchase_price_num'] ?? 0));
                $sheet->setCellValue('F'.$row, (float) ($sale['net_profit'] ?? 0));
                $sheet->setCellValue('G'.$row, $sale['payment_method'] ?? '—');
                $sheet->setCellValue('H'.$row, $sale['customer'] ?? '—');

                $this->styleDataRow($sheet, 'A'.$row.':H'.$row, $index % 2 === 1);
                $sheet->getStyle('A'.$row)->getNumberFormat()->setFormatCode('dd/mm/yyyy hh:mm');
                foreach (['D', 'E', 'F'] as $col) {
                    $sheet->getStyle($col.$row)->getNumberFormat()->setFormatCode('"$"#,##0');
                }
                $row++;
            }

            $row++;
        }

        $widths = ['A' => 16, 'B' => 26, 'C' => 18, 'D' => 14, 'E' => 12, 'F' => 12, 'G' => 12, 'H' => 20];
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
