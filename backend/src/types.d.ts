// Extensión de los tipos de Express: datos que los middlewares
// le agregan al request una vez validado el token y la membresía.
declare namespace Express {
  interface Request {
    usuarioId?: string;
    miembro?: {
      id: string;
      rol: "dueno" | "colaborador" | "lector";
    };
  }
}
