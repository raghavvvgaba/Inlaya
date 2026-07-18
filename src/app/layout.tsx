import "~/styles/globals.css";

import { type Metadata } from "next";
import { ThemedClerkProvider } from "~/components/themed-clerk-provider";
import { ThemeProvider } from "~/components/theme-provider";
import { TooltipProvider } from "~/components/ui/tooltip";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Inlaya | Fit the right change into place",
  description:
    "Turn GitHub issues into reviewed pull requests with an AI agent, isolated sandboxes, and live previews.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body className="font-sans min-h-screen bg-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemedClerkProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </ThemedClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
