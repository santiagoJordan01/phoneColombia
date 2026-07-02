<table class="header">
    <tr>
        <td class="header-brand">
            <p class="header-brand__name">Phone Colombia</p>
            <p class="header-brand__tagline">Tecnología móvil · Inventario y ventas</p>
        </td>
        <td class="header-doc">
            <p class="header-doc__label">{{ $docLabel }}</p>
            @if (!empty($docSubtitle))
                <p class="header-doc__sub">{{ $docSubtitle }}</p>
            @endif
            <p class="header-doc__period">{{ $periodLabel }}</p>
            <p class="header-doc__generated">Generado: {{ $generatedAt }} (hora Colombia)</p>
        </td>
    </tr>
</table>
