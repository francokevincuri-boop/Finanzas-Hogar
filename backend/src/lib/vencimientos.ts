// Vencimientos calculados al vuelo (decisión §12 del contrato):
// no hay tabla Vencimiento; se arman en el momento leyendo servicios y cuotas.

import { prisma } from "./prisma";

export type Vencimiento = {
  origen: "servicio" | "cuota";
  origenId: string;
  nombre: string;
  monto: number;
  fecha: string; // YYYY-MM-DD
  estado: "pagado" | "pendiente" | "vencido";
};

/** ¿El servicio vence en este mes? (según periodicidad y mes ancla) */
function serviceVenceEnMes(periodicidad: string, mesAncla: number, mes: number): boolean {
  if (periodicidad === "mensual") return true;
  if (periodicidad === "bimestral") return (mes - mesAncla) % 2 === 0;
  return mes === mesAncla; // anual
}

/** Día ajustado al largo del mes (31 en febrero → 28/29). */
function diaAjustado(anio: number, mes: number, dia: number): Date {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate(); // mes es 1-12 acá
  return new Date(Date.UTC(anio, mes - 1, Math.min(dia, ultimo)));
}

/**
 * Calcula todos los vencimientos de un hogar entre dos fechas (inclusive).
 */
export async function calcularVencimientos(hogarId: string, desde: Date, hasta: Date): Promise<Vencimiento[]> {
  const hoy = new Date();
  const resultado: Vencimiento[] = [];

  // 1. Servicios: una ocurrencia por cada mes del rango donde corresponda
  const servicios = await prisma.servicio.findMany({
    where: { hogarId, activo: true },
    include: { pagos: true },
  });

  // Recorrer cada mes del rango
  const cursor = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1));
  while (cursor.getTime() <= hasta.getTime()) {
    const anio = cursor.getUTCFullYear();
    const mes = cursor.getUTCMonth() + 1; // 1-12
    const periodo = `${anio}-${String(mes).padStart(2, "0")}`;

    for (const s of servicios) {
      if (!serviceVenceEnMes(s.periodicidad, s.mesAncla, mes)) continue;

      const fechaVto = diaAjustado(anio, mes, s.diaVencimiento);
      if (fechaVto.getTime() < desde.getTime() || fechaVto.getTime() > hasta.getTime()) continue;

      const pago = s.pagos.find((p) => p.periodo === periodo);
      resultado.push({
        origen: "servicio",
        origenId: s.id,
        nombre: s.nombre,
        monto: Number(pago?.montoPagado ?? s.montoEstimado),
        fecha: fechaVto.toISOString().slice(0, 10),
        estado: pago ? "pagado" : fechaVto.getTime() < hoy.getTime() ? "vencido" : "pendiente",
      });
    }

    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // 2. Cuotas de tarjeta que vencen en el rango
  const cuotas = await prisma.cuota.findMany({
    where: {
      consumo: { tarjeta: { hogarId } },
      fechaVencimiento: { gte: desde, lte: hasta },
    },
    include: { consumo: { include: { tarjeta: { select: { nombre: true } } } } },
    orderBy: { fechaVencimiento: "asc" },
  });

  for (const c of cuotas) {
    resultado.push({
      origen: "cuota",
      origenId: c.id,
      nombre: `${c.consumo.tarjeta.nombre}: ${c.consumo.descripcion} (${c.numero}/${c.totalCuotas})`,
      monto: Number(c.monto),
      fecha: c.fechaVencimiento.toISOString().slice(0, 10),
      estado: c.pagada ? "pagado" : c.fechaVencimiento.getTime() < hoy.getTime() ? "vencido" : "pendiente",
    });
  }

  // Ordenar todo por fecha
  resultado.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return resultado;
}
