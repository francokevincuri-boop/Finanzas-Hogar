// Lógica de fechas de tarjeta: en qué resumen cae cada cuota.
//
// Regla: una compra entra en el resumen cuyo CIERRE es el primero
// posterior a la fecha de compra. El pago vence el día de vencimiento
// que sigue a ese cierre. Las cuotas siguientes vencen mes a mes.

/** Devuelve una fecha con el día pedido, ajustado si el mes es más corto (ej: 31 en febrero → 28). */
function fechaConDia(anio: number, mes: number, dia: number): Date {
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes, Math.min(dia, ultimoDia)));
}

/**
 * Calcula el vencimiento de la PRIMERA cuota de una compra.
 */
export function primerVencimiento(fechaCompra: Date, diaCierre: number, diaVencimiento: number): Date {
  let anio = fechaCompra.getUTCFullYear();
  let mes = fechaCompra.getUTCMonth();

  // ¿En qué cierre cae la compra? Si ya pasó el cierre de este mes, va al del mes que viene.
  const cierreDelMes = fechaConDia(anio, mes, diaCierre);
  if (fechaCompra.getTime() > cierreDelMes.getTime()) {
    mes += 1;
  }

  // El vencimiento sigue al cierre. Si el día de vencimiento es anterior o igual
  // al día de cierre (ej: cierra el 28, vence el 10), el pago cae al mes siguiente.
  if (diaVencimiento <= diaCierre) {
    mes += 1;
  }

  return fechaConDia(anio, mes, diaVencimiento);
}

/** Vencimiento de la cuota N (numerada desde 1): N-1 meses después de la primera. */
export function vencimientoCuota(primera: Date, numero: number): Date {
  return fechaConDia(primera.getUTCFullYear(), primera.getUTCMonth() + (numero - 1), primera.getUTCDate());
}

/** Divide un monto total en N cuotas de 2 decimales; la última absorbe el redondeo. */
export function dividirEnCuotas(montoTotal: number, totalCuotas: number): number[] {
  const base = Math.floor((montoTotal / totalCuotas) * 100) / 100;
  const cuotas = Array(totalCuotas).fill(base);
  cuotas[totalCuotas - 1] = Math.round((montoTotal - base * (totalCuotas - 1)) * 100) / 100;
  return cuotas;
}
