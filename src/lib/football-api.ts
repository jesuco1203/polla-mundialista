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

function groupFromRound(round?: string) {
  const match = round?.match(/Group\s+([A-Z])/i);
  return match?.[1] ?? null;
}

export async function fetchWorldCupMatches(): Promise<ImportedMatch[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    throw new Error("Falta API_FOOTBALL_KEY para sincronizar partidos reales.");
  }

  const response = await fetch(
    "https://v3.football.api-sports.io/fixtures?league=1&season=2026",
    {
      headers: {
        "x-apisports-key": apiKey,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`API-Football respondio ${response.status}`);
  }

  const payload = (await response.json()) as { response?: ApiSportsFixture[] };

  return (payload.response ?? []).map((item) => ({
    externalId: String(item.fixture.id),
    stage: item.league.round ?? "Mundial 2026",
    groupName: groupFromRound(item.league.round),
    homeTeam: item.teams.home.name,
    awayTeam: item.teams.away.name,
    startsAt: new Date(item.fixture.date),
    status: statusMap[item.fixture.status.short] ?? "SCHEDULED",
    homeScore: item.goals.home,
    awayScore: item.goals.away,
    venue: item.fixture.venue?.name ?? null,
  }));
}
