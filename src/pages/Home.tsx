import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-gray-950">
      {/* Logo / Brand */}
      <div className="mb-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/50">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" className="w-7 h-7">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <path d="M9 22V12h6v10" />
          </svg>
        </div>
        <span className="text-3xl font-bold text-white tracking-tight">CampusRide</span>
      </div>

      {/* Tagline */}
      <p className="text-gray-400 text-center text-base max-w-xs mb-10 leading-relaxed">
        Real-time bus tracking for college commuters — know before you go.
      </p>

      {/* Role Cards */}
      <div className="w-full max-w-sm flex flex-col gap-4">
        <Link
          to="/student"
          className="group flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-2xl px-6 py-5 hover:border-indigo-500 hover:bg-gray-900/80 transition-all duration-200 shadow-sm"
        >
          <div className="w-11 h-11 rounded-xl bg-indigo-600/20 flex items-center justify-center group-hover:bg-indigo-600/30 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.8" className="w-6 h-6">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-base">Student</p>
            <p className="text-gray-500 text-sm">Track your bus live</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" className="w-5 h-5 group-hover:stroke-indigo-400 transition-colors">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>

        <Link
          to="/driver"
          className="group flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-2xl px-6 py-5 hover:border-indigo-500 hover:bg-gray-900/80 transition-all duration-200 shadow-sm"
        >
          <div className="w-11 h-11 rounded-xl bg-indigo-600/20 flex items-center justify-center group-hover:bg-indigo-600/30 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.8" className="w-6 h-6">
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="M16 8h4l3 3v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-base">Driver</p>
            <p className="text-gray-500 text-sm">Share your location</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" className="w-5 h-5 group-hover:stroke-indigo-400 transition-colors">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>

        <Link
          to="/admin"
          className="group flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-2xl px-6 py-5 hover:border-indigo-500 hover:bg-gray-900/80 transition-all duration-200 shadow-sm"
        >
          <div className="w-11 h-11 rounded-xl bg-indigo-600/20 flex items-center justify-center group-hover:bg-indigo-600/30 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.8" className="w-6 h-6">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-base">Admin</p>
            <p className="text-gray-500 text-sm">View analytics dashboard</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" className="w-5 h-5 group-hover:stroke-indigo-400 transition-colors">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      </div>

      <p className="mt-10 text-gray-600 text-xs text-center">
        Built for college transport · Hackathon 2024
      </p>
    </div>
  );
}
