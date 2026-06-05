-- CreateEnum
CREATE TYPE "Periodicidad" AS ENUM ('mensual', 'bimestral', 'anual');

-- CreateTable
CREATE TABLE "servicios" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto_estimado" DECIMAL(15,2) NOT NULL,
    "periodicidad" "Periodicidad" NOT NULL DEFAULT 'mensual',
    "dia_vencimiento" INTEGER NOT NULL,
    "mes_ancla" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_servicio" (
    "id" TEXT NOT NULL,
    "servicio_id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "monto_pagado" DECIMAL(15,2),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuestos" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "monto_asignado" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "servicios_hogar_id_idx" ON "servicios"("hogar_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_servicio_servicio_id_periodo_key" ON "pagos_servicio"("servicio_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "presupuestos_hogar_id_categoria_id_mes_key" ON "presupuestos"("hogar_id", "categoria_id", "mes");

-- AddForeignKey
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_servicio" ADD CONSTRAINT "pagos_servicio_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
