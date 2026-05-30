import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Home from "./components/Home";
import Room from "./components/Room";
import InterpreterJoin from "./components/InterpreterJoin";
import InterpreterRoom from "./components/InterpreterRoom";
import RequireAuth from "./components/RequireAuth";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<RequireAuth><Room /></RequireAuth>} />
        <Route path="/interpreter" element={<RequireAuth><InterpreterJoin /></RequireAuth>} />
        <Route path="/interpreter/:token" element={<RequireAuth><InterpreterRoom /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
