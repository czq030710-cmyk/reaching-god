import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIFX — The Synthetic Muse",
  description:
    "A cinematic passage through AI film, commercial campaigns, music and original IP.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
