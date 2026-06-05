import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint de salud: si responde, el server está vivo
app.get("/health", (_req, res) => {
  res.json({ ok: true, servicio: "finanzas-hogar-api", fecha: new Date().toISOString() });
});

// Rutas por módulo
app.use("/auth", authRoutes);
// Próximos: hogares, cuentas, categorías, transacciones

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`API Finanzas del Hogar escuchando en http://localhost:${PORT}`);
});
