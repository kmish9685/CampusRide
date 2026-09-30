import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 bg-gray-950 w-full overflow-x-hidden">
      {/* Logo / Brand Header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/50">
          {/* Bus Icon */}
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-7 h-7">
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M16 17v2a1 1 0 01-1 1H9a1 1 0 01-1-1v-2" />
            <circle cx="7.5" cy="13.5" r="1.5" fill="white" />
            <circle cx="16.5" cy="13.5" r="1.5" fill="white" />
            <path d="M3 10h18" />
          </svg>
        </div>
        <span className="text-3xl font-extrabold text-white tracking-tight">CampusRide</span>
      </div>

      {/* Tagline */}
      <p className="text-gray-400 text-center text-sm sm:text-base max-w-xs mb-8 leading-relaxed">
        Real-time bus tracking for college commuters — know before you go.
      </p>

      {/* Role Cards Container: full width with 16px side padding on mobile, max 420px on desktop */}
      <div className="w-full max-w-[420px] flex flex-col gap-3.5">
        {/* Student Card */}
        <Link
          to="/student"
          className="group flex items-center gap-4 bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 hover:border-indigo-500 hover:bg-gray-900 transition-all duration-200 shadow-md min-h-[72px]"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-600/30 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" className="w-6 h-6">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-base">Student</p>
            <p className="text-gray-400 text-xs sm:text-sm truncate">Track your bus live</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" className="w-5 h-5 shrink-0 group-hover:stroke-indigo-400 transition-colors">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Driver Card */}
        <Link
          to="/driver"
          className="group flex items-center gap-4 bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 hover:border-indigo-500 hover:bg-gray-900 transition-all duration-200 shadow-md min-h-[72px]"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-600/30 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" className="w-6 h-6">
              <rect x="2" y="5" width="20" height="12" rx="2" />
              <path d="M17 17v2a1 1 0 01-1 1H8a1 1 0 01-1-1v-2" />
              <circle cx="7" cy="13" r="1.5" fill="#818cf8" />
              <circle cx="17" cy="13" r="1.5" fill="#818cf8" />
              <path d="M2 10h20" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-base">Driver</p>
            <p className="text-gray-400 text-xs sm:text-sm truncate">Share your location</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" className="w-5 h-5 shrink-0 group-hover:stroke-indigo-400 transition-colors">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Admin Card with Chart Icon */}
        <Link
          to="/admin"
          className="group flex items-center gap-4 bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 hover:border-indigo-500 hover:bg-gray-900 transition-all duration-200 shadow-md min-h-[72px]"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-600/30 transition-colors">
            {/* Chart Bar Icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-base">Admin</p>
            <p className="text-gray-400 text-xs sm:text-sm truncate">View analytics dashboard</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" className="w-5 h-5 shrink-0 group-hover:stroke-indigo-400 transition-colors">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Footer */}
      <p className="mt-8 text-gray-500 text-xs text-center">
        Built for college transport · Hackathon 2026
      </p>
    </div>
  );
}
