# Roadmap Polla Mundialista

## Reglas base

- Inscripcion: S/10 por participante.
- Pozo: participantes pagados x S/10.
- Premio: 50% del pozo para el ganador final.
- Organizador: 50% del pozo.
- Puntaje: 2 puntos por marcador exacto, 1 punto por resultado correcto, 0 por error.
- Desempate recomendado: mayor cantidad de marcadores exactos, luego mayor cantidad de pronosticos cerrados, luego criterio manual publicado antes del inicio.

## Riesgo legal a validar

En Peru, los juegos a distancia y apuestas deportivas a distancia estan regulados por MINCETUR bajo Ley 31557, modificada por Ley 31806, y D.S. 005-2023-MINCETUR. Si la plataforma cobra inscripciones, ofrece premio y el organizador retiene utilidad, puede acercarse a actividad regulada. Para MVP publico conviene validar con abogado antes de cobrar online o promocionar masivamente.

Mitigacion MVP:

- Operacion privada/cerrada, no casino ni sportsbook publico.
- Pagos manuales verificados por organizador.
- Registro de mayores de edad en terminos.
- Sin cuotas, odds, apuestas por partido ni retiro automatizado.
- Trazabilidad de pagos y resultados.

## API de partidos

Opcion recomendada para MVP: API-Football de API-SPORTS.

- Mundial 2026 disponible como `league=1&season=2026`.
- Endpoints utiles: fixtures, standings, teams, live scores.
- Gratis para prototipo con limite bajo; plan pagado barato para produccion.
- El codigo ya tiene adaptador en `src/lib/football-api.ts`.

Alternativas:

- football-data.org: buena opcion para prototipo y bajo trafico.
- Sportmonks: mas caro, mas completo para live scores, squads y bracket.
- TheStatsAPI: util si mas adelante queremos odds/estadisticas avanzadas.

## Fase 1 MVP

- Registro de participantes.
- Confirmacion manual de pago.
- Codigo de acceso por participante.
- Carga inicial de partidos.
- Pronosticos bloqueados cuando inicia el partido.
- Cierre de resultado por organizador.
- Calculo de puntos.
- Ranking y pozo visibles.
- Docker y variables de entorno para VPS.

## Fase 2

- Autenticacion real para organizador.
- Vista privada por participante.
- Historial de cambios y auditoria.
- Desempates automaticos.
- Exportacion CSV.
- Terminos y consentimiento.
- Integracion Yape/Plin o pasarela si la parte legal esta resuelta.

## Sistema de referidos

### Fase 1: MVP operativo

- Cada participante recibe un codigo de referido propio.
- El formulario de registro acepta un codigo opcional de quien invito.
- El organizador puede ver referidos totales y referidos pagados por participante.
- El ranking publico muestra referidos pagados como senal social, sin alterar el puntaje deportivo.
- El pago sigue siendo manual; un referido solo cuenta como validado cuando su estado pasa a `Pagado`.

### Fase 2: Incentivos

- Definir premio por referidos: descuento de inscripcion, bono al pozo, premio separado o beneficio manual.
- Mostrar estado de recompensa: pendiente, validada, entregada.
- Agregar reporte descargable para liquidar premios por referido.
- Permitir enlaces compartibles con `?ref=CODIGO`.

### Fase 3: Control y crecimiento

- Detectar duplicados por telefono/correo antes de contar recompensa.
- Limitar autorreferidos y cambios de referido despues del pago.
- Panel de conversion por canal: invitados, pagados, conversion y monto generado.
- Notificaciones WhatsApp para invitar y recordar pagos.

## Fase 3

- Sincronizacion programada de resultados.
- Notificaciones WhatsApp/email.
- Multi-pollas.
- Dominio, SSL, backups y monitoreo.
