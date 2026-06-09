# Polla Mundialista

Sistema web para administrar una polla mundialista privada: inscripciones, pagos manuales, pronosticos, resultados, puntaje y ranking.

## Reglas actuales

- Inscripcion: S/10.
- Marcador exacto: 2 puntos.
- Resultado correcto: 1 punto.
- Error: 0 puntos.
- Premio ganador: 50% del pozo acumulado.
- Organizador: 50% del pozo acumulado.

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:init
npm run db:seed
npm run dev -- -H 0.0.0.0 -p 3001
```

Abre `http://localhost:3001`.

Datos demo:

- Codigo participante: `DEMO2026`
- PIN organizador local: el valor de `ADMIN_PIN` en `.env`

## Variables

```bash
DATABASE_URL="file:./dev.db"
ADMIN_PIN="pon-un-pin-largo"
API_FOOTBALL_KEY=""
```

`API_FOOTBALL_KEY` habilita la sincronizacion desde API-Football. El adaptador actual consulta Mundial 2026 con `league=1&season=2026`.

## Despliegue Docker

```bash
export ADMIN_PIN="pon-un-pin-largo"
export API_FOOTBALL_KEY="opcional"
docker compose up -d --build
```

La base SQLite de produccion queda en el volumen `polla_data`.
El contenedor inicializa el esquema con `prisma/init.sql` antes de arrancar.

## Pendientes antes de produccion abierta

- Validar encuadre legal antes de cobrar o promocionar masivamente.
- Cambiar `ADMIN_PIN` por autenticacion completa.
- Definir desempates oficiales antes del primer partido.
- Configurar dominio, SSL, backups y monitoreo.
