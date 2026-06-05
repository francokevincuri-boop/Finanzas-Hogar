# Finanzas del Hogar

Centro de control del dinero de un hogar, pensado para Argentina: cuotas, dólar, inflación y un asistente que razona sobre tu situación real.

**Fuente de verdad:** [CLAUDE.md](./CLAUDE.md) — modelo de datos, contrato de API y decisiones.

## Estructura

```
backend/    API REST (Node + Express + Prisma + PostgreSQL)
frontend/   UI (React + Vite + Tailwind, diseñada en Claude Design)
docs/       Log de decisiones y documentación
```

## Levantar en local

Requisitos: Node.js LTS, Docker Desktop, Git.

```bash
# 1. Base de datos
docker compose up -d

# 2. Backend
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

API en `http://localhost:3000` — probar con `http://localhost:3000/health`.
