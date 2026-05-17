import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Home from "./components/Home";
import Room from "./components/Room";
import InterpreterJoin from "./components/InterpreterJoin";
import InterpreterRoom from "./components/InterpreterRoom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/interpreter" element={<InterpreterJoin />} />
        <Route path="/interpreter/:token" element={<InterpreterRoom />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
