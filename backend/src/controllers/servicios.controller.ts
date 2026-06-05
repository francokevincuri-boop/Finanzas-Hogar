import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

const PERIODICIDADES = ["mensual", "bimestral", "anual"] as const;

/** GET /hogares/:hogarId/servicios */
export async function listarServicios(req: Request, res: Response) {
  const servicios = await prisma.servicio.findMany({
    where: { hogarId: req.params.hogarId, activo: true },
    orderBy: { diaVencimiento: "asc" },
  });
  return res.json(servicios);
}

/**
 * POST /hogares/:hogarId/servicios
 * Body: { nombre, montoEstimado, diaVencimiento, periodicidad?, mesAncla? }
 */
export async function crearServicio(req: Request, res: Response) {
  const { nombre, montoEstimado, diaVencimiento, periodicidad, mesAncla } = req.body ?? {};

  if (!nombre?.trim() || montoEstimado === undefined || diaVencimiento === undefined) {
    return res.status(400).json({ error: "Faltan campos: nombre, montoEstimado y diaVencimiento son obligatorios." });
  }
  if (typeof montoEstimado !== "number" || montoEstimado <= 0) {
    return res.status(400).json({ error: "montoEstimado debe ser un número mayor a cero." });
  }
  if (!Number.isInteger(diaVencimiento) || diaVencimiento < 1 || diaVencimiento > 31) {
    return res.status(400).json({ error: "diaVencimiento debe ser un día del mes (1 a 31)." });
  }
  if (periodicidad && !PERIODICIDADES.includes(periodicidad)) {
    return res.status(400).json({ error: `Periodicidad inválida. Opciones: ${PERIODICIDADES.join(", ")}.` });
  }
  if (mesAncla !== undefined && (!Number.isInteger(mesAncla) || mesAncla < 1 || mesAncla > 12)) {
    return res.status(400).json({ error: "mesAncla debe ser un mes (1 a 12)." });
  }

  const servicio = await prisma.servicio.create({
    data: {
      hogarId: req.params.hogarId,
      nombre: nombre.trim(),
      montoEstimado,
      diaVencimiento,
      periodicidad: periodicidad ?? "mensual",
      mesAncla: mesAncla ?? 1,
    },
  });

  return res.status(201).json(servicio);
}

/**
 * PUT /hogares/:hogarId/servicios/:servicioId
 * Body: cualquier campo editable. Para darlo de baja: { activo: false }
 */
export async function actualizarServicio(req: Request, res: Response) {
  const { nombre, montoEstimado, diaVencimiento, periodicidad, mesAncla, activo } = req.body ?? {};

  const existente = await prisma.servicio.findFirst({
    where: { id: req.params.servicioId, hogarId: req.params.hogarId },
  });
  if (!existente) {
    return res.status(404).json({ error: "Servicio no encontrado." });
  }
  if (periodicidad && !PERIODICIDADES.includes(periodicidad)) {
    return res.status(400).json({ error: `Periodicidad inválida. Opciones: ${PERIODICIDADES.join(", ")}.` });
  }

  const servicio = await prisma.servicio.update({
    where: { id: existente.id },
    data: {
      ...(nombre?.trim() && { nombre: nombre.trim() }),
      ...(typeof montoEstimado === "number" && montoEstimado > 0 && { montoEstimado }),
      ...(Number.isInteger(diaVencimiento) && { diaVencimiento }),
      ...(periodicidad && { periodicidad }),
      ...(Number.isInteger(mesAncla) && { mesAncla }),
      ...(typeof activo === "boolean" && { activo }),
    },
  });

  return res.json(servicio);
}

/**
 * POST /hogares/:hogarId/servicios/:servicioId/pagar
 * Body: { periodo, montoPagado? }  → marca el período como pagado (ej: "2026-06")
 */
export async function pagarServicio(req: Request, res: Response) {
  const { periodo, montoPagado } = req.body ?? {};

  if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
    return res.status(400).json({ error: "periodo es obligatorio con formato YYYY-MM, ej: 2026-06." });
  }

  const servicio = await prisma.servicio.findFirst({
    where: { id: req.params.servicioId, hogarId: req.params.hogarId },
  });
  if (!servicio) {
    return res.status(404).json({ error: "Servicio no encontrado." });
  }

  const yaPagado = await prisma.pagoServicio.findUnique({
    where: { servicioId_periodo: { servicioId: servicio.id, periodo } },
  });
  if (yaPagado) {
    return res.status(409).json({ error: `${servicio.nombre} ya está marcado como pagado en ${periodo}.` });
  }

  const pago = await prisma.pagoServicio.create({
    data: { servicioId: servicio.id, periodo, montoPagado: montoPagado ?? null },
  });

  return res.status(201).json(pago);
}
