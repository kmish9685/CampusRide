import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/student", label: "Student" },
    { to: "/driver", label: "Driver" },
    { to: "/admin", label: "Admin" },
  ];

  return (
    <header className="sticky top-0 z-50 h-[56px] bg-gray-950/95 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4 h-[56px] flex items-center justify-between">
        {/* Brand */}
        <Link
          to="/"
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-2.5 focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
              <rect x="3" y="4" width="18" height="13" rx="2" />
              <path d="M16 17v2a1 1 0 01-1 1H9a1 1 0 01-1-1v-2" />
              <circle cx="7.5" cy="13.5" r="1.5" fill="currentColor" />
              <circle cx="16.5" cy="13.5" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <span className="font-bold text-base tracking-tight text-white">CampusRide</span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden sm:flex items-center gap-1.5">
          {navLinks.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="sm:hidden w-11 h-11 flex items-center justify-center rounded-xl bg-gray-900 border border-gray-800 text-gray-300 hover:text-white focus:outline-none"
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="sm:hidden absolute top-[56px] left-0 right-0 bg-gray-950/98 backdrop-blur-xl border-b border-gray-800 px-4 py-3 shadow-2xl flex flex-col gap-1 z-50">
          {navLinks.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setIsOpen(false)}
                className={`min-h-[44px] flex items-center px-4 rounded-xl text-base font-semibold transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-gray-300 hover:bg-gray-900 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
