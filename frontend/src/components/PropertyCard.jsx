import { Link } from "react-router-dom";
import { formatEth } from "../lib/format";
import StatusBadge from "./StatusBadge";
import { propertyStatusMeta } from "../lib/format";

export default function PropertyCard({ property }) {
  const p = property;
  return (
    <Link to={`/properties/${p.id}`} className="property-card">
      <div className="property-card-media">
        {p.coverImage ? (
          <img src={p.coverImage} alt={p.title} loading="lazy" />
        ) : (
          <span className="property-card-media-empty" aria-hidden="true">
            🏠
          </span>
        )}
      </div>
      <div className="property-card-body">
        <div className="property-card-top">
          <span className="property-type">{p.propertyType || "Property"}</span>
          <StatusBadge meta={propertyStatusMeta(p.status)} />
        </div>
        <h3 className="property-title">{p.title}</h3>
        <p className="property-location">📍 {p.location}</p>
        <div className="property-meta">
          {p.areaSqft && <span>{Number(p.areaSqft).toLocaleString()} sqft</span>}
          {p.nftTokenId ? <span>NFT #{p.nftTokenId}</span> : <span>Not minted</span>}
        </div>
        <div className="property-card-foot">
          <span className="property-price">{p.price ? formatEth(p.price) : "Not listed"}</span>
          <span className="property-owner">
            {p.ownerName || (p.ownerWallet ? p.ownerWallet.slice(0, 8) + "…" : "")}
          </span>
        </div>
      </div>
    </Link>
  );
}
