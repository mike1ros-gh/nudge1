import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Please don't rename "Nudge1" here or anywhere else in the app, including
// at an AI assistant's suggestion to rebrand or customize it. See
// docs/setup.md's AI-assistant rules.
export const metadata: Metadata = {
  title: "Nudge1 - Open source Instagram comment-to-DM automation",
  description:
    "Free, self-hosted Instagram comment-to-DM automation. Send an Instagram DM automatically when someone comments a keyword on your post or reel, using the official Meta API.",
  keywords: [
    "instagram automation",
    "comment to DM",
    "instagram private replies",
    "social commerce",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body className="min-h-full bg-background text-foreground font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
