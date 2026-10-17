import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import PropertyCard from "../components/PropertyCard";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";

export default function MyProperties() {
  const [properties, setProperties] = useState(null);

  useEffect(() => {
    api
      .get("/api/properties/mine")
      .then((d) => setProperties(d.properties))
      .catch(() => setProperties([]));
  }, []);

  if (!properties) return <Loader label="Loading your properties…" />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My properties</h1>
          <p className="muted">Properties registered to your wallet.</p>
        </div>
        <Link to="/properties/new" className="btn btn-primary">
          Register property
        </Link>
      </div>

      {properties.length === 0 ? (
        <EmptyState
          title="No properties yet"
          message="Register your first property to get it verified and minted."
          action={
            <Link to="/properties/new" className="btn btn-primary">
              Register a property
            </Link>
          }
        />
      ) : (
        <div className="card-grid">
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  );
}
