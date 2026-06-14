const BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

interface WeatherResponse {
  main: {
    temp: number;
  };
  weather: Array<{
    main: string;
    description: string;
  }>;
}

function apiKey(): string | undefined {
  return process.env.OPENWEATHERMAP_API_KEY || undefined;
}

export async function fetchWeatherCondition(city: string): Promise<string | null> {
  const key = apiKey();
  if (!key) {
    console.error("OpenWeatherMap: OPENWEATHERMAP_API_KEY is not set");
    return null;
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("q", city);
  url.searchParams.set("appid", key);
  url.searchParams.set("units", "metric");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(`OpenWeatherMap: HTTP ${res.status} for ${city}`);
      return null;
    }
    const data = (await res.json()) as WeatherResponse;
    const condition = data.weather[0]?.main ?? "Unknown";
    const temp = Math.round(data.main.temp);
    return `${condition}, ${temp}°C`;
  } catch (err) {
    console.error(`OpenWeatherMap: fetch error for ${city}:`, err);
    return null;
  }
}
