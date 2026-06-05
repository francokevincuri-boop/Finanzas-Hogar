import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("Falta JWT_SECRET en el archivo .env");
}

/** Firma un token para un usuario. Expira en 7 días. */
export function firmarToken(usuarioId: string): string {
  return jwt.sign({ usuarioId }, JWT_SECRET as string, { expiresIn: "7d" });
}

/**
 * Middleware 1 — ¿Quién sos?
 * Exige header "Authorization: Bearer <token>" y deja el usuarioId en el request.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Falta el token. Enviá el header Authorization: Bearer <token>." });
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET as string) as { usuarioId: string };
    req.usuarioId = payload.usuarioId;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o vencido. Volvé a iniciar sesión." });
  }
}

/**
 * Middleware 2 — ¿Podés tocar ESTE hogar?
 * La línea de defensa multi-tenant (CLAUDE.md §5): para rutas /hogares/:hogarId/...
 * verifica que el usuario logueado sea miembro de ese hogar. Si no lo es,
 * responde 404 (no revelamos que el hogar existe).
 */
export async function requireMiembroHogar(req: Request, res: Response, next: NextFunction) {
  const { hogarId } = req.params;

  const miembro = await prisma.miembroHogar.findUnique({
    where: { usuarioId_hogarId: { usuarioId: req.usuarioId!, hogarId } },
  });

  if (!miembro) {
    return res.status(404).json({ error: "Hogar no encontrado." });
  }

  req.miembro = { id: miembro.id, rol: miembro.rol };
  next();
}

/**
 * Middleware 3 — ¿Tu rol alcanza?
 * Uso: requireRol("dueno") o requireRol("dueno", "colaborador").
 * Los lectores pueden ver pero no modificar.
 */
export function requireRol(...rolesPermitidos: Array<"dueno" | "colaborador" | "lector">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.miembro || !rolesPermitidos.includes(req.miembro.rol)) {
      return res.status(403).json({ error: "Tu rol en este hogar no permite esta acción." });
    }
    next();
  };
}
