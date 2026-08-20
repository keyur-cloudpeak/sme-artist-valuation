'use client';

import { useEffect, useState } from "react";

export default function ResumeThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("wb_theme");
    const nextTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.resumeTheme = nextTheme;
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("wb_theme", nextTheme);
    document.documentElement.dataset.resumeTheme = nextTheme;
  }

  return (
    <button
      className={`resume-theme ${theme === "dark" ? "is-dark" : ""}`}
      type="button"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      onClick={toggleTheme}
    >
      <span>{theme === "dark" ? "LIGHT" : "DARK"}</span>
      <span className="resume-theme-track" aria-hidden="true">
        <span className="resume-theme-thumb" />
      </span>
    </button>
  );
}
