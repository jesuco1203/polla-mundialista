import {
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Info,
  LogOut,
  Lock,
  MapPin,
  Medal,
  Save,
  Share2,
  ShieldCheck,
  Star,
  Trophy,
  UserPlus,
} from "lucide-react";
import Image from "next/image";
import { headers } from "next/headers";
import {
  completeGoogleParticipantPhone,
  registerParticipant,
  savePrediction,
} from "@/app/actions";
import { ReferralShare } from "@/app/referral-share";
import { ScoreStepper } from "@/app/score-stepper";
import { peruDayKey } from "@/lib/date-format";
import { getGoogleSession } from "@/lib/google-auth";
import { prisma } from "@/lib/prisma";
import {
  REFERRAL_INVITE_LIMIT,
  REFERRER_BONUS_POINTS,
  REFERRED_WELCOME_POINTS,
  getReferralBonus,
} from "@/lib/referral-bonus";
import { formatMoney } from "@/lib/scoring";

export const dynamic = "force-dynamic";

type HomeSearchParams = Promise<{
  ref?: string | string[];
  registered?: string | string[];
  referralError?: string | string[];
  authError?: string | string[];
  predictionNotice?: string | string[];
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
  const [config, participants, matches] = await Promise.all([
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
  ]);

  const sortedLeaderboard = participants
    .map((participant) => {
      const predictionPoints = participant.predictions.reduce(
        (total, prediction) => total + prediction.points,
        0,
      );
      const referralBonus = getReferralBonus({
        referredById: participant.referredById,
        referrals: participant.referrals,
      });

      return {
        ...participant,
        ...referralBonus,
        exactHits: participant.predictions.filter((prediction) => prediction.points === 2).length,
        predictedMatches: participant.predictions.length,
        predictionPoints,
        totalPoints: predictionPoints + referralBonus.totalBonusPoints,
      };
    })
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

function teamCode(name: string) {
  const normalized = name.toLowerCase();
  const knownCodes: Record<string, string> = {
    "bosnia and herzegovina": "BIH",
    canada: "CAN",
    paraguay: "PAR",
    "saudi arabia": "KSA",
    spain: "ESP",
    "united states": "USA",
  };

  return knownCodes[normalized] ?? name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function matchDateParts(startsAt: Date) {
  return {
    date: new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "America/Lima",
    }).format(startsAt),
    time: new Intl.DateTimeFormat("es-PE", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Lima",
    }).format(startsAt),
  };
}

function shortAccountName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
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
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="section-title">
      <p>{eyebrow}</p>
      <h2>{icon ? <span className="section-title-icon">{icon}</span> : null}{title}</h2>
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
  const predictionNotice = firstSearchParam(query.predictionNotice);
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
  const googleParticipant = googleSession?.email
    ? participants.find((participant) => participant.email?.toLowerCase() === googleSession.email.toLowerCase()) ?? null
    : null;
  const googleParticipantNeedsPhone = Boolean(
    googleParticipant && ["", "Google"].includes(googleParticipant.phone.trim()),
  );
  const potCents = paidParticipants.length * config.entryFeeCents;
  const winnerCents = Math.floor((potCents * config.winnerShare) / 100);
  const now = new Date();
  const nextMatches = matches.filter((match) => match.status !== "FINISHED").slice(0, 8);
  const todayMatches = matches.filter((match) => peruDayKey(match.startsAt) === peruDayKey(now));
  const displayMatches = todayMatches.length > 0 ? todayMatches : nextMatches;
  const openMatches = nextMatches.filter((match) => match.startsAt > now);
  const nextClose = openMatches[0]?.startsAt;
  const closeDiffMs = nextClose ? Math.max(0, nextClose.getTime() - now.getTime()) : 0;
  const closeDays = Math.floor(closeDiffMs / 86_400_000);
  const closeHours = Math.floor((closeDiffMs % 86_400_000) / 3_600_000);
  const closeMinutes = Math.floor((closeDiffMs % 3_600_000) / 60_000);
  const googleLoginHref = invitedByCode
    ? `/api/auth/google?ref=${encodeURIComponent(invitedByCode)}`
    : "/api/auth/google";
  const primaryHeroHref = "#registro";
  const primaryHeroLabel = googleParticipant
    ? "Ver mi invitacion"
    : googleSession
      ? "Completar registro"
      : "Entrar o registrarme";
  const loggedParticipantName = googleParticipant?.name ?? registeredParticipant?.name ?? "";
  const loggedParticipantShortName = shortAccountName(loggedParticipantName);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="hero-shell">
        <header className="site-header">
          <a className="brand-lockup" href="#top" aria-label="Polla Mundial 2026">
            <span className="brand-ball"><Trophy size={20} /></span>
            <span>
              <strong>Polla</strong>
              <small>Mundial 2026</small>
            </span>
          </a>
          <nav className="site-nav" aria-label="Navegacion principal">
            <a href="#como-funciona">Como funciona</a>
            {leaderboard.length > 0 ? <a href="#ranking">Ranking</a> : null}
            <a href="#participante">Pronosticos</a>
            <a href="#referidos">Referidos</a>
          </nav>
          {googleSession ? (
            <details className="user-menu">
              <summary>
                <span className="user-avatar">{googleSession.name.slice(0, 1).toUpperCase()}</span>
                <span>Hola, {googleSession.name.split(" ")[0]}</span>
                <ChevronRight size={16} />
              </summary>
              <div>
                <a href={googleParticipant ? "#registro" : "#participante"}>Mi perfil</a>
                <form action="/api/auth/logout" method="post">
                  <button type="submit">
                    <LogOut size={16} />
                    Cerrar sesion
                  </button>
                </form>
              </div>
            </details>
          ) : (
            <a href={primaryHeroHref} className="header-cta">
              Entrar
              <ChevronRight size={16} />
            </a>
          )}
        </header>

        <div className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">
              <Trophy size={16} />
              Polla Mundial 2026
            </div>
            <h1>Acierta los resultados y gana el pozo</h1>
            <p>
              La polla del Mundial 2026. Facil de jugar, ranking automatico y premios claros desde el primer partido.
            </p>

            <div className="hero-stats" aria-label="Estadisticas principales">
              <div>
                <CircleDollarSign size={18} />
                <span>Inscripcion</span>
                <strong>{formatMoney(config.entryFeeCents, config.currency)}</strong>
              </div>
              <div>
                <CircleDollarSign size={18} />
                <span>Pozo acumulado</span>
                <strong>{formatMoney(potCents, config.currency)}</strong>
              </div>
              <div>
                <Medal size={18} />
                <span>Premio estimado</span>
                <strong>{formatMoney(winnerCents, config.currency)}</strong>
              </div>
            </div>

            <div className="hero-actions">
              <a href={primaryHeroHref} className="primary-link">
                {primaryHeroLabel}
                <ChevronRight size={18} />
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
                <span><Lock size={14} /> Pago 100% seguro. Acceso activado al confirmar S/10.</span>
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
            <div className="closing-card">
              <span>Proximo cierre de pronosticos</span>
              <div className="countdown-grid" aria-label="Tiempo al proximo cierre">
                <strong>{String(closeDays).padStart(2, "0")}<small>Dias</small></strong>
                <strong>{String(closeHours).padStart(2, "0")}<small>Horas</small></strong>
                <strong>{String(closeMinutes).padStart(2, "0")}<small>Min</small></strong>
              </div>
              <ul>
                <li><BadgeCheck size={16} /> Acierta y suma puntos</li>
                <li><BadgeCheck size={16} /> Compite en el ranking</li>
                <li><BadgeCheck size={16} /> Invita hasta {REFERRAL_INVITE_LIMIT} amigos</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <nav className="view-tabs" aria-label="Vistas principales">
        <a href="#como-funciona">Como funciona</a>
        <a href="#registro">Inscripcion</a>
        {leaderboard.length > 0 ? <a href="#ranking">Ranking</a> : null}
        <a href="#participante">Pronosticos</a>
        <a href="#referidos">Referidos</a>
      </nav>

      <div className="app-shell">
        <section className="how-card" id="como-funciona">
          <div className="signup-copy">
            <SectionTitle
              eyebrow="Como funciona"
              title="Juegas en tres pasos"
              description="El recorrido queda claro antes de registrarte: pagas, pronosticas y compites por el pozo."
            />

            <div className="flow-steps" aria-label="Como funciona">
              <div>
                <strong>1</strong>
                <UserPlus size={34} />
                <span>Registrate con Google o WhatsApp.</span>
              </div>
              <div>
                <strong>2</strong>
                <CircleDollarSign size={34} />
                <span>Confirma tu pago de S/10.</span>
              </div>
              <div>
                <strong>3</strong>
                <Trophy size={34} />
                <span>Pronostica y comparte tu referido.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="conversion-grid" id="registro">
          <div className="signup-copy">
            <SectionTitle
              eyebrow="Inscripcion"
              title="Entra a la polla en menos de un minuto"
              description="Registrate, confirma tu pago y activa tus pronosticos. Tu codigo de referido queda listo para compartir."
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
                <span>
                  Invita hasta {REFERRAL_INVITE_LIMIT} amigos: tu sumas +{REFERRER_BONUS_POINTS} y ellos reciben{" "}
                  +{REFERRED_WELCOME_POINTS} de bienvenida.
                </span>
              </figcaption>
            </figure>

            <div className="notice">
              <BadgeCheck size={18} />
              <span>El codigo para pronosticar se activa cuando tu pago queda marcado como pagado.</span>
            </div>
          </div>

          <aside className="signup-stats" aria-label="Resumen de inscripcion">
            <StatCard
              icon={<CircleDollarSign size={20} />}
              label="Inscripcion"
              value={formatMoney(config.entryFeeCents, config.currency)}
              detail="Pago unico para activar tu acceso"
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
          </aside>

          <div className="register-panel">
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
                <div className="auth-actions participant-shortcuts">
                  <a href="#participante" className="primary-button">
                    Ir a pronosticos
                  </a>
                </div>
              </>
            ) : null}
            {googleParticipant && !registeredParticipant ? (
              <>
                <div className="registration-success">
                  <BadgeCheck size={20} />
                  <div>
                    <strong>{googleParticipant.name}, este es tu link de invitacion.</strong>
                    <span>Acceso para pronosticar: {googleParticipant.accessCode}</span>
                    <span>Referido para invitar: {googleParticipant.referralCode}</span>
                    <small>
                      Comparte este link: puedes invitar hasta {REFERRAL_INVITE_LIMIT} amigos y sumar +
                      {REFERRER_BONUS_POINTS} por cada pago confirmado.
                    </small>
                  </div>
                </div>
                <ReferralShare baseUrl={baseUrl} code={googleParticipant.referralCode} />
                {googleParticipantNeedsPhone ? (
                  <form action={completeGoogleParticipantPhone} className="google-phone-form">
                    <div>
                      <strong>Completa tu celular</strong>
                      <span>Ya entraste con Google. Solo falta tu WhatsApp para que el organizador pueda validar tu pago.</span>
                    </div>
                    <label>
                      WhatsApp
                      <input name="phone" placeholder="Ej. 999 999 999" required />
                    </label>
                    <button className="primary-button" type="submit">
                      Guardar celular
                    </button>
                  </form>
                ) : null}
                <div className="auth-actions participant-shortcuts">
                  <a href="#participante" className="primary-button">
                    Ir a pronosticos
                  </a>
                </div>
              </>
            ) : null}
            {referralError === "invalid" ? (
              <div className="registration-alert">
                No encontramos el codigo {invitedByCode}. Revisa el codigo o registrate sin referido.
              </div>
            ) : null}
            {referralError === "limit" ? (
              <div className="registration-alert">
                Ese codigo ya alcanzo el limite de {REFERRAL_INVITE_LIMIT} invitados. Puedes registrarte sin referido.
              </div>
            ) : null}
            {authError ? (
              <div className="registration-alert">
                {authError === "missing_config"
                  ? "El login con Google queda listo cuando configuremos las credenciales."
                  : "No pudimos completar el ingreso con Google. Intenta otra vez."}
              </div>
            ) : null}

            {!googleSession && !googleParticipant && !registeredParticipant ? (
              <div className="entry-options">
                <div className="entry-choice-intro">
                  <strong>Elige una sola forma de entrar</strong>
                  <span>Puedes usar Google o crear tu cuenta con nombre y WhatsApp. No necesitas hacer ambas.</span>
                </div>
                <div className="entry-card existing-user entry-google-card">
                  <div>
                    <Lock size={18} />
                    <h2>Opcion 1: Entrar con Google</h2>
                  </div>
                  <p>Recomendado si quieres entrar rapido con tu correo.</p>
                  <div className="auth-actions">
                    {googleSession ? null : (
                      <a className="google-button" href={googleLoginHref}>
                        <span className="google-logo" aria-hidden="true">G</span>
                        Entrar con Google
                      </a>
                    )}
                  </div>
                </div>

                <div className="entry-divider" aria-hidden="true">
                  <span>O</span>
                </div>

                <div className="entry-card entry-whatsapp-card">
                  <div>
                    <UserPlus size={18} />
                    <h2>Opcion 2: Crear cuenta con WhatsApp</h2>
                  </div>
                  <p>Usa esta opcion si prefieres registrarte solo con tu nombre y numero.</p>
                  <form action={registerParticipant} className="stacked-form">
                    <label>
                      Nombre
                      <input name="name" placeholder="Ej. Juan Perez" required />
                    </label>
                    <label>
                      WhatsApp
                      <input name="phone" placeholder="Ej. 999 999 999" required />
                    </label>
                    <input name="email" type="hidden" value="" />
                    <input name="referralCode" type="hidden" value={invitedByCode} />
                    <button className="primary-button" type="submit">
                      Crear cuenta con WhatsApp
                    </button>
                  </form>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="dashboard-grid" id="dashboard">
          <div className="ranking-section" id="ranking">
            <SectionTitle
              eyebrow="Competencia"
              title="Ranking general"
              description="Gana quien acumule mas puntos por pronosticos y bonus de referidos."
            />
            <div className="leaderboard-panel">
              {leaderboard.length === 0 ? (
                <div className="soft-empty-state">
                  <strong>El ranking aparecera cuando se confirmen los primeros pagos.</strong>
                  <span>
                    Los participantes suman 2 puntos por marcador exacto, 1 por resultado correcto y bonus por referidos.
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Participante</th>
                        <th>Exactos</th>
                        <th>Pronosticos</th>
                        <th>Referidos</th>
                        <th>Bonus</th>
                        <th>Puntos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((participant, index) => (
                        <tr key={participant.id}>
                          <td>{index + 1}</td>
                          <td>
                            <span className="participant-name-cell">
                              <TeamMark name={participant.name} />
                              <span>{participant.name}</span>
                            </span>
                          </td>
                          <td>{participant.exactHits}</td>
                          <td>{participant.predictedMatches}</td>
                          <td>{participant.paidReferralCount}/{REFERRAL_INVITE_LIMIT}</td>
                          <td>+{participant.totalBonusPoints}</td>
                          <td className="score-cell">{participant.totalPoints}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="participant-layout" id="participante">
            <div className="participant-main">
            <SectionTitle
              eyebrow="Pronosticos"
              icon={<CalendarDays size={30} />}
              title={todayMatches.length > 0 ? "Partidos de hoy" : "Proximos partidos"}
              description={
                todayMatches.length > 0
                  ? "Estos partidos se muestran siempre durante el dia para registrar tus pronosticos."
                  : "No hay partidos cargados para hoy; te mostramos los proximos disponibles."
              }
            />

            {predictionNotice === "login" && !googleParticipant ? (
              <div className="prediction-login-alert">
                <div>
                  <strong>Para guardar tu pronostico necesitas entrar o crear tu cuenta.</strong>
                  <span>Asi vinculamos tus puntos, tu pago y tus referidos con tu participante.</span>
                </div>
                <div className="auth-actions">
                  <a className="primary-button" href={googleSession ? "#registro" : googleLoginHref}>
                    {googleSession ? "Completar registro" : "Entrar con Google"}
                  </a>
                  {googleSession ? null : (
                    <a className="secondary-button" href="#registro">
                      Crear mi cuenta
                    </a>
                  )}
                </div>
              </div>
            ) : null}
            {predictionNotice === "payment" ? (
              <div className="prediction-login-alert payment-pending-alert">
                <div>
                  <strong>Tu pronostico aun no se guardo porque falta confirmar tu pago.</strong>
                  <span>Cuando el organizador apruebe tu pago de inscripcion, podras guardar marcadores y sumar puntos.</span>
                </div>
                <div className="auth-actions">
                  <a className="primary-button" href="#registro">
                    Ver mi inscripcion
                  </a>
                </div>
              </div>
            ) : null}

            <div className="match-grid">
              {displayMatches.length === 0 ? (
                <p className="empty-text">No hay partidos pendientes cargados.</p>
              ) : (
                displayMatches.map((match) => {
                  const locked = match.startsAt <= now;
                  const dateParts = matchDateParts(match.startsAt);

                  return (
                    <form action={savePrediction} className="match-card" key={match.id}>
                      <div className="match-topline">
                        <span className="match-badge">{match.groupName ? `Grupo ${match.groupName}` : match.stage}</span>
                        <MatchState locked={locked} />
                      </div>

                      <input type="hidden" name="matchId" value={match.id} />
                      {googleParticipant || registeredParticipant ? (
                        <input name="accessCode" type="hidden" value={registeredParticipant?.accessCode ?? ""} />
                      ) : null}

                      <div className="match-meta">
                        <span><CalendarDays size={17} /> {dateParts.date}</span>
                        <span><Clock3 size={17} /> {dateParts.time}</span>
                        {match.venue ? <span><MapPin size={17} /> {match.venue}</span> : null}
                      </div>

                      <div className="teams-row">
                        <div className="team-side">
                          <span className="team-identity">
                            <TeamMark name={match.homeTeam} />
                            <strong>{teamCode(match.homeTeam)}</strong>
                          </span>
                        </div>
                        <span className="versus">vs</span>
                        <div className="team-side right">
                          <span className="team-identity">
                            <TeamMark name={match.awayTeam} />
                            <strong>{teamCode(match.awayTeam)}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="match-schedule">
                        <p className={locked ? "match-close-note closed" : "match-close-note"}>
                          <Lock size={15} />
                          {locked
                            ? "Pronosticos cerrados para este partido."
                            : "Cierra justo al iniciar este partido."}
                        </p>
                      </div>

                      <div className="prediction-panel">
                        <div className="prediction-panel-heading">
                          <div>
                            <strong>Tu pronostico</strong>
                            <span>
                              {googleParticipant || registeredParticipant
                                ? "Queda guardado a tu nombre."
                                : "Si no has entrado, te pediremos crear cuenta al guardar."}
                            </span>
                          </div>
                          <Info size={19} aria-hidden="true" />
                        </div>
                        <ScoreStepper homeTeam={match.homeTeam} awayTeam={match.awayTeam} locked={locked} />
                        {googleParticipant || registeredParticipant ? (
                          <p className="helper-text">
                            Pronosticas como {googleParticipant?.name ?? registeredParticipant?.name}.
                          </p>
                        ) : null}
                      </div>
                      <button className="primary-button" type="submit" disabled={locked}>
                        <Save size={18} />
                        {locked ? "Pronostico cerrado" : "Guardar pronostico"}
                      </button>
                    </form>
                  );
                })
              )}
            </div>

            <article className="mobile-points-card">
              <div className="mobile-points-title">
                <span><Star size={20} /></span>
                <strong>Asi ganas puntos</strong>
              </div>
              <div className="mobile-points-grid">
                <div>
                  <span>Marcador exacto</span>
                  <strong>+2 puntos</strong>
                </div>
                <div>
                  <span>Resultado correcto</span>
                  <strong>+1 punto</strong>
                </div>
              </div>
              <p>
                Cada partido se bloquea cuando inicia. <Lock size={14} />
              </p>
            </article>
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
            <h2>Referidos con puntos</h2>
            <p>
              Trae hasta {REFERRAL_INVITE_LIMIT} amigos pagados: tu sumas +{REFERRER_BONUS_POINTS} por cada uno y
              ellos reciben +{REFERRED_WELCOME_POINTS} de bienvenida.
            </p>
          </article>
        </section>

      </div>
      {loggedParticipantName ? (
        <nav className="mobile-user-bar" aria-label="Acciones rapidas del participante">
          <div className="mobile-user-info">
            <strong>{loggedParticipantShortName}</strong>
          </div>
          <div className="mobile-user-actions">
            <a href="#participante">
              <CalendarDays size={17} />
              Pronostico
            </a>
            <a href="#ranking">
              <Trophy size={17} />
              Ranking
            </a>
          </div>
        </nav>
      ) : null}
    </main>
  );
}
