// ─────────────────────────────────────────────
//  Root Layout  (app/layout.tsx)
// ─────────────────────────────────────────────
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Svdeeq-Bot · CRM Control Center",
  description: "AI WhatsApp Receptionist & CRM Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* IBM Plex Sans — body font */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
