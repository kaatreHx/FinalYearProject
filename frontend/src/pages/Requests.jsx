import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatEth, requestStatusMeta, formatDate } from "../lib/format";
import { shortAddr } from "../lib/ethers";
import StatusBadge from "../components/StatusBadge";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";

const TABS = [
  { key: "all", label: "All" },
  { key: "buyer", label: "Sent (buyer)" },
  { key: "seller", label: "Received (seller)" },
];

export default function Requests() {
  const [requests, setRequests] = useState(null);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    api
      .get("/api/requests/mine")
      .then((d) => setRequests(d.requests))
      .catch(() => setRequests([]));
  }, []);

  if (!requests) return <Loader label="Loading requests…" />;

  const filtered = tab === "all" ? requests : requests.filter((r) => r.role === tab);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Purchase requests</h1>
          <p className="muted">Requests you have sent or received.</p>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No requests"
          message="When you send or receive a purchase request it will show up here."
          action={
            <Link to="/marketplace" className="btn btn-primary">
              Browse marketplace
            </Link>
          }
        />
      ) : (
        <div className="list">
          {filtered.map((r) => {
            const meta = requestStatusMeta(r.status);
            return (
              <Link to={`/requests/${r.id}`} key={r.id} className="list-row">
                <div className="list-main">
                  <div className="row gap wrap">
                    <strong>{r.propertyTitle}</strong>
                    <StatusBadge meta={meta} />
                    <span className="pill">{r.role === "buyer" ? "You are buyer" : "You are seller"}</span>
                  </div>
                  <div className="muted small">
                    {formatEth(r.price)} · {shortAddr(r.buyerWallet)} → {shortAddr(r.sellerWallet)} ·{" "}
                    {formatDate(r.createdAt)}
                  </div>
                </div>
                <span className="chev">›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
