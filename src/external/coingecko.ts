interface CoinGeckoPriceResponse {
  [coinId: string]: {
    usd: number;
  };
}

const BASE_URL = "https://api.coingecko.com/api/v3";

function apiKey(): string | undefined {
  return process.env.COINGECKO_API_KEY || undefined;
}

export async function fetchCryptoPrice(coinId: string): Promise<number | null> {
  const key = apiKey();
  const url = new URL(`${BASE_URL}/simple/price`);
  url.searchParams.set("ids", coinId.toLowerCase());
  url.searchParams.set("vs_currencies", "usd");
  if (key) {
    url.searchParams.set("x_cg_demo_api_key", key);
  }

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(`CoinGecko: HTTP ${res.status} for ${coinId}`);
      return null;
    }
    const data = (await res.json()) as CoinGeckoPriceResponse;
    const entry = data[coinId.toLowerCase()];
    if (!entry || entry.usd === undefined) {
      console.error(`CoinGecko: no price data for ${coinId}`);
      return null;
    }
    return entry.usd;
  } catch (err) {
    console.error(`CoinGecko: fetch error for ${coinId}:`, err);
    return null;
  }
}
