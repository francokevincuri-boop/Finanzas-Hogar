import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { primerVencimiento, vencimientoCuota, dividirEnCuotas } from "../lib/fechasTarjeta";

/** GET /hogares/:hogarId/tarjetas */
export async function listarTarjetas(req: Request, res: Response) {
  const tarjetas = await prisma.tarjeta.findMany({
    where: { hogarId: req.params.hogarId },
    orderBy: { creadoEn: "asc" },
  });
  return res.json(tarjetas);
}

/**
 * POST /hogares/:hogarId/tarjetas
 * Body: { nombre, banco?, limite?, diaCierre, diaVencimiento }
 */
export async function crearTarjeta(req: Request, res: Response) {
  const { nombre, banco, limite, diaCierre, diaVencimiento } = req.body ?? {};

  if (!nombre?.trim() || diaCierre === undefined || diaVencimiento === undefined) {
    return res.status(400).json({ error: "Faltan campos: nombre, diaCierre y diaVencimiento son obligatorios." });
  }
  for (const [campo, valor] of [["diaCierre", diaCierre], ["diaVencimiento", diaVencimiento]] as const) {
    if (!Number.isInteger(valor) || valor < 1 || valor > 31) {
      return res.status(400).json({ error: `${campo} debe ser un día del mes (1 a 31).` });
    }
  }
  if (limite !== undefined && (typeof limite !== "number" || limite <= 0)) {
    return res.status(400).json({ error: "El límite debe ser un número mayor a cero." });
  }

  const tarjeta = await prisma.tarjeta.create({
    data: {
      hogarId: req.params.hogarId,
      nombre: nombre.trim(),
      banco: banco?.trim() || null,
      limite: limite ?? null,
      diaCierre,
      diaVencimiento,
    },
  });

  return res.status(201).json(tarjeta);
}

/**
 * POST /hogares/:hogarId/tarjetas/:tarjetaId/consumos
 * Body: { descripcion, montoTotal, fecha?, cuotas? }
 * Si cuotas > 1, genera las cuotas automáticamente con sus vencimientos.
 */
export async function crearConsumo(req: Request, res: Response) {
  const { descripcion, montoTotal, fecha, cuotas } = req.body ?? {};

  if (!descripcion?.trim() || montoTotal === undefined) {
    return res.status(400).json({ error: "Faltan campos: descripcion y montoTotal son obligatorios." });
  }
  if (typeof montoTotal !== "number" || montoTotal <= 0) {
    return res.status(400).json({ error: "montoTotal debe ser un número mayor a cero." });
  }
  const totalCuotas = cuotas ?? 1;
  if (!Number.isInteger(totalCuotas) || totalCuotas < 1 || totalCuotas > 60) {
    return res.status(400).json({ error: "cuotas debe ser un entero entre 1 y 60." });
  }
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: "La fecha debe tener formato YYYY-MM-DD." });
  }

  const tarjeta = await prisma.tarjeta.findFirst({
    where: { id: req.params.tarjetaId, hogarId: req.params.hogarId },
  });
  if (!tarjeta) {
    return res.status(404).json({ error: "Tarjeta no encontrada en este hogar." });
  }

  const fechaCompra = fecha ? new Date(`${fecha}T00:00:00Z`) : new Date();
  const primera = primerVencimiento(fechaCompra, tarjeta.diaCierre, tarjeta.diaVencimiento);
  const montos = dividirEnCuotas(montoTotal, totalCuotas);

  const consumo = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.consumoTarjeta.create({
      data: {
        tarjetaId: tarjeta.id,
        descripcion: descripcion.trim(),
        montoTotal,
        fecha: fechaCompra,
        enCuotas: totalCuotas > 1,
      },
    });

    await tx.cuota.createMany({
      data: montos.map((monto, i) => ({
        consumoId: nuevo.id,
        numero: i + 1,
        totalCuotas,
        monto,
        fechaVencimiento: vencimientoCuota(primera, i + 1),
      })),
    });

    return nuevo;
  });

  const cuotasCreadas = await prisma.cuota.findMany({
    where: { consumoId: consumo.id },
    orderBy: { numero: "asc" },
  });

  return res.status(201).json({ ...consumo, cuotas: cuotasCreadas });
}

/** GET /hogares/:hogarId/tarjetas/:tarjetaId/consumos */
export async function listarConsumos(req: Request, res: Response) {
  const tarjeta = await prisma.tarjeta.findFirst({
    where: { id: req.params.tarjetaId, hogarId: req.params.hogarId },
  });
  if (!tarjeta) {
    return res.status(404).json({ error: "Tarjeta no encontrada en este hogar." });
  }

  const consumos = await prisma.consumoTarjeta.findMany({
    where: { tarjetaId: tarjeta.id },
    include: { cuotas: { orderBy: { numero: "asc" } } },
    orderBy: { fecha: "desc" },
  });

  return res.json(consumos);
}

/**
 * GET /hogares/:hogarId/tarjetas/:tarjetaId/proyeccion
 * "¿Cómo viene la tarjeta?" — cuotas pendientes agrupadas por mes de vencimiento.
 */
export async function proyeccionTarjeta(req: Request, res: Response) {
  const tarjeta = await prisma.tarjeta.findFirst({
    where: { id: req.params.tarjetaId, hogarId: req.params.hogarId },
  });
  if (!tarjeta) {
    return res.status(404).json({ error: "Tarjeta no encontrada en este hogar." });
  }

  const cuotas = await prisma.cuota.findMany({
    where: { consumo: { tarjetaId: tarjeta.id }, pagada: false },
    include: { consumo: { select: { descripcion: true } } },
    orderBy: { fechaVencimiento: "asc" },
  });

  // Agrupar por mes (YYYY-MM)
  const meses = new Map<string, { mes: string; total: number; detalle: object[] }>();
  for (const c of cuotas) {
    const mes = c.fechaVencimiento.toISOString().slice(0, 7);
    if (!meses.has(mes)) {
      meses.set(mes, { mes, total: 0, detalle: [] });
    }
    const grupo = meses.get(mes)!;
    grupo.total = Math.round((grupo.total + Number(c.monto)) * 100) / 100;
    grupo.detalle.push({
      consumo: c.consumo.descripcion,
      cuota: `${c.numero}/${c.totalCuotas}`,
      monto: c.monto,
      vence: c.fechaVencimiento.toISOString().slice(0, 10),
    });
  }

  return res.json({
    tarjeta: tarjeta.nombre,
    limite: tarjeta.limite,
    comprometidoTotal: Math.round(cuotas.reduce((sum, c) => sum + Number(c.monto), 0) * 100) / 100,
    meses: [...meses.values()],
  });
}
