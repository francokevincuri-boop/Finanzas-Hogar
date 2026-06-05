import { Router } from "express";
import { requireRol } from "../middleware/auth";
import { listarCategorias, crearCategoria, precargarCategorias } from "../controllers/categorias.controller";

const router = Router({ mergeParams: true });

const puedeEditar = requireRol("dueno", "colaborador");

router.get("/", listarCategorias);
router.post("/", puedeEditar, crearCategoria);
router.post("/precargar", puedeEditar, precargarCategorias);

export default router;
