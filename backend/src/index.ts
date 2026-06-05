import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import hogaresRoutes from "./routes/hogares.routes";
import { cotizacionDolar, inflacion } from "./controllers/cotizaciones.controller";

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint de salud: si responde, el server está vivo
app.get("/health", (_req, res) => {
  res.json({ ok: true, servicio: "finanzas-hogar-api", fecha: new Date().toISOString() });
});

// Rutas por módulo
app.use("/auth", authRoutes);
app.use("/hogares", hogaresRoutes);

// Datos externos (públicos: no exponen nada del hogar)
app.get("/cotizaciones/dolar", cotizacionDolar);
app.get("/inflacion", inflacion);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`API Finanzas del Hogar escuchando en http://localhost:${PORT}`);
});
