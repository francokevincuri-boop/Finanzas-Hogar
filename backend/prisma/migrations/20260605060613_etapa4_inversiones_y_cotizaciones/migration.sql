-- CreateEnum
CREATE TYPE "TipoInversion" AS ENUM ('plazo_fijo', 'fci', 'usd', 'cedear', 'cripto');

-- AlterTable
ALTER TABLE "transacciones" ADD COLUMN     "cotizacion" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "inversiones" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "tipo" "TipoInversion" NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "fecha" DATE NOT NULL,
    "valor_actual" DECIMAL(15,2),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inversiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizaciones_dolar" (
    "fecha" TEXT NOT NULL,
    "oficial" DECIMAL(10,2) NOT NULL,
    "blue" DECIMAL(10,2) NOT NULL,
    "mep" DECIMAL(10,2) NOT NULL,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotizaciones_dolar_pkey" PRIMARY KEY ("fecha")
);

-- CreateTable
CREATE TABLE "indices_inflacion" (
    "mes" TEXT NOT NULL,
    "ipc" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "indices_inflacion_pkey" PRIMARY KEY ("mes")
);

-- CreateIndex
CREATE INDEX "inversiones_hogar_id_idx" ON "inversiones"("hogar_id");

-- AddForeignKey
ALTER TABLE "inversiones" ADD CONSTRAINT "inversiones_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
