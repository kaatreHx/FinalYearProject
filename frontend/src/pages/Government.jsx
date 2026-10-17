import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatEth, formatDate } from "../lib/format";
import { shortAddr } from "../lib/ethers";
import Modal from "../components/Modal";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";

const TABS = [
  { key: "kyc", label: "KYC applications" },
  { key: "properties", label: "Property verification" },
  { key: "requests", label: "Transfer approvals" },
];

export default function Government() {
  const [tab, setTab] = useState("kyc");
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");

  const loadStats = async () => {
    try {
      setStats(await api.get("/api/government/stats"));
    } catch {
      /* ignore */
    }
  };

  const loadTab = async (key) => {
    setLoading(true);
    setError("");
    try {
      if (key === "kyc") {
        const d = await api.get("/api/government/kyc?status=pending");
        setItems(d.applications);
      } else if (key === "properties") {
        const d = await api.get("/api/government/properties?status=pending");
        setItems(d.properties);
      } else {
        const d = await api.get("/api/government/requests?status=Accepted");
        setItems(d.requests);
      }
    } catch (err) {
      setError(err.message);
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const refresh = async () => {
    await Promise.all([loadTab(tab), loadStats()]);
  };

  const approveKyc = (id) =>
    act(`kyc-${id}`, async () => {
      await api.patch(`/api/government/kyc/${id}`, { action: "approve" });
      setNotice("KYC approved.");
    });

  const approveProperty = (id) =>
    act(`prop-${id}`, async () => {
      const res = await api.patch(`/api/government/properties/${id}/approve`);
      setNotice(res.message + (res.txHash ? ` Mint tx ${res.txHash.slice(0, 12)}…` : ""));
    });

  const approveRequest = (id) =>
    act(`req-${id}`, async () => {
      const res = await api.patch(`/api/government/requests/${id}/approve`);
      setNotice(res.message || "Transfer approved.");
    });

  const act = async (key, fn) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const doReject = async () => {
    const { kind, id } = rejecting;
    await act(`reject-${id}`, async () => {
      if (kind === "kyc") {
        await api.patch(`/api/government/kyc/${id}`, { action: "reject", reason });
      } else if (kind === "property") {
        await api.patch(`/api/government/properties/${id}/reject`, { reason });
      } else {
        await api.patch(`/api/government/requests/${id}/reject`, { reason });
      }
      setNotice("Rejected.");
    });
    setRejecting(null);
    setReason("");
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Government dashboard</h1>
          <p className="muted">Verify identities, mint properties, and approve transfers.</p>
        </div>
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat">
            <span className="stat-value">{stats.pendingKyc}</span>
            <span className="stat-label">KYC pending</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.pendingProperties}</span>
            <span className="stat-label">Properties pending</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.pendingRequests}</span>
            <span className="stat-label">Transfers to approve</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.totalProperties}</span>
            <span className="stat-label">Registered properties</span>
          </div>
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <Loader label="Loading queue…" />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing to review" message="The queue is clear." />
      ) : (
        <div className="list">
          {tab === "kyc" &&
            items.map((a) => (
              <div key={a.id} className="review-row">
                <div className="list-main">
                  <div className="row gap wrap">
                    <strong>{a.full_name}</strong>
                    <span className="pill">{a.nationality || "—"}</span>
                  </div>
                  <div className="muted small">
                    ID {a.id_number} · {shortAddr(a.wallet_address)} · {formatDate(a.created_at)}
                  </div>
                </div>
                <div className="row gap">
                  {a.document_path && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => api.download(`/api/government/kyc/${a.id}/document`, a.document_name)}
                    >
                      View document
                    </button>
                  )}
                  <button className="btn btn-primary btn-sm" onClick={() => approveKyc(a.id)} disabled={!!busy}>
                    Approve
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setRejecting({ kind: "kyc", id: a.id })}
                    disabled={!!busy}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}

          {tab === "properties" &&
            items.map((p) => (
              <div key={p.id} className="review-row">
                <div className="list-main">
                  <div className="row gap wrap">
                    <strong>{p.title}</strong>
                    <span className="pill">{p.property_type || "—"}</span>
                  </div>
                  <div className="muted small">
                    📍 {p.location} · owner {p.owner_name || shortAddr(p.owner_wallet)} ·{" "}
                    {formatDate(p.created_at)}
                  </div>
                </div>
                <div className="row gap">
                  <Link to={`/properties/${p.id}`} className="btn btn-ghost btn-sm">
                    View
                  </Link>
                  <button className="btn btn-primary btn-sm" onClick={() => approveProperty(p.id)} disabled={!!busy}>
                    {busy === `prop-${p.id}` ? "Minting…" : "Verify & mint"}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setRejecting({ kind: "property", id: p.id })}
                    disabled={!!busy}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}

          {tab === "requests" &&
            items.map((r) => (
              <div key={r.id} className="review-row">
                <div className="list-main">
                  <div className="row gap wrap">
                    <strong>{r.property_title}</strong>
                    <span className="pill">{formatEth(r.price)}</span>
                  </div>
                  <div className="muted small">
                    {shortAddr(r.buyer_wallet)} → {shortAddr(r.seller_wallet)} · {formatDate(r.created_at)}
                  </div>
                </div>
                <div className="row gap">
                  <Link to={`/requests/${r.id}`} className="btn btn-ghost btn-sm">
                    Review
                  </Link>
                  <button className="btn btn-primary btn-sm" onClick={() => approveRequest(r.id)} disabled={!!busy}>
                    {busy === `req-${r.id}` ? "Approving…" : "Approve transfer"}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setRejecting({ kind: "request", id: r.id })}
                    disabled={!!busy}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      <Modal open={!!rejecting} title="Reject — provide a reason" onClose={() => setRejecting(null)}>
        <div className="form">
          <div className="field">
            <label>Reason</label>
            <textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain the rejection" />
          </div>
          <div className="row gap">
            <button className="btn btn-danger" onClick={doReject} disabled={!!busy}>
              Confirm rejection
            </button>
            <button className="btn btn-ghost" onClick={() => setRejecting(null)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
