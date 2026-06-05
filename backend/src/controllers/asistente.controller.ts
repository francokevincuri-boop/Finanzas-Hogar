import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { primerVencimiento, vencimientoCuota, dividirEnCuotas } from "../lib/fechasTarjeta";
import { calcularVencimientos } from "../lib/vencimientos";

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * POST /hogares/:hogarId/asistente/simular
 * Body: { montoTotal, cuotas?, tarjetaId?, descripcion? }
 *
 * "¿Puedo meterme en esto?" respondido con números, sin guardar nada:
 * aplica el gasto hipotético sobre la proyección real y devuelve mes a mes
 * cómo quedaría el margen. Sin IA: matemática pura (CLAUDE.md §7).
 */
export async function simular(req: Request, res: Response) {
  const { montoTotal, cuotas, tarjetaId, descripcion } = req.body ?? {};
  const hogarId = req.params.hogarId;

  // Validaciones
  if (montoTotal === undefined || typeof montoTotal !== "number" || montoTotal <= 0) {
    return res.status(400).json({ error: "montoTotal es obligatorio y debe ser mayor a cero." });
  }
  const totalCuotas = cuotas ?? 1;
  if (!Number.isInteger(totalCuotas) || totalCuotas < 1 || totalCuotas > 60) {
    return res.status(400).json({ error: "cuotas debe ser un entero entre 1 y 60." });
  }

  // Tarjeta opcional: define cuándo cae cada cuota
  let tarjeta = null;
  if (tarjetaId) {
    tarjeta = await prisma.tarjeta.findFirst({ where: { id: tarjetaId, hogarId } });
    if (!tarjeta) {
      return res.status(404).json({ error: "Tarjeta no encontrada en este hogar." });
    }
  }

  const hoy = new Date();

  // ¿Cuándo vence la primera cuota? Con tarjeta: según su cierre real.
  // Sin tarjeta: día 10 del mes que viene (aproximación razonable).
  const primera = tarjeta
    ? primerVencimiento(hoy, tarjeta.diaCierre, tarjeta.diaVencimiento)
    : new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 10));

  const montosCuota = dividirEnCuotas(montoTotal, totalCuotas);
  const cuotasNuevas = montosCuota.map((monto, i) => ({
    numero: i + 1,
    monto,
    fecha: vencimientoCuota(primera, i + 1),
  }));

  // ── Supuestos: promedios de los últimos 3 meses ──────────────────
  const inicioPromedios = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1));
  const transacciones = await prisma.transaccion.findMany({
    where: { hogarId, fecha: { gte: inicioPromedios }, tipo: { in: ["ingreso", "gasto"] } },
    include: { categoria: { select: { esFijo: true } } },
  });

  const ingresoPromedio = r2(
    transacciones.filter((t) => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0) / 3
  );
  // Gastos variables: lo que gastás "viviendo" (los fijos ya están en servicios/comprometido)
  const gastosVariablesPromedio = r2(
    transacciones
      .filter((t) => t.tipo === "gasto" && !t.categoria?.esFijo)
      .reduce((s, t) => s + Number(t.monto), 0) / 3
  );

  // ── Comprometido existente por mes (cuotas actuales + servicios) ──
  const inicioHorizonte = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const finHorizonte = vencimientoCuota(primera, totalCuotas);
  const vencimientosExistentes = await calcularVencimientos(hogarId, inicioHorizonte, finHorizonte);

  const comprometidoPorMes = new Map<string, number>();
  for (const v of vencimientosExistentes) {
    if (v.estado === "pagado") continue;
    const mes = v.fecha.slice(0, 7);
    comprometidoPorMes.set(mes, r2((comprometidoPorMes.get(mes) ?? 0) + v.monto));
  }

  // ── Proyección mes a mes ─────────────────────────────────────────
  const meses: Array<{
    mes: string;
    cuotaNueva: number;
    comprometidoExistente: number;
    ingresoEstimado: number;
    gastosVariablesEstimados: number;
    margen: number;
  }> = [];

  const cursor = new Date(inicioHorizonte);
  while (cursor.getTime() <= finHorizonte.getTime()) {
    const mes = cursor.toISOString().slice(0, 7);
    const cuotaNueva = r2(
      cuotasNuevas.filter((c) => c.fecha.toISOString().slice(0, 7) === mes).reduce((s, c) => s + c.monto, 0)
    );
    const comprometidoExistente = comprometidoPorMes.get(mes) ?? 0;
    meses.push({
      mes,
      cuotaNueva,
      comprometidoExistente,
      ingresoEstimado: ingresoPromedio,
      gastosVariablesEstimados: gastosVariablesPromedio,
      margen: r2(ingresoPromedio - comprometidoExistente - gastosVariablesPromedio - cuotaNueva),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // ── Colchón y advertencias ───────────────────────────────────────
  const cuentasARS = await prisma.cuenta.findMany({ where: { hogarId, moneda: "ARS" } });
  const colchonActual = r2(cuentasARS.reduce((s, c) => s + Number(c.saldoActual), 0));

  const advertencias: string[] = [];
  if (tarjeta?.limite) {
    const pendienteTarjeta = await prisma.cuota.aggregate({
      where: { consumo: { tarjetaId: tarjeta.id }, pagada: false },
      _sum: { monto: true },
    });
    const usado = Number(pendienteTarjeta._sum.monto ?? 0);
    if (usado + montoTotal > Number(tarjeta.limite)) {
      advertencias.push(
        `Este consumo superaría el límite de ${tarjeta.nombre}: pendiente actual ${usado} + ${montoTotal} > límite ${Number(tarjeta.limite)}.`
      );
    }
  }
  if (ingresoPromedio === 0) {
    advertencias.push("No hay ingresos registrados en los últimos 3 meses: la proyección no puede estimar tu margen real.");
  }

  const mesesEnRojo = meses.filter((m) => m.margen < 0);
  const peorMes = meses.reduce((peor, m) => (m.margen < peor.margen ? m : peor), meses[0]);

  const veredicto =
    mesesEnRojo.length === 0
      ? `Entra: en ningún mes proyectado quedás en negativo. El mes más ajustado es ${peorMes.mes} con un margen de ${peorMes.margen}.`
      : `Cuidado: quedarías en rojo en ${mesesEnRojo.length} de ${meses.length} meses. El peor es ${peorMes.mes} con margen ${peorMes.margen}. Tu colchón actual de ${colchonActual} ${
          colchonActual + peorMes.margen >= 0 ? "podría absorberlo, pero te come el ahorro" : "no alcanza para cubrirlo"
        }.`;

  return res.json({
    hipotesis: {
      descripcion: descripcion?.trim() || "Gasto simulado",
      montoTotal,
      cuotas: totalCuotas,
      montoPorCuota: montosCuota[0],
      tarjeta: tarjeta?.nombre ?? null,
      primerVencimiento: primera.toISOString().slice(0, 10),
    },
    supuestos: {
      ingresoEstimado: ingresoPromedio,
      gastosVariablesEstimados: gastosVariablesPromedio,
      base: "Promedio de los últimos 3 meses de transacciones registradas.",
      colchonActual,
    },
    meses,
    resumen: {
      mesesProyectados: meses.length,
      mesesEnRojo: mesesEnRojo.length,
      peorMes: { mes: peorMes.mes, margen: peorMes.margen },
      veredicto,
    },
    advertencias,
    nota: "Simulación: no se guardó nada en tus datos.",
  });
}
