import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ConnectButton from "../components/ConnectButton";

const FEATURES = [
  {
    icon: "🏛️",
    title: "Government verified",
    text: "Every property is checked by the government before it is minted as an NFT. No fake or duplicate records.",
  },
  {
    icon: "🔗",
    title: "On-chain ownership",
    text: "Ownership lives as an ERC-721 NFT on Ethereum, so records are transparent and tamper-proof.",
  },
  {
    icon: "🔒",
    title: "Protected documents",
    text: "Buyers attach documents that stay locked and hidden from the seller until the request is accepted.",
  },
  {
    icon: "🕘",
    title: "Full history",
    text: "Each property page shows the current owner and every previous owner with dates and transactions.",
  },
  {
    icon: "⚖️",
    title: "No fixed roles",
    text: "Any user can register, list, buy and sell. The only special account is the government verifier.",
  },
  {
    icon: "💸",
    title: "Smart-contract payment",
    text: "After verification the buyer pays, and ownership plus funds move automatically in one transaction.",
  },
];

const STEPS = [
  { n: 1, title: "Connect & verify", text: "Log in with MetaMask and complete a simple KYC." },
  { n: 2, title: "Register property", text: "Submit a property; the government verifies and mints it." },
  { n: 3, title: "List & request", text: "The owner lists a price; a buyer sends a request with documents." },
  { n: 4, title: "Accept → Verify → Pay", text: "Seller accepts, government approves, buyer pays, NFT moves." },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="landing">
      <section className="hero">
        <span className="hero-pill">Blockchain · ERC-721 · Ethereum</span>
        <h1>
          Land ownership you can <span className="accent">actually verify</span>
        </h1>
        <p className="hero-sub">
          Land Chain registers every property as a government-verified NFT, then handles buying and
          selling through a transparent, request-based smart-contract flow — with complete ownership
          history.
        </p>
        <div className="hero-actions">
          {user ? (
            <Link to="/dashboard" className="btn btn-primary btn-lg">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <ConnectButton />
              <Link to="/marketplace" className="btn btn-outline btn-lg">
                Browse marketplace
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">How it works</h2>
        <div className="steps">
          {STEPS.map((s) => (
            <div key={s.n} className="step">
              <span className="step-num">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Built for trust</h2>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature">
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta">
        <h2>Ready to register your first property?</h2>
        <p>Connect your MetaMask wallet to get started. No email or password needed.</p>
        {!user && <ConnectButton />}
      </section>
    </div>
  );
}
