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
APP_URL="http://localhost:3000"
AUTH_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

`API_FOOTBALL_KEY` habilita la sincronizacion desde API-Football. El adaptador actual consulta Mundial 2026 con `league=1&season=2026`.
`GOOGLE_LOG_WEBHOOK_URL` envia una copia de auditoria a Google Sheets mediante Apps Script. Si queda vacio, la auditoria se guarda solo en SQLite.
`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` habilitan el ingreso con Google. `AUTH_SECRET` firma la cookie de sesion y `APP_URL` debe apuntar al dominio publico.

## Despliegue Docker

```bash
export ADMIN_PIN="pon-un-pin-largo"
export API_FOOTBALL_KEY="opcional"
export GOOGLE_LOG_WEBHOOK_URL="opcional"
export GOOGLE_LOG_SECRET="opcional"
export APP_URL="https://tu-dominio"
export AUTH_SECRET="secreto-largo"
export GOOGLE_CLIENT_ID="cliente-google"
export GOOGLE_CLIENT_SECRET="secreto-google"
docker compose up -d --build
```

La base SQLite de produccion queda en el volumen `polla_data`.
El contenedor inicializa el esquema con `prisma/init.sql` antes de arrancar.

## Login con Google

El login con Google queda disponible en `/api/auth/google`. En Google Cloud configura este redirect URI:

```text
https://tu-dominio/api/auth/google/callback
```

Cuando el usuario entra con Google:

- Si su correo ya existe como participante, puede pronosticar sin escribir codigo.
- Si aun no esta inscrito, el formulario usa su nombre y correo como base.
- Cada ingreso correcto genera un evento `auth.google_login` en auditoria local.

## Auditoria local

El sistema guarda eventos en `AuditLog`: registros, referidos invalidos, pagos, pronosticos, partidos creados, resultados cerrados y sincronizaciones. El panel organizador muestra los ultimos eventos.

## Pendientes antes de produccion abierta

- Validar encuadre legal antes de cobrar o promocionar masivamente.
- Cambiar `ADMIN_PIN` por autenticacion completa.
- Definir desempates oficiales antes del primer partido.
- Configurar dominio, SSL, backups y monitoreo.
