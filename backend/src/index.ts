import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint de salud: si responde, el server está vivo
app.get("/health", (_req, res) => {
  res.json({ ok: true, servicio: "finanzas-hogar-api", fecha: new Date().toISOString() });
});

// Acá se montan las rutas por módulo (Etapa 1): auth, hogares, cuentas, transacciones

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`API Finanzas del Hogar escuchando en http://localhost:${PORT}`);
});
