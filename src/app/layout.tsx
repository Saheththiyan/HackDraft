import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "HackDraft — CTF team workspace", description: "Capture your solves. Build your CTF report.", robots: { index: false, follow: false } };
const themeScript = "(function(){try{var stored=localStorage.getItem('hackdraft-theme');var theme=stored==='light'||stored==='dark'?stored:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme}catch(e){document.documentElement.dataset.theme='light'}})();";
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body>{children}</body></html>;
}
