"use client";

import { useMemo, useState } from "react";
import DashboardNav from "@/components/property/DashboardNav";
import FilterSidebar from "@/components/property/FilterSidebar";
import PropertyGrid from "@/components/property/PropertyGrid";
import { MOCK_PROPERTIES, filterProperties } from "@/lib/properties";
import { DEFAULT_FILTERS, type PropertyFilters } from "@/types/property";
import styles from "./page.module.css";

export default function DashboardPage() {
  const [filters, setFilters] = useState<PropertyFilters>(DEFAULT_FILTERS);

  const results = useMemo(
    () => filterProperties(MOCK_PROPERTIES, filters),
    [filters]
  );

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
              {results.length} listing{results.length !== 1 ? "s" : ""}
            </span>
          </div>

          <PropertyGrid properties={results} />
        </main>
      </div>
    </div>
  );
}
