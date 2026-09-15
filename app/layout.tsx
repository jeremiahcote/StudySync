import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudySync | Your coursework, in sync",
  description: "A simple study planner for keeping college coursework organized.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/studysync-logo.png",
    shortcut: "/studysync-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
