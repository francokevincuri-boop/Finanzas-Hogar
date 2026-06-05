import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { CATEGORIAS_INICIALES } from "../lib/categoriasIniciales";

/** GET /hogares/:hogarId/categorias */
export async function listarCategorias(req: Request, res: Response) {
  const categorias = await prisma.categoria.findMany({
    where: { hogarId: req.params.hogarId },
    orderBy: [{ tipo: "asc" }, { esFijo: "desc" }, { nombre: "asc" }],
  });
  return res.json(categorias);
}

/**
 * POST /hogares/:hogarId/categorias
 * Body: { nombre, tipo, esFijo? }
 */
export async function crearCategoria(req: Request, res: Response) {
  const { nombre, tipo, esFijo } = req.body ?? {};

  if (!nombre?.trim() || !tipo) {
    return res.status(400).json({ error: "Faltan campos: nombre y tipo son obligatorios." });
  }
  if (!["gasto", "ingreso"].includes(tipo)) {
    return res.status(400).json({ error: "Tipo inválido. Opciones: gasto, ingreso." });
  }

  const duplicada = await prisma.categoria.findFirst({
    where: { hogarId: req.params.hogarId, nombre: { equals: nombre.trim(), mode: "insensitive" } },
  });
  if (duplicada) {
    return res.status(409).json({ error: "Ya existe una categoría con ese nombre en este hogar." });
  }

  const categoria = await prisma.categoria.create({
    data: {
      hogarId: req.params.hogarId,
      nombre: nombre.trim(),
      tipo,
      esFijo: esFijo ?? false,
    },
  });

  return res.status(201).json(categoria);
}

/**
 * POST /hogares/:hogarId/categorias/precargar
 * Carga el set inicial argentino en hogares que todavía no tienen categorías.
 * (Los hogares nuevos ya las traen; esto es para hogares creados antes.)
 */
export async function precargarCategorias(req: Request, res: Response) {
  const existentes = await prisma.categoria.count({ where: { hogarId: req.params.hogarId } });
  if (existentes > 0) {
    return res.status(409).json({ error: "Este hogar ya tiene categorías. La precarga es solo para hogares vacíos." });
  }

  await prisma.categoria.createMany({
    data: CATEGORIAS_INICIALES.map((c) => ({ ...c, hogarId: req.params.hogarId })),
  });

  return res.status(201).json({ ok: true, cargadas: CATEGORIAS_INICIALES.length });
}
