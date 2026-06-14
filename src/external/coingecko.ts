const BASE_URL = "https://api.coingecko.com/api/v3";

export interface CoinSearchResult {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
}

export interface CoinPrice {
  usd: number;
  usd_24h_change: number | null;
}

async function coinGeckoFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  const data = await coinGeckoFetch<{ coins: CoinSearchResult[] }>(
    `/search?query=${encodeURIComponent(query)}`
  );
  return data?.coins?.slice(0, 10) ?? [];
}

export async function getCoinPrice(coinId: string): Promise<CoinPrice | null> {
  const data = await coinGeckoFetch<Record<string, { usd: number; usd_24h_change: number | null }>>(
    `/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd&include_24hr_change=true`
  );
  if (!data || !data[coinId]) return null;
  return { usd: data[coinId].usd, usd_24h_change: data[coinId].usd_24h_change };
}

export async function resolveCryptoOutcome(coinId: string): Promise<string | null> {
  const price = await getCoinPrice(coinId);
  if (!price) return null;
  if (price.usd_24h_change === null) return null;
  if (price.usd_24h_change > 0) return "Up";
  if (price.usd_24h_change < 0) return "Down";
  return "Flat";
}
