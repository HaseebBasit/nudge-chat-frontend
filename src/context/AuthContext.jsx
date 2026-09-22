import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api.js";
import { destroySocket } from "../lib/socket.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("nudge_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("nudge_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function hydrate() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        setUser(data.user);
        localStorage.setItem("nudge_user", JSON.stringify(data.user));
      } catch (error) {
        // token invalid/expired
        setToken(null);
        setUser(null);
        localStorage.removeItem("nudge_token");
        localStorage.removeItem("nudge_user");
      } finally {
        setLoading(false);
      }
    }
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function login(newToken, newUser) {
    localStorage.setItem("nudge_token", newToken);
    localStorage.setItem("nudge_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    destroySocket();
    localStorage.removeItem("nudge_token");
    localStorage.removeItem("nudge_user");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
