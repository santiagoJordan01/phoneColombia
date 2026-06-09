# Mantener dominio Supabase activo (keep-alive)

- Archivos añadidos:
- scripts/keep_supabase_awake.cjs — script Node para ejecución continua o única.
- scripts/keep_supabase_once.ps1 — script PowerShell para ejecutar una vez (p. ej. desde Task Scheduler).
- .github/workflows/keep-supabase.yml — workflow para GitHub Actions; lee KEEP_ALIVE_URLS desde secretos.

Uso rápido:

1) Ejecutar una vez con Node (útil para probar):

```bash
node scripts/keep_supabase_awake.cjs https://tu-dominio.example --once
```

2) Ejecución continua con Node (ejecutar como daemon o con PM2):

```bash
KEEP_ALIVE_URLS="https://tu-dominio.example" KEEP_ALIVE_INTERVAL_MINUTES=10 node scripts/keep_supabase_awake.cjs
```

3) Windows Task Scheduler: programar una tarea que ejecute:

```powershell
powershell -File C:\ruta\a\repo\scripts\keep_supabase_once.ps1 -Url "https://tu-dominio.example"
```

4) GitHub Actions: crear el secret KEEP_ALIVE_URLS con URLs separadas por comas, habilitar el workflow.

Nota: usa esta técnica responsablemente y revisa los términos de servicio de Supabase.
