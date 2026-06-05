import { Router } from "express";
import { requireRol } from "../middleware/auth";
import {
  listarInversiones,
  crearInversion,
  actualizarInversion,
  eliminarInversion,
} from "../controllers/inversiones.controller";

const router = Router({ mergeParams: true });

const puedeEditar = requireRol("dueno", "colaborador");

router.get("/", listarInversiones);
router.post("/", puedeEditar, crearInversion);
router.put("/:inversionId", puedeEditar, actualizarInversion);
router.delete("/:inversionId", puedeEditar, eliminarInversion);

export default router;
