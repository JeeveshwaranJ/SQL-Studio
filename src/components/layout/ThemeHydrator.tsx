"use client";

import { useEffect } from "react";
import { useThemeStore } from "../../lib/store/themeStore";

export default function ThemeHydrator() {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    
    // Reset all theme classes
    root.classList.remove("theme-github-light", "theme-dracula");
    
    // Apply appropriate class
    if (theme === "github-light") {
      root.classList.add("theme-github-light");
    } else if (theme === "dracula") {
      root.classList.add("theme-dracula");
    }
  }, [theme]);

  return null;
}
