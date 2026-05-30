import React, { createContext, useContext, useEffect, useState } from "react";

const TOKEN_KEY = "zoomclone_auth_token";
const AuthContext = createContext(null);

const API_BASE = (import.meta.env.VITE_SERVER_URL || "").replace(/\/$/, "");

function apiUrl(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

async function parseResponse(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    throw new Error(data.error || "Authentication failed.");
  }

  return data;
}

async function postJson(path, body, token) {
  let response;
  try {
    response = await fetch(apiUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Network error (CORS, mixed content, server down)
    const msg = err && err.message ? err.message : "Network request failed";
    throw new Error(`Network error when contacting auth server: ${msg}`);
  }

  try {
    return await parseResponse(response);
  } catch (err) {
    // surface status and body for easier debugging
    throw new Error(err.message || `Request failed (${response.status})`);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const response = await fetch(apiUrl("/api/auth/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await parseResponse(response);
        if (!cancelled) setUser(data.user);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        if (!cancelled) {
          setToken("");
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function authenticate(path, payload) {
    setSubmitting(true);
    try {
      const data = await postJson(path, payload);
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setSubmitting(false);
    }
  }

  async function login(payload) {
    return authenticate("/api/auth/login", payload);
  }

  async function register(payload) {
    return authenticate("/api/auth/register", payload);
  }

  async function logout() {
    const currentToken = token;
    setSubmitting(true);
    try {
      if (currentToken) {
        await postJson("/api/auth/logout", {}, currentToken).catch(() => null);
      }
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setToken("");
      setUser(null);
      setSubmitting(false);
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, submitting, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
