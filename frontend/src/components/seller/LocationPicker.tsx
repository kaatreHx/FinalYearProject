"use client";

import { useEffect, useRef, useState } from "react";
import { loadLeaflet } from "@/lib/leaflet";
import styles from "./LocationPicker.module.css";

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
}

interface SearchResult {
  label: string;
  lat: number;
  lon: number;
}

// Free geocoding via OpenStreetMap's Nominatim — no API key needed.
// In production this should go through your own backend so you can
// cache results and respect Nominatim's usage policy (max ~1 req/sec).
async function searchPlaces(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
      query
    )}`
  );
  if (!res.ok) throw new Error("search failed");
  const data: Array<{ display_name: string; lat: string; lon: string }> = await res.json();
  return data.map((item) => ({
    label: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }));
}

export default function LocationPicker({
  latitude,
  longitude,
  onChange,
}: LocationPickerProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Init map once.
  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !L || !mapEl.current || mapRef.current) return;

        const map = L.map(mapEl.current).setView([latitude, longitude], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onChange(pos.lat, pos.lng);
        });

        map.on("click", (e: any) => {
          marker.setLatLng(e.latlng);
          onChange(e.latlng.lat, e.latlng.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;
      })
      .catch(() => setMapError("Couldn't load the map. You can still enter coordinates manually."));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep marker/view in sync if coordinates change from outside the map
  // (manual lat/lng inputs, "use current location", search selection).
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapRef.current.setView([latitude, longitude]);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMapError("Your browser doesn't support location detection.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setMapError("Couldn't get your location. Pick a spot on the map instead.");
        setLocating(false);
      }
    );
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setSearchError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchPlaces(value.trim());
        setSuggestions(results);
        if (results.length === 0) {
          setSearchError("No matches — try a different search.");
        }
      } catch {
        setSuggestions([]);
        setSearchError("Couldn't search right now. Try again in a moment.");
      } finally {
        setSearching(false);
      }
    }, 450);
  }

  function selectSuggestion(result: SearchResult) {
    onChange(result.lat, result.lon);
    setSearchQuery(result.label);
    setSuggestions([]);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.searchWrap}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search for an address, landmark, or area…"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {searching && <span className={styles.searchStatus}>Searching…</span>}

        {suggestions.length > 0 && (
          <ul className={styles.suggestions}>
            {suggestions.map((result, i) => (
              <li key={`${result.lat}-${result.lon}-${i}`}>
                <button
                  type="button"
                  className={styles.suggestionBtn}
                  onClick={() => selectSuggestion(result)}
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {searchError && <p className={styles.error}>{searchError}</p>}
      </div>

      <div className={styles.headerRow}>
        <p className={styles.hint}>
          Click the map or drag the pin to set the exact spot.
        </p>
        <button
          type="button"
          className={styles.locateBtn}
          onClick={useCurrentLocation}
          disabled={locating}
        >
          {locating ? "Locating…" : "Use current location"}
        </button>
      </div>

      <div ref={mapEl} className={styles.map} />

      {mapError && <p className={styles.error}>{mapError}</p>}

      <div className={styles.coordsRow}>
        <label className={styles.coordField}>
          <span className={styles.coordLabel}>Latitude</span>
          <input
            type="number"
            step="any"
            className={styles.coordInput}
            value={latitude}
            onChange={(e) => onChange(Number(e.target.value), longitude)}
          />
        </label>
        <label className={styles.coordField}>
          <span className={styles.coordLabel}>Longitude</span>
          <input
            type="number"
            step="any"
            className={styles.coordInput}
            value={longitude}
            onChange={(e) => onChange(latitude, Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
