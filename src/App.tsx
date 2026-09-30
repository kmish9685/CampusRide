import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Student from "./pages/Student";
import Driver from "./pages/Driver";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-gray-950 text-gray-100">
        <Navbar />
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/student" element={<Student />} />
            <Route path="/driver" element={<Driver />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
