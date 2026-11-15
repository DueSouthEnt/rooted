export interface ForecastDay {
  date: string;
  code: number;
  label: string;
  tempMaxC: number;
  tempMinC: number;
  rainMm: number;
  windKmh: number;
  frost: boolean;
}

export interface Forecast {
  timezone: string;
  tempC: number;
  code: number;
  label: string;
  windKmh: number;
  rainMm: number;
  todayMaxC: number;
  todayMinC: number;
  days: ForecastDay[];
  frostSoon: boolean;
}

const WMO: Array<[number, string]> = [
  [0, "Clear"],
  [1, "Mainly clear"],
  [2, "Partly cloudy"],
  [3, "Overcast"],
  [45, "Fog"],
  [48, "Rime fog"],
  [51, "Light drizzle"],
  [53, "Drizzle"],
  [55, "Heavy drizzle"],
  [61, "Light rain"],
  [63, "Rain"],
  [65, "Heavy rain"],
  [71, "Light snow"],
  [73, "Snow"],
  [75, "Heavy snow"],
  [80, "Rain showers"],
  [81, "Showers"],
  [82, "Violent showers"],
  [95, "Thunderstorm"],
];

export function weatherLabel(code: number): string {
  let label = "Changeable";
  for (const [threshold, name] of WMO) {
    if (code >= threshold) label = name;
  }
  return label;
}

export async function fetchForecast(latitude: number, longitude: number): Promise<Forecast | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m,precipitation");
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("wind_speed_unit", "kmh");
  try {
    const response = await fetch(url, { next: { revalidate: 1800 } });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      timezone?: string;
      current?: {
        temperature_2m: number;
        weather_code: number;
        wind_speed_10m: number;
        precipitation: number;
      };
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        wind_speed_10m_max: number[];
      };
    };
    if (!body.current || !body.daily) return null;
    const days: ForecastDay[] = body.daily.time.map((date, index) => {
      const tempMinC = body.daily!.temperature_2m_min[index];
      return {
        date,
        code: body.daily!.weather_code[index],
        label: weatherLabel(body.daily!.weather_code[index]),
        tempMaxC: body.daily!.temperature_2m_max[index],
        tempMinC,
        rainMm: body.daily!.precipitation_sum[index],
        windKmh: body.daily!.wind_speed_10m_max[index],
        frost: tempMinC <= 0,
      };
    });
    return {
      timezone: body.timezone ?? "Europe/London",
      tempC: body.current.temperature_2m,
      code: body.current.weather_code,
      label: weatherLabel(body.current.weather_code),
      windKmh: body.current.wind_speed_10m,
      rainMm: body.current.precipitation,
      todayMaxC: days[0]?.tempMaxC ?? body.current.temperature_2m,
      todayMinC: days[0]?.tempMinC ?? body.current.temperature_2m,
      days,
      frostSoon: days.some((day) => day.frost),
    };
  } catch {
    return null;
  }
}
