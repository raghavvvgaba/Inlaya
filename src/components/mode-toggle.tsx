"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "~/components/ui/button"

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  // Flip from whatever is showing, so this also works while following the
  // system theme (the default until the user picks one).
  function handleToggle() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={handleToggle}
      title="Toggle theme"
      type="button"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
