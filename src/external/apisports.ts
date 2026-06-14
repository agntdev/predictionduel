const BASE_URL = "https://v3.football.api-sports.io";

function getKey(): string {
  return process.env.APISPORTS_KEY ?? "";
}

export interface Team {
  id: number;
  name: string;
  country: string;
}

export interface MatchStatus {
  id: number;
  status: { long: string; short: string };
  goals: { home: number | null; away: number | null };
  teams: { home: { name: string }; away: { name: string } };
}

async function apiSportsFetch<T>(path: string): Promise<T | null> {
  const key = getKey();
  if (!key) return null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "x-apisports-key": key },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function searchTeams(query: string): Promise<Team[]> {
  const data = await apiSportsFetch<{
    response: { team: { id: number; name: string; country: string } }[];
  }>(`/teams?search=${encodeURIComponent(query)}`);
  if (!data?.response) return [];
  return data.response
    .slice(0, 10)
    .map((r) => ({ id: r.team.id, name: r.team.name, country: r.team.country }));
}

export async function getMatchStatus(matchId: number): Promise<MatchStatus | null> {
  const data = await apiSportsFetch<{ response: MatchStatus[] }>(
    `/fixtures?id=${matchId}`
  );
  if (!data?.response?.length) return null;
  return data.response[0];
}

export async function resolveSportsOutcome(matchId: number): Promise<string | null> {
  const match = await getMatchStatus(matchId);
  if (!match) return null;
  if (match.status.short !== "FT") return null;
  const { home, away } = match.goals;
  if (home === null || away === null) return null;
  if (home > away) return match.teams.home.name;
  if (away > home) return match.teams.away.name;
  return "Draw";
}
