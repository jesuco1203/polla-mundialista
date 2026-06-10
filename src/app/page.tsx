import {
  BadgeCheck,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Lock,
  Medal,
  RefreshCcw,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import {
  createMatch,
  markPayment,
  registerParticipant,
  savePrediction,
  syncMatches,
  updateMatchResult,
} from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/scoring";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const [config, participants, matches, leaderboard] = await Promise.all([
    prisma.poolConfig.findFirst(),
    prisma.participant.findMany({
      orderBy: { createdAt: "desc" },
      include: { predictions: true },
    }),
    prisma.match.findMany({
      orderBy: { startsAt: "asc" },
      include: { predictions: true },
    }),
    prisma.participant.findMany({
      where: { paymentStatus: "PAID" },
      include: { predictions: true },
    }),
  ]);

  const sortedLeaderboard = leaderboard
    .map((participant) => ({
      ...participant,
      totalPoints: participant.predictions.reduce(
        (total, prediction) => total + prediction.points,
        0,
      ),
      predictedMatches: participant.predictions.length,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || b.predictedMatches - a.predictedMatches);

  return {
    config: config ?? {
      entryFeeCents: 1000,
      organizerShare: 50,
      winnerShare: 50,
      currency: "PEN",
      name: "Polla Mundialista 2026",
    },
    participants,
    matches,
    leaderboard: sortedLeaderboard,
  };
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        <p className="stat-detail">{detail}</p>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const label =
    status === "PAID" ? "Pagado" : status === "REJECTED" ? "Observado" : "Pendiente";

  return <span className={`status-pill status-${status.toLowerCase()}`}>{label}</span>;
}

export default async function Home() {
  const { config, participants, matches, leaderboard } = await getDashboardData();
  const paidParticipants = participants.filter((participant) => participant.paymentStatus === "PAID");
  const potCents = paidParticipants.length * config.entryFeeCents;
  const winnerCents = Math.floor((potCents * config.winnerShare) / 100);
  const organizerCents = potCents - winnerCents;
  const nextMatches = matches.filter((match) => match.status !== "FINISHED").slice(0, 6);
  const finishedMatches = matches.filter((match) => match.status === "FINISHED");

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="eyebrow">
                <Trophy size={16} />
                Mundial 2026
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[var(--foreground)] sm:text-5xl">
                Polla Mundialista
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted-foreground)]">
                Registro, control de pagos, pronosticos bloqueados por hora de partido,
                puntaje automatico y ranking final en un solo panel.
              </p>
            </div>
            <div className="rule-box">
              <ShieldCheck size={18} />
              <span>S/10 inscripcion · 1 punto resultado · 2 puntos marcador exacto · premio 50%</span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Users size={20} />}
              label="Participantes pagados"
              value={`${paidParticipants.length}`}
              detail={`${participants.length} registrados en total`}
            />
            <StatCard
              icon={<CircleDollarSign size={20} />}
              label="Pozo acumulado"
              value={formatMoney(potCents, config.currency)}
              detail={`${formatMoney(config.entryFeeCents, config.currency)} por inscripcion`}
            />
            <StatCard
              icon={<Medal size={20} />}
              label="Premio ganador"
              value={formatMoney(winnerCents, config.currency)}
              detail={`${config.winnerShare}% del pozo`}
            />
            <StatCard
              icon={<ClipboardList size={20} />}
              label="Organizador"
              value={formatMoney(organizerCents, config.currency)}
              detail={`${config.organizerShare}% del pozo`}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
        <section className="space-y-5">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Tabla de posiciones</h2>
                <p>Ordenada por puntos acumulados y cantidad de pronosticos registrados.</p>
              </div>
              <BadgeCheck className="text-[var(--accent)]" size={22} />
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Participante</th>
                    <th>Codigo</th>
                    <th>Pronosticos</th>
                    <th>Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-cell">
                        Aun no hay participantes pagados.
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((participant, index) => (
                      <tr key={participant.id}>
                        <td>{index + 1}</td>
                        <td className="font-medium text-[var(--foreground)]">{participant.name}</td>
                        <td>{participant.accessCode}</td>
                        <td>{participant.predictedMatches}</td>
                        <td className="score-cell">{participant.totalPoints}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Pronosticar partidos</h2>
                <p>Solo se aceptan pronosticos de participantes con pago confirmado.</p>
              </div>
              <Lock className="text-[var(--accent)]" size={22} />
            </div>
            <div className="match-grid">
              {nextMatches.length === 0 ? (
                <p className="empty-text">No hay partidos pendientes cargados.</p>
              ) : (
                nextMatches.map((match) => (
                  <form action={savePrediction} className="match-card" key={match.id}>
                    <div>
                      <p className="match-stage">{match.stage}</p>
                      <h3>
                        {match.homeTeam} <span>vs</span> {match.awayTeam}
                      </h3>
                      <p className="match-date">
                        {new Intl.DateTimeFormat("es-PE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(match.startsAt)}
                      </p>
                    </div>
                    <input type="hidden" name="matchId" value={match.id} />
                    <label>
                      Codigo del participante
                      <input name="accessCode" placeholder="DEMO2026" required />
                    </label>
                    <div className="score-inputs">
                      <label>
                        {match.homeTeam}
                        <input name="homeScore" type="number" min="0" max="30" defaultValue="1" required />
                      </label>
                      <label>
                        {match.awayTeam}
                        <input name="awayScore" type="number" min="0" max="30" defaultValue="0" required />
                      </label>
                    </div>
                    <button className="primary-button" type="submit">
                      Guardar pronostico
                    </button>
                  </form>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Partidos finalizados</h2>
                <p>Resultados con puntajes recalculados.</p>
              </div>
              <CalendarClock className="text-[var(--accent)]" size={22} />
            </div>
            <div className="compact-list">
              {finishedMatches.length === 0 ? (
                <p className="empty-text">Aun no hay resultados cerrados.</p>
              ) : (
                finishedMatches.map((match) => (
                  <div className="compact-row" key={match.id}>
                    <span>{match.homeTeam}</span>
                    <strong>
                      {match.homeScore} - {match.awayScore}
                    </strong>
                    <span>{match.awayTeam}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Inscripcion</h2>
                <p>El codigo se genera al registrar y se activa cuando el pago se confirma.</p>
              </div>
            </div>
            <form action={registerParticipant} className="stacked-form">
              <label>
                Nombre completo
                <input name="name" placeholder="Ej. Juan Perez" required />
              </label>
              <label>
                WhatsApp
                <input name="phone" placeholder="Ej. 999 999 999" required />
              </label>
              <label>
                Correo opcional
                <input name="email" type="email" placeholder="correo@dominio.com" />
              </label>
              <button className="primary-button" type="submit">
                Registrar participante
              </button>
            </form>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Panel organizador</h2>
                <p>Usa el PIN del servidor para pagos, resultados y sincronizacion.</p>
              </div>
            </div>
            <form action={syncMatches} className="admin-inline">
              <input name="adminPin" type="password" placeholder="PIN" required />
              <button className="secondary-button" type="submit">
                <RefreshCcw size={16} />
                Sincronizar API
              </button>
            </form>
            <div className="participant-list">
              {participants.map((participant) => (
                <form action={markPayment} className="participant-row" key={participant.id}>
                  <input type="hidden" name="participantId" value={participant.id} />
                  <div>
                    <strong>{participant.name}</strong>
                    <span>{participant.phone} · {participant.accessCode}</span>
                    <StatusPill status={participant.paymentStatus} />
                  </div>
                  <select name="paymentStatus" defaultValue={participant.paymentStatus}>
                    <option value="PENDING">Pendiente</option>
                    <option value="PAID">Pagado</option>
                    <option value="REJECTED">Observado</option>
                  </select>
                  <input name="paymentNote" placeholder="Nota pago" defaultValue={participant.paymentNote ?? ""} />
                  <input name="adminPin" type="password" placeholder="PIN" required />
                  <button className="secondary-button" type="submit">
                    Actualizar
                  </button>
                </form>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Cargar partido</h2>
                <p>Fallback manual cuando la API aun no tiene fixture completo.</p>
              </div>
            </div>
            <form action={createMatch} className="stacked-form">
              <div className="score-inputs">
                <label>
                  Etapa
                  <input name="stage" placeholder="Grupo A" required />
                </label>
                <label>
                  Grupo
                  <input name="groupName" placeholder="A" />
                </label>
              </div>
              <label>
                Equipo local
                <input name="homeTeam" placeholder="Mexico" required />
              </label>
              <label>
                Equipo visitante
                <input name="awayTeam" placeholder="Sudafrica" required />
              </label>
              <label>
                Fecha y hora
                <input name="startsAt" type="datetime-local" required />
              </label>
              <label>
                Sede opcional
                <input name="venue" placeholder="Estadio" />
              </label>
              <input name="adminPin" type="password" placeholder="PIN organizador" required />
              <button className="primary-button" type="submit">
                Crear partido
              </button>
            </form>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Cerrar resultado</h2>
                <p>Al guardar, se recalculan los puntos del partido.</p>
              </div>
            </div>
            <div className="result-list">
              {matches.slice(0, 8).map((match) => (
                <form action={updateMatchResult} className="result-row" key={match.id}>
                  <input type="hidden" name="matchId" value={match.id} />
                  <p>{match.homeTeam} vs {match.awayTeam}</p>
                  <div className="score-inputs">
                    <input
                      aria-label={`Goles ${match.homeTeam}`}
                      name="homeScore"
                      type="number"
                      min="0"
                      max="30"
                      defaultValue={match.homeScore ?? 0}
                      required
                    />
                    <input
                      aria-label={`Goles ${match.awayTeam}`}
                      name="awayScore"
                      type="number"
                      min="0"
                      max="30"
                      defaultValue={match.awayScore ?? 0}
                      required
                    />
                  </div>
                  <input name="adminPin" type="password" placeholder="PIN" required />
                  <button className="secondary-button" type="submit">Guardar</button>
                </form>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
