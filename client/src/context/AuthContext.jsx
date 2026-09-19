import React, { createContext, useContext, useEffect, useState } from "react";

const TOKEN_KEY = "oguzmeeting_auth_token";
const LEGACY_TOKEN_KEY = "zoomclone_auth_token";
const AuthContext = createContext(null);

const API_BASE = (import.meta.env.VITE_SERVER_URL || "").replace(/\/$/, "");

function apiUrl(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

async function parseResponse(response) {
  const text = await response.text();
  let data = {};
  const contentType = response.headers.get("content-type") || "";

  if (text) {
    if (contentType.includes("application/json")) {
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }
    } else if (!text.trim().startsWith("<")) {
      data = { error: text };
    }
  }

  if (!response.ok) {
    throw new Error(data.error || authStatusMessage(response.status));
  }

  return data;
}

function authStatusMessage(status) {
  if (status === 0) return "Could not reach the auth server.";
  if (status === 400) return "Check the form and try again.";
  if (status === 401) return "Invalid email or password.";
  if (status === 409) return "An account with that email already exists.";
  if (status === 429) return "Too many attempts. Please wait a bit and try again.";
  if (status >= 500) return "The auth server had a problem. Check that the backend is running.";
  return `Authentication failed (${status}).`;
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
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || "");
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
        localStorage.removeItem(LEGACY_TOKEN_KEY);
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
      localStorage.removeItem(LEGACY_TOKEN_KEY);
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
      localStorage.removeItem(LEGACY_TOKEN_KEY);
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
