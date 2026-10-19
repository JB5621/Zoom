import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthState";

import { LoadingScreen } from "./LoadingScreen";

export default function RequireAuth({ children }) {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen label="Checking your session..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return children;
}
