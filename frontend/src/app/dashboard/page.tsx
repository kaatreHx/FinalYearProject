"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardNav from "@/components/property/DashboardNav";
import FilterSidebar from "@/components/property/FilterSidebar";
import PropertyGrid from "@/components/property/PropertyGrid";
import { fetchPublicProperties, filterProperties } from "@/lib/properties";
import { DEFAULT_FILTERS, type Property, type PropertyFilters } from "@/types/property";
import styles from "./page.module.css";

export default function DashboardPage() {
  const [filters, setFilters] = useState<PropertyFilters>(DEFAULT_FILTERS);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Type and price are filtered by the API; search text and bedrooms are
  // applied locally below. Debounced so typing a price doesn't spam the server.
  const { type, minPrice, maxPrice } = filters;
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(() => {
      fetchPublicProperties({ type, minPrice, maxPrice })
        .then((data) => {
          if (cancelled) return;
          setProperties(data);
          setLoadError(null);
        })
        .catch((err) => {
          if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't load listings.");
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [type, minPrice, maxPrice]);

  const results = useMemo(() => filterProperties(properties, filters), [properties, filters]);

  return (
    <div className={styles.page}>
      <DashboardNav
        query={filters.query}
        onQueryChange={(query) => setFilters((f) => ({ ...f, query }))}
      />

      <div className={styles.body}>
        <FilterSidebar filters={filters} onChange={setFilters} />

        <main className={styles.main}>
          <div className={styles.resultsHeader}>
            <h1 className={styles.heading}>Browse properties</h1>
            <span className={styles.count}>
              {isLoading ? "Loading…" : `${results.length} listing${results.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {loadError ? (
            <p className={styles.count}>{loadError}</p>
          ) : (
            !isLoading && <PropertyGrid properties={results} />
          )}
        </main>
      </div>
    </div>
  );
}
