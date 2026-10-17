import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { kycStatusMeta } from "../lib/format";
import StatusBadge from "../components/StatusBadge";
import PhoneInput from "../components/PhoneInput";

/**
 * Profile page: lets the logged-in user update their name, email and phone.
 * The phone number is shown to other users on property pages so that a buyer
 * can contact the current owner (and vice-versa).
 */
export default function Profile() {
  const { user, refresh, isGovernment } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState("");

  // Keep the form in sync with the loaded user.
  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.patch("/api/auth/me", form);
      await refresh();
      setSuccess(res.message || "Profile updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const kyc = kycStatusMeta(user?.kycStatus || "none");

  /** Copy the wallet address to the clipboard. */
  const copyWallet = async () => {
    try {
      await navigator.clipboard.writeText(user?.wallet || "");
      setCopied("wallet");
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <div className="narrow">
      <div className="card">
        <div className="row between">
          <h1>My profile</h1>
          <StatusBadge meta={isGovernment ? { label: "Government", cls: "badge-purple" } : kyc} />
        </div>
        <p className="muted">
          Your name and phone number appear on your property pages so buyers and sellers can
          contact the owner. Keep them up to date.
        </p>

        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="field">
          <label>Wallet address</label>
          <div className="locked-field" title="Linked to your MetaMask account">
            <span className="lock-icon" aria-hidden="true">
              🔒
            </span>
            <span className="mono locked-value">{user?.wallet || ""}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyWallet}>
              {copied === "wallet" ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <small className="muted">
            Linked to your MetaMask account. This address cannot be changed.
          </small>
        </div>

        <form className="form" onSubmit={submit}>
          <div className="field">
            <label>Full name</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="Your full name"
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </div>
          <div className="field">
            <label>Phone number</label>
            <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <small className="muted">
              Shown on your property pages so interested buyers can reach you.
            </small>
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </button>
        </form>
      </div>

      {!isGovernment && (
        <div className="card">
          <h2>Identity verification</h2>
          <p className="muted">KYC is managed separately from your profile.</p>
          <Link to="/kyc" className="btn btn-outline">
            View KYC status
          </Link>
        </div>
      )}
    </div>
  );
}
