import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import PropertyCard from "../components/PropertyCard";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";

export default function Marketplace() {
  const [properties, setProperties] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api
      .get("/api/properties")
      .then((d) => setProperties(d.properties))
      .catch(() => setProperties([]));
  }, []);

  const filtered = useMemo(() => {
    if (!properties) return [];
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        (p.propertyType || "").toLowerCase().includes(q)
    );
  }, [properties, query]);

  if (!properties) return <Loader label="Loading marketplace…" />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Marketplace</h1>
          <p className="muted">Government-verified properties listed for sale.</p>
        </div>
        <input
          className="search"
          placeholder="Search by title, location, or type…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No properties found"
          message={
            properties.length === 0
              ? "No properties are listed yet. Check back soon."
              : "No properties match your search."
          }
        />
      ) : (
        <div className="card-grid">
          {filtered.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  );
}
