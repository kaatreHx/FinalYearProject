"use client";

import { useEffect, useRef, useState } from "react";
import { loadLeaflet } from "@/lib/leaflet";
import styles from "./PropertyLocationMap.module.css";

interface PropertyLocationMapProps {
  latitude: number;
  longitude: number;
  title: string;
}

export default function PropertyLocationMap({
  latitude,
  longitude,
  title,
}: PropertyLocationMapProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !L || !mapEl.current || mapRef.current) return;

        const map = L.map(mapEl.current, {
          zoomControl: true,
          scrollWheelZoom: false,
        }).setView([latitude, longitude], 15);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        L.marker([latitude, longitude]).addTo(map).bindPopup(title);

        mapRef.current = map;
      })
      .catch(() => setMapError("Couldn't load the map."));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.wrap}>
      <div ref={mapEl} className={styles.map} />
      {mapError && <p className={styles.error}>{mapError}</p>}
    </div>
  );
}
