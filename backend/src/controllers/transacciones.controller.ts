import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

/**
 * GET /hogares/:hogarId/transacciones
 * Filtros opcionales por query string:
 *   ?mes=2026-06          → solo ese mes
 *   ?categoriaId=...      → solo esa categoría
 *   ?miembroId=...        → solo ese miembro
 *   ?cuentaId=...         → solo esa cuenta
 *   ?tipo=gasto|ingreso   → solo ese tipo
 */
export async function listarTransacciones(req: Request, res: Response) {
  const { mes, categoriaId, miembroId, cuentaId, tipo } = req.query;

  // Filtro por mes: desde el día 1 hasta el día 1 del mes siguiente
  let filtroFecha = {};
  if (typeof mes === "string") {
    if (!/^\d{4}-\d{2}$/.test(mes)) {
      return res.status(400).json({ error: "El filtro mes debe tener formato YYYY-MM, ej: 2026-06." });
    }
    const desde = new Date(`${mes}-01T00:00:00Z`);
    const hasta = new Date(desde);
    hasta.setUTCMonth(hasta.getUTCMonth() + 1);
    filtroFecha = { fecha: { gte: desde, lt: hasta } };
  }

  const transacciones = await prisma.transaccion.findMany({
    where: {
      hogarId: req.params.hogarId,
      ...filtroFecha,
      ...(typeof categoriaId === "string" && { categoriaId }),
      ...(typeof miembroId === "string" && { miembroId }),
      ...(typeof cuentaId === "string" && { cuentaId }),
      ...(typeof tipo === "string" && ["ingreso", "gasto", "transferencia"].includes(tipo) && {
        tipo: tipo as "ingreso" | "gasto" | "transferencia",
      }),
    },
    include: {
      cuenta: { select: { nombre: true } },
      categoria: { select: { nombre: true } },
      miembro: { include: { usuario: { select: { nombre: true } } } },
    },
    orderBy: [{ fecha: "desc" }, { creadoEn: "desc" }],
  });

  return res.json(
    transacciones.map((t) => ({
      id: t.id,
      tipo: t.tipo,
      monto: t.monto,
      moneda: t.moneda,
      fecha: t.fecha,
      descripcion: t.descripcion,
      compartida: t.compartida,
      cuenta: t.cuenta.nombre,
      cuentaId: t.cuentaId,
      categoria: t.categoria?.nombre ?? null,
      categoriaId: t.categoriaId,
      miembro: t.miembro?.usuario.nombre ?? null,
    }))
  );
}

/**
 * POST /hogares/:hogarId/transacciones
 * Body: { tipo, monto, cuentaId, categoriaId?, fecha?, descripcion?, compartida? }
 * El saldo de la cuenta se actualiza solo: ingreso suma, gasto resta.
 */
export async function crearTransaccion(req: Request, res: Response) {
  const { tipo, monto, cuentaId, categoriaId, fecha, descripcion, compartida } = req.body ?? {};
  const hogarId = req.params.hogarId;

  // Validaciones
  if (!tipo || monto === undefined || !cuentaId) {
    return res.status(400).json({ error: "Faltan campos: tipo, monto y cuentaId son obligatorios." });
  }
  if (!["ingreso", "gasto"].includes(tipo)) {
    if (tipo === "transferencia") {
      return res.status(400).json({ error: "Las transferencias entre cuentas vienen en el próximo bloque." });
    }
    return res.status(400).json({ error: "Tipo inválido. Opciones: ingreso, gasto." });
  }
  if (typeof monto !== "number" || monto <= 0) {
    return res.status(400).json({ error: "El monto debe ser un número mayor a cero." });
  }
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: "La fecha debe tener formato YYYY-MM-DD, ej: 2026-06-05." });
  }

  // La cuenta tiene que ser de ESTE hogar
  const cuenta = await prisma.cuenta.findFirst({ where: { id: cuentaId, hogarId } });
  if (!cuenta) {
    return res.status(404).json({ error: "Cuenta no encontrada en este hogar." });
  }

  // La categoría (si viene) tiene que ser de este hogar y del tipo correcto
  if (categoriaId) {
    const categoria = await prisma.categoria.findFirst({ where: { id: categoriaId, hogarId } });
    if (!categoria) {
      return res.status(404).json({ error: "Categoría no encontrada en este hogar." });
    }
    if (categoria.tipo !== tipo) {
      return res.status(400).json({ error: `La categoría "${categoria.nombre}" es de tipo ${categoria.tipo}, no ${tipo}.` });
    }
  }

  // Crear transacción + mover saldo, todo o nada
  const transaccion = await prisma.$transaction(async (tx) => {
    const nueva = await tx.transaccion.create({
      data: {
        hogarId,
        cuentaId,
        categoriaId: categoriaId ?? null,
        miembroId: req.miembro!.id, // quién la cargó
        tipo,
        monto,
        moneda: cuenta.moneda,
        fecha: fecha ? new Date(`${fecha}T00:00:00Z`) : new Date(),
        descripcion: descripcion?.trim() || null,
        compartida: compartida ?? false,
      },
    });

    await tx.cuenta.update({
      where: { id: cuentaId },
      data: { saldoActual: tipo === "ingreso" ? { increment: monto } : { decrement: monto } },
    });

    return nueva;
  });

  return res.status(201).json(transaccion);
}

/**
 * DELETE /hogares/:hogarId/transacciones/:transaccionId
 * Elimina la transacción y revierte el efecto en el saldo de la cuenta.
 */
export async function eliminarTransaccion(req: Request, res: Response) {
  const existente = await prisma.transaccion.findFirst({
    where: { id: req.params.transaccionId, hogarId: req.params.hogarId },
  });
  if (!existente) {
    return res.status(404).json({ error: "Transacción no encontrada." });
  }

  await prisma.$transaction(async (tx) => {
    // Revertir el saldo: si era ingreso se resta, si era gasto se devuelve
    await tx.cuenta.update({
      where: { id: existente.cuentaId },
      data: {
        saldoActual:
          existente.tipo === "ingreso" ? { decrement: existente.monto } : { increment: existente.monto },
      },
    });
    await tx.transaccion.delete({ where: { id: existente.id } });
  });

  return res.status(204).send();
}
