import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Lock,
  LogOut,
  RefreshCcw,
  Share2,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import {
  createMatch,
  deleteParticipant,
  loginAdmin,
  logoutAdmin,
  markPayment,
  syncMatches,
  testGoogleLogging,
  updateMatchResult,
} from "@/app/actions";
import { DeleteParticipantButton } from "@/app/admin/delete-participant-button";
import { ReferralShare } from "@/app/referral-share";
import { getAdminSession } from "@/lib/admin-auth";
import { formatPeruShortDateTime } from "@/lib/date-format";
import { prisma } from "@/lib/prisma";
import { REFERRAL_INVITE_LIMIT, REFERRER_BONUS_POINTS } from "@/lib/referral-bonus";
import { formatMoney } from "@/lib/scoring";

export const dynamic = "force-dynamic";

type AdminSearchParams = Promise<{
  error?: string | string[];
}>;

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const protocol =
    headersList.get("x-forwarded-proto")?.split(",")[0] ?? (host.includes("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

function StatusPill({ status }: { status: string }) {
  const label = status === "PAID" ? "Pagado" : status === "REJECTED" ? "Observado" : "Pendiente";
  return <span className={`status-pill status-${status.toLowerCase()}`}>{label}</span>;
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

async function getAdminData() {
  const [config, participants, matches, auditLogs] = await Promise.all([
    prisma.poolConfig.findFirst(),
    prisma.participant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        referredBy: {
          select: { name: true, referralCode: true },
        },
        referrals: {
          select: { id: true, name: true, paymentStatus: true },
        },
        predictions: {
          include: {
            match: {
              select: {
                awayTeam: true,
                homeTeam: true,
                startsAt: true,
                status: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
    prisma.match.findMany({
      orderBy: { startsAt: "asc" },
      include: { predictions: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ]);

  return {
    auditLogs,
    config: config ?? {
      currency: "PEN",
      entryFeeCents: 1000,
      organizerShare: 50,
      winnerShare: 50,
    },
    matches,
    participants,
  };
}

function describeAuditEvent(event: string) {
  const labels: Record<string, string> = {
    "participant.deleted": "Usuario eliminado",
    "participant.google_login": "Ingreso con Google",
    "participant.google_phone_completed": "Telefono completado",
    "participant.login": "Inicio de sesion",
    "participant.registered": "Registro creado",
    "payment.updated": "Pago actualizado",
    "prediction.saved": "Pronostico guardado",
  };

  return labels[event] ?? event;
}

function getLatestDate(dates: Date[]) {
  const validDates = dates.filter(Boolean);

  if (validDates.length === 0) {
    return null;
  }

  return new Date(Math.max(...validDates.map((date) => date.getTime())));
}

function safeAuditPayload(payloadJson: string) {
  try {
    return JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default async function AdminPage({ searchParams }: { searchParams?: AdminSearchParams }) {
  const isAdmin = await getAdminSession();
  const query = searchParams ? await searchParams : {};
  const error = firstSearchParam(query.error);

  if (!isAdmin) {
    return (
      <main className="admin-login-shell">
        <section className="admin-login-card">
          <div className="proof-icon">
            <ShieldCheck size={22} />
          </div>
          <p className="eyebrow-text">Panel seguro</p>
          <h1>Organizador</h1>
          <p>Ingresa el PIN para aprobar pagos, sincronizar partidos y cerrar resultados.</p>
          {error === "pin" ? <div className="form-alert">PIN incorrecto. Intenta otra vez.</div> : null}
          <form action={loginAdmin} className="stacked-form">
            <label>
              PIN organizador
              <input name="adminPin" type="password" placeholder="PIN" required autoFocus />
            </label>
            <button className="primary-button" type="submit">
              Entrar al panel
            </button>
          </form>
          <Link className="ghost-link" href="/">
            <ArrowLeft size={16} />
            Volver a la landing
          </Link>
        </section>
      </main>
    );
  }

  const baseUrl = await getBaseUrl();
  const { auditLogs, config, matches, participants } = await getAdminData();
  const paidParticipants = participants.filter((participant) => participant.paymentStatus === "PAID");
  const potCents = paidParticipants.length * config.entryFeeCents;
  const organizerCents = Math.floor((potCents * config.organizerShare) / 100);
  const totalPredictions = participants.reduce((total, participant) => total + participant.predictions.length, 0);
  const referralLeaders = participants
    .map((participant) => ({
      id: participant.id,
      name: participant.name,
      referralCode: participant.referralCode,
      totalReferrals: participant.referrals.length,
      paidReferrals: participant.referrals.filter((referral) => referral.paymentStatus === "PAID").length,
      referralBonusPoints:
        Math.min(
          participant.referrals.filter((referral) => referral.paymentStatus === "PAID").length,
          REFERRAL_INVITE_LIMIT,
        ) * REFERRER_BONUS_POINTS,
    }))
    .filter((participant) => participant.totalReferrals > 0)
    .sort((a, b) => b.paidReferrals - a.paidReferrals || b.totalReferrals - a.totalReferrals);
  const finishedMatches = matches.filter((match) => match.status === "FINISHED");
  const participantInsights = participants.map((participant) => {
    const paidReferrals = participant.referrals.filter((referral) => referral.paymentStatus === "PAID").length;
    const referralBonusPoints = Math.min(paidReferrals, REFERRAL_INVITE_LIMIT) * REFERRER_BONUS_POINTS;
    const predictionPoints = participant.predictions.reduce((total, prediction) => total + prediction.points, 0);
    const participantLogs = auditLogs.filter(
      (log) =>
        log.actor === participant.phone ||
        log.actor === participant.email ||
        log.actor === participant.referralCode ||
        log.targetId === participant.id,
    );
    const lastActivityAt = getLatestDate([
      participant.createdAt,
      participant.updatedAt,
      ...participant.predictions.map((prediction) => prediction.updatedAt),
      ...participantLogs.map((log) => log.createdAt),
    ]);

    return {
      id: participant.id,
      accessCode: participant.accessCode,
      exactHits: participant.predictions.filter((prediction) => prediction.points === 2).length,
      lastActivityAt,
      latestPrediction: participant.predictions[0] ?? null,
      name: participant.name,
      paidReferrals,
      paymentStatus: participant.paymentStatus,
      phone: participant.phone,
      predictionCount: participant.predictions.length,
      recentLogs: participantLogs.slice(0, 3),
      referralBonusPoints,
      referralCode: participant.referralCode,
      resultHits: participant.predictions.filter((prediction) => prediction.points === 1).length,
      totalPoints: predictionPoints + referralBonusPoints,
      totalReferrals: participant.referrals.length,
    };
  });

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="admin-page-shell">
        <div className="admin-topbar">
          <Link className="ghost-link" href="/">
            <ArrowLeft size={16} />
            Landing
          </Link>
          <form action={logoutAdmin}>
            <button className="secondary-button" type="submit">
              <LogOut size={16} />
              Salir
            </button>
          </form>
        </div>

        <SectionTitle
          eyebrow="Zona privada"
          title="Panel organizador"
          description="Gestiona pagos, sincroniza fixture, revisa referidos y cierra resultados."
        />

        <div className="admin-summary-grid">
          <section className="stat-card">
            <div className="stat-icon"><Users size={18} /></div>
            <div>
              <p className="stat-label">Inscritos</p>
              <p className="stat-value">{participants.length}</p>
              <p className="stat-detail">{paidParticipants.length} pagados</p>
            </div>
          </section>
          <section className="stat-card">
            <div className="stat-icon"><ClipboardList size={18} /></div>
            <div>
              <p className="stat-label">Partidos</p>
              <p className="stat-value">{matches.length}</p>
              <p className="stat-detail">{finishedMatches.length} cerrados</p>
            </div>
          </section>
          <section className="stat-card">
            <div className="stat-icon"><Lock size={18} /></div>
            <div>
              <p className="stat-label">Organizador</p>
              <p className="stat-value">{formatMoney(organizerCents, config.currency)}</p>
              <p className="stat-detail">Estimado por pagos aprobados</p>
            </div>
          </section>
          <section className="stat-card">
            <div className="stat-icon"><BarChart3 size={18} /></div>
            <div>
              <p className="stat-label">Pronosticos</p>
              <p className="stat-value">{totalPredictions}</p>
              <p className="stat-detail">Guardados por usuarios</p>
            </div>
          </section>
        </div>

        <div className="admin-grid">
          <div className="admin-card admin-card-wide">
            <div className="panel-header">
              <div>
                <h2>Actividad y estadisticas por usuario</h2>
                <p>Revisa quien entro, quien pronostico, sus puntos, referidos y ultimas acciones.</p>
              </div>
              <BarChart3 className="text-[var(--accent)]" size={22} />
            </div>
            <div className="participant-insights">
              {participantInsights.length === 0 ? (
                <p className="empty-text">Aun no hay usuarios registrados.</p>
              ) : (
                participantInsights.map((participant) => {
                  const latestPayload = participant.latestPrediction
                    ? `${participant.latestPrediction.match.homeTeam} ${participant.latestPrediction.homeScore} - ${participant.latestPrediction.awayScore} ${participant.latestPrediction.match.awayTeam}`
                    : "Sin pronosticos todavia";

                  return (
                    <article className="participant-insight-card" key={participant.id}>
                      <div className="participant-insight-head">
                        <div>
                          <strong>{participant.name}</strong>
                          <span>
                            {participant.phone} · Ref. {participant.referralCode} · Acceso {participant.accessCode}
                          </span>
                        </div>
                        <StatusPill status={participant.paymentStatus} />
                      </div>
                      <div className="participant-stat-grid">
                        <div>
                          <span>Pronosticos</span>
                          <strong>{participant.predictionCount}</strong>
                        </div>
                        <div>
                          <span>Puntos</span>
                          <strong>{participant.totalPoints}</strong>
                        </div>
                        <div>
                          <span>Exactos</span>
                          <strong>{participant.exactHits}</strong>
                        </div>
                        <div>
                          <span>Resultado</span>
                          <strong>{participant.resultHits}</strong>
                        </div>
                        <div>
                          <span>Referidos</span>
                          <strong>{participant.paidReferrals}/{REFERRAL_INVITE_LIMIT}</strong>
                        </div>
                      </div>
                      <div className="participant-activity-summary">
                        <span>Ultimo pronostico</span>
                        <strong>{latestPayload}</strong>
                        <small>
                          Ultima actividad:{" "}
                          {participant.lastActivityAt ? formatPeruShortDateTime(participant.lastActivityAt) : "sin actividad"}
                        </small>
                      </div>
                      <div className="activity-mini-list">
                        {participant.recentLogs.length === 0 ? (
                          <span>Sin eventos recientes en auditoria.</span>
                        ) : (
                          participant.recentLogs.map((log) => {
                            const payload = safeAuditPayload(log.payloadJson);
                            const detail =
                              typeof payload.match === "string"
                                ? payload.match
                                : typeof payload.newStatus === "string"
                                  ? `Estado ${payload.newStatus}`
                                  : typeof payload.name === "string"
                                    ? payload.name
                                    : log.actor ?? "sistema";

                            return (
                              <div className="activity-mini-row" key={log.id}>
                                <span>{describeAuditEvent(log.event)}</span>
                                <strong>{detail}</strong>
                                <time dateTime={log.createdAt.toISOString()}>{formatPeruShortDateTime(log.createdAt)}</time>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <div className="admin-card">
            <div className="panel-header">
              <div>
                <h2>Pagos y API</h2>
                <p>Aprueba pagos y sincroniza partidos reales con respaldo automatico.</p>
              </div>
              <Lock className="text-[var(--accent)]" size={22} />
            </div>
            <form action={syncMatches} className="admin-inline">
              <button className="secondary-button" type="submit">
                <RefreshCcw size={16} />
                Sincronizar API
              </button>
            </form>
            <div className="participant-list">
              {participants.length === 0 ? (
                <p className="empty-text">Aun no hay participantes registrados.</p>
              ) : (
                participants.map((participant) => (
                  <div className="participant-row" key={participant.id}>
                    <div>
                      <strong>{participant.name}</strong>
                      <span>{participant.phone} · Acceso {participant.accessCode}</span>
                      <span>Referido {participant.referralCode}</span>
                      {participant.referredBy ? <span>Invitado por {participant.referredBy.name}</span> : null}
                      <span>
                        {participant.referrals.length} referidos ·{" "}
                        {participant.referrals.filter((referral) => referral.paymentStatus === "PAID").length} pagados · cupos{" "}
                        {participant.referrals.length}/{REFERRAL_INVITE_LIMIT}
                      </span>
                      {(() => {
                        const insight = participantInsights.find((item) => item.id === participant.id);

                        return insight ? (
                          <span>
                            {insight.predictionCount} pronosticos · {insight.totalPoints} pts · {insight.exactHits} exactos ·{" "}
                            ultima actividad{" "}
                            {insight.lastActivityAt ? formatPeruShortDateTime(insight.lastActivityAt) : "sin registro"}
                          </span>
                        ) : null;
                      })()}
                      <StatusPill status={participant.paymentStatus} />
                    </div>
                    <div className="participant-admin-actions">
                      <form action={markPayment} className="participant-payment-form">
                        <input type="hidden" name="participantId" value={participant.id} />
                        <select name="paymentStatus" defaultValue={participant.paymentStatus}>
                          <option value="PENDING">Pendiente</option>
                          <option value="PAID">Pagado</option>
                          <option value="REJECTED">Observado</option>
                        </select>
                        <input name="paymentNote" placeholder="Nota pago" defaultValue={participant.paymentNote ?? ""} />
                        <button className="secondary-button" type="submit">
                          Actualizar
                        </button>
                      </form>
                      <form action={deleteParticipant}>
                        <input type="hidden" name="participantId" value={participant.id} />
                        <DeleteParticipantButton participantName={participant.name} />
                      </form>
                    </div>
                  </div>
                ))
              )}
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
                      <ReferralShare baseUrl={baseUrl} code={participant.referralCode} name={participant.name} compact />
                    </div>
                    <div>
                      <strong>{participant.paidReferrals}</strong>
                      <span>{participant.totalReferrals}/{REFERRAL_INVITE_LIMIT} total</span>
                      <span>+{participant.referralBonusPoints} pts</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="admin-card">
            <div className="panel-header">
              <div>
                <h2>Auditoria reciente</h2>
                <p>Ultimos registros guardados localmente.</p>
              </div>
              <ClipboardList className="text-[var(--accent)]" size={22} />
            </div>
            <div className="audit-list">
              {auditLogs.length === 0 ? (
                <p className="empty-text">Aun no hay eventos registrados.</p>
              ) : (
                auditLogs.map((log) => (
                  <div className="audit-row" key={log.id}>
                    <div>
                      <strong>{log.event}</strong>
                      <span>
                        {log.actor ?? "sistema"} · {log.googleStatus}
                      </span>
                    </div>
                    <time dateTime={log.createdAt.toISOString()}>{formatPeruShortDateTime(log.createdAt)}</time>
                  </div>
                ))
              )}
            </div>
            <form action={testGoogleLogging} className="admin-inline audit-test-form">
              <button className="secondary-button" type="submit">
                Probar Google
              </button>
            </form>
          </div>

          <div className="admin-card">
            <div className="panel-header">
              <div>
                <h2>Cargar partido</h2>
                <p>Fallback manual cuando las fuentes externas fallen.</p>
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
                Fecha y hora peruana
                <input name="startsAt" type="datetime-local" required />
              </label>
              <label>
                Sede opcional
                <input name="venue" placeholder="Estadio" />
              </label>
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
              {matches.slice(0, 16).map((match) => (
                <form action={updateMatchResult} className="result-row" key={match.id}>
                  <input type="hidden" name="matchId" value={match.id} />
                  <p>
                    {match.homeTeam} vs {match.awayTeam}
                    <span>{formatPeruShortDateTime(match.startsAt)}</span>
                  </p>
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
      </section>
    </main>
  );
}
