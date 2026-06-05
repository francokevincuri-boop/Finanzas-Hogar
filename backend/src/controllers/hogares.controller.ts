import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

/**
 * GET /hogares
 * Lista los hogares del usuario logueado, con su rol en cada uno.
 */
export async function listarHogares(req: Request, res: Response) {
  const membresias = await prisma.miembroHogar.findMany({
    where: { usuarioId: req.usuarioId },
    include: { hogar: true },
    orderBy: { creadoEn: "asc" },
  });

  return res.json(
    membresias.map((m) => ({
      id: m.hogar.id,
      nombre: m.hogar.nombre,
      monedaBase: m.hogar.monedaBase,
      miRol: m.rol,
    }))
  );
}

/**
 * POST /hogares
 * Body: { nombre, monedaBase? }
 * Crea un hogar nuevo con el usuario logueado como dueño.
 * (Caso de uso: crear el hogar de tus padres para administrarlo.)
 */
export async function crearHogar(req: Request, res: Response) {
  const { nombre, monedaBase } = req.body ?? {};

  if (!nombre?.trim()) {
    return res.status(400).json({ error: "El nombre del hogar es obligatorio." });
  }

  const hogar = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.hogar.create({
      data: { nombre: nombre.trim(), monedaBase: monedaBase ?? "ARS" },
    });
    await tx.miembroHogar.create({
      data: { usuarioId: req.usuarioId!, hogarId: nuevo.id, rol: "dueno" },
    });
    return nuevo;
  });

  return res.status(201).json({ id: hogar.id, nombre: hogar.nombre, monedaBase: hogar.monedaBase, miRol: "dueno" });
}

/**
 * GET /hogares/:hogarId/miembros
 * Lista los miembros del hogar (requiere ser miembro).
 */
export async function listarMiembros(req: Request, res: Response) {
  const miembros = await prisma.miembroHogar.findMany({
    where: { hogarId: req.params.hogarId },
    include: { usuario: { select: { id: true, nombre: true, email: true } } },
    orderBy: { creadoEn: "asc" },
  });

  return res.json(
    miembros.map((m) => ({
      miembroId: m.id,
      usuarioId: m.usuario.id,
      nombre: m.usuario.nombre,
      email: m.usuario.email,
      rol: m.rol,
    }))
  );
}

/**
 * POST /hogares/:hogarId/miembros
 * Body: { email, rol }
 * Agrega a un usuario existente al hogar. Solo el dueño puede invitar.
 * (Invitación por email a usuarios que no existen todavía: pendiente, más adelante.)
 */
export async function agregarMiembro(req: Request, res: Response) {
  const { email, rol } = req.body ?? {};
  const rolesValidos = ["dueno", "colaborador", "lector"];

  if (!email || !rol) {
    return res.status(400).json({ error: "Faltan campos: email y rol son obligatorios." });
  }
  if (!rolesValidos.includes(rol)) {
    return res.status(400).json({ error: `Rol inválido. Opciones: ${rolesValidos.join(", ")}.` });
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    return res.status(404).json({ error: "No existe un usuario con ese email. Pedile que se registre primero." });
  }

  const yaEsMiembro = await prisma.miembroHogar.findUnique({
    where: { usuarioId_hogarId: { usuarioId: usuario.id, hogarId: req.params.hogarId } },
  });
  if (yaEsMiembro) {
    return res.status(409).json({ error: "Ese usuario ya es miembro de este hogar." });
  }

  const miembro = await prisma.miembroHogar.create({
    data: { usuarioId: usuario.id, hogarId: req.params.hogarId, rol },
  });

  return res.status(201).json({
    miembroId: miembro.id,
    usuarioId: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: miembro.rol,
  });
}
