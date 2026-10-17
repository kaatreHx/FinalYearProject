import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ethers } from "ethers";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { formatEth, formatDateTime, requestStatusMeta } from "../lib/format";
import { getSigner, marketContract, shortAddr } from "../lib/ethers";
import StatusBadge from "../components/StatusBadge";
import Loader from "../components/Loader";

const FLOW = ["Pending", "Accepted", "GovApproved", "Paid"];

/** Friendly names for the buyer's identity documents. */
const DOC_LABELS = {
  citizenship: "Citizenship certificate",
  pan: "PAN card",
};

export default function RequestDetail() {
  const { id } = useParams();
  const { user, isGovernment } = useAuth();

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    try {
      const d = await api.get(`/api/requests/${id}`);
      setData(d);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error && !data) return <div className="page"><div className="alert alert-danger">{error}</div></div>;
  if (!data) return <Loader label="Loading request…" />;

  const { request: r, documents, documentsVisible } = data;
  const isBuyer = user?.wallet === r.buyerWallet;
  const isSeller = user?.wallet === r.sellerWallet;
  const meta = requestStatusMeta(r.status);
  const currentStep = FLOW.indexOf(r.status);

  const run = async (key, fn) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const sellerAccept = () =>
    run("accept", async () => {
      const signer = await getSigner();
      const market = marketContract(signer);
      const tx = await market.acceptRequest(r.onchainRequestId);
      await tx.wait();
      await api.patch(`/api/requests/${r.id}/accept`, { txHash: tx.hash });
      setNotice("Request accepted. Documents are now visible to you.");
    });

  const sellerReject = () =>
    run("reject", async () => {
      if (r.onchainRequestId) {
        try {
          const signer = await getSigner();
          const market = marketContract(signer);
          const tx = await market.rejectRequest(r.onchainRequestId);
          await tx.wait();
        } catch {
          /* on-chain reject is best-effort */
        }
      }
      await api.patch(`/api/requests/${r.id}/reject`, { reason: "Rejected by seller" });
      setNotice("Request rejected.");
    });

  const govApprove = () =>
    run("govApprove", async () => {
      const res = await api.patch(`/api/government/requests/${r.id}/approve`);
      setNotice(res.message || "Approved. Buyer may now pay.");
    });

  const govReject = () =>
    run("govReject", async () => {
      await api.patch(`/api/government/requests/${r.id}/reject`, { reason: "Rejected by government" });
      setNotice("Request rejected.");
    });

  const buyerPay = () =>
    run("pay", async () => {
      const signer = await getSigner();
      const market = marketContract(signer);
      const tx = await market.payAndTransfer(r.onchainRequestId, { value: BigInt(r.price) });
      await tx.wait();
      await api.patch(`/api/requests/${r.id}/paid`, { txHash: tx.hash });
      setNotice("Payment complete. Ownership transferred to you.");
    });

  return (
    <div className="page">
      <Link to="/requests" className="back-link">
        ← Back to requests
      </Link>

      <div className="detail-head">
        <div>
          <div className="row gap wrap">
            <h1>Request #{r.id}</h1>
            <StatusBadge meta={meta} />
          </div>
          <p className="muted">
            <Link to={`/properties/${r.propertyId}`}>{r.propertyTitle}</Link> · {formatEth(r.price)}
          </p>
        </div>
      </div>

      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {r.status === "Rejected" && (
        <div className="alert alert-danger">This request was rejected{r.rejectReason ? `: ${r.rejectReason}` : "."}</div>
      )}

      <div className="card">
        <h2>Progress</h2>
        <div className="progress">
          {FLOW.map((step, i) => (
            <div
              key={step}
              className={`progress-step ${i <= currentStep ? "done" : ""} ${
                i === currentStep && r.status !== "Rejected" ? "active" : ""
              }`}
            >
              <span className="progress-dot">{i + 1}</span>
              <span>{requestStatusMeta(step).label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <h2>Parties</h2>
          <dl className="detail-list">
            <div>
              <dt>Buyer</dt>
              <dd>
                {r.buyerName || "—"} <span className="mono muted">({shortAddr(r.buyerWallet)})</span>
              </dd>
            </div>
            <div>
              <dt>Seller</dt>
              <dd>
                {r.sellerName || "—"} <span className="mono muted">({shortAddr(r.sellerWallet)})</span>
              </dd>
            </div>
            <div>
              <dt>On-chain request</dt>
              <dd>{r.onchainRequestId ? `#${r.onchainRequestId}` : "Not linked"}</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h2>Actions</h2>

          {isSeller && r.status === "Pending" && (
            <>
              <p className="muted">
                Accepting unlocks the buyer's documents for you. Rejecting ends the request.
              </p>
              <div className="row gap">
                <button className="btn btn-primary" onClick={sellerAccept} disabled={!!busy}>
                  {busy === "accept" ? "Confirming…" : "Accept request"}
                </button>
                <button className="btn btn-danger" onClick={sellerReject} disabled={!!busy}>
                  {busy === "reject" ? "Working…" : "Reject"}
                </button>
              </div>
            </>
          )}

          {isGovernment && r.status === "Accepted" && (
            <>
              <p className="muted">Verify the documents, then approve to allow payment.</p>
              <div className="row gap">
                <button className="btn btn-primary" onClick={govApprove} disabled={!!busy}>
                  {busy === "govApprove" ? "Approving…" : "Approve transfer"}
                </button>
                <button className="btn btn-danger" onClick={govReject} disabled={!!busy}>
                  Reject
                </button>
              </div>
            </>
          )}

          {isBuyer && r.status === "GovApproved" && (
            <>
              <p className="muted">
                Government approved. Pay {formatEth(r.price)} to complete the purchase — the NFT moves
                to you and the seller is paid in the same transaction.
              </p>
              <button className="btn btn-primary btn-block" onClick={buyerPay} disabled={!!busy}>
                {busy === "pay" ? "Confirming payment…" : `Pay ${formatEth(r.price)}`}
              </button>
            </>
          )}

          {isBuyer && r.status === "Pending" && (
            <p className="muted">Waiting for the seller to accept your request and unlock your documents.</p>
          )}
          {isBuyer && r.status === "Accepted" && (
            <p className="muted">Seller accepted. Waiting for government verification.</p>
          )}
          {r.status === "Paid" && <p className="muted">Completed — ownership has been transferred.</p>}
          {!isBuyer && !isSeller && !isGovernment && <p className="muted">You are viewing this request.</p>}
          {isSeller && r.status === "Accepted" && (
            <p className="muted">You accepted. Waiting for government verification.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="row between">
          <h2>Documents</h2>
          <span className={`badge ${documentsVisible ? "badge-green" : "badge-amber"}`}>
            {documentsVisible ? "Unlocked" : "Locked"}
          </span>
        </div>

        {!documentsVisible ? (
          <p className="muted">
            These documents are hidden until the seller accepts the request. Only the buyer and the
            government can view them before that.
          </p>
        ) : documents.length === 0 ? (
          <p className="muted">No documents attached.</p>
        ) : (
          <ul className="doc-list">
            {documents.map((d) => (
              <li key={d.id}>
                <span>
                  📎 {DOC_LABELS[d.docType] || "Document"}
                  <span className="muted small"> ({d.fileName})</span>
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => api.download(`/api/requests/${r.id}/documents/${d.id}`, d.fileName)}
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Transaction record</h2>
        <dl className="detail-list mono small">
          <div>
            <dt>Request created</dt>
            <dd>{r.createTxHash ? shortAddr(r.createTxHash) : "—"}</dd>
          </div>
          <div>
            <dt>Seller accepted</dt>
            <dd>{r.acceptTxHash ? shortAddr(r.acceptTxHash) : "—"}</dd>
          </div>
          <div>
            <dt>Government approved</dt>
            <dd>{r.approveTxHash ? shortAddr(r.approveTxHash) : "—"}</dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd>{r.payTxHash ? shortAddr(r.payTxHash) : "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
