import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  LogIn,
  LogOut,
  Lock,
  Medal,
  Share2,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import {
  registerParticipant,
  savePrediction,
} from "@/app/actions";
import { ReferralShare } from "@/app/referral-share";
import { formatPeruDateTime, formatPeruShortDateTime, peruDayKey } from "@/lib/date-format";
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

export default async function Home({ searchParams }: { searchParams?: HomeSearchParams }) {
  const query = searchParams ? await searchParams : {};
  const invitedByCode = normalizeCodeParam(query.ref);
  const registeredCode = normalizeCodeParam(query.registered);
  const referralError = firstSearchParam(query.referralError);
  const authError = firstSearchParam(query.authError);
  const baseUrl = await getBaseUrl();
  const googleSession = await getGoogleSession();
  const { config, participants, matches, leaderboard } = await getDashboardData();
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
  const now = new Date();
  const nextMatches = matches.filter((match) => match.status !== "FINISHED").slice(0, 8);
  const todayMatches = matches.filter((match) => peruDayKey(match.startsAt) === peruDayKey(now));
  const displayMatches = todayMatches.length > 0 ? todayMatches : nextMatches;
  const openMatches = nextMatches.filter((match) => match.startsAt > now);
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
                    {nextClose ? formatPeruShortDateTime(nextClose) : "Por partido"}
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
        <Link href="/admin">Admin</Link>
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
              nextClose ? formatPeruShortDateTime(nextClose) : "Sin partidos"
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
                        {formatPeruDateTime(match.startsAt)}
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

      </div>
    </main>
  );
}
