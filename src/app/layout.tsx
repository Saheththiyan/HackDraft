import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], weight: "variable", style: ["normal", "italic"], variable: "--font-serif", display: "swap", axes: ["opsz"] });

export const metadata: Metadata = { title: "HackDraft — CTF team workspace", description: "Capture your solves. Build your CTF report.", robots: { index: false, follow: false } };
const themeScript = "(function(){try{var stored=localStorage.getItem('hackdraft-theme');var theme=stored==='light'||stored==='dark'?stored:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme}catch(e){document.documentElement.dataset.theme='light'}})();";
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${serif.variable}`}><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body>{children}</body></html>;
}
