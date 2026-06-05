# Log de decisiones

Registro cronológico. El detalle vive en `CLAUDE.md` (§12).

| Fecha | Decisión |
|---|---|
| 2026-06-05 | Local primero: Postgres en Docker, deploy a cloud recién con algo usable. |
| 2026-06-05 | Prisma para schema y migraciones. |
| 2026-06-05 | Monorepo en GitHub (`francokevincuri-boop/Finanzas-Hogar`): `/backend`, `/frontend`, `/docs`. |
| 2026-06-05 | Dólar: DolarApi.com · Inflación: IPC INDEC (datos.gob.ar). A verificar en Etapa 4. |
| 2026-06-05 | Regla de trabajo: Claude propone, Franco confirma, recién ahí se ejecuta. |
| 2026-06-05 | Ramas: `develop` por defecto (trabajo diario), `main` solo releases con tag de versión. |
| 2026-06-05 | GitHub Actions a futuro: CI sobre `develop`, deploy al taguear en `main`. |
| 2026-06-05 | Transferencias: columna `cuenta_destino_id` nullable en `Transaccion` (una sola fila, origen y destino). |
