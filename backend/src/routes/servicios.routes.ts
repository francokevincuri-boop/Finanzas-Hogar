import { Router } from "express";
import { requireRol } from "../middleware/auth";
import { listarServicios, crearServicio, actualizarServicio, pagarServicio } from "../controllers/servicios.controller";

const router = Router({ mergeParams: true });

const puedeEditar = requireRol("dueno", "colaborador");

router.get("/", listarServicios);
router.post("/", puedeEditar, crearServicio);
router.put("/:servicioId", puedeEditar, actualizarServicio);
router.post("/:servicioId/pagar", puedeEditar, pagarServicio);

export default router;
