import { Router } from "express";
import { requireAuth, requireMiembroHogar, requireRol } from "../middleware/auth";
import { listarHogares, crearHogar, listarMiembros, agregarMiembro } from "../controllers/hogares.controller";

const router = Router();

// Todas las rutas de hogares exigen estar logueado
router.use(requireAuth);

router.get("/", listarHogares);
router.post("/", crearHogar);

// Las rutas con :hogarId exigen además ser miembro de ESE hogar
router.get("/:hogarId/miembros", requireMiembroHogar, listarMiembros);
router.post("/:hogarId/miembros", requireMiembroHogar, requireRol("dueno"), agregarMiembro);

export default router;
