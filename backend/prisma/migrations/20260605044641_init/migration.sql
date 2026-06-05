-- CreateEnum
CREATE TYPE "RolMiembro" AS ENUM ('dueno', 'colaborador', 'lector');

-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('efectivo', 'banco', 'billetera', 'usd', 'inversion');

-- CreateEnum
CREATE TYPE "TipoCategoria" AS ENUM ('gasto', 'ingreso');

-- CreateEnum
CREATE TYPE "TipoTransaccion" AS ENUM ('ingreso', 'gasto', 'transferencia');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hogares" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "moneda_base" TEXT NOT NULL DEFAULT 'ARS',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hogares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "miembros_hogar" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "rol" "RolMiembro" NOT NULL DEFAULT 'dueno',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "miembros_hogar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "saldo_actual" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCategoria" NOT NULL,
    "es_fijo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacciones" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "categoria_id" TEXT,
    "miembro_id" TEXT,
    "tipo" "TipoTransaccion" NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "fecha" DATE NOT NULL,
    "descripcion" TEXT,
    "compartida" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transacciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "miembros_hogar_usuario_id_hogar_id_key" ON "miembros_hogar"("usuario_id", "hogar_id");

-- CreateIndex
CREATE INDEX "cuentas_hogar_id_idx" ON "cuentas"("hogar_id");

-- CreateIndex
CREATE INDEX "categorias_hogar_id_idx" ON "categorias"("hogar_id");

-- CreateIndex
CREATE INDEX "transacciones_hogar_id_fecha_idx" ON "transacciones"("hogar_id", "fecha");

-- AddForeignKey
ALTER TABLE "miembros_hogar" ADD CONSTRAINT "miembros_hogar_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembros_hogar" ADD CONSTRAINT "miembros_hogar_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembros_hogar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
