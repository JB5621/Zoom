import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import Room from "./components/Room";
import InterpreterJoin from "./components/InterpreterJoin";
import InterpreterRoom from "./components/InterpreterRoom";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/interpreter" element={<InterpreterJoin />} />
        <Route path="/interpreter/:token" element={<InterpreterRoom />} />
      </Routes>
    </BrowserRouter>
  );
}
