import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { firmarToken } from "../middleware/auth";
import { CATEGORIAS_INICIALES } from "../lib/categoriasIniciales";

/**
 * POST /auth/register
 * Body: { email, nombre, password, nombreHogar? }
 * Crea el usuario + su primer hogar (con él como dueño) en una sola transacción.
 */
export async function register(req: Request, res: Response) {
  const { email, nombre, password, nombreHogar } = req.body ?? {};

  // Validaciones simples
  if (!email || !nombre || !password) {
    return res.status(400).json({ error: "Faltan campos: email, nombre y password son obligatorios." });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "El email no tiene un formato válido." });
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese email." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Transacción: si algo falla, no queda nada a medias
  const resultado = await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: { email, nombre, passwordHash },
    });
    const hogar = await tx.hogar.create({
      data: { nombre: nombreHogar?.trim() || `Hogar de ${nombre}` },
    });
    await tx.miembroHogar.create({
      data: { usuarioId: usuario.id, hogarId: hogar.id, rol: "dueno" },
    });
    // Categorías argentinas precargadas para no arrancar de cero
    await tx.categoria.createMany({
      data: CATEGORIAS_INICIALES.map((c) => ({ ...c, hogarId: hogar.id })),
    });
    return { usuario, hogar };
  });

  return res.status(201).json({
    token: firmarToken(resultado.usuario.id),
    usuario: { id: resultado.usuario.id, email, nombre },
    hogar: { id: resultado.hogar.id, nombre: resultado.hogar.nombre },
  });
}

/**
 * POST /auth/login
 * Body: { email, password }
 */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "Faltan campos: email y password son obligatorios." });
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  // Mismo mensaje si el email no existe o la contraseña está mal:
  // no le damos pistas a un atacante sobre qué emails están registrados.
  const passwordOk = usuario && (await bcrypt.compare(password, usuario.passwordHash));
  if (!passwordOk) {
    return res.status(401).json({ error: "Email o contraseña incorrectos." });
  }

  return res.json({
    token: firmarToken(usuario.id),
    usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre },
  });
}
