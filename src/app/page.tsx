import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Lock,
  Medal,
  RefreshCcw,
  Share2,
  ShieldCheck,
  Trophy,
  UserPlus,
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
      include: {
        predictions: true,
        referredBy: {
          select: { name: true, referralCode: true },
        },
        referrals: {
          select: { id: true, name: true, paymentStatus: true },
        },
      },
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
      exactHits: participant.predictions.filter((prediction) => prediction.points === 2).length,
    }))
    .sort(
      (a, b) =>
        b.totalPoints - a.totalPoints ||
        b.exactHits - a.exactHits ||
        b.predictedMatches - a.predictedMatches,
    );

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

function TeamMark({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return <span className="team-mark" aria-hidden="true">{initials || "?"}</span>;
}

function MatchState({ locked }: { locked: boolean }) {
  return (
    <span className={locked ? "match-state closed" : "match-state open"}>
      {locked ? <Lock size={14} /> : <Clock3 size={14} />}
      {locked ? "Bloqueado" : "Abierto"}
    </span>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="section-title">
      <p>{eyebrow}</p>
      <h2>{title}</h2>
      <span>{description}</span>
    </div>
  );
}

export default async function Home() {
  const { config, participants, matches, leaderboard } = await getDashboardData();
  const paidParticipants = participants.filter((participant) => participant.paymentStatus === "PAID");
  const paidReferrals = participants.reduce(
    (total, participant) =>
      total + participant.referrals.filter((referral) => referral.paymentStatus === "PAID").length,
    0,
  );
  const referralLeaders = participants
    .map((participant) => ({
      id: participant.id,
      name: participant.name,
      referralCode: participant.referralCode,
      totalReferrals: participant.referrals.length,
      paidReferrals: participant.referrals.filter((referral) => referral.paymentStatus === "PAID").length,
    }))
    .filter((participant) => participant.totalReferrals > 0)
    .sort((a, b) => b.paidReferrals - a.paidReferrals || b.totalReferrals - a.totalReferrals);
  const potCents = paidParticipants.length * config.entryFeeCents;
  const winnerCents = Math.floor((potCents * config.winnerShare) / 100);
  const organizerCents = potCents - winnerCents;
  const now = new Date();
  const nextMatches = matches.filter((match) => match.status !== "FINISHED").slice(0, 8);
  const openMatches = nextMatches.filter((match) => match.startsAt > now);
  const finishedMatches = matches.filter((match) => match.status === "FINISHED");
  const featuredMatch = openMatches[0] ?? nextMatches[0];
  const nextClose = openMatches[0]?.startsAt;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="hero-shell">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">
              <Trophy size={16} />
              Mundial 2026
            </div>
            <h1>Participa en la polla del Mundial 2026</h1>
            <p>
              Pronostica marcadores, compite por puntos y sigue el pozo en vivo.
              La inscripcion es de S/10 y el premio al ganador es el 50% del acumulado.
            </p>
            <div className="hero-actions">
              <a href="#participante" className="primary-link">
                Pronosticar ahora
                <ChevronRight size={18} />
              </a>
              <a href="#registro" className="ghost-link">
                Inscribirme
              </a>
            </div>
          </div>

          <aside className="hero-board" aria-label="Resumen destacado">
            <div className="hero-board-header">
              <span>Proximo cierre</span>
              <strong>
                {nextClose
                  ? new Intl.DateTimeFormat("es-PE", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(nextClose)
                  : "Sin fixture"}
              </strong>
            </div>

            <div className="scoreboard">
              <div>
                <TeamMark name={featuredMatch?.homeTeam ?? "Local"} />
                <span>{featuredMatch?.homeTeam ?? "Local"}</span>
              </div>
              <strong>VS</strong>
              <div>
                <TeamMark name={featuredMatch?.awayTeam ?? "Visitante"} />
                <span>{featuredMatch?.awayTeam ?? "Visitante"}</span>
              </div>
            </div>

            <dl className="rules-grid">
              <div>
                <ShieldCheck size={16} />
                <dt>Inscripcion</dt>
                <dd>{formatMoney(config.entryFeeCents, config.currency)}</dd>
              </div>
              <div>
                <Medal size={16} />
                <dt>Marcador exacto</dt>
                <dd>2 pts</dd>
              </div>
              <div>
                <BadgeCheck size={16} />
                <dt>Resultado correcto</dt>
                <dd>1 pt</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <nav className="view-tabs" aria-label="Vistas principales">
        <a href="#participante">Participante</a>
        <a href="#ranking">Ranking</a>
        <a href="#organizador">Organizador</a>
      </nav>

      <section className="kpi-strip" aria-label="Resumen de la polla">
        <StatCard
          icon={<Users size={20} />}
          label="Inscritos pagados"
          value={`${paidParticipants.length}`}
          detail={`${participants.length} registros totales`}
        />
        <StatCard
          icon={<CircleDollarSign size={20} />}
          label="Pozo acumulado"
          value={formatMoney(potCents, config.currency)}
          detail="Actualizado con pagos confirmados"
        />
        <StatCard
          icon={<Medal size={20} />}
          label="Premio al ganador"
          value={formatMoney(winnerCents, config.currency)}
          detail={`${config.winnerShare}% del pozo`}
        />
        <StatCard
          icon={<CalendarClock size={20} />}
          label="Cierre proximo"
          value={
            nextClose
              ? new Intl.DateTimeFormat("es-PE", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(nextClose)
              : "Sin partidos"
          }
          detail="Pronostico bloqueado al iniciar"
        />
        <StatCard
          icon={<Share2 size={20} />}
          label="Referidos pagados"
          value={`${paidReferrals}`}
          detail={`${referralLeaders.length} participantes invitaron`}
        />
      </section>

      <div className="app-shell">
        <section className="participant-layout" id="participante">
          <div className="participant-main">
            <SectionTitle
              eyebrow="Participante"
              title="Partidos abiertos"
              description="Ingresa tu codigo, marca el score y guarda antes del inicio."
            />

            <div className="notice">
              <BadgeCheck size={18} />
              <span>Para pronosticar, tu pago debe figurar como confirmado por el organizador.</span>
            </div>

            <div className="match-grid">
              {nextMatches.length === 0 ? (
                <p className="empty-text">No hay partidos pendientes cargados.</p>
              ) : (
                nextMatches.map((match) => {
                  const locked = match.startsAt <= now;

                  return (
                    <form action={savePrediction} className="match-card" key={match.id}>
                      <div className="match-topline">
                        <span className="match-badge">{match.groupName ? `Grupo ${match.groupName}` : match.stage}</span>
                        <MatchState locked={locked} />
                      </div>

                      <div className="teams-row">
                        <div className="team-side">
                          <TeamMark name={match.homeTeam} />
                          <strong>{match.homeTeam}</strong>
                        </div>
                        <span className="versus">vs</span>
                        <div className="team-side right">
                          <strong>{match.awayTeam}</strong>
                          <TeamMark name={match.awayTeam} />
                        </div>
                      </div>

                      <p className="match-date">
                        {new Intl.DateTimeFormat("es-PE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(match.startsAt)}
                        {match.venue ? ` · ${match.venue}` : ""}
                      </p>

                      <input type="hidden" name="matchId" value={match.id} />
                      <label>
                        Ingresa tu codigo
                        <input name="accessCode" placeholder="DEMO2026" required disabled={locked} />
                      </label>
                      <div className="score-inputs compact">
                        <label>
                          Local
                          <input name="homeScore" type="number" min="0" max="30" defaultValue="1" required disabled={locked} />
                        </label>
                        <label>
                          Visitante
                          <input name="awayScore" type="number" min="0" max="30" defaultValue="0" required disabled={locked} />
                        </label>
                      </div>
                      <button className="primary-button" type="submit" disabled={locked}>
                        {locked ? "Pronostico cerrado" : "Guardar pronostico"}
                      </button>
                    </form>
                  );
                })
              )}
            </div>
          </div>

          <details className="register-panel" id="registro">
            <summary>
              <span>Entrar</span>
              <span>Registrarse</span>
              <small>S/10 · codigo con pago confirmado</small>
            </summary>

            <div className="entry-options">
              <div className="entry-card existing-user">
                <div>
                  <Lock size={18} />
                  <h2>Ya estoy inscrito</h2>
                </div>
                <p>Usa tu codigo en cualquier partido abierto para guardar o actualizar tu pronostico.</p>
                <p className="helper-text">Tu codigo de referido aparece en el ranking y en el panel del organizador.</p>
                <a href="#participante" className="secondary-button">
                  Entrar con mi codigo
                </a>
              </div>

              <div className="entry-card">
                <div>
                  <UserPlus size={18} />
                  <h2>Nuevo participante</h2>
                </div>
                <p>Completa tus datos y envia tu comprobante. El codigo se activa cuando el pago queda confirmado.</p>
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
                  <label>
                    Codigo de quien te invito
                    <input name="referralCode" placeholder="Ej. DEMO2026" />
                  </label>
                  <button className="primary-button" type="submit">
                    Registrarme
                  </button>
                </form>
              </div>
            </div>
          </details>
        </section>

        <section className="ranking-section" id="ranking">
          <SectionTitle
            eyebrow="Competencia"
            title="Ranking general"
            description="Gana quien acumule mas puntos al terminar el Mundial."
          />
          <div className="leaderboard-panel">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Participante</th>
                    <th>Codigo</th>
                    <th>Exactos</th>
                    <th>Pronosticos</th>
                    <th>Referidos</th>
                    <th>Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-cell">
                        Aun no hay participantes pagados.
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((participant, index) => (
                      <tr key={participant.id}>
                        <td>{index + 1}</td>
                        <td className="font-medium text-[var(--foreground)]">{participant.name}</td>
                        <td>{participant.accessCode}</td>
                        <td>{participant.exactHits}</td>
                        <td>{participant.predictedMatches}</td>
                        <td>
                          {participants.find((item) => item.id === participant.id)?.referrals.filter(
                            (referral) => referral.paymentStatus === "PAID",
                          ).length ?? 0}
                        </td>
                        <td className="score-cell">{participant.totalPoints}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="admin-zone" id="organizador">
          <SectionTitle
            eyebrow="Zona privada"
            title="Organizador"
            description="Gestiona pagos, sincroniza fixture, carga partidos y cierra resultados."
          />

          <details className="admin-disclosure">
            <summary>
              <span>
                <Lock size={18} />
                Abrir panel organizador
              </span>
              <small>Requiere PIN en cada accion</small>
            </summary>

            <div className="admin-grid">
              <div className="admin-card">
                <div className="panel-header">
                  <div>
                    <h2>Pagos y API</h2>
                    <p>Actualiza estados y sincroniza partidos reales cuando tengas la llave.</p>
                  </div>
                  <Lock className="text-[var(--accent)]" size={22} />
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
                        <span>{participant.phone} · Acceso {participant.accessCode}</span>
                        <span>Referido {participant.referralCode}</span>
                        {participant.referredBy ? (
                          <span>Invitado por {participant.referredBy.name}</span>
                        ) : null}
                        <span>
                          {participant.referrals.length} referidos ·{" "}
                          {participant.referrals.filter((referral) => referral.paymentStatus === "PAID").length} pagados
                        </span>
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

              <div className="admin-card">
                <div className="panel-header">
                  <div>
                    <h2>Referidos</h2>
                    <p>Controla quienes traen participantes y cuantos ya pagaron.</p>
                  </div>
                  <Share2 className="text-[var(--accent)]" size={22} />
                </div>
                <div className="compact-list">
                  {referralLeaders.length === 0 ? (
                    <p className="empty-text">Aun no hay referidos registrados.</p>
                  ) : (
                    referralLeaders.map((participant) => (
                      <div className="referral-row" key={participant.id}>
                        <div>
                          <strong>{participant.name}</strong>
                          <span>Codigo {participant.referralCode}</span>
                        </div>
                        <div>
                          <strong>{participant.paidReferrals}</strong>
                          <span>{participant.totalReferrals} total</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="admin-card">
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

              <div className="admin-card">
                <div className="panel-header">
                  <div>
                    <h2>Cerrar resultado</h2>
                    <p>Al guardar, se recalculan los puntos del partido.</p>
                  </div>
                  <ClipboardList className="text-[var(--accent)]" size={22} />
                </div>
                <div className="result-list">
                  {matches.slice(0, 10).map((match) => (
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
                      <button className="secondary-button" type="submit">Cerrar resultado</button>
                    </form>
                  ))}
                </div>
              </div>

              <div className="admin-card">
                <div className="panel-header">
                  <div>
                    <h2>Resultados cerrados</h2>
                    <p>Partidos con puntajes ya recalculados.</p>
                  </div>
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
            </div>

            <div className="organizer-share">
              <span>Ganancia estimada del organizador</span>
              <strong>{formatMoney(organizerCents, config.currency)}</strong>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
