-- AlterTable
ALTER TABLE "transacciones" ADD COLUMN     "cuenta_destino_id" TEXT;

-- CreateTable
CREATE TABLE "tarjetas" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "banco" TEXT,
    "limite" DECIMAL(15,2),
    "dia_cierre" INTEGER NOT NULL,
    "dia_vencimiento" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarjetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumos_tarjeta" (
    "id" TEXT NOT NULL,
    "tarjeta_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto_total" DECIMAL(15,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "en_cuotas" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumos_tarjeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuotas" (
    "id" TEXT NOT NULL,
    "consumo_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "total_cuotas" INTEGER NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "pagada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cuotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tarjetas_hogar_id_idx" ON "tarjetas"("hogar_id");

-- CreateIndex
CREATE INDEX "consumos_tarjeta_tarjeta_id_idx" ON "consumos_tarjeta"("tarjeta_id");

-- CreateIndex
CREATE INDEX "cuotas_consumo_id_idx" ON "cuotas"("consumo_id");

-- CreateIndex
CREATE INDEX "cuotas_fecha_vencimiento_idx" ON "cuotas"("fecha_vencimiento");

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_cuenta_destino_id_fkey" FOREIGN KEY ("cuenta_destino_id") REFERENCES "cuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarjetas" ADD CONSTRAINT "tarjetas_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_tarjeta" ADD CONSTRAINT "consumos_tarjeta_tarjeta_id_fkey" FOREIGN KEY ("tarjeta_id") REFERENCES "tarjetas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_consumo_id_fkey" FOREIGN KEY ("consumo_id") REFERENCES "consumos_tarjeta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
