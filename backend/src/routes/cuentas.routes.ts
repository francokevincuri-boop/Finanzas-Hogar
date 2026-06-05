import { Router } from "express";
import { requireRol } from "../middleware/auth";
import { listarCuentas, crearCuenta, actualizarCuenta, eliminarCuenta } from "../controllers/cuentas.controller";

// mergeParams: true → este router puede leer :hogarId de la ruta padre
const router = Router({ mergeParams: true });

const puedeEditar = requireRol("dueno", "colaborador");

router.get("/", listarCuentas);
router.post("/", puedeEditar, crearCuenta);
router.put("/:cuentaId", puedeEditar, actualizarCuenta);
router.delete("/:cuentaId", puedeEditar, eliminarCuenta);

export default router;
