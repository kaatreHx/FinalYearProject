"use client";

import type { PropertyFilters, PropertyType } from "@/types/property";
import styles from "./FilterSidebar.module.css";

const PROPERTY_TYPES: (PropertyType | "All")[] = [
  "All",
  "House",
  "Apartment",
  "Land",
  "Commercial",
];

const BED_OPTIONS = [null, 1, 2, 3, 4] as const;

interface FilterSidebarProps {
  filters: PropertyFilters;
  onChange: (filters: PropertyFilters) => void;
}

export default function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  function update<K extends keyof PropertyFilters>(
    key: K,
    value: PropertyFilters[K]
  ) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <h4 className={styles.sectionLabel}>Property type</h4>
        <div className={styles.typeList}>
          {PROPERTY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`${styles.typeBtn} ${
                filters.type === type ? styles.typeBtnActive : ""
              }`}
              onClick={() => update("type", type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionLabel}>Price range</h4>
        <div className={styles.priceRow}>
          <input
            type="number"
            inputMode="numeric"
            placeholder="Min"
            className={styles.priceInput}
            value={filters.minPrice ?? ""}
            onChange={(e) =>
              update(
                "minPrice",
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
          />
          <span className={styles.priceDash}>—</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="Max"
            className={styles.priceInput}
            value={filters.maxPrice ?? ""}
            onChange={(e) =>
              update(
                "maxPrice",
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
          />
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionLabel}>Bedrooms</h4>
        <div className={styles.bedList}>
          {BED_OPTIONS.map((beds) => (
            <button
              key={beds ?? "any"}
              type="button"
              className={`${styles.bedBtn} ${
                filters.minBeds === beds ? styles.bedBtnActive : ""
              }`}
              onClick={() => update("minBeds", beds)}
            >
              {beds === null ? "Any" : `${beds}+`}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className={styles.clearBtn}
        onClick={() =>
          onChange({
            query: filters.query,
            type: "All",
            minPrice: null,
            maxPrice: null,
            minBeds: null,
          })
        }
      >
        Clear filters
      </button>
    </aside>
  );
}
