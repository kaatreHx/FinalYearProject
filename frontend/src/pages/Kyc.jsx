import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { kycStatusMeta } from "../lib/format";
import StatusBadge from "../components/StatusBadge";
import Loader from "../components/Loader";
import PhoneInput from "../components/PhoneInput";

const EMPTY = {
  fullName: "",
  dateOfBirth: "",
  nationality: "",
  idNumber: "",
  address: "",
  phone: "",
};

export default function Kyc() {
  const { user, isGovernment, refresh } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get("/api/kyc/me");
        setKyc(data.kyc);
        if (data.kyc) {
          setForm({
            fullName: data.kyc.full_name || data.user?.fullName || "",
            dateOfBirth: data.kyc.date_of_birth ? String(data.kyc.date_of_birth).slice(0, 10) : "",
            nationality: data.kyc.nationality || "",
            idNumber: data.kyc.id_number || "",
            address: data.kyc.address || "",
            phone: data.user?.phone || "",
          });
        }
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (file) fd.append("document", file);
      await api.postForm("/api/kyc", fd);
      await refresh();
      const data = await api.get("/api/kyc/me");
      setKyc(data.kyc);
      setSuccess("Your KYC has been submitted. The government will review it shortly.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader label="Loading your KYC…" />;

  if (isGovernment) {
    return (
      <div className="narrow">
        <div className="card">
          <h1>Government account</h1>
          <p className="muted">
            This wallet is registered as the government verifier and is automatically verified.
          </p>
          <Link to="/government" className="btn btn-primary">
            Open Government dashboard
          </Link>
        </div>
      </div>
    );
  }

  const status = user?.kycStatus || "none";
  const meta = kycStatusMeta(status);

  if (status === "approved") {
    return (
      <div className="narrow">
        <div className="card center">
          <div className="big-emoji">✅</div>
          <h1>KYC verified</h1>
          <p className="muted">Your identity has been approved by the government. You have full access.</p>
          <div className="row gap center-row">
            <Link to="/properties/new" className="btn btn-primary">
              Register a property
            </Link>
            <Link to="/marketplace" className="btn btn-outline">
              Browse marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="narrow">
      <div className="card">
        <div className="row between">
          <h1>Identity verification (KYC)</h1>
          <StatusBadge meta={meta} />
        </div>
        <p className="muted">
          Complete this simple check so the government can verify your identity. It is required
          before you can register or buy property.
        </p>

        {status === "pending" && (
          <div className="alert alert-warn">
            Your application is under review. You can resubmit if you need to correct something.
          </div>
        )}
        {status === "rejected" && kyc?.reject_reason && (
          <div className="alert alert-danger">Rejected: {kyc.reject_reason}</div>
        )}
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form className="form" onSubmit={submit}>
          <div className="field">
            <label>Full name</label>
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="As printed on your ID"
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Date of birth</label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Nationality</label>
              <input
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                placeholder="e.g. Nepali"
              />
            </div>
          </div>
          <div className="field">
            <label>ID / citizenship number</label>
            <input
              required
              value={form.idNumber}
              onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
              placeholder="Document number"
            />
          </div>
          <div className="field">
            <label>Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Your current address"
            />
          </div>
          <div className="field">
            <label>Phone number (optional)</label>
            <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <small className="muted">
              Shown to other users on your property pages so they can contact you.
            </small>
          </div>
          <div className="field">
            <label>Supporting document (image or PDF)</label>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0])} />
            <small className="muted">Stored securely off-chain. Only the government can view it.</small>
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Submitting…" : "Submit for verification"}
          </button>
        </form>
      </div>
    </div>
  );
}
