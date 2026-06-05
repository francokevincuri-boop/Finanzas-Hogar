import { Request, Response } from "express";
import { obtenerDolar, obtenerInflacion } from "../lib/externos";

/** GET /cotizaciones/dolar — oficial, blue y MEP de hoy (con caché diario) */
export async function cotizacionDolar(_req: Request, res: Response) {
  try {
    const dolar = await obtenerDolar();
    return res.json(dolar);
  } catch (e) {
    return res.status(503).json({ error: (e as Error).message });
  }
}

/** GET /inflacion — serie de IPC con variación mensual (%) */
export async function inflacion(_req: Request, res: Response) {
  const serie = await obtenerInflacion();
  if (serie.length === 0) {
    return res.status(503).json({ error: "No hay datos de inflación: la API no responde y el caché está vacío." });
  }
  // Los últimos 13 meses alcanzan para cualquier vista; la serie completa queda en DB
  return res.json(serie.slice(-13));
}
