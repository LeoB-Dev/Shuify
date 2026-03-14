import { HashRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import App from "./App";

export default function Root() {
  return (
    <HashRouter>
      <Navbar />
      <div className="pt-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room-planner" element={<App />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
