"use client";

import { useTheme } from "@/components/theme-provider";
import { Moon, Flower2 } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "pink" : "dark")}
      className="flex items-center justify-center w-8 h-8 rounded-md border border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      title={theme === "dark" ? "Розова тема" : "Тъмна тема"}
    >
      {theme === "dark" ? (
        <Flower2 className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
