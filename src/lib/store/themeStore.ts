import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppTheme = "vscode-dark" | "github-light" | "dracula";

interface ThemeState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "vscode-dark",
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "sqlstudio-theme",
    }
  )
);
