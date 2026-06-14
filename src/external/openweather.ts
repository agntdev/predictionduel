const GEO_URL = "https://api.openweathermap.org/geo/1.0";
const DATA_URL = "https://api.openweathermap.org/data/2.5";

function getKey(): string {
  return process.env.OPENWEATHER_KEY ?? "";
}

export interface CityResult {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

export interface CurrentWeather {
  temp: number;
  feels_like: number;
  humidity: number;
  description: string;
  wind_speed: number;
}

async function openWeatherFetch<T>(base: string, path: string): Promise<T | null> {
  const key = getKey();
  if (!key) return null;
  const sep = path.includes("?") ? "&" : "?";
  try {
    const res = await fetch(`${base}${path}${sep}appid=${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function searchCities(query: string): Promise<CityResult[]> {
  const data = await openWeatherFetch<CityResult[]>(
    GEO_URL,
    `/direct?q=${encodeURIComponent(query)}&limit=5`
  );
  return data ?? [];
}

export async function getCurrentWeather(lat: number, lon: number): Promise<CurrentWeather | null> {
  const data = await openWeatherFetch<{
    main: { temp: number; feels_like: number; humidity: number };
    weather: { description: string }[];
    wind: { speed: number };
  }>(DATA_URL, `/weather?lat=${lat}&lon=${lon}&units=metric`);
  if (!data) return null;
  return {
    temp: data.main.temp,
    feels_like: data.main.feels_like,
    humidity: data.main.humidity,
    description: data.weather[0]?.description ?? "unknown",
    wind_speed: data.wind.speed,
  };
}

export async function resolveWeatherOutcome(
  lat: number,
  lon: number,
  thresholds?: { tempMin?: number; tempMax?: number }
): Promise<string | null> {
  const weather = await getCurrentWeather(lat, lon);
  if (!weather) return null;
  if (thresholds?.tempMin !== undefined && weather.temp < thresholds.tempMin) {
    return "Below";
  }
  if (thresholds?.tempMax !== undefined && weather.temp >= thresholds.tempMax) {
    return "Above";
  }
  return weather.description;
}
