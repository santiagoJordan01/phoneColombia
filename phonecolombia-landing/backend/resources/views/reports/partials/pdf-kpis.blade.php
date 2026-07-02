@php
    $rows = array_chunk($kpis, 6);
@endphp

@foreach ($rows as $row)
    <table class="kpi-grid">
        <tr>
            @foreach ($row as $kpi)
                <td>
                    <div class="kpi kpi--{{ $kpi['tone'] ?? 'slate' }}">
                        <span class="kpi__label">{{ $kpi['label'] }}</span>
                        <span class="kpi__value">{{ $kpi['value'] }}</span>
                    </div>
                </td>
            @endforeach
            @for ($i = count($row); $i < 6; $i++)
                <td></td>
            @endfor
        </tr>
    </table>
@endforeach
