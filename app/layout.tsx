import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { getUserPreferences } from "@/lib/preferences/db";
import { toCssVars } from "@/lib/preferences/theme";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Mimir",
  description: "Plataforma interna de conhecimento e inteligência operacional",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const prefs = await getUserPreferences();
  const cssVars = toCssVars(prefs);
  const themeMode = prefs.theme_mode ?? "dark";
  const resolvedTheme = themeMode === "light" ? "light" : "dark";
  return (
    <html
      lang="pt-BR"
      className={`${dmSans.variable} ${dmSerif.variable} h-full antialiased`}
      style={cssVars}
      data-theme-mode={themeMode}
      data-theme={resolvedTheme}
    >
      <body className={`min-h-full flex flex-col ${prefs.dense_mode ? "dense" : ""}`}>{children}</body>
    </html>
  );
}
