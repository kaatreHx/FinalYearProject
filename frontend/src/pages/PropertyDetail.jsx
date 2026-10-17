import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ethers } from "ethers";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { formatEth, formatDate, formatDateTime, propertyStatusMeta } from "../lib/format";
import { getSigner, nftContract, marketContract, MARKETPLACE_ADDRESS, shortAddr } from "../lib/ethers";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import Loader from "../components/Loader";

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, address, kycApproved, isGovernment } = useAuth();

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [listOpen, setListOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState("");

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestDocs, setRequestDocs] = useState({ citizenship: null, pan: null });
  const [activeImg, setActiveImg] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [docsUploading, setDocsUploading] = useState(false);

  const load = async () => {
    try {
      const d = await api.get(`/api/properties/${id}`);
      setData(d);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <div className="page"><div className="alert alert-danger">{error}</div></div>;
  if (!data) return <Loader label="Loading property…" />;

  const { property: p, history } = data;
  const isOwner = address && p.ownerWallet?.toLowerCase() === address.toLowerCase();
  const images = p.images || [];
  const activePhoto = images[Math.min(activeImg, images.length - 1)] || null;
  // null when the viewer is not allowed to see the documents.
  const ownershipDocs = data.ownershipDocs;
  const docCount = (ownershipDocs || []).length;

  /** Owner uploads ownership documents for this property. */
  const uploadDocs = async (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setDocsUploading(true);
    setError("");
    try {
      const fd = new FormData();
      for (const file of picked.slice(0, 5)) fd.append("documents", file);
      await api.postForm(`/api/properties/${p.id}/ownership-docs`, fd);
      setNotice("Ownership document(s) uploaded.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDocsUploading(false);
      e.target.value = "";
    }
  };

  /** Owner removes an ownership document. */
  const removeDoc = async (docId) => {
    setError("");
    try {
      await api.del(`/api/properties/${p.id}/ownership-docs/${docId}`);
      setNotice("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  /** Owner uploads more photos for this property. */
  const addImages = async (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      for (const file of picked.slice(0, 6)) fd.append("images", file);
      await api.postForm(`/api/properties/${p.id}/images`, fd);
      setNotice("Photos added.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = ""; // allow picking the same file again
    }
  };

  /** Owner removes a photo. */
  const removeImage = async (imageId) => {
    setError("");
    try {
      await api.del(`/api/properties/${p.id}/images/${imageId}`);
      setActiveImg(0);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  /** Owner lists (or re-lists) the property for sale. */
  const submitListing = async (e) => {
    e.preventDefault();
    setBusy("list");
    setError("");
    try {
      if (!p.nftTokenId) throw new Error("This property has not been minted yet.");
      const wei = ethers.parseEther(price);

      const signer = await getSigner();
      const nft = nftContract(signer);
      const market = marketContract(signer);

      const approved = await nft.getApproved(p.nftTokenId);
      if (approved.toLowerCase() !== MARKETPLACE_ADDRESS.toLowerCase()) {
        const approveTx = await nft.approve(MARKETPLACE_ADDRESS, p.nftTokenId);
        await approveTx.wait();
      }
      const listTx = await market.listProperty(p.nftTokenId, wei);
      await listTx.wait();
      await api.patch(`/api/properties/${p.id}/list`, { price: wei.toString(), txHash: listTx.hash });

      setListOpen(false);
      setPrice("");
      setNotice("Property listed for sale.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  /** Buyer sends a purchase request with citizenship + PAN (hidden until accepted). */
  const submitRequest = async (e) => {
    e.preventDefault();
    setBusy("request");
    setError("");
    try {
      if (!requestDocs.citizenship || !requestDocs.pan) {
        throw new Error("Please attach both your citizenship certificate and your PAN card.");
      }
      const fd = new FormData();
      fd.append("propertyId", String(p.id));
      fd.append("citizenship", requestDocs.citizenship);
      fd.append("pan", requestDocs.pan);

      const res = await api.postForm("/api/requests", fd);
      const { tokenId, documentHash } = res.chain;

      const signer = await getSigner();
      const market = marketContract(signer);
      const tx = await market.createRequest(tokenId, documentHash);
      await tx.wait();
      const onchainRequestId = Number(await market.requestCount());

      await api.patch(`/api/requests/${res.request.id}/onchain`, {
        onchainRequestId,
        txHash: tx.hash,
      });

      setRequestOpen(false);
      setRequestDocs({ citizenship: null, pan: null });
      navigate(`/requests/${res.request.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="page">
      <Link to="/marketplace" className="back-link">
        ← Back to marketplace
      </Link>

      <div className="detail-head">
        <div>
          <div className="row gap wrap">
            <h1>{p.title}</h1>
            <StatusBadge meta={propertyStatusMeta(p.status)} />
          </div>
          <p className="muted">📍 {p.location}</p>
        </div>
        <div className="detail-price">{p.price ? formatEth(p.price) : "Not listed"}</div>
      </div>

      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="gallery">
        <div className="gallery-toolbar">
          <h2>Photos</h2>
          {isOwner && (
            <label className="btn btn-outline btn-sm add-photos">
              {uploading ? "Uploading…" : "+ Add photos"}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={addImages}
                disabled={uploading}
                hidden
              />
            </label>
          )}
        </div>

        {images.length === 0 ? (
          <div className="gallery-empty">
            <span aria-hidden="true" style={{ fontSize: "2rem" }}>
              🖼️
            </span>
            <span className="muted">No photos yet</span>
          </div>
        ) : (
          <>
            <div className="gallery-main">
              <img src={activePhoto.url} alt={p.title} />
            </div>
            {images.length > 1 && (
              <div className="gallery-thumbs">
                {images.map((img, i) => (
                  <div
                    key={img.id}
                    className={`gallery-thumb ${i === activeImg ? "active" : ""}`}
                    onClick={() => setActiveImg(i)}
                    title={`Photo ${i + 1}`}
                  >
                    <img src={img.url} alt={`Photo ${i + 1}`} />
                    {isOwner && (
                      <button
                        type="button"
                        className="thumb-remove"
                        title="Remove photo"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(img.id);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="detail-grid">
        <div className="card">
          <h2>Property details</h2>
          <dl className="detail-list">
            <div>
              <dt>Type</dt>
              <dd>{p.propertyType || "—"}</dd>
            </div>
            <div>
              <dt>Area</dt>
              <dd>{p.areaSqft ? `${Number(p.areaSqft).toLocaleString()} sqft` : "—"}</dd>
            </div>
            <div>
              <dt>NFT token</dt>
              <dd>{p.nftTokenId ? `#${p.nftTokenId}` : "Not minted"}</dd>
            </div>
            <div>
              <dt>Current owner</dt>
              <dd>
                {p.ownerName || "Unknown"}{" "}
                <span className="mono muted">({shortAddr(p.ownerWallet)})</span>
                {isOwner && <span className="you-badge">you</span>}
              </dd>
            </div>
            <div>
              <dt>Owner contact</dt>
              <dd>
                {p.ownerPhone ? (
                  <a href={`tel:${p.ownerPhone.replace(/\s+/g, "")}`} className="owner-phone">
                    📞 {p.ownerPhone}
                  </a>
                ) : (
                  <span className="muted">Not provided</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Registered</dt>
              <dd>{formatDate(p.createdAt)}</dd>
            </div>
          </dl>
          {p.description && <p className="description">{p.description}</p>}
        </div>

        <div className="card">
          <h2>Actions</h2>

          {!user && (
            <p className="muted">Connect your MetaMask wallet to buy or manage this property.</p>
          )}

          {user && isOwner && p.status === "verified" && (
            <>
              <p className="muted">This property is verified and ready to be listed for sale.</p>
              <button className="btn btn-primary btn-block" onClick={() => setListOpen(true)}>
                List for sale
              </button>
            </>
          )}

          {user && isOwner && p.status === "listed" && (
            <>
              <p className="muted">Listed at {formatEth(p.price)}. You can update the price.</p>
              <button className="btn btn-outline btn-block" onClick={() => setListOpen(true)}>
                Update listing price
              </button>
            </>
          )}

          {user && isOwner && p.status === "pending" && (
            <div className="alert alert-warn">Awaiting government verification before it can be sold.</div>
          )}

          {user && isOwner && p.status === "rejected" && (
            <div className="alert alert-danger">
              Rejected by government{p.rejectReason ? `: ${p.rejectReason}` : "."}
            </div>
          )}

          {user && !isOwner && p.status === "listed" && kycApproved && (
            <>
              <p className="muted">
                Send a purchase request. Your documents stay hidden from the seller until they accept.
              </p>
              <button className="btn btn-primary btn-block" onClick={() => setRequestOpen(true)}>
                Send purchase request
              </button>
            </>
          )}

          {user && !isOwner && p.status === "listed" && !kycApproved && (
            <div className="alert alert-warn">
              Complete KYC before requesting this property. <Link to="/kyc">Go to KYC</Link>
            </div>
          )}

          {user && !isOwner && p.status === "verified" && (
            <p className="muted">This property is verified but not currently listed for sale.</p>
          )}
        </div>
      </div>

      {/* Ownership documents are private: the API only returns the array to the
          owner, the government, or an accepted buyer, so the whole section is
          hidden from the public marketplace view. */}
      {Array.isArray(ownershipDocs) && (
        <div className="card">
          <div className="row between">
            <h2>Ownership documents</h2>
            {isOwner && (
              <label className="btn btn-outline btn-sm add-photos">
                {docsUploading ? "Uploading…" : "+ Add document"}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  onChange={uploadDocs}
                  disabled={docsUploading}
                  hidden
                />
              </label>
            )}
          </div>

          {docCount === 0 ? (
            <p className="muted">
              No ownership documents yet. Add at least one (e.g. land certificate) before listing
              this property for sale.
            </p>
          ) : (
            <ul className="doc-list">
              {ownershipDocs.map((d) => (
                <li key={d.id}>
                  <span className="doc-name">📄 {d.fileName}</span>
                  <span className="row gap">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        api.download(`/api/properties/${p.id}/ownership-docs/${d.id}`, d.fileName)
                      }
                    >
                      Download
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeDoc(d.id)}
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <h2>Ownership history</h2>
        {history.length === 0 ? (
          <p className="muted">No ownership records yet.</p>
        ) : (
          <ol className="timeline">
            {history.map((h, i) => (
              <li key={h.id}>
                <span className={`timeline-dot ${!h.endedAt ? "current" : ""}`} />
                <div className="timeline-body">
                  <div className="row between wrap">
                    <strong>
                      {h.ownerName || shortAddr(h.ownerWallet)}
                      {i === history.length - 1 && !h.endedAt && (
                        <span className="you-badge">current owner</span>
                      )}
                    </strong>
                    <span className="muted small">
                      {formatDate(h.startedAt)}
                      {h.endedAt ? ` → ${formatDate(h.endedAt)}` : " → present"}
                    </span>
                  </div>
                  <div className="muted small mono">{h.ownerWallet}</div>
                  {h.ownerPhone && (
                    <div className="small">
                      📞{" "}
                      <a href={`tel:${h.ownerPhone.replace(/\s+/g, "")}`} className="owner-phone">
                        {h.ownerPhone}
                      </a>
                    </div>
                  )}
                  {h.price && <div className="small">Sold for {formatEth(h.price)}</div>}
                  {h.txHash && <div className="muted small mono">tx {shortAddr(h.txHash)}</div>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* List-for-sale modal */}
      <Modal open={listOpen} title="List property for sale" onClose={() => setListOpen(false)}>
        <form className="form" onSubmit={submitListing}>
          <div className="field">
            <label>Price (ETH)</label>
            <input
              required
              type="number"
              step="0.0001"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 2"
            />
          </div>
          <p className="muted small">
            This will approve the marketplace and create the listing on-chain via MetaMask.
          </p>
          <button className="btn btn-primary" disabled={busy === "list"}>
            {busy === "list" ? "Confirm in MetaMask…" : "List for sale"}
          </button>
        </form>
      </Modal>

      {/* Purchase request modal */}
      <Modal open={requestOpen} title="Send purchase request" onClose={() => setRequestOpen(false)}>
        <form className="form" onSubmit={submitRequest}>
          <div className="field">
            <label>Citizenship certificate</label>
            <input
              type="file"
              required
              accept="image/*,.pdf"
              onChange={(e) =>
                setRequestDocs((d) => ({ ...d, citizenship: e.target.files[0] || null }))
              }
            />
          </div>
          <div className="field">
            <label>PAN card</label>
            <input
              type="file"
              required
              accept="image/*,.pdf"
              onChange={(e) => setRequestDocs((d) => ({ ...d, pan: e.target.files[0] || null }))}
            />
          </div>
          <small className="muted">
            Encrypted off-chain; only a hash goes on-chain. The seller cannot see these until they
            accept your request.
          </small>
          <button className="btn btn-primary" disabled={busy === "request"}>
            {busy === "request" ? "Confirm in MetaMask…" : "Send request"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
