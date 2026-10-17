import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { hasMetaMask } from "../lib/ethers";

export default function Login() {
  const { user, connect, connecting } = useAuth();
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/dashboard";

  useEffect(() => {
    if (user) navigate(from, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handle = async () => {
    setError("");
    try {
      await connect();
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed.");
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="auth-logo">◈</div>
        <h1>Sign in to Land Chain</h1>
        <p className="muted">
          Authentication is done with your wallet — no email or password. MetaMask signs a one-time
          message and we verify the signature.
        </p>

        {!hasMetaMask() && (
          <div className="alert alert-warn">
            MetaMask is not detected. Install the browser extension to continue.
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        <button className="btn btn-primary btn-lg btn-block" onClick={handle} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect MetaMask"}
        </button>

        <ul className="auth-notes">
          <li>Your wallet address is your identity.</li>
          <li>We never ask for your seed phrase or private key.</li>
          <li>New users are created automatically on first login.</li>
          <li>KYC is required before registering or buying property.</li>
        </ul>
      </div>
    </div>
  );
}
