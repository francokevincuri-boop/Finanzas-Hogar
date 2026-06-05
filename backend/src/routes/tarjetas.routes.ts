import { Router } from "express";
import { requireRol } from "../middleware/auth";
import {
  listarTarjetas,
  crearTarjeta,
  crearConsumo,
  listarConsumos,
  proyeccionTarjeta,
} from "../controllers/tarjetas.controller";

const router = Router({ mergeParams: true });

const puedeEditar = requireRol("dueno", "colaborador");

router.get("/", listarTarjetas);
router.post("/", puedeEditar, crearTarjeta);
router.get("/:tarjetaId/consumos", listarConsumos);
router.post("/:tarjetaId/consumos", puedeEditar, crearConsumo);
router.get("/:tarjetaId/proyeccion", proyeccionTarjeta);

export default router;
