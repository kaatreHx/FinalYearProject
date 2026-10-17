import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Kyc from "./pages/Kyc";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import RegisterProperty from "./pages/RegisterProperty";
import MyProperties from "./pages/MyProperties";
import Marketplace from "./pages/Marketplace";
import PropertyDetail from "./pages/PropertyDetail";
import Requests from "./pages/Requests";
import RequestDetail from "./pages/RequestDetail";
import Government from "./pages/Government";

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/properties/:id" element={<PropertyDetail />} />

          <Route
            path="/kyc"
            element={
              <ProtectedRoute>
                <Kyc />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute hideForGovernment>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/properties/new"
            element={
              <ProtectedRoute requireKyc>
                <RegisterProperty />
              </ProtectedRoute>
            }
          />
          <Route
            path="/properties/mine"
            element={
              <ProtectedRoute>
                <MyProperties />
              </ProtectedRoute>
            }
          />
          <Route
            path="/requests"
            element={
              <ProtectedRoute>
                <Requests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/requests/:id"
            element={
              <ProtectedRoute>
                <RequestDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/government"
            element={
              <ProtectedRoute requireGovernment>
                <Government />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="footer">
        <span>Land Chain — Blockchain Land Registry · Final Year Project</span>
      </footer>
    </div>
  );
}
