const BASE_URL = "https://v1.sports.api-sports.io";

interface FixtureResponse {
  response: Fixture[];
  errors: unknown[];
}

interface Fixture {
  fixture: { id: number };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
  score: {
    fulltime: { home: number | null; away: number | null };
  };
}

function apiKey(): string | undefined {
  return process.env.API_SPORTS_KEY || undefined;
}

export async function fetchMatchResult(matchId: string): Promise<string | null> {
  const key = apiKey();
  if (!key) {
    console.error("API-Sports: API_SPORTS_KEY is not set");
    return null;
  }

  const sport = process.env.API_SPORTS_SPORT || "football";
  const url = `${BASE_URL}/${encodeURIComponent(sport)}/fixtures?id=${encodeURIComponent(matchId)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "x-apisports-key": key,
        "Accept": "application/json",
      },
    });
    if (!res.ok) {
      console.error(`API-Sports: HTTP ${res.status} for match ${matchId}`);
      return null;
    }
    const data = (await res.json()) as FixtureResponse;
    if (!data.response || data.response.length === 0) {
      console.error(`API-Sports: no fixture data for match ${matchId}`);
      return null;
    }

    const fixture = data.response[0];
    const home = fixture.teams.home.name;
    const away = fixture.teams.away.name;
    const homeGoals = fixture.goals.home ?? fixture.score.fulltime.home;
    const awayGoals = fixture.goals.away ?? fixture.score.fulltime.away;

    if (homeGoals === null || awayGoals === null) {
      return null;
    }

    return `${home} ${homeGoals}-${awayGoals} ${away}`;
  } catch (err) {
    console.error(`API-Sports: fetch error for match ${matchId}:`, err);
    return null;
  }
}
