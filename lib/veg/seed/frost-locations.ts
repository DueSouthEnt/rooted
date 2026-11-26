import type { GeoPoint } from "@/lib/veg/geo";
import { WORLD_FROST_LOCATIONS } from "@/lib/veg/seed/frost-world";

export type FrostLocation = GeoPoint & {
  country: string;
  region: string;
  lastSpringFrost: string;
  firstAutumnFrost: string;
  sourceName: string;
  sourceUrl: string;
};

const MIDAS =
  "Gardenkept compilation of Met Office MIDAS Open UK daily temperature data, 1996–2025 (air frost at 0°C or below). Open Government Licence v3.0.";
const MIDAS_URL = "https://gardenkept.co.uk/frost-dates";

function station(
  id: string,
  name: string,
  region: string,
  latitude: number,
  longitude: number,
  lastSpringFrost: string,
  firstAutumnFrost: string,
): FrostLocation {
  return {
    id,
    name,
    country: "GB",
    region,
    latitude,
    longitude,
    lastSpringFrost,
    firstAutumnFrost,
    sourceName: MIDAS,
    sourceUrl: MIDAS_URL,
  };
}

/** Thirty Met Office stations. Dates are average last spring and first autumn air frosts, 1996–2025. */
const UK_FROST_LOCATIONS: FrostLocation[] = [
  station("lerwick", "Lerwick", "Scotland", 60.139, -1.183, "04-13", "11-20"),
  station("stornoway", "Stornoway Airport", "Scotland", 58.214, -6.319, "04-15", "11-22"),
  station("aberdeen", "Aberdeen Dyce", "Scotland", 57.205, -2.205, "04-29", "10-27"),
  station("aviemore", "Aviemore", "Scotland", 57.206, -3.827, "05-25", "09-25"),
  station("leuchars", "Leuchars", "Scotland", 56.373, -2.868, "04-30", "10-30"),
  station("edinburgh", "Edinburgh Royal Botanic Garden", "Scotland", 55.966, -3.209, "04-15", "11-02"),
  station("eskdalemuir", "Eskdalemuir", "Scotland", 55.311, -3.206, "05-20", "10-03"),
  station("boulmer", "Boulmer", "North of England", 55.421, -1.6, "04-08", "11-20"),
  station("durham", "Durham", "North of England", 54.768, -1.585, "04-29", "11-03"),
  station("carlisle", "Carlisle", "North of England", 54.895, -2.933, "04-19", "11-01"),
  station("blackpool", "Blackpool Squires Gate", "North of England", 53.776, -3.039, "04-16", "11-07"),
  station("sheffield", "Sheffield", "North of England", 53.381, -1.49, "04-09", "11-21"),
  station("waddington", "Waddington", "Midlands", 53.175, -0.523, "04-05", "11-19"),
  station("nottingham", "Nottingham Watnall", "Midlands", 53.005, -1.25, "04-06", "11-14"),
  station("wellesbourne", "Wellesbourne", "Midlands", 52.192, -1.605, "04-26", "11-03"),
  station("cambridge", "Cambridge Botanic Garden", "East of England", 52.194, 0.128, "04-23", "11-04"),
  station("marham", "Marham", "East of England", 52.648, 0.551, "04-24", "10-31"),
  station("heathrow", "Heathrow", "London and the South East", 51.479, -0.449, "03-24", "11-18"),
  station("wisley", "Wisley", "London and the South East", 51.311, -0.474, "04-24", "10-28"),
  station("east-malling", "East Malling", "London and the South East", 51.287, 0.449, "04-16", "11-03"),
  station("oxford", "Oxford", "London and the South East", 51.761, -1.262, "04-05", "11-12"),
  station("hurn", "Hurn", "South West", 50.78, -1.835, "04-26", "10-25"),
  station("camborne", "Camborne", "South West", 50.218, -5.327, "02-20", "12-12"),
  station("plymouth", "Plymouth Mountbatten", "South West", 50.361, -4.121, "03-13", "11-30"),
  station("north-wyke", "North Wyke", "South West", 50.769, -3.901, "04-03", "11-19"),
  station("valley", "Valley", "Wales", 53.252, -4.535, "03-17", "11-29"),
  station("aberporth", "Aberporth", "Wales", 52.139, -4.571, "03-04", "12-06"),
  station("cardiff", "Cardiff Bute Park", "Wales", 51.488, -3.187, "04-08", "11-09"),
  station("aldergrove", "Aldergrove", "Northern Ireland", 54.664, -6.216, "04-16", "11-09"),
  station("armagh", "Armagh", "Northern Ireland", 54.352, -6.649, "04-16", "11-11"),
];

export const FROST_LOCATIONS: FrostLocation[] = [...UK_FROST_LOCATIONS, ...WORLD_FROST_LOCATIONS];
