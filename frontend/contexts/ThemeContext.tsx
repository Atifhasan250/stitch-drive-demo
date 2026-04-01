"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setMounted(true);
    // Sync React state with the class added by layout.tsx inline script
    const isLight = document.documentElement.classList.contains("light");
    setTheme(isLight ? "light" : "dark");
  }, []);

  function toggle() {
    if (!mounted) return;
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("sd_theme", next);
      document.documentElement.classList.toggle("light", next === "light");
      return next;
    });
  }

  // Prevent hydration mismatch: render a placeholder or nothing until mounted if needed,
  // but for theme we actually want the children to render immediately.
  // The suppressHydrationWarning on root html handles the class mismatch.


  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
