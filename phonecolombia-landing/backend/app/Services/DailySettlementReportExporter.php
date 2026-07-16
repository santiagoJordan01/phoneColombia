<?php

namespace App\Services;

use App\Support\MoneyFormatter;
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

class DailySettlementReportExporter
{
    private const COLOR_BRAND = 'FF1E3A5F';

    private const COLOR_HEADER_TEXT = 'FFFFFFFF';

    private const COLOR_ALT_ROW = 'FFF8FAFC';

    private const COLOR_BORDER = 'FFCBD5E1';

    /** @param array<string, mixed> $report */
    public function toPdf(array $report, string $dateLabel): StreamedResponse
    {
        $filename = 'cuadre_caja_'.$dateLabel.'.pdf';

        $pdf = Pdf::loadView('reports.daily-settlement-pdf', [
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
        $filename = 'cuadre_caja_'.$dateLabel.'.xlsx';
        $generatedAt = now()->timezone('America/Bogota');
        $periodLabel = $this->formatPeriodLabel($report, $dateLabel);

        $spreadsheet = new Spreadsheet;
        $spreadsheet->getDefaultStyle()->getFont()->setName('Calibri')->setSize(11);

        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Cuadre del día');

        $sheet->setCellValue('A1', 'PHONE COLOMBIA');
        $sheet->setCellValue('A2', 'Cuadre de caja');
        $sheet->setCellValue('A3', 'Fecha: '.$periodLabel);
        $sheet->setCellValue('A4', 'Generado: '.$generatedAt->format('d/m/Y H:i').' (hora Colombia)');
        $sheet->mergeCells('A1:J1');
        $sheet->mergeCells('A2:J2');
        $sheet->mergeCells('A3:J3');
        $sheet->mergeCells('A4:J4');

        $sheet->getStyle('A1:J1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['argb' => self::COLOR_HEADER_TEXT]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_BRAND]],
        ]);
        $sheet->getStyle('A2:J4')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF475569']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFE8EEF4']],
        ]);

        $row = 6;
        $sheet->setCellValue('A'.$row, 'Ventas netas');
        $sheet->setCellValue('B'.$row, (float) ($report['ventas_netas'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $row++;
        $sheet->setCellValue('A'.$row, 'Costo total');
        $sheet->setCellValue('B'.$row, (float) ($report['total_costo'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $row++;
        $sheet->setCellValue('A'.$row, 'Utilidad bruta');
        $sheet->setCellValue('B'.$row, (float) ($report['utilidad_bruta'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $row += 2;

        $sheet->setCellValue('A'.$row, 'Formas de pago');
        $sheet->getStyle('A'.$row)->getFont()->setBold(true);
        $row++;

        foreach ($report['formas_de_pago'] ?? [] as $forma) {
            $sheet->setCellValue('A'.$row, $forma['label'] ?? '');
            $sheet->setCellValue('B'.$row, (float) ($forma['amount'] ?? 0));
            $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
            $row++;
        }

        $row++;
        $sheet->setCellValue('A'.$row, 'Total formas de pago');
        $sheet->setCellValue('B'.$row, (float) ($report['total_formas_pago'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $row++;
        $sheet->setCellValue('A'.$row, 'Total ingresos');
        $sheet->setCellValue('B'.$row, (float) ($report['total_ingresos'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $row++;
        $sheet->setCellValue('A'.$row, '  · Cobros (fecha de pago)');
        $sheet->setCellValue('B'.$row, (float) ($report['ingresos_cobros'] ?? $report['ingresos_venta'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $row++;
        $sheet->setCellValue('A'.$row, '  · Manuales');
        $sheet->setCellValue('B'.$row, (float) ($report['ingresos_manuales'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $row++;
        $sheet->setCellValue('A'.$row, 'Total egresos');
        $sheet->setCellValue('B'.$row, (float) ($report['total_egresos'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $row++;
        $sheet->setCellValue('A'.$row, '  · Retomas');
        $sheet->setCellValue('B'.$row, (float) ($report['egresos_retoma'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $row++;
        $sheet->setCellValue('A'.$row, '  · Manuales');
        $sheet->setCellValue('B'.$row, (float) ($report['egresos_manuales'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $row++;
        $sheet->setCellValue('A'.$row, 'Neto de caja');
        $sheet->setCellValue('B'.$row, (float) ($report['neto_caja'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $row++;
        $sheet->setCellValue('A'.$row, 'Cobrado acumulado (ventas del período)');
        $sheet->setCellValue('B'.$row, (float) ($report['cobrado_acumulado_ventas'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $row++;
        $sheet->setCellValue('A'.$row, 'Pendiente (ventas del período)');
        $sheet->setCellValue('B'.$row, (float) ($report['pendiente_ventas'] ?? $report['credito_del_dia'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $row++;
        $sheet->setCellValue('A'.$row, 'Diferencia ventas (precio − cobrado − pendiente)');
        $sheet->setCellValue('B'.$row, (float) ($report['diferencia'] ?? 0));
        $sheet->getStyle('B'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        $sheet->getStyle('A'.$row.':B'.$row)->getFont()->setBold(true);
        $row += 2;

        $sheet->setCellValue('A'.$row, 'Equipos vendidos ('.(int) ($report['equipos_count'] ?? 0).')');
        $sheet->getStyle('A'.$row)->getFont()->setBold(true);
        $row++;

        $headers = ['Origen', 'Equipo', 'IMEI', 'Proveedor', 'Costo', 'Valor', 'Utilidad', 'Ingreso', 'Pendiente', 'Responsable', 'Remisión'];
        $col = 'A';
        foreach ($headers as $header) {
            $sheet->setCellValue($col.$row, $header);
            $col++;
        }
        $sheet->getStyle('A'.$row.':K'.$row)->applyFromArray([
            'font' => ['bold' => true, 'color' => ['argb' => self::COLOR_HEADER_TEXT]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_BRAND]],
        ]);
        $row++;

        $equiposIngreso = 0.0;
        foreach (array_values($report['equipos_vendidos'] ?? []) as $index => $equipo) {
            $ingreso = (float) ($equipo['ingreso'] ?? 0);
            $equiposIngreso += $ingreso;
            $sheet->setCellValue('A'.$row, $equipo['origen_label'] ?? 'Venta');
            $sheet->setCellValue('B'.$row, $equipo['equipo'] ?? '—');
            $sheet->setCellValue('C'.$row, $equipo['imei'] ?? '—');
            $sheet->setCellValue('D'.$row, $equipo['proveedor'] ?? '—');
            $sheet->setCellValue('E'.$row, (float) ($equipo['costo'] ?? 0));
            $sheet->setCellValue('F'.$row, (float) ($equipo['valor'] ?? 0));
            $sheet->setCellValue('G'.$row, (float) ($equipo['utilidad'] ?? 0));
            $sheet->setCellValue('H'.$row, $ingreso);
            $sheet->setCellValue('I'.$row, (float) ($equipo['pendiente'] ?? 0));
            $sheet->setCellValue('J'.$row, $equipo['responsable'] ?? '—');
            $sheet->setCellValue('K'.$row, $equipo['remission_number'] ?? '—');
            foreach (['E', 'F', 'G', 'H', 'I'] as $moneyCol) {
                $sheet->getStyle($moneyCol.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
            }
            if ($index % 2 === 1) {
                $sheet->getStyle('A'.$row.':K'.$row)->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()->setARGB(self::COLOR_ALT_ROW);
            }
            $row++;
        }

        $sheet->setCellValue('A'.$row, 'Totales equipos');
        $sheet->setCellValue('E'.$row, (float) ($report['total_costo'] ?? 0));
        $sheet->setCellValue('F'.$row, (float) ($report['ventas_netas'] ?? 0));
        $sheet->setCellValue('G'.$row, (float) ($report['utilidad_bruta'] ?? 0));
        $sheet->setCellValue('H'.$row, $equiposIngreso);
        $sheet->setCellValue('I'.$row, (float) ($report['pendiente_ventas'] ?? $report['credito_del_dia'] ?? 0));
        $sheet->getStyle('A'.$row.':K'.$row)->getFont()->setBold(true);
        foreach (['E', 'F', 'G', 'H', 'I'] as $moneyCol) {
            $sheet->getStyle($moneyCol.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        }
        $row += 2;

        $sheet->setCellValue('A'.$row, 'Ingresos y egresos ('.(int) ($report['movimientos_count'] ?? 0).')');
        $sheet->getStyle('A'.$row)->getFont()->setBold(true);
        $row++;

        $movHeaders = ['Origen', 'Tipo', 'Concepto', 'Método', 'Costo', 'Monto', 'Responsable', 'Notas', 'Fecha'];
        $col = 'A';
        foreach ($movHeaders as $header) {
            $sheet->setCellValue($col.$row, $header);
            $col++;
        }
        $sheet->getStyle('A'.$row.':I'.$row)->applyFromArray([
            'font' => ['bold' => true, 'color' => ['argb' => self::COLOR_HEADER_TEXT]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_BRAND]],
        ]);
        $row++;

        foreach (array_values($report['movimientos_caja'] ?? []) as $index => $mov) {
            $sheet->setCellValue('A'.$row, $mov['origen_label'] ?? '—');
            $sheet->setCellValue('B'.$row, $mov['type_label'] ?? '—');
            $sheet->setCellValue('C'.$row, $mov['concept'] ?? '—');
            $sheet->setCellValue('D'.$row, $mov['method_label'] ?? '—');
            if (isset($mov['costo']) && $mov['costo'] !== null) {
                $sheet->setCellValue('E'.$row, (float) $mov['costo']);
                $sheet->getStyle('E'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
            } else {
                $sheet->setCellValue('E'.$row, '—');
            }
            $sheet->setCellValue('F'.$row, (float) ($mov['amount'] ?? 0));
            $sheet->setCellValue('G'.$row, $mov['responsable'] ?? '—');
            $sheet->setCellValue('H'.$row, $mov['notes'] ?? '—');
            $sheet->setCellValue('I'.$row, $mov['occurred_at'] ?? '—');
            $sheet->getStyle('F'.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
            if ($index % 2 === 1) {
                $sheet->getStyle('A'.$row.':I'.$row)->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()->setARGB(self::COLOR_ALT_ROW);
            }
            $row++;
        }

        $sheet->setCellValue('A'.$row, 'Totales caja');
        $sheet->setCellValue('E'.$row, (float) ($report['movimientos_costo_total'] ?? 0));
        $sheet->setCellValue('F'.$row, (float) ($report['total_ingresos'] ?? 0));
        $sheet->getStyle('A'.$row.':I'.$row)->getFont()->setBold(true);
        foreach (['E', 'F'] as $moneyCol) {
            $sheet->getStyle($moneyCol.$row)->getNumberFormat()->setFormatCode('"$"#,##0.00');
        }
        $row += 2;
        $sheet->setCellValue('A'.$row, 'Responsable: ____________________');
        $sheet->setCellValue('E'.$row, 'Revisado por: ____________________');

        foreach (['A' => 14, 'B' => 28, 'C' => 22, 'D' => 18, 'E' => 14, 'F' => 14, 'G' => 14, 'H' => 14, 'I' => 14, 'J' => 18, 'K' => 16] as $c => $w) {
            $sheet->getColumnDimension($c)->setWidth($w);
        }

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
        if ($from && $to && $from !== $to) {
            return $from.' — '.$to;
        }

        return $report['fecha'] ?? $to ?? $from ?? $fallback;
    }
}
