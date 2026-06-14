export {
  searchCoins,
  getCoinPrice,
  resolveCryptoOutcome,
} from "./coingecko.js";
export type { CoinSearchResult, CoinPrice } from "./coingecko.js";

export {
  searchTeams,
  getMatchStatus,
  resolveSportsOutcome,
} from "./apisports.js";
export type { Team, MatchStatus } from "./apisports.js";

export {
  searchCities,
  getCurrentWeather,
  resolveWeatherOutcome,
} from "./openweather.js";
export type { CityResult, CurrentWeather } from "./openweather.js";

import { searchCoins } from "./coingecko.js";
import { searchTeams } from "./apisports.js";
import { searchCities } from "./openweather.js";
import { resolveCryptoOutcome } from "./coingecko.js";
import { resolveSportsOutcome } from "./apisports.js";
import { resolveWeatherOutcome } from "./openweather.js";

export interface CryptoSourceRef {
  api: "coingecko";
  coinId: string;
  refPrice: number;
}

export interface SportsSourceRef {
  api: "apisports";
  matchId: number;
}

export interface WeatherSourceRef {
  api: "openweather";
  lat: number;
  lon: number;
  city: string;
}

export type ApiSourceRef = CryptoSourceRef | SportsSourceRef | WeatherSourceRef;

export interface SearchResult {
  label: string;
  sourceRef: string;
}

export async function searchEvents(
  eventType: string,
  query: string
): Promise<SearchResult[]> {
  switch (eventType) {
    case "crypto": {
      const coins = await searchCoins(query);
      return coins.map((c) => ({
        label: `${c.name} (${c.symbol.toUpperCase()})`,
        sourceRef: JSON.stringify({
          api: "coingecko",
          coinId: c.id,
          refPrice: 0,
        } satisfies CryptoSourceRef),
      }));
    }
    case "sports": {
      const teams = await searchTeams(query);
      return teams.map((t) => ({
        label: `${t.name}${t.country ? `, ${t.country}` : ""}`,
        sourceRef: JSON.stringify({
          api: "apisports",
          matchId: t.id,
        } satisfies SportsSourceRef),
      }));
    }
    case "weather": {
      const cities = await searchCities(query);
      return cities.map((c) => {
        const extra = c.state ? `${c.state}, ${c.country}` : c.country;
        return {
          label: `${c.name}, ${extra} (${c.lat.toFixed(2)}, ${c.lon.toFixed(2)})`,
          sourceRef: JSON.stringify({
            api: "openweather",
            lat: c.lat,
            lon: c.lon,
            city: c.name,
          } satisfies WeatherSourceRef),
        };
      });
    }
    default:
      return [];
  }
}

export async function resolveEventOutcome(
  eventType: string,
  sourceRef: string
): Promise<string | null> {
  switch (eventType) {
    case "crypto": {
      const ref = JSON.parse(sourceRef) as CryptoSourceRef;
      return resolveCryptoOutcome(ref.coinId);
    }
    case "sports": {
      const ref = JSON.parse(sourceRef) as SportsSourceRef;
      return resolveSportsOutcome(ref.matchId);
    }
    case "weather": {
      const ref = JSON.parse(sourceRef) as WeatherSourceRef;
      return resolveWeatherOutcome(ref.lat, ref.lon);
    }
    default:
      return null;
  }
}
