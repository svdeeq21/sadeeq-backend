import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Svdeeq Command Center",
  description: "AI Outreach Operations Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
