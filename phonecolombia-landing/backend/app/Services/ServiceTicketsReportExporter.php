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

class ServiceTicketsReportExporter
{
    private const COLOR_BRAND = 'FF1E3A5F';

    private const COLOR_HEADER_TEXT = 'FFFFFFFF';

    private const COLOR_ALT_ROW = 'FFF8FAFC';

    /** @param array<string, mixed> $report */
    public function toPdf(array $report, string $dateLabel): StreamedResponse
    {
        $filename = 'servicio_tecnico_'.$dateLabel.'.pdf';

        $pdf = Pdf::loadView('reports.service-tickets-pdf', [
            'report' => $report,
            'dateLabel' => $dateLabel,
            'periodLabel' => $this->formatPeriodLabel($report, $dateLabel),
            'generatedAt' => now()->timezone('America/Bogota')->format('d/m/Y H:i'),
        ])->setPaper('letter', 'landscape');

        return response()->streamDownload(
            fn () => print ($pdf->output()),
            $filename,
            ['Content-Type' => 'application/pdf'],
        );
    }

    /** @param array<string, mixed> $report */
    public function toExcel(array $report, string $dateLabel): StreamedResponse
    {
        $filename = 'servicio_tecnico_'.$dateLabel.'.xlsx';
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
        $sheet->setCellValue('A2', 'Informe de servicio técnico');
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
            ['Tickets', (int) ($totals['count'] ?? 0)],
            ['Abiertos', (int) ($totals['open_count'] ?? 0)],
            ['Cerrados', (int) ($totals['closed_count'] ?? 0)],
            ['Costo reparación', (float) ($totals['repair_cost'] ?? 0)],
            ['Precio al cliente', (float) ($totals['customer_price'] ?? 0)],
            ['Margen', (float) ($totals['margin'] ?? 0)],
            ['Margen %', ($totals['margin_percent'] ?? null) !== null ? ($totals['margin_percent'].'%') : '—'],
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
            if (! is_int($value) && ! is_string($value)) {
                $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
            }
            $this->styleDataRow($sheet, 'A'.$row.':B'.$row, $index % 2 === 1);
            $row++;
        }

        $sheet->getColumnDimension('A')->setWidth(24);
        $sheet->getColumnDimension('B')->setWidth(18);
    }

    /** @param array<string, mixed> $report */
    private function buildDetailSheet(Worksheet $sheet, array $report, string $periodLabel): void
    {
        $sheet->setTitle('Detalle tickets');

        $sheet->setCellValue('A1', 'Detalle de tickets — '.$periodLabel);
        $sheet->mergeCells('A1:N1');
        $this->styleSectionTitle($sheet, 'A1:N1');

        $headers = ['Recibido', 'Equipo', 'Referencia', 'Tipo', 'Cliente', 'Estado', 'Técnico', 'Taller', 'Costo', 'Precio cliente', 'Margen', 'Entregado', 'Garantía', 'Falla'];
        $sheet->fromArray($headers, null, 'A3');
        $this->styleTableHeader($sheet, 'A3:N3');

        $tickets = array_values(collect($report['tickets'] ?? [])->all());
        $row = 4;

        if ($tickets === []) {
            $sheet->setCellValue('A'.$row, 'No hay tickets en este período con los filtros aplicados.');
            $sheet->mergeCells('A'.$row.':N'.$row);

            return;
        }

        foreach ($tickets as $index => $ticket) {
            $receivedAt = $ticket['received_at'] ?? null;
            $deliveredAt = $ticket['delivered_at'] ?? null;
            $receivedLabel = $receivedAt
                ? \Carbon\Carbon::parse($receivedAt)->timezone('America/Bogota')->format('d/m/Y H:i')
                : '—';
            $deliveredLabel = $deliveredAt
                ? \Carbon\Carbon::parse($deliveredAt)->timezone('America/Bogota')->format('d/m/Y H:i')
                : '—';

            $sheet->setCellValue('A'.$row, $receivedLabel);
            $sheet->setCellValue('B'.$row, $ticket['display_name'] ?? '—');
            $sheet->setCellValue('C'.$row, $ticket['device_reference'] ?? ($ticket['imei'] ?? '—'));
            $sheet->setCellValue('D'.$row, $ticket['ticket_type_label'] ?? ($ticket['ticket_type'] ?? '—'));
            $sheet->setCellValue('E'.$row, $ticket['customer_name'] ?? '—');
            $sheet->setCellValue('F'.$row, $ticket['status_label'] ?? ($ticket['status'] ?? '—'));
            $sheet->setCellValue('G'.$row, $ticket['technician'] ?? '—');
            $sheet->setCellValue('H'.$row, $ticket['workshop'] ?? '—');
            $sheet->setCellValue('I'.$row, (float) ($ticket['repair_cost'] ?? 0));
            $sheet->setCellValue('J'.$row, (float) ($ticket['customer_price'] ?? 0));
            $sheet->setCellValue('K'.$row, (float) ($ticket['margin'] ?? 0));
            $sheet->setCellValue('L'.$row, $deliveredLabel);
            $sheet->setCellValue('M'.$row, ($ticket['is_warranty'] ?? false) ? 'Sí' : 'No');
            $sheet->setCellValue('N'.$row, $ticket['issue_description'] ?? '—');

            $this->styleDataRow($sheet, 'A'.$row.':N'.$row, $index % 2 === 1);
            foreach (['I', 'J', 'K'] as $col) {
                $sheet->getStyle($col.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
            }
            $row++;
        }

        foreach (['A' => 16, 'B' => 22, 'C' => 14, 'D' => 14, 'E' => 16, 'F' => 16, 'G' => 14, 'H' => 12, 'I' => 12, 'J' => 12, 'K' => 12, 'L' => 16, 'M' => 10, 'N' => 28] as $col => $width) {
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
