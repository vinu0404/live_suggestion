import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Live Meeting Copilot",
  description: "Transcript, live suggestions, and detailed chat answers powered by Groq.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
