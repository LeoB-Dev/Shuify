import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen text-white overflow-hidden relative" style={{ background: "#0a0a0f" }}>

      {/* Ambient glow blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full blur-3xl opacity-20"
          style={{ width: 600, height: 600, background: "radial-gradient(circle, #6366f1, transparent)", top: -100, left: -100 }}
        />
        <div
          className="absolute rounded-full blur-3xl opacity-15"
          style={{ width: 500, height: 500, background: "radial-gradient(circle, #8b5cf6, transparent)", bottom: 0, right: -80 }}
        />
        <div
          className="absolute rounded-full blur-2xl opacity-10"
          style={{ width: 300, height: 300, background: "radial-gradient(circle, #a78bfa, transparent)", top: "40%", left: "50%" }}
        />
      </div>

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.25) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 tracking-wide uppercase">
          3D Room Planner · Babylon.js
        </div>

        <h1 className="text-7xl font-black tracking-tighter mb-5 text-white">
          0Shuify
        </h1>

        <p className="text-white/50 text-lg leading-relaxed max-w-lg mb-8">
          Design your dream room in 3D. Drag, drop, rotate furniture
          and save as many layouts as you like.
        </p>

        <Link
          to="/room-planner"
          className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold text-sm transition-all"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 0 40px rgba(99,102,241,0.4)" }}
        >
          Open Room Planner
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </div>

      {/* Feature cards */}
      <div className="relative z-10 px-6 pb-20 flex justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl w-full">
          {[
            {
              icon: "⠿",
              title: "Drag & Drop",
              desc: "Pick furniture from the sidebar and drop it anywhere in your 3D room.",
              color: "#6366f1",
            },
            {
              icon: "↻",
              title: "Rotate Items",
              desc: "Right-click any placed item to snap-rotate it 90° instantly.",
              color: "#8b5cf6",
            },
            {
              icon: "💾",
              title: "Save Rooms",
              desc: "Layouts are persisted automatically and restored on next visit.",
              color: "#a78bfa",
            },
          ].map(({ icon, title, desc, color }) => (
            <div
              key={title}
              className="rounded-2xl p-6 space-y-3 border border-white/8"
              style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(8px)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: `${color}22`, border: `1px solid ${color}44` }}
              >
                {icon}
              </div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-white/45 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
