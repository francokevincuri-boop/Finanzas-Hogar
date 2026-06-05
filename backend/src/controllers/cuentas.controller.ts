import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

const TIPOS_CUENTA = ["efectivo", "banco", "billetera", "usd", "inversion"] as const;
type TipoCuenta = (typeof TIPOS_CUENTA)[number];

/** GET /hogares/:hogarId/cuentas */
export async function listarCuentas(req: Request, res: Response) {
  const cuentas = await prisma.cuenta.findMany({
    where: { hogarId: req.params.hogarId },
    orderBy: { creadoEn: "asc" },
  });
  return res.json(cuentas);
}

/**
 * POST /hogares/:hogarId/cuentas
 * Body: { nombre, tipo, moneda?, saldoInicial? }
 */
export async function crearCuenta(req: Request, res: Response) {
  const { nombre, tipo, moneda, saldoInicial } = req.body ?? {};

  if (!nombre?.trim() || !tipo) {
    return res.status(400).json({ error: "Faltan campos: nombre y tipo son obligatorios." });
  }
  if (!TIPOS_CUENTA.includes(tipo)) {
    return res.status(400).json({ error: `Tipo inválido. Opciones: ${TIPOS_CUENTA.join(", ")}.` });
  }
  if (saldoInicial !== undefined && typeof saldoInicial !== "number") {
    return res.status(400).json({ error: "saldoInicial debe ser un número." });
  }

  const cuenta = await prisma.cuenta.create({
    data: {
      hogarId: req.params.hogarId,
      nombre: nombre.trim(),
      tipo: tipo as TipoCuenta,
      // Las cuentas tipo "usd" se asumen en dólares salvo que se indique otra cosa
      moneda: moneda ?? (tipo === "usd" ? "USD" : "ARS"),
      saldoActual: saldoInicial ?? 0,
    },
  });

  return res.status(201).json(cuenta);
}

/**
 * PUT /hogares/:hogarId/cuentas/:cuentaId
 * Body: { nombre?, tipo?, moneda? }  (el saldo NO se edita a mano: lo mueven las transacciones)
 */
export async function actualizarCuenta(req: Request, res: Response) {
  const { nombre, tipo, moneda } = req.body ?? {};

  if (tipo && !TIPOS_CUENTA.includes(tipo)) {
    return res.status(400).json({ error: `Tipo inválido. Opciones: ${TIPOS_CUENTA.join(", ")}.` });
  }

  // findFirst con hogarId: nunca tocar cuentas de otro hogar
  const existente = await prisma.cuenta.findFirst({
    where: { id: req.params.cuentaId, hogarId: req.params.hogarId },
  });
  if (!existente) {
    return res.status(404).json({ error: "Cuenta no encontrada." });
  }

  const cuenta = await prisma.cuenta.update({
    where: { id: existente.id },
    data: {
      ...(nombre?.trim() && { nombre: nombre.trim() }),
      ...(tipo && { tipo: tipo as TipoCuenta }),
      ...(moneda && { moneda }),
    },
  });

  return res.json(cuenta);
}

/** DELETE /hogares/:hogarId/cuentas/:cuentaId */
export async function eliminarCuenta(req: Request, res: Response) {
  const existente = await prisma.cuenta.findFirst({
    where: { id: req.params.cuentaId, hogarId: req.params.hogarId },
  });
  if (!existente) {
    return res.status(404).json({ error: "Cuenta no encontrada." });
  }

  // Si tiene movimientos, no se borra: se perdería historia financiera
  const movimientos = await prisma.transaccion.count({ where: { cuentaId: existente.id } });
  if (movimientos > 0) {
    return res.status(409).json({
      error: `La cuenta tiene ${movimientos} transacciones. No se puede eliminar para no perder historial.`,
    });
  }

  await prisma.cuenta.delete({ where: { id: existente.id } });
  return res.status(204).send();
}
