import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { calcularVencimientos } from "../lib/vencimientos";

/**
 * GET /hogares/:hogarId/vencimientos?desde=2026-06-01&hasta=2026-07-31
 * Calendario unificado: servicios + cuotas de tarjeta.
 * Sin parámetros: próximos 30 días.
 */
export async function listarVencimientos(req: Request, res: Response) {
  const { desde, hasta } = req.query;

  for (const [nombre, valor] of [["desde", desde], ["hasta", hasta]] as const) {
    if (valor !== undefined && (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor))) {
      return res.status(400).json({ error: `${nombre} debe tener formato YYYY-MM-DD.` });
    }
  }

  const fechaDesde = desde ? new Date(`${desde}T00:00:00Z`) : new Date();
  const fechaHasta = hasta
    ? new Date(`${hasta}T00:00:00Z`)
    : new Date(fechaDesde.getTime() + 30 * 24 * 60 * 60 * 1000);

  const vencimientos = await calcularVencimientos(req.params.hogarId, fechaDesde, fechaHasta);

  return res.json({
    desde: fechaDesde.toISOString().slice(0, 10),
    hasta: fechaHasta.toISOString().slice(0, 10),
    totalPendiente: Math.round(
      vencimientos.filter((v) => v.estado !== "pagado").reduce((s, v) => s + v.monto, 0) * 100
    ) / 100,
    vencimientos,
  });
}

/**
 * GET /hogares/:hogarId/balance/:mes   (mes = YYYY-MM)
 * El número que importa: ingresos, gastos, comprometido y disponible real.
 */
export async function balanceMensual(req: Request, res: Response) {
  const { mes } = req.params;
  const hogarId = req.params.hogarId;

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: "El mes debe tener formato YYYY-MM, ej: 2026-06." });
  }

  const desde = new Date(`${mes}-01T00:00:00Z`);
  const hasta = new Date(desde);
  hasta.setUTCMonth(hasta.getUTCMonth() + 1);
  const finDeMes = new Date(hasta.getTime() - 24 * 60 * 60 * 1000);

  // Ingresos y gastos ya registrados en el mes
  const transacciones = await prisma.transaccion.findMany({
    where: { hogarId, fecha: { gte: desde, lt: hasta }, tipo: { in: ["ingreso", "gasto"] } },
  });
  const ingresos = transacciones.filter((t) => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0);
  const gastos = transacciones.filter((t) => t.tipo === "gasto").reduce((s, t) => s + Number(t.monto), 0);

  // Comprometido del mes: vencimientos (servicios + cuotas) que aún no se pagaron
  const vencimientos = await calcularVencimientos(hogarId, desde, finDeMes);
  const comprometidoPendiente = vencimientos
    .filter((v) => v.estado !== "pagado")
    .reduce((s, v) => s + v.monto, 0);

  // Saldos actuales por moneda
  const cuentas = await prisma.cuenta.findMany({ where: { hogarId } });
  const saldosPorMoneda: Record<string, number> = {};
  for (const c of cuentas) {
    saldosPorMoneda[c.moneda] = Math.round(((saldosPorMoneda[c.moneda] ?? 0) + Number(c.saldoActual)) * 100) / 100;
  }

  const saldoARS = saldosPorMoneda["ARS"] ?? 0;

  return res.json({
    mes,
    ingresos: Math.round(ingresos * 100) / 100,
    gastos: Math.round(gastos * 100) / 100,
    comprometidoPendiente: Math.round(comprometidoPendiente * 100) / 100,
    saldosPorMoneda,
    // Lo que de verdad podés gastar este mes sin pisar lo comprometido
    disponibleReal: Math.round((saldoARS - comprometidoPendiente) * 100) / 100,
    detalleComprometido: vencimientos.filter((v) => v.estado !== "pagado"),
  });
}

/**
 * GET /hogares/:hogarId/presupuesto/:mes
 * Sobres: cuánto asignaste, cuánto gastaste y cuánto queda por categoría.
 */
export async function verPresupuesto(req: Request, res: Response) {
  const { mes } = req.params;
  const hogarId = req.params.hogarId;

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: "El mes debe tener formato YYYY-MM, ej: 2026-06." });
  }

  const desde = new Date(`${mes}-01T00:00:00Z`);
  const hasta = new Date(desde);
  hasta.setUTCMonth(hasta.getUTCMonth() + 1);

  const [categorias, asignaciones, gastosDelMes] = await Promise.all([
    prisma.categoria.findMany({ where: { hogarId, tipo: "gasto" }, orderBy: { nombre: "asc" } }),
    prisma.presupuesto.findMany({ where: { hogarId, mes } }),
    prisma.transaccion.groupBy({
      by: ["categoriaId"],
      where: { hogarId, tipo: "gasto", fecha: { gte: desde, lt: hasta } },
      _sum: { monto: true },
    }),
  ]);

  const sobres = categorias.map((cat) => {
    const asignado = Number(asignaciones.find((a) => a.categoriaId === cat.id)?.montoAsignado ?? 0);
    const gastado = Number(gastosDelMes.find((g) => g.categoriaId === cat.id)?._sum.monto ?? 0);
    return {
      categoriaId: cat.id,
      categoria: cat.nombre,
      esFijo: cat.esFijo,
      asignado,
      gastado,
      restante: Math.round((asignado - gastado) * 100) / 100,
    };
  });

  const totalAsignado = Math.round(sobres.reduce((s, x) => s + x.asignado, 0) * 100) / 100;
  const totalGastado = Math.round(sobres.reduce((s, x) => s + x.gastado, 0) * 100) / 100;

  return res.json({ mes, totalAsignado, totalGastado, sobres });
}

/**
 * PUT /hogares/:hogarId/presupuesto/:mes
 * Body: { asignaciones: [{ categoriaId, monto }, ...] }
 * Crea o actualiza los sobres del mes.
 */
export async function asignarPresupuesto(req: Request, res: Response) {
  const { mes } = req.params;
  const hogarId = req.params.hogarId;
  const { asignaciones } = req.body ?? {};

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: "El mes debe tener formato YYYY-MM, ej: 2026-06." });
  }
  if (!Array.isArray(asignaciones) || asignaciones.length === 0) {
    return res.status(400).json({ error: "Enviá asignaciones: [{ categoriaId, monto }, ...]." });
  }
  for (const a of asignaciones) {
    if (!a?.categoriaId || typeof a?.monto !== "number" || a.monto < 0) {
      return res.status(400).json({ error: "Cada asignación necesita categoriaId y un monto >= 0." });
    }
  }

  // Todas las categorías tienen que ser del hogar
  const ids = asignaciones.map((a) => a.categoriaId);
  const validas = await prisma.categoria.count({ where: { id: { in: ids }, hogarId } });
  if (validas !== new Set(ids).size) {
    return res.status(400).json({ error: "Alguna categoría no pertenece a este hogar." });
  }

  await prisma.$transaction(
    asignaciones.map((a) =>
      prisma.presupuesto.upsert({
        where: { hogarId_categoriaId_mes: { hogarId, categoriaId: a.categoriaId, mes } },
        update: { montoAsignado: a.monto },
        create: { hogarId, categoriaId: a.categoriaId, mes, montoAsignado: a.monto },
      })
    )
  );

  return res.json({ ok: true, mes, actualizadas: asignaciones.length });
}
