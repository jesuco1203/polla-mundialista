import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  LogIn,
  LogOut,
  Lock,
  Medal,
  RefreshCcw,
  Share2,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import Image from "next/image";
import { headers } from "next/headers";
import {
  createMatch,
  markPayment,
  registerParticipant,
  savePrediction,
  syncMatches,
  testGoogleLogging,
  updateMatchResult,
} from "@/app/actions";
import { ReferralShare } from "@/app/referral-share";
import { getGoogleSession } from "@/lib/google-auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/scoring";

export const dynamic = "force-dynamic";

type HomeSearchParams = Promise<{
  ref?: string | string[];
  registered?: string | string[];
  referralError?: string | string[];
  authError?: string | string[];
}>;

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeCodeParam(value: string | string[] | undefined) {
  return firstSearchParam(value)?.trim().toUpperCase() || "";
}

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const protocol =
    headersList.get("x-forwarded-proto")?.split(",")[0] ?? (host.includes("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

async function getDashboardData() {
  const [config, participants, matches, leaderboard, auditLogs] = await Promise.all([
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
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
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
    auditLogs,
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

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Lima",
    year: "numeric",
  }).format(date);
}

export default async function Home({ searchParams }: { searchParams?: HomeSearchParams }) {
  const query = searchParams ? await searchParams : {};
  const invitedByCode = normalizeCodeParam(query.ref);
  const registeredCode = normalizeCodeParam(query.registered);
  const referralError = firstSearchParam(query.referralError);
  const authError = firstSearchParam(query.authError);
  const baseUrl = await getBaseUrl();
  const googleSession = await getGoogleSession();
  const { config, participants, matches, auditLogs, leaderboard } = await getDashboardData();
  const registeredParticipant = registeredCode
    ? await prisma.participant.findUnique({
        where: { referralCode: registeredCode },
        select: {
          accessCode: true,
          name: true,
          referralCode: true,
          referredBy: {
            select: { name: true },
          },
        },
      })
    : null;
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
  const googleParticipant = googleSession?.email
    ? participants.find((participant) => participant.email?.toLowerCase() === googleSession.email.toLowerCase()) ?? null
    : null;
  const potCents = paidParticipants.length * config.entryFeeCents;
  const winnerCents = Math.floor((potCents * config.winnerShare) / 100);
  const organizerCents = potCents - winnerCents;
  const now = new Date();
  const nextMatches = matches.filter((match) => match.status !== "FINISHED").slice(0, 8);
  const todayMatches = matches.filter((match) => dayKey(match.startsAt) === dayKey(now));
  const displayMatches = todayMatches.length > 0 ? todayMatches : nextMatches;
  const openMatches = nextMatches.filter((match) => match.startsAt > now);
  const finishedMatches = matches.filter((match) => match.status === "FINISHED");
  const nextClose = openMatches[0]?.startsAt;
  const shouldOpenRegisterPanel = Boolean(invitedByCode || referralError || authError || registeredParticipant);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="hero-shell">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">
              <Trophy size={16} />
              Mundial 2026
            </div>
            <h1>Participa en la Polla Mundialista 2026</h1>
            <p>
              Inscribete por S/10, pronostica cada partido y compite por el pozo
              con ranking automatico.
            </p>
            <div className="hero-actions">
              <a href="#registro" className="primary-link">
                Inscribirme
                <ChevronRight size={18} />
              </a>
              <a href="#ranking" className="ghost-link">
                Ver ranking
              </a>
            </div>
            <div className="auth-strip">
              {googleSession ? (
                <>
                  <span>{googleSession.name}</span>
                  <form action="/api/auth/logout" method="post">
                    <button className="google-button subtle" type="submit">
                      <LogOut size={16} />
                      Salir
                    </button>
                  </form>
                </>
              ) : (
                <a className="google-button" href="/api/auth/google">
                  <LogIn size={16} />
                  Entrar con Google
                </a>
              )}
            </div>
          </div>

          <aside className="hero-visual" aria-label="Resumen de participacion">
            <Image
              src="/images/trophy-hero.png"
              alt="Copa dorada sobre una cancha de futbol"
              className="hero-photo"
              width={1400}
              height={747}
              priority
            />
            <div className="hero-board">
              <div className="hero-board-header">
                <span>Pozo acumulado</span>
                <strong>{formatMoney(potCents, config.currency)}</strong>
              </div>

              <div className="scoreboard">
                <div>
                  <TeamMark name="Polla" />
                  <span>{paidParticipants.length} pagados</span>
                </div>
                <strong>VS</strong>
                <div>
                  <TeamMark name="Premio" />
                  <span>{formatMoney(winnerCents, config.currency)} premio</span>
                </div>
              </div>

              <dl className="rules-grid">
                <div>
                  <CircleDollarSign size={16} />
                  <dt>Inscripcion</dt>
                  <dd>{formatMoney(config.entryFeeCents, config.currency)}</dd>
                </div>
                <div>
                  <CalendarClock size={16} />
                  <dt>Cierre</dt>
                  <dd>
                    {nextClose
                      ? new Intl.DateTimeFormat("es-PE", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(nextClose)
                      : "Por partido"}
                  </dd>
                </div>
                <div>
                  <Share2 size={16} />
                  <dt>Referidos</dt>
                  <dd>{paidReferrals} pagados</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </section>

      <nav className="view-tabs" aria-label="Vistas principales">
        <a href="#registro">Inscripcion</a>
        <a href="#ranking">Ranking</a>
        <a href="#participante">Pronosticos</a>
        <a href="#referidos">Referidos</a>
        <a href="#organizador">Organizador</a>
      </nav>

      <div className="app-shell">
        <section className="conversion-grid" id="registro">
          <div className="signup-copy">
            <SectionTitle
              eyebrow="Inscripcion"
              title="Entra a la polla en menos de un minuto"
              description="Registrate, confirma tu pago con el organizador y recibe tus codigos para pronosticar e invitar."
            />

            <figure className="mascot-card">
              <Image
                src="/images/mascot-condor.png"
                alt="Mascota original de futbol sosteniendo una pelota"
                width={900}
                height={900}
                loading="eager"
              />
              <figcaption>
                <strong>Tu codigo te abre la cancha.</strong>
                <span>Inscribete, invita con tu referido y empieza a competir.</span>
              </figcaption>
            </figure>

            <div className="flow-steps" aria-label="Como funciona">
              <div>
                <strong>1</strong>
                <span>Te registras con WhatsApp.</span>
              </div>
              <div>
                <strong>2</strong>
                <span>Pagas S/10 y se confirma tu acceso.</span>
              </div>
              <div>
                <strong>3</strong>
                <span>Pronosticas, compites y compartes tu referido.</span>
              </div>
            </div>

            <div className="notice">
              <BadgeCheck size={18} />
              <span>El codigo para pronosticar se activa cuando tu pago queda marcado como pagado.</span>
            </div>
          </div>

          <details className="register-panel" open={shouldOpenRegisterPanel}>
            <summary>
              <span>Entrar</span>
              <span>Registrarme</span>
              <small>S/10 · ranking automatico · referido propio</small>
            </summary>

            {registeredParticipant ? (
              <>
                <div className="registration-success">
                  <BadgeCheck size={20} />
                  <div>
                    <strong>Listo, {registeredParticipant.name}. Guarda tus codigos.</strong>
                    <span>Acceso para pronosticar: {registeredParticipant.accessCode}</span>
                    <span>Referido para invitar: {registeredParticipant.referralCode}</span>
                    <small>Tu acceso queda activo cuando el organizador confirme tu pago.</small>
                  </div>
                </div>
                <ReferralShare baseUrl={baseUrl} code={registeredParticipant.referralCode} />
              </>
            ) : null}

            {referralError === "invalid" ? (
              <div className="registration-alert">
                No encontramos el codigo {invitedByCode}. Revisa el codigo o registrate sin referido.
              </div>
            ) : null}
            {authError ? (
              <div className="registration-alert">
                {authError === "missing_config"
                  ? "El login con Google queda listo cuando configuremos las credenciales."
                  : "No pudimos completar el ingreso con Google. Intenta otra vez."}
              </div>
            ) : null}

            <div className="entry-options">
              <div className="entry-card existing-user">
                <div>
                  <Lock size={18} />
                  <h2>Ya estoy inscrito</h2>
                </div>
                {googleParticipant ? (
                  <p>Entraste como {googleParticipant.name}. Puedes pronosticar sin escribir tu codigo.</p>
                ) : (
                  <p>Usa Google si tu correo ya esta inscrito, o tu codigo en cualquier partido abierto.</p>
                )}
                <div className="auth-actions">
                  {googleSession ? null : (
                    <a className="google-button" href="/api/auth/google">
                      <LogIn size={16} />
                      Entrar con Google
                    </a>
                  )}
                  <a href="#participante" className="secondary-button">
                    Ir a pronosticos
                  </a>
                </div>
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
                    <input name="name" placeholder="Ej. Juan Perez" defaultValue={googleSession?.name ?? ""} required />
                  </label>
                  <label>
                    WhatsApp
                    <input name="phone" placeholder="Ej. 999 999 999" required />
                  </label>
                  <label>
                    Correo opcional
                    <input name="email" type="email" placeholder="correo@dominio.com" defaultValue={googleSession?.email ?? ""} />
                  </label>
                  <label>
                    Codigo de quien te invito
                    <input name="referralCode" placeholder="Ej. DEMO2026" defaultValue={invitedByCode} />
                  </label>
                  <button className="primary-button" type="submit">
                    Inscribirme
                  </button>
                </form>
              </div>
            </div>
          </details>
        </section>

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
                    <th>Codigo referido</th>
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
                        <td>{participant.referralCode}</td>
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

        <section className="proof-grid" aria-label="Reglas y confianza">
          <article className="proof-card">
            <div className="proof-icon"><ShieldCheck size={20} /></div>
            <h2>Reglas claras</h2>
            <p>Marcador exacto suma 2 puntos. Resultado correcto suma 1 punto. Cada partido se bloquea al iniciar.</p>
          </article>
          <article className="proof-card">
            <div className="proof-icon"><CircleDollarSign size={20} /></div>
            <h2>Pago confirmado</h2>
            <p>Tu acceso queda pendiente hasta que el organizador marque tu inscripcion como pagada.</p>
          </article>
          <article className="proof-card" id="referidos">
            <div className="proof-icon"><Share2 size={20} /></div>
            <h2>Invita con tu codigo</h2>
            <p>Cada participante recibe un codigo de referido. En el panel se ve quien invito y cuantos ya pagaron.</p>
          </article>
        </section>

        <section className="participant-layout" id="participante">
          <div className="participant-main">
            <SectionTitle
              eyebrow="Pronosticos"
              title={todayMatches.length > 0 ? "Partidos de hoy" : "Proximos partidos"}
              description={
                todayMatches.length > 0
                  ? "Estos partidos se muestran siempre durante el dia para registrar tus pronosticos."
                  : "No hay partidos cargados para hoy; te mostramos los proximos disponibles."
              }
            />

            <div className="match-grid">
              {displayMatches.length === 0 ? (
                <p className="empty-text">No hay partidos pendientes cargados.</p>
              ) : (
                displayMatches.map((match) => {
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
                      {googleParticipant ? (
                        <>
                          <input name="accessCode" type="hidden" value="" />
                          <p className="helper-text">Pronosticas como {googleParticipant.name}.</p>
                        </>
                      ) : (
                        <label>
                          Ingresa tu codigo
                          <input name="accessCode" placeholder="DEMO2026" required disabled={locked} />
                        </label>
                      )}
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
                    <p>Actualiza estados y sincroniza partidos reales con respaldo automatico.</p>
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
                          <ReferralShare baseUrl={baseUrl} code={participant.referralCode} name={participant.name} compact />
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
                    <h2>Auditoria reciente</h2>
                    <p>Ultimos registros guardados localmente y estado de envio a Google.</p>
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
                        <time dateTime={log.createdAt.toISOString()}>
                          {new Intl.DateTimeFormat("es-PE", {
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            month: "short",
                          }).format(log.createdAt)}
                        </time>
                      </div>
                    ))
                  )}
                </div>
                <form action={testGoogleLogging} className="admin-inline audit-test-form">
                  <input name="adminPin" placeholder="PIN organizador" type="password" />
                  <button className="secondary-button" type="submit">
                    Probar Google
                  </button>
                </form>
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
