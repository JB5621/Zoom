import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingScreen } from "./pageStyles";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen label="Checking your session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
