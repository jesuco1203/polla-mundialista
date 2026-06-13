import { teamNameEs } from "@/lib/team-names";

type ApiSportsFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
    venue?: { name?: string };
  };
  league: {
    round?: string;
  };
  teams: {
    home: { name: string };
    away: { name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
};

type WorldCup26Game = {
  id: string;
  home_score: string | null;
  away_score: string | null;
  group: string | null;
  matchday: string | null;
  local_date: string;
  stadium_id: string | null;
  finished: string;
  time_elapsed: string;
  type: string;
  home_team_name_en?: string;
  away_team_name_en?: string;
};

type WorldCup26Stadium = {
  id: string;
  name_en: string;
  city_en: string;
  country_en: string;
  region: string;
};

type OpenFootballMatch = {
  round?: string;
  date: string;
  time?: string;
  team1: string;
  team2: string;
  group?: string;
  ground?: string;
  score?: {
    ft?: [number, number];
  };
};

export type ImportedMatch = {
  externalId: string;
  stage: string;
  groupName: string | null;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
};

export type MatchSyncResult = {
  source: string;
  matches: ImportedMatch[];
};

const statusMap: Record<string, string> = {
  NS: "SCHEDULED",
  TBD: "SCHEDULED",
  "1H": "LIVE",
  HT: "LIVE",
  "2H": "LIVE",
  ET: "LIVE",
  P: "LIVE",
  FT: "FINISHED",
  AET: "FINISHED",
  PEN: "FINISHED",
};

function groupFromRound(round?: string | null) {
  const match = round?.match(/Group\s+([A-Z])/i);
  return match?.[1] ?? null;
}

function asScore(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "" || value === "null") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function padMatchId(value: string | number) {
  return String(value).padStart(3, "0");
}

function parseOpenFootballDate(date: string, time?: string) {
  const match = time?.match(/^(\d{2}:\d{2})\s+UTC([+-]\d{1,2})$/);
  if (!match) return new Date(`${date}T00:00:00.000Z`);

  const [, hour, offset] = match;
  const offsetNumber = Number(offset);
  const sign = offsetNumber < 0 ? "-" : "+";
  const normalizedOffset = `${sign}${String(Math.abs(offsetNumber)).padStart(2, "0")}:00`;
  return new Date(`${date}T${hour}:00${normalizedOffset}`);
}

function offsetForWorldCup26Stadium(stadium?: WorldCup26Stadium) {
  if (!stadium) return "-06:00";
  if (stadium.country_en === "Mexico") return "-06:00";
  if (stadium.region === "Eastern") return "-04:00";
  if (stadium.region === "Central") return "-05:00";
  if (stadium.region === "Western") return "-07:00";
  return "-06:00";
}

function parseWorldCup26Date(localDate: string, stadium?: WorldCup26Stadium) {
  const match = localDate.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})$/);
  if (!match) return new Date(localDate);

  const [, month, day, year, hour] = match;
  return new Date(`${year}-${month}-${day}T${hour}:00${offsetForWorldCup26Stadium(stadium)}`);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`${url} respondio ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchFromWorldCup26(): Promise<MatchSyncResult> {
  const [{ games }, { stadiums }] = await Promise.all([
    fetchJson<{ games?: WorldCup26Game[] }>("https://worldcup26.ir/get/games"),
    fetchJson<{ stadiums?: WorldCup26Stadium[] }>("https://worldcup26.ir/get/stadiums"),
  ]);

  const stadiumById = new Map((stadiums ?? []).map((stadium) => [stadium.id, stadium]));
  const matches = (games ?? []).map((game) => {
    const stadium = game.stadium_id ? stadiumById.get(game.stadium_id) : undefined;
    const homeScore = asScore(game.home_score);
    const awayScore = asScore(game.away_score);
    const isFinished = game.finished === "TRUE";
    const isLive = !isFinished && game.time_elapsed && game.time_elapsed !== "notstarted";

    return {
      externalId: `wc2026-${padMatchId(game.id)}`,
      stage: game.type === "group" ? `Grupo ${game.group ?? ""}`.trim() : game.type,
      groupName: game.group || null,
      homeTeam: teamNameEs(game.home_team_name_en || "Por definir"),
      awayTeam: teamNameEs(game.away_team_name_en || "Por definir"),
      startsAt: parseWorldCup26Date(game.local_date, stadium),
      status: isFinished ? "FINISHED" : isLive ? "LIVE" : "SCHEDULED",
      homeScore: isFinished ? homeScore : null,
      awayScore: isFinished ? awayScore : null,
      venue: stadium ? `${stadium.name_en}, ${stadium.city_en}` : null,
    };
  });

  if (matches.length === 0) {
    throw new Error("worldcup26.ir no devolvio partidos.");
  }

  return { source: "worldcup26.ir", matches };
}

async function fetchFromOpenFootball(): Promise<MatchSyncResult> {
  const payload = await fetchJson<{ matches?: OpenFootballMatch[] }>(
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json",
  );

  const sortedMatches = (payload.matches ?? [])
    .map((match) => ({
      ...match,
      startsAt: parseOpenFootballDate(match.date, match.time),
    }))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const matches = sortedMatches.map((match, index) => ({
    externalId: `wc2026-${padMatchId(index + 1)}`,
    stage: match.group ?? match.round ?? "Mundial 2026",
    groupName: groupFromRound(match.group),
    homeTeam: teamNameEs(match.team1),
    awayTeam: teamNameEs(match.team2),
    startsAt: match.startsAt,
    status: match.score?.ft ? "FINISHED" : "SCHEDULED",
    homeScore: match.score?.ft?.[0] ?? null,
    awayScore: match.score?.ft?.[1] ?? null,
    venue: match.ground ?? null,
  }));

  if (matches.length === 0) {
    throw new Error("openfootball no devolvio partidos.");
  }

  return { source: "openfootball/worldcup.json", matches };
}

async function fetchFromApiFootball(): Promise<MatchSyncResult> {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    throw new Error("Falta API_FOOTBALL_KEY.");
  }

  const payload = await fetchJson<{ response?: ApiSportsFixture[] }>(
    "https://v3.football.api-sports.io/fixtures?league=1&season=2026",
    {
      headers: {
        "x-apisports-key": apiKey,
      },
    },
  );

  const matches = (payload.response ?? []).map((item) => ({
    externalId: `api-football-${item.fixture.id}`,
    stage: item.league.round ?? "Mundial 2026",
    groupName: groupFromRound(item.league.round),
    homeTeam: teamNameEs(item.teams.home.name),
    awayTeam: teamNameEs(item.teams.away.name),
    startsAt: new Date(item.fixture.date),
    status: statusMap[item.fixture.status.short] ?? "SCHEDULED",
    homeScore: item.goals.home,
    awayScore: item.goals.away,
    venue: item.fixture.venue?.name ?? null,
  }));

  if (matches.length === 0) {
    throw new Error("API-Football no devolvio partidos.");
  }

  return { source: "api-football", matches };
}

export async function fetchWorldCupMatches(): Promise<MatchSyncResult> {
  const sources = [
    fetchFromWorldCup26,
    fetchFromOpenFootball,
    fetchFromApiFootball,
  ];
  const errors: string[] = [];

  for (const source of sources) {
    try {
      return await source();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`No se pudo sincronizar partidos. ${errors.join(" | ")}`);
}
