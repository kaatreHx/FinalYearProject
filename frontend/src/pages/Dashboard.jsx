import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { kycStatusMeta } from "../lib/format";
import StatusBadge from "../components/StatusBadge";

export default function Dashboard() {
  const { user, isGovernment, kycApproved } = useAuth();
  const [stats, setStats] = useState({ properties: 0, requests: 0, listings: 0 });
  const [gov, setGov] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ properties }, { requests }] = await Promise.all([
          api.get("/api/properties/mine"),
          api.get("/api/requests/mine"),
        ]);
        setStats({
          properties: properties.length,
          requests: requests.length,
          listings: properties.filter((p) => p.status === "listed").length,
        });
      } catch {
        /* ignore */
      }
      if (isGovernment) {
        try {
          setGov(await api.get("/api/government/stats"));
        } catch {
          /* ignore */
        }
      }
    })();
  }, [isGovernment]);

  const kyc = kycStatusMeta(user?.kycStatus || "none");

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Welcome back{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}</h1>
          <p className="muted">Your Land Chain overview.</p>
        </div>
        <StatusBadge meta={isGovernment ? { label: "Government", cls: "badge-purple" } : kyc} />
      </div>

      {!kycApproved && !isGovernment && (
        <div className="alert alert-warn row between">
          <span>
            {user?.kycStatus === "pending"
              ? "Your KYC is under review. You can browse, but registering and buying unlock after approval."
              : "Complete KYC verification to register or buy property."}
          </span>
          <Link to="/kyc" className="btn btn-primary btn-sm">
            {user?.kycStatus === "pending" ? "View KYC" : "Start KYC"}
          </Link>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat">
          <span className="stat-value">{stats.properties}</span>
          <span className="stat-label">My properties</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.listings}</span>
          <span className="stat-label">Listed for sale</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.requests}</span>
          <span className="stat-label">My requests</span>
        </div>
        <div className="stat">
          <span className="stat-value">{user?.wallet ? user.wallet.slice(0, 6) + "…" : "—"}</span>
          <span className="stat-label">Wallet</span>
        </div>
      </div>

      {isGovernment && gov && (
        <div className="card">
          <div className="row between">
            <h2>Government queue</h2>
            <Link to="/government" className="btn btn-primary btn-sm">
              Open dashboard
            </Link>
          </div>
          <div className="stat-grid compact">
            <div className="stat">
              <span className="stat-value">{gov.pendingKyc}</span>
              <span className="stat-label">KYC pending</span>
            </div>
            <div className="stat">
              <span className="stat-value">{gov.pendingProperties}</span>
              <span className="stat-label">Properties pending</span>
            </div>
            <div className="stat">
              <span className="stat-value">{gov.pendingRequests}</span>
              <span className="stat-label">Transfers to approve</span>
            </div>
          </div>
        </div>
      )}

      <h2 className="section-heading">Quick actions</h2>
      <div className="action-grid">
        <Link to="/properties/new" className="action-card">
          <span className="action-icon">➕</span>
          <h3>Register a property</h3>
          <p>Submit property details for government verification.</p>
        </Link>
        <Link to="/marketplace" className="action-card">
          <span className="action-icon">🏘️</span>
          <h3>Browse marketplace</h3>
          <p>Explore verified properties listed for sale.</p>
        </Link>
        <Link to="/properties/mine" className="action-card">
          <span className="action-icon">📄</span>
          <h3>My properties</h3>
          <p>List a verified property for sale and track its status.</p>
        </Link>
        <Link to="/requests" className="action-card">
          <span className="action-icon">📨</span>
          <h3>Purchase requests</h3>
          <p>Manage requests you have sent or received.</p>
        </Link>
      </div>
    </div>
  );
}
