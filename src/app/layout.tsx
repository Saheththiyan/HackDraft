import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "HackDraft — CTF team workspace", description: "Capture your solves. Build your CTF report.", robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
