import type { Metadata } from "next";
import "./globals.css";
import { BudgetProvider } from "@/lib/BudgetContext";
import { AuthProvider } from "@/lib/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Auto Audit — Simple Budgeting for Students",
  description:
    "Track spending, stay under budget, and build better money habits. Designed for students and young adults.",
};

// Inline pre-hydration script: applies stored theme before first paint to
// avoid a light-mode flash on dark-mode users.
const themeBootstrap = `
(function() {
  try {
    var pref = localStorage.getItem('auto-audit:theme');
    var dark = pref === 'dark' || (!pref || pref === 'system') &&
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`.trim();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <BudgetProvider>{children}</BudgetProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
