import { Router } from "express";
import { requireAuth, requireMiembroHogar, requireRol } from "../middleware/auth";
import { listarHogares, crearHogar, listarMiembros, agregarMiembro } from "../controllers/hogares.controller";
import cuentasRoutes from "./cuentas.routes";
import categoriasRoutes from "./categorias.routes";
import transaccionesRoutes from "./transacciones.routes";
import tarjetasRoutes from "./tarjetas.routes";
import serviciosRoutes from "./servicios.routes";
import inversionesRoutes from "./inversiones.routes";
import { patrimonio } from "../controllers/inversiones.controller";
import {
  listarVencimientos,
  balanceMensual,
  verPresupuesto,
  asignarPresupuesto,
} from "../controllers/proyeccion.controller";

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
router.use("/:hogarId/servicios", requireMiembroHogar, serviciosRoutes);
router.use("/:hogarId/inversiones", requireMiembroHogar, inversionesRoutes);

// Patrimonio neto (Etapa 4)
router.get("/:hogarId/patrimonio", requireMiembroHogar, patrimonio);

// Proyección (Etapa 3)
router.get("/:hogarId/vencimientos", requireMiembroHogar, listarVencimientos);
router.get("/:hogarId/balance/:mes", requireMiembroHogar, balanceMensual);
router.get("/:hogarId/presupuesto/:mes", requireMiembroHogar, verPresupuesto);
router.put("/:hogarId/presupuesto/:mes", requireMiembroHogar, requireRol("dueno", "colaborador"), asignarPresupuesto);

export default router;
