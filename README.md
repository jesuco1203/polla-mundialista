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
GOOGLE_LOG_WEBHOOK_URL=""
GOOGLE_LOG_SECRET=""
```

`API_FOOTBALL_KEY` habilita la sincronizacion desde API-Football. El adaptador actual consulta Mundial 2026 con `league=1&season=2026`.
`GOOGLE_LOG_WEBHOOK_URL` envia una copia de auditoria a Google Sheets mediante Apps Script. Si queda vacio, la auditoria se guarda solo en SQLite.

## Despliegue Docker

```bash
export ADMIN_PIN="pon-un-pin-largo"
export API_FOOTBALL_KEY="opcional"
export GOOGLE_LOG_WEBHOOK_URL="opcional"
export GOOGLE_LOG_SECRET="opcional"
docker compose up -d --build
```

La base SQLite de produccion queda en el volumen `polla_data`.
El contenedor inicializa el esquema con `prisma/init.sql` antes de arrancar.

## Auditoria y Google Sheets

El sistema guarda eventos en `AuditLog`: registros, referidos invalidos, pagos, pronosticos, partidos creados, resultados cerrados y sincronizaciones. El panel organizador muestra los ultimos eventos.

Para duplicar los logs en Google Sheets, crea un Apps Script publicado como Web App y configura:

- `GOOGLE_LOG_WEBHOOK_URL`: URL `/exec` del Web App.
- `GOOGLE_LOG_SECRET`: texto compartido entre la app y el script para validar llamadas.

Usa el prompt de `docs/GOOGLE_LOGGING_NAVIGATOR_PROMPT.md` con una IA navegadora conectada a Google.

## Pendientes antes de produccion abierta

- Validar encuadre legal antes de cobrar o promocionar masivamente.
- Cambiar `ADMIN_PIN` por autenticacion completa.
- Definir desempates oficiales antes del primer partido.
- Configurar dominio, SSL, backups y monitoreo.
