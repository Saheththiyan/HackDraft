// Pen-nib pole carrying a notched flag with three draft lines: the solve, written down.
export function BrandMark({ className = "", size = 28 }: { className?: string; size?: number }) {
  return <svg className={`brand-mark ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <path className="brand-mark-flag" d="M20 7h36l-8 10.5L56 28H20z" />
    <path className="brand-mark-lines" d="M27 12.5h18M27 17.5h13M27 22.5h16" />
    <path className="brand-mark-pole" d="M14 5.5a3 3 0 0 1 6 0V42h-6z" />
    <path className="brand-mark-pole" d="M11.5 42h11L17 60z" />
    <path className="brand-mark-slit" d="M17 45.5v8.5" />
  </svg>;
}

export function BrandWordmark({ tagline }: { tagline?: string }) {
  return <span className="brand-wordmark"><span>HackDraft</span>{tagline && <small>{tagline}</small>}</span>;
}

export function BrandLockup({ tagline }: { tagline?: string }) {
  return <span className="brand-lockup"><BrandMark /><BrandWordmark tagline={tagline} /></span>;
}
