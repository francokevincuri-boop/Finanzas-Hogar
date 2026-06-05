// Datos externos: dólar (DolarApi.com) e inflación (IPC INDEC vía datos.gob.ar).
// Estrategia: consultar la API, cachear en DB. Si la API está caída, servir lo último cacheado.

import { prisma } from "./prisma";

const URL_DOLAR = "https://dolarapi.com/v1/dolares";
const URL_IPC =
  "https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=1000&sort=asc";

export type Dolar = {
  fecha: string;
  oficial: number;
  blue: number;
  mep: number;
  fuente: "api" | "cache";
};

/**
 * Cotización del dólar de HOY. Una sola llamada a la API por día:
 * si ya está cacheada la de hoy, se devuelve directo.
 */
export async function obtenerDolar(): Promise<Dolar> {
  const hoy = new Date().toISOString().slice(0, 10);

  const cacheada = await prisma.cotizacionDolar.findUnique({ where: { fecha: hoy } });
  if (cacheada) {
    return { fecha: hoy, oficial: Number(cacheada.oficial), blue: Number(cacheada.blue), mep: Number(cacheada.mep), fuente: "cache" };
  }

  try {
    const res = await fetch(URL_DOLAR);
    if (!res.ok) throw new Error(`DolarApi respondió ${res.status}`);
    const casas = (await res.json()) as Array<{ casa: string; venta: number }>;

    const venta = (casa: string) => {
      const c = casas.find((x) => x.casa === casa);
      if (!c) throw new Error(`DolarApi no devolvió la casa "${casa}"`);
      return c.venta;
    };

    const datos = { oficial: venta("oficial"), blue: venta("blue"), mep: venta("bolsa") };

    await prisma.cotizacionDolar.upsert({
      where: { fecha: hoy },
      update: datos,
      create: { fecha: hoy, ...datos },
    });

    return { fecha: hoy, ...datos, fuente: "api" };
  } catch {
    // API caída: servir la última cotización guardada
    const ultima = await prisma.cotizacionDolar.findFirst({ orderBy: { fecha: "desc" } });
    if (!ultima) throw new Error("No hay cotización disponible: la API no responde y el caché está vacío.");
    return { fecha: ultima.fecha, oficial: Number(ultima.oficial), blue: Number(ultima.blue), mep: Number(ultima.mep), fuente: "cache" };
  }
}

/**
 * Serie de IPC. Refresca el caché desde datos.gob.ar (si responde) y
 * devuelve los índices con la variación mensual calculada.
 */
export async function obtenerInflacion(): Promise<Array<{ mes: string; ipc: number; variacionMensual: number | null }>> {
  try {
    const res = await fetch(URL_IPC);
    if (!res.ok) throw new Error(`datos.gob.ar respondió ${res.status}`);
    const json = (await res.json()) as { data: Array<[string, number]> };

    await prisma.indiceInflacion.createMany({
      data: json.data.map(([fecha, ipc]) => ({ mes: fecha.slice(0, 7), ipc })),
      skipDuplicates: true, // los meses ya cacheados no se tocan
    });
  } catch {
    // API caída: seguimos con lo que haya en el caché
  }

  const indices = await prisma.indiceInflacion.findMany({ orderBy: { mes: "asc" } });

  return indices.map((x, i) => ({
    mes: x.mes,
    ipc: Number(x.ipc),
    variacionMensual:
      i === 0 ? null : Math.round((Number(x.ipc) / Number(indices[i - 1].ipc) - 1) * 10000) / 100, // % con 2 decimales
  }));
}
