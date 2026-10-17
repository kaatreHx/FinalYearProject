import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "../lib/api";
import { connectWallet } from "../lib/ethers";

const AUTH_KEY = "lc_auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [address, setAddress] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [ready, setReady] = useState(false);

  const clearSession = useCallback(() => {
    setToken(null);
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
    setAddress(null);
  }, []);

  const logout = clearSession;

  /** On load, restore the session from the stored token. */
  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setReady(true);
        return;
      }
      try {
        const { user } = await api.get("/api/auth/me");
        setUser(user);
        setAddress(user.wallet);
      } catch {
        setToken(null);
      }
      setReady(true);
    })();
  }, []);

  /** React when the user switches account or network inside MetaMask. */
  useEffect(() => {
    if (!window.ethereum?.on) return;

    const handleAccountsChanged = (accounts) => {
      const next = accounts && accounts[0] ? accounts[0].toLowerCase() : null;
      // Disconnected, or a different account was selected: end the session so
      // the user can sign in as the new account.
      if (!next || (address && next !== address)) clearSession();
    };
    const handleChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [address, clearSession]);

  /** Connect MetaMask and perform the full wallet login. */
  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const { signer, address: wallet } = await connectWallet();
      const { message } = await api.post("/api/auth/nonce", { wallet });
      const signature = await signer.signMessage(message);
      const { token, user } = await api.post("/api/auth/verify", { wallet, signature });
      setToken(token);
      localStorage.setItem(AUTH_KEY, JSON.stringify({ wallet }));
      setUser(user);
      setAddress(user.wallet);
      return user;
    } finally {
      setConnecting(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const { user } = await api.get("/api/auth/me");
    setUser(user);
    setAddress(user.wallet);
    return user;
  }, []);

  const value = {
    user,
    address,
    connecting,
    ready,
    connect,
    logout,
    refresh,
    isAuthenticated: !!user,
    isGovernment: user?.role === "government",
    kycApproved: user?.kycStatus === "approved",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
