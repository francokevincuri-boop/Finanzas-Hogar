import { PrismaClient } from "@prisma/client";

// Cliente único de Prisma para toda la app
export const prisma = new PrismaClient();
