import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ConnectButton from "./ConnectButton";

const linkClass = ({ isActive }) => (isActive ? "nav-link active" : "nav-link");

export default function Navbar() {
  const { user, isGovernment } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">◈</span>
          <span className="brand-text">
            Land<b>Chain</b>
          </span>
        </Link>

        <nav className="nav-links">
          <NavLink to="/marketplace" className={linkClass}>
            Marketplace
          </NavLink>
          {user && (
            <NavLink to="/dashboard" className={linkClass}>
              Dashboard
            </NavLink>
          )}
          {user && (
            <NavLink to="/properties/mine" className={linkClass}>
              My Properties
            </NavLink>
          )}
          {user && (
            <NavLink to="/requests" className={linkClass}>
              Requests
            </NavLink>
          )}
          {user && !isGovernment && (
            <NavLink to="/profile" className={linkClass}>
              Profile
            </NavLink>
          )}
          {isGovernment && (
            <NavLink to="/government" className={linkClass}>
              Government
            </NavLink>
          )}
        </nav>

        <ConnectButton />
      </div>
    </header>
  );
}
