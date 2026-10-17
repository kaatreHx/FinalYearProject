import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { shortAddr } from "../lib/ethers";
import { kycStatusMeta } from "../lib/format";

export default function ConnectButton() {
  const { user, connect, logout, connecting } = useAuth();
  const [error, setError] = useState("");

  if (user) {
    const kyc = kycStatusMeta(user.kycStatus);
    const label = user.role === "government" ? "Government" : kyc.label;
    const cls = user.role === "government" ? "badge-purple" : kyc.cls;

    return (
      <div className="wallet-chip">
        <span className={`badge ${cls}`}>{label}</span>
        <span className="wallet-addr" title={user.wallet}>
          {shortAddr(user.wallet)}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={logout}>
          Sign out
        </button>
      </div>
    );
  }

  const handle = async () => {
    setError("");
    try {
      await connect();
    } catch (err) {
      setError(err.message || "Could not connect.");
    }
  };

  return (
    <div className="connect-wrap">
      <button className="btn btn-primary btn-sm" onClick={handle} disabled={connecting}>
        {connecting ? "Connecting…" : "Connect MetaMask"}
      </button>
      {error && <span className="connect-error">{error}</span>}
    </div>
  );
}
