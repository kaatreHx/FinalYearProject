"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import tableStyles from "@/components/admin/AdminTable.module.css";
import { MOCK_PROPERTIES, formatPrice } from "@/lib/properties";
import type { Property, PropertyType } from "@/types/property";

const TYPE_FILTERS: (PropertyType | "All")[] = [
  "All",
  "House",
  "Apartment",
  "Land",
  "Commercial",
];

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>(MOCK_PROPERTIES);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PropertyType | "All">("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return properties.filter((property) => {
      if (typeFilter !== "All" && property.type !== typeFilter) return false;
      if (
        q &&
        !`${property.title} ${property.ownerName} ${property.city}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [properties, query, typeFilter]);

  function removeListing(id: string) {
    // Mocked — no admin/properties endpoint exists yet, see
    // lib/properties.ts for where the real DELETE call would go.
    setProperties((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div>
      <AdminPageHeader
        title="Properties"
        description={`${properties.length} listing${
          properties.length !== 1 ? "s" : ""
        } across all sellers.`}
      />

      <div className={tableStyles.toolbar}>
        <input
          type="text"
          className={tableStyles.searchInput}
          placeholder="Search by title, owner, or city…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={tableStyles.filterSelect}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as PropertyType | "All")}
        >
          {TYPE_FILTERS.map((type) => (
            <option key={type} value={type}>
              {type === "All" ? "All types" : type}
            </option>
          ))}
        </select>
      </div>

      <div className={tableStyles.tableWrap}>
        {filtered.length === 0 ? (
          <p className={tableStyles.emptyState}>No listings match those filters.</p>
        ) : (
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Owner</th>
                <th>Type</th>
                <th>Status</th>
                <th>City</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((property) => (
                <tr key={property.id}>
                  <td>
                    <Link
                      href={`/property/${property.id}`}
                      className={tableStyles.rowLink}
                    >
                      {property.title}
                    </Link>
                  </td>
                  <td>{property.ownerName}</td>
                  <td>{property.type}</td>
                  <td>
                    <span
                      className={tableStyles.tag}
                      data-tone={property.status === "For Rent" ? "rent" : undefined}
                    >
                      {property.status}
                    </span>
                  </td>
                  <td>{property.city}</td>
                  <td>{formatPrice(property.price, property.status)}</td>
                  <td>
                    <button
                      type="button"
                      className={tableStyles.actionBtn}
                      onClick={() => removeListing(property.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
