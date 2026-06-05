import { Router } from "express";
import { requireRol } from "../middleware/auth";
import { listarTransacciones, crearTransaccion, eliminarTransaccion } from "../controllers/transacciones.controller";

const router = Router({ mergeParams: true });

const puedeEditar = requireRol("dueno", "colaborador");

router.get("/", listarTransacciones);
router.post("/", puedeEditar, crearTransaccion);
router.delete("/:transaccionId", puedeEditar, eliminarTransaccion);

export default router;
