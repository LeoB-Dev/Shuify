import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-zinc-900/95 backdrop-blur-sm border-b border-white/10 flex items-center px-8 gap-8">
      <span className="text-white font-bold tracking-wide text-xl mr-4">Shuify</span>
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `text-base transition-colors ${isActive ? "text-white" : "text-white/50 hover:text-white/80"}`
        }
      >
        Home
      </NavLink>
      <NavLink
        to="/room-planner"
        className={({ isActive }) =>
          `text-base transition-colors ${isActive ? "text-white" : "text-white/50 hover:text-white/80"}`
        }
      >
        Room Planner
      </NavLink>
    </nav>
  );
}
