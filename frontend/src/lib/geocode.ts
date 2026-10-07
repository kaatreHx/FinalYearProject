// Free geocoding via OpenStreetMap's Nominatim — no API key needed.
// In production this should go through your own backend so you can cache
// results and respect Nominatim's usage policy (max ~1 req/sec).

export interface SearchResult {
  label: string;
  lat: number;
  lon: number;
}

export async function searchPlaces(query: string, limit = 5): Promise<SearchResult[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&q=${encodeURIComponent(query)}`
  );
  if (!res.ok) throw new Error("search failed");
  const data: Array<{ display_name: string; lat: string; lon: string }> = await res.json();
  return data.map((item) => ({
    label: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }));
}

export interface ReversedPlace {
  street: string;
  city: string;
  zip: string;
}

/** Turns a map pin into the street / city / postal code the backend stores. */
export async function reverseGeocode(lat: number, lon: number): Promise<ReversedPlace | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lon}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const a = data?.address;
  if (!a) return null;
  return {
    street: [a.house_number, a.road ?? a.neighbourhood ?? a.suburb].filter(Boolean).join(" "),
    city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "",
    zip: a.postcode ?? "",
  };
}

/** Best-effort forward geocode that gets less specific until something matches. */
export async function geocodeFirst(queries: string[]): Promise<{ lat: number; lon: number } | null> {
  for (const q of queries) {
    if (!q.trim()) continue;
    try {
      const [hit] = await searchPlaces(q, 1);
      if (hit) return { lat: hit.lat, lon: hit.lon };
    } catch {
      return null;
    }
  }
  return null;
}
