# Brief de Frontend — Finanzas del Hogar

> **Para Claude Design.** Este documento es el contrato completo para diseñar y construir el frontend. El backend YA EXISTE y funciona — todos los endpoints listados acá están implementados y probados. No inventar endpoints ni formas de respuesta: usar exactamente lo que está acá.

## 1. Qué es la app

Centro de control del dinero de un hogar argentino. La pregunta que responde: **"¿cuánta plata tengo realmente disponible?"** — descontando cuotas de tarjeta, servicios por vencer y todo lo comprometido. Multi-hogar (una persona puede administrar su casa y la de sus padres), multimoneda (ARS/USD), con dólar e inflación integrados.

Usuario tipo: persona/familia argentina que carga sus gastos a mano. **La carga rápida es sagrada: si cargar un gasto lleva más de 5 segundos, la app muere.**

## 2. Stack y reglas técnicas

- **React + Vite + Tailwind.** El código exportado va a la carpeta `/frontend` del monorepo.
- API local: `http://localhost:3000` (usar variable de entorno `VITE_API_URL`).
- **Auth:** JWT. Tras login/registro, guardar el token y enviarlo en TODAS las llamadas como header `Authorization: Bearer <token>`. Si una respuesta es 401, redirigir a login.
- **Errores:** la API siempre responde errores como `{ "error": "mensaje legible en español" }` con status 4xx/5xx. Mostrar ese mensaje al usuario tal cual: ya viene pensado para humanos.
- **Hogar activo:** el usuario puede tener varios hogares (`GET /hogares`). Toda la app opera sobre un "hogar activo" seleccionado (persistirlo en localStorage). Las rutas de datos llevan el id: `/hogares/:hogarId/...`.
- **Roles:** `dueno` | `colaborador` | `lector`. El lector NO puede crear/editar nada (la API lo rechaza con 403): ocultarle los botones de acción.
- Montos: la API devuelve números (a veces como string decimal de Prisma — parsear con `Number()`). Formatear en pantalla como pesos argentinos: `$ 1.415.000`.
- Fechas: la API usa `YYYY-MM-DD` y meses `YYYY-MM`.

## 3. Contrato de API (as-built, completo)

### Auth (públicos)

```
POST /auth/register
  Body: { email, nombre, password (min 8), nombreHogar? }
  201: { token, usuario: {id, email, nombre}, hogar: {id, nombre} }
  El hogar se crea automáticamente con 25 categorías argentinas precargadas.

POST /auth/login
  Body: { email, password }
  200: { token, usuario: {id, email, nombre} }
```

### Hogares y miembros

```
GET  /hogares                       → [{ id, nombre, monedaBase, miRol }]
POST /hogares                       Body: { nombre, monedaBase? }  → 201 hogar
GET  /hogares/:hogarId/miembros     → [{ miembroId, usuarioId, nombre, email, rol }]
POST /hogares/:hogarId/miembros     Body: { email, rol }  (solo dueño; el usuario debe existir)
```

### Cuentas

```
GET    /hogares/:hogarId/cuentas
  → [{ id, nombre, tipo, moneda, saldoActual, creadoEn }]
  tipos: efectivo | banco | billetera | usd | inversion
POST   /hogares/:hogarId/cuentas    Body: { nombre, tipo, moneda?, saldoInicial? }
PUT    /hogares/:hogarId/cuentas/:cuentaId    Body: { nombre?, tipo?, moneda? }
DELETE /hogares/:hogarId/cuentas/:cuentaId    (409 si tiene transacciones)
El saldo NO se edita a mano: lo mueven las transacciones.
```

### Categorías

```
GET  /hogares/:hogarId/categorias   → [{ id, nombre, tipo: gasto|ingreso, esFijo }]
POST /hogares/:hogarId/categorias   Body: { nombre, tipo, esFijo? }
POST /hogares/:hogarId/categorias/precargar   (solo hogares sin categorías)
```

### Transacciones (el corazón de la carga)

```
GET /hogares/:hogarId/transacciones?mes=2026-06&categoriaId=&cuentaId=&miembroId=&tipo=
  → [{ id, tipo, monto, moneda, fecha, descripcion, compartida,
       cuenta, cuentaId, cuentaDestino, categoria, categoriaId, miembro }]
  (cuenta/categoria/miembro vienen resueltos como nombres listos para mostrar)

POST /hogares/:hogarId/transacciones
  Gasto/ingreso: { tipo: "gasto"|"ingreso", monto, cuentaId, categoriaId?, fecha?, descripcion?, compartida? }
  Transferencia: { tipo: "transferencia", monto, cuentaId, cuentaDestinoId }
  → 201. El saldo de las cuentas se actualiza SOLO.
  Reglas: la categoría debe coincidir con el tipo; transferencias sin categoría;
  monedas distintas en transferencia → error (compra de USD vendrá después).
  Si la cuenta es USD, el backend guarda la cotización del día automáticamente.

DELETE /hogares/:hogarId/transacciones/:transaccionId   (revierte el saldo)
```

### Tarjetas de crédito y cuotas

```
GET  /hogares/:hogarId/tarjetas
  → [{ id, nombre, banco, limite, diaCierre, diaVencimiento }]
POST /hogares/:hogarId/tarjetas     Body: { nombre, banco?, limite?, diaCierre, diaVencimiento }

POST /hogares/:hogarId/tarjetas/:tarjetaId/consumos
  Body: { descripcion, montoTotal, fecha?, cuotas? (1-60, default 1) }
  → 201 { ...consumo, cuotas: [{ numero, totalCuotas, monto, fechaVencimiento, pagada }] }
  Las cuotas se generan SOLAS según el cierre real de la tarjeta.

GET /hogares/:hogarId/tarjetas/:tarjetaId/consumos   → consumos con sus cuotas

GET /hogares/:hogarId/tarjetas/:tarjetaId/proyeccion
  → { tarjeta, limite, comprometidoTotal,
      meses: [{ mes: "2026-07", total, detalle: [{ consumo, cuota: "3/12", monto, vence }] }] }
  Responde "¿cómo viene la tarjeta?" mes a mes.
```

### Servicios (luz, gas, expensas...)

```
GET  /hogares/:hogarId/servicios
  → [{ id, nombre, montoEstimado, periodicidad, diaVencimiento, mesAncla, activo }]
  periodicidad: mensual | bimestral | anual
POST /hogares/:hogarId/servicios    Body: { nombre, montoEstimado, diaVencimiento, periodicidad?, mesAncla? }
PUT  /hogares/:hogarId/servicios/:servicioId    (para editar o dar de baja: { activo: false })
POST /hogares/:hogarId/servicios/:servicioId/pagar    Body: { periodo: "2026-06", montoPagado? }
```

### Proyección (las pantallas estrella)

```
GET /hogares/:hogarId/vencimientos?desde=2026-06-05&hasta=2026-07-05
  (sin parámetros: próximos 30 días)
  → { desde, hasta, totalPendiente,
      vencimientos: [{ origen: "servicio"|"cuota", origenId, nombre, monto,
                       fecha, estado: "pagado"|"pendiente"|"vencido" }] }

GET /hogares/:hogarId/balance/2026-06
  → { mes, ingresos, gastos, comprometidoPendiente, saldosPorMoneda: { ARS: n, USD: n },
      disponibleReal, detalleComprometido: [vencimientos pendientes] }
  ⭐ disponibleReal = el número más importante de toda la app.

GET /hogares/:hogarId/presupuesto/2026-06
  → { mes, totalAsignado, totalGastado,
      sobres: [{ categoriaId, categoria, esFijo, asignado, gastado, restante }] }
PUT /hogares/:hogarId/presupuesto/2026-06
  Body: { asignaciones: [{ categoriaId, monto }] }
```

### Inversiones y patrimonio

```
GET    /hogares/:hogarId/inversiones
  → [{ id, tipo, nombre, monto, moneda, fecha, valorActual }]
  tipos: plazo_fijo | fci | usd | cedear | cripto
POST   /hogares/:hogarId/inversiones   Body: { tipo, nombre, monto, moneda?, fecha?, valorActual? }
PUT    /hogares/:hogarId/inversiones/:inversionId   Body: { valorActual?, nombre?, monto? }
DELETE /hogares/:hogarId/inversiones/:inversionId

GET /hogares/:hogarId/patrimonio
  → { fecha, porMoneda: { ARS: {cuentas, inversiones}, USD: {...} },
      cotizacionUsada: { oficial, fecha }, patrimonioNetoARS }
```

### Datos externos (públicos, sin token)

```
GET /cotizaciones/dolar   → { fecha, oficial, blue, mep, fuente: "api"|"cache" }
GET /inflacion            → [{ mes, ipc, variacionMensual (% o null) }]  (últimos 13 meses)
```

### Simulador ("¿puedo meterme en esto?")

```
POST /hogares/:hogarId/asistente/simular
  Body: { montoTotal, cuotas?, tarjetaId?, descripcion? }
  → { hipotesis: { descripcion, montoTotal, cuotas, montoPorCuota, tarjeta, primerVencimiento },
      supuestos: { ingresoEstimado, gastosVariablesEstimados, base, colchonActual },
      meses: [{ mes, cuotaNueva, comprometidoExistente, ingresoEstimado,
                gastosVariablesEstimados, margen }],
      resumen: { mesesProyectados, mesesEnRojo, peorMes: {mes, margen}, veredicto },
      advertencias: [strings], nota }
  No guarda nada. El "veredicto" viene redactado listo para mostrar.
```

## 4. Pantallas del MVP (en orden de prioridad)

1. **Login / Registro** — minimal. El registro pide email, nombre, contraseña y nombre del hogar.
2. **Carga rápida de movimiento** ⭐ — accesible desde TODA la app (botón flotante). Default: gasto. Flujo ideal: monto → categoría (grilla de chips, las más usadas primero) → cuenta → listo. Fecha default hoy. Ingreso y transferencia como tabs del mismo modal.
3. **Dashboard (home)** — `disponibleReal` como número protagonista gigante. Debajo: saldos por cuenta, próximos vencimientos (7 días) con estado, accesos a tarjetas y simulador. Cotización del dólar discreta en el header.
4. **Onboarding / Configuración** — alta de cuentas, tarjetas y servicios con formularios simples. Se usa fuerte el primer día y poco después.
5. **Tarjetas** — lista con `comprometidoTotal` de cada una; detalle = proyección mes a mes (gráfico de barras) + carga de consumo (con selector de cuotas 1/3/6/12/18).
6. **Movimientos** — lista del mes con filtros (mes, categoría, cuenta), borrar con confirmación.
7. **Vencimientos** — calendario/lista del mes, marcar servicio como pagado en un toque.
8. **Simulador** — form simple (monto, cuotas, tarjeta opcional) → resultado visual: veredicto grande, barras por mes (verde margen positivo / rojo negativo), supuestos visibles.
9. **Presupuesto** (después del MVP) — sobres con barras de progreso gastado/asignado.
10. **Patrimonio e inversiones** (después del MVP).

## 5. Guía de diseño

- **Mobile-first** (se usa en el supermercado), pero debe funcionar bien en desktop.
- Estética: app financiera moderna y cálida, no corporativa fría. Es plata personal y a veces da ansiedad: el tono debe calmar, no alarmar — pero sin mentir (los rojos son rojos).
- Verde = disponible/ingreso, rojo = vencido/negativo, ámbar = comprometido/por vencer.
- Números grandes y legibles. Formato `$ 1.415.000` (punto de miles, sin decimales salvo USD).
- Multi-hogar: selector de hogar arriba (la mayoría tiene uno solo: que no estorbe).
- Dark mode bienvenido si no agrega complejidad.

## 6. Integración con el repo

- El código exportado entra en `/frontend` del monorepo (rama `feature/frontend-base`).
- `frontend/.env`: `VITE_API_URL=http://localhost:3000`.
- No commitear `node_modules` ni `.env` (ya cubiertos por el `.gitignore` de la raíz).
