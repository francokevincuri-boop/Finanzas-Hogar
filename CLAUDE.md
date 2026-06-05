# Finanzas del Hogar — Brief de Proyecto (PRD)

> Documento fuente de verdad. Pensado para usarse como `CLAUDE.md` / PRD en Cowork y como base del diseño en Claude Design. Todo lo que el front (Design) y el back (Cowork) necesiten para encajar tiene que vivir acá o derivarse de acá.

---

## 1. Qué es

Un **centro de control del dinero de un hogar**. La unidad no es la transacción: es la **capacidad de decidir**. Cada módulo existe para que alguien pueda responder *"¿puedo o no puedo hacer X este mes / los próximos meses?"*.

No es una app de gastos más. Es un todo-en-uno orientado al hogar argentino, con un asistente que razona sobre la situación financiera real.

## 2. Para quién

Un mismo usuario puede administrar **uno o varios hogares**, con distintos roles. Casos cubiertos desde el día uno:

- **Persona sola / estudiante** — un hogar, un miembro.
- **Familia (2–4 personas)** — un hogar, varios miembros, gastos compartidos.
- **Cuidador que ayuda a otro hogar** — ej. una hija administrando las finanzas de sus padres: un usuario con acceso a su propio hogar **y** al de los padres, con permisos distintos.

## 3. Decisiones de diseño ya tomadas

| Tema | Decisión |
|---|---|
| Multi-hogar | Sí, desde el día uno. El modelo de datos se diseña multi-tenant. |
| Alcance | Completo, con el asistente/bot incluido en el plan (no como agregado posterior). |
| Entrada de datos | Carga manual ágil + import de resúmenes (CSV/PDF). **No** hay open banking en Argentina; no se conecta el banco automáticamente. |
| Moneda | Multimoneda nativa (ARS + USD), con cotizaciones oficial/MEP/blue y ajuste por inflación. |
| Privacidad | Datos sensibles. Almacenamiento y acceso definidos explícitamente (ver §9). |

## 4. Módulos (alcance completo)

**Registro (base)**
- Cuentas: efectivo, bancos, billeteras (Mercado Pago/Ualá), dólares por separado.
- Ingresos con periodicidad (sueldo, freelance, ayudas familiares).
- Gastos categorizados, fijos vs. variables.
- Servicios con vencimiento (luz, gas, agua, internet, expensas, prepaga).
- Tarjetas de crédito con lógica real: cierre, vencimiento, límite, consumo del período y **cuotas pendientes**.

**Proyección (flujo de caja)**
- Calendario de vencimientos con alertas.
- Balance mensual proyectado: disponible **ya descontando lo comprometido**.
- Concepto de **dinero comprometido vs. disponible** (las cuotas en curso no son plata libre).
- Presupuesto por sobres (estilo YNAB: cada peso tiene un trabajo).

**Hogar**
- Multi-perfil dentro de un hogar.
- Gastos compartidos y reparto (estilo Splitwise, integrado).
- Un usuario administrando varios hogares con roles.

**Argentino**
- Cotización dólar oficial/MEP/blue actualizándose sola.
- Ahorro en USD.
- Ajuste por inflación (IPC) para comparar meses con sentido real.
- Inversiones livianas (plazo fijo, FCI, dólar, CEDEARs/cripto) → **patrimonio neto** en el tiempo.

**Cerebro (asistente)**
- Preguntas en lenguaje natural: *"¿puedo meterme en un auto de 15M en 12 cuotas?"* → responde mirando ingresos, comprometido y colchón.
- Simulación de escenarios *what-if* antes de comprometerse.
- Recomendaciones proactivas (ej. esperar al próximo cierre de tarjeta; ARS parados que la inflación se come).

## 5. Modelo de datos inicial

Entidades núcleo (multi-tenant por `hogar`):

```
Usuario            id, email, nombre, auth
Hogar              id, nombre, moneda_base (default ARS)
MiembroHogar       id, usuario_id, hogar_id, rol (dueño | colaborador | lector)
                   -> cubre el caso "hija administra hogar de padres"

Cuenta             id, hogar_id, nombre, tipo (efectivo|banco|billetera|usd|inversion),
                   moneda, saldo_actual
Categoria          id, hogar_id, nombre, tipo (gasto|ingreso), es_fijo (bool)

Transaccion        id, hogar_id, cuenta_id, categoria_id, miembro_id,
                   tipo (ingreso|gasto|transferencia), monto, moneda, fecha,
                   descripcion, compartida (bool)

Tarjeta            id, hogar_id, nombre, banco, limite, dia_cierre, dia_vencimiento
ConsumoTarjeta     id, tarjeta_id, descripcion, monto_total, fecha,
                   en_cuotas (bool)
Cuota              id, consumo_id, numero, total_cuotas, monto, fecha_vencimiento,
                   pagada (bool)         -> permite proyectar "cómo viene la tarjeta"

Servicio           id, hogar_id, nombre, monto_estimado, periodicidad,
                   dia_vencimiento
Vencimiento        id, hogar_id, origen (servicio|cuota|tarjeta), origen_id,
                   monto, fecha, estado (pendiente|pagado|vencido)

Presupuesto        id, hogar_id, categoria_id, mes, monto_asignado   (sobres)

Inversion          id, hogar_id, tipo (plazo_fijo|fci|usd|cedear|cripto),
                   monto, moneda, fecha, valor_actual

CotizacionDolar    fecha, oficial, mep, blue        (cache externo)
IndiceInflacion    mes, ipc                          (para ajuste real)
```

Regla transversal: **toda query filtra por `hogar_id`** según el `MiembroHogar` del usuario logueado. Es la línea de defensa multi-tenant.

## 6. Contrato de API (esqueleto)

REST. Todo bajo el contexto del hogar activo. Este es el "idioma común" entre front y back: si los dos lo respetan, encajan.

```
Auth
  POST   /auth/login
  POST   /auth/register

Hogares
  GET    /hogares                      (los del usuario)
  POST   /hogares
  GET    /hogares/:id/miembros
  POST   /hogares/:id/miembros         (invitar, asignar rol)

Cuentas / Transacciones
  GET    /hogares/:id/cuentas
  GET    /hogares/:id/transacciones    (filtros: mes, categoria, miembro)
  POST   /hogares/:id/transacciones
  POST   /hogares/:id/transacciones/import   (CSV/PDF de resumen)

Tarjetas
  GET    /hogares/:id/tarjetas
  GET    /hogares/:id/tarjetas/:tid/proyeccion  (cuotas futuras por mes)

Vencimientos / Calendario
  GET    /hogares/:id/vencimientos     (rango de fechas)

Presupuesto
  GET    /hogares/:id/presupuesto/:mes
  PUT    /hogares/:id/presupuesto/:mes

Proyección / Balance
  GET    /hogares/:id/balance/:mes     (ingresos, comprometido, disponible)
  GET    /hogares/:id/patrimonio       (neto en el tiempo)

Externos
  GET    /cotizaciones/dolar
  GET    /inflacion

Asistente
  POST   /hogares/:id/asistente/preguntar   (pregunta NL -> respuesta)
  POST   /hogares/:id/asistente/simular     (escenario what-if)
```

## 7. El asistente (arquitectura)

El bot **no** es una caja mágica: es un endpoint que arma contexto y razona.

1. El back arma un **snapshot financiero** del hogar (balance del mes, comprometido, vencimientos próximos, cotización dólar, cuotas en curso).
2. Lo manda junto con la pregunta del usuario a la API de Claude.
3. La respuesta vuelve en texto + (opcional) una **acción sugerida** o una **simulación** estructurada que el front puede renderizar.

Para `/simular`: el usuario propone un gasto/cuota hipotético, el back lo aplica sobre la proyección **sin guardar nada** y devuelve cómo quedarían los próximos N meses. Esto es lo que responde *"¿puedo meterme en un auto?"* de forma honesta.

Este módulo es el diferencial más fuerte del producto.

## 8. Stack sugerido

Recomendación (ajustable — es tu decisión, queda registrada acá):

- **Front:** React + Vite + Tailwind (se diseña en Claude Design, se exporta a código).
- **Back:** Node + Express.
- **DB:** PostgreSQL (multi-tenant natural; row-level security opcional para el aislamiento por hogar).
- **Auth:** JWT o similar.
- **Externos:** scraper/API de cotización dólar + IPC, cacheados en DB.

Rationale: alineado a tu stack habitual (React/Vite/Tailwind + Node/Express). Postgres en vez de SQL Server porque el aislamiento multi-hogar y el hosting cloud son más directos, pero si preferís SQL Server por comodidad, el modelo no cambia.

## 9. Consideraciones de privacidad

- Datos financieros sensibles → cifrado en reposo, acceso siempre filtrado por `hogar_id` + rol.
- Nunca exponer datos de un hogar a un miembro sin `MiembroHogar` válido.
- El snapshot que va al asistente debe ser el mínimo necesario.

## 10. Roadmap por fases

Aunque el alcance es completo, conviene construir en orden para no morir en el camino:

- **Fase 1 — Base:** hogares, miembros/roles, cuentas, transacciones, categorías.
- **Fase 2 — Tarjetas y cuotas:** la lógica que más duele en Argentina; proyección de tarjeta.
- **Fase 3 — Proyección:** vencimientos, balance mensual, comprometido vs. disponible, presupuesto por sobres.
- **Fase 4 — Argentino:** dólar, inflación, inversiones, patrimonio neto.
- **Fase 5 — Asistente:** preguntar + simular sobre todo lo anterior.

El asistente es Fase 5 a propósito: necesita que las fases 1–4 ya generen datos reales para razonar.

## 11. Cómo encajan Cowork + Claude Design + repo

No hay sync automática entre Design (web) y Cowork (local). La simetría la sostiene la **fuente de verdad compartida**:

- **Este documento** = el contrato (modelo de datos + API + alcance).
- **Un repo git** = el punto de encuentro físico. Cowork se conecta a GitHub (vía MCP) y lee/escribe el repo.
- **Claude Design** diseña el front contra el contrato de §6, exporta a código, y ese código entra al repo.
- **Cowork** construye el back contra el mismo contrato.

Front y back nunca se hablan directo durante el desarrollo: se hablan a través del contrato de API. Si los dos lo respetan, encajan. **Eso es la simetría.**

## 12. Decisiones cerradas (2026-06-05)

| Tema | Decisión |
|---|---|
| Entorno | **Local primero**: Postgres en Docker, todo corre en la máquina de Franco. Deploy a cloud recién con algo usable. |
| Schema/migraciones | **Prisma**: schema declarativo, migraciones automáticas, tipos TS. |
| Repo | **Monorepo en GitHub**: `/backend`, `/frontend`, `/docs`. Este CLAUDE.md vive en la raíz como contrato. |
| Dólar/IPC | **DolarApi.com** (oficial/MEP/blue, gratis sin key) + **IPC del INDEC** (datos.gob.ar). Se verifica disponibilidad al implementar en Etapa 4. |

### Reglas de trabajo

- Claude propone, **Franco confirma**, recién ahí se ejecuta. Nunca codear ni asumir sin OK explícito.
- Cada decisión nueva se registra en este documento (fuente de verdad).

### Decisiones pendientes

- Detalle del formato de import de resúmenes (qué bancos/tarjetas priorizar).
- Estrategia de notificaciones/alertas (push, email, in-app).
- Diseño de `Vencimiento`: tabla materializada vs. vista calculada (a discutir en Etapa 3).
- Guardar cotización del día (o `monto_ars_equivalente`) en `Transaccion` para ajuste por inflación retroactivo (a discutir en Etapa 1).
