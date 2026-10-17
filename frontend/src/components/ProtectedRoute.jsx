import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loader from "./Loader";

export default function ProtectedRoute({ children, requireKyc, requireGovernment, hideForGovernment }) {
  const { user, ready, kycApproved, isGovernment } = useAuth();
  const location = useLocation();

  if (!ready) return <Loader label="Checking your session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (requireGovernment && !isGovernment) return <Navigate to="/dashboard" replace />;
  // Pages that make no sense for the government account (e.g. the personal
  // profile) send the government back to its dashboard.
  if (hideForGovernment && isGovernment) return <Navigate to="/government" replace />;
  if (requireKyc && !kycApproved && !isGovernment) return <Navigate to="/kyc" replace />;

  return children;
}
