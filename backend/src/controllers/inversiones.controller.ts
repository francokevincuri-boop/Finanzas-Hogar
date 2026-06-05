import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { obtenerDolar } from "../lib/externos";

const TIPOS_INVERSION = ["plazo_fijo", "fci", "usd", "cedear", "cripto"] as const;
type TipoInversion = (typeof TIPOS_INVERSION)[number];

/** GET /hogares/:hogarId/inversiones */
export async function listarInversiones(req: Request, res: Response) {
  const inversiones = await prisma.inversion.findMany({
    where: { hogarId: req.params.hogarId },
    orderBy: { fecha: "desc" },
  });
  return res.json(inversiones);
}

/**
 * POST /hogares/:hogarId/inversiones
 * Body: { tipo, nombre, monto, moneda?, fecha?, valorActual? }
 */
export async function crearInversion(req: Request, res: Response) {
  const { tipo, nombre, monto, moneda, fecha, valorActual } = req.body ?? {};

  if (!tipo || !nombre?.trim() || monto === undefined) {
    return res.status(400).json({ error: "Faltan campos: tipo, nombre y monto son obligatorios." });
  }
  if (!TIPOS_INVERSION.includes(tipo)) {
    return res.status(400).json({ error: `Tipo inválido. Opciones: ${TIPOS_INVERSION.join(", ")}.` });
  }
  if (typeof monto !== "number" || monto <= 0) {
    return res.status(400).json({ error: "El monto debe ser un número mayor a cero." });
  }
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: "La fecha debe tener formato YYYY-MM-DD." });
  }

  const inversion = await prisma.inversion.create({
    data: {
      hogarId: req.params.hogarId,
      tipo: tipo as TipoInversion,
      nombre: nombre.trim(),
      monto,
      moneda: moneda ?? (tipo === "usd" || tipo === "cedear" || tipo === "cripto" ? "USD" : "ARS"),
      fecha: fecha ? new Date(`${fecha}T00:00:00Z`) : new Date(),
      valorActual: valorActual ?? null,
    },
  });

  return res.status(201).json(inversion);
}

/**
 * PUT /hogares/:hogarId/inversiones/:inversionId
 * Uso típico: actualizar valorActual ("mi plazo fijo ya vale X").
 */
export async function actualizarInversion(req: Request, res: Response) {
  const { nombre, valorActual, monto } = req.body ?? {};

  const existente = await prisma.inversion.findFirst({
    where: { id: req.params.inversionId, hogarId: req.params.hogarId },
  });
  if (!existente) {
    return res.status(404).json({ error: "Inversión no encontrada." });
  }

  const inversion = await prisma.inversion.update({
    where: { id: existente.id },
    data: {
      ...(nombre?.trim() && { nombre: nombre.trim() }),
      ...(typeof valorActual === "number" && valorActual >= 0 && { valorActual }),
      ...(typeof monto === "number" && monto > 0 && { monto }),
    },
  });

  return res.json(inversion);
}

/** DELETE /hogares/:hogarId/inversiones/:inversionId (rescate/cierre) */
export async function eliminarInversion(req: Request, res: Response) {
  const existente = await prisma.inversion.findFirst({
    where: { id: req.params.inversionId, hogarId: req.params.hogarId },
  });
  if (!existente) {
    return res.status(404).json({ error: "Inversión no encontrada." });
  }

  await prisma.inversion.delete({ where: { id: existente.id } });
  return res.status(204).send();
}

/**
 * GET /hogares/:hogarId/patrimonio
 * Foto completa: cuentas + inversiones, por moneda, valuado todo en ARS
 * a la cotización oficial del día.
 */
export async function patrimonio(req: Request, res: Response) {
  const hogarId = req.params.hogarId;

  const [cuentas, inversiones] = await Promise.all([
    prisma.cuenta.findMany({ where: { hogarId } }),
    prisma.inversion.findMany({ where: { hogarId } }),
  ]);

  const r2 = (n: number) => Math.round(n * 100) / 100;

  // Sumar por moneda (las inversiones valen su valorActual, o lo invertido si no se actualizó)
  const porMoneda: Record<string, { cuentas: number; inversiones: number }> = {};
  for (const c of cuentas) {
    porMoneda[c.moneda] ??= { cuentas: 0, inversiones: 0 };
    porMoneda[c.moneda].cuentas = r2(porMoneda[c.moneda].cuentas + Number(c.saldoActual));
  }
  for (const i of inversiones) {
    porMoneda[i.moneda] ??= { cuentas: 0, inversiones: 0 };
    porMoneda[i.moneda].inversiones = r2(porMoneda[i.moneda].inversiones + Number(i.valorActual ?? i.monto));
  }

  // Valuar todo en ARS con la cotización oficial de hoy
  let dolar = null;
  try {
    dolar = await obtenerDolar();
  } catch {
    // sin cotización, devolvemos el desglose igual
  }

  let totalARS: number | null = null;
  if (dolar) {
    totalARS = 0;
    for (const [moneda, valores] of Object.entries(porMoneda)) {
      const subtotal = valores.cuentas + valores.inversiones;
      totalARS += moneda === "USD" ? subtotal * dolar.oficial : subtotal;
    }
    totalARS = r2(totalARS);
  }

  return res.json({
    fecha: new Date().toISOString().slice(0, 10),
    porMoneda,
    cotizacionUsada: dolar ? { oficial: dolar.oficial, fecha: dolar.fecha } : null,
    patrimonioNetoARS: totalARS,
  });
}
