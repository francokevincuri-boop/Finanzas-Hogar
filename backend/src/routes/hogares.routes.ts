import { Router } from "express";
import { requireAuth, requireMiembroHogar, requireRol } from "../middleware/auth";
import { listarHogares, crearHogar, listarMiembros, agregarMiembro } from "../controllers/hogares.controller";
import cuentasRoutes from "./cuentas.routes";
import categoriasRoutes from "./categorias.routes";
import transaccionesRoutes from "./transacciones.routes";
import tarjetasRoutes from "./tarjetas.routes";

const router = Router();

// Todas las rutas de hogares exigen estar logueado
router.use(requireAuth);

router.get("/", listarHogares);
router.post("/", crearHogar);

// Las rutas con :hogarId exigen además ser miembro de ESE hogar
router.get("/:hogarId/miembros", requireMiembroHogar, listarMiembros);
router.post("/:hogarId/miembros", requireMiembroHogar, requireRol("dueno"), agregarMiembro);

// Submódulos del hogar
router.use("/:hogarId/cuentas", requireMiembroHogar, cuentasRoutes);
router.use("/:hogarId/categorias", requireMiembroHogar, categoriasRoutes);
router.use("/:hogarId/transacciones", requireMiembroHogar, transaccionesRoutes);
router.use("/:hogarId/tarjetas", requireMiembroHogar, tarjetasRoutes);

export default router;
