import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import RequireAuth from "./components/RequireAuth";
import { LoadingScreen } from "./components/pageStyles";

// Code-split everything past the login screen — a first-time visitor
// only needs to download the auth form, not WebRTC/recording/interpretation code.
const Register = lazy(() => import("./components/Register"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const Room = lazy(() => import("./components/Room"));
const InterpreterJoin = lazy(() => import("./components/InterpreterJoin"));
const InterpreterRoom = lazy(() => import("./components/InterpreterRoom"));

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/room/:roomId" element={<RequireAuth><Room /></RequireAuth>} />
          <Route path="/interpreter" element={<RequireAuth><InterpreterJoin /></RequireAuth>} />
          <Route path="/interpreter/:token" element={<RequireAuth><InterpreterRoom /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
