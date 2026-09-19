import Image from "next/image";

export function BrandMark({ className = "" }: { className?: string }) {
  return <span className={`brand-mark-image ${className}`} aria-hidden="true"><Image src="/brand/hackdraft-mark.png" alt="" width={160} height={88} priority className="brand-mark-image-art" /></span>;
}

export function BrandLockupImage({ className = "" }: { className?: string }) {
  return <Image src="/brand/hackdraft-lockup.png" alt="HackDraft — CTF documentation platform" width={420} height={230} priority className={`brand-lockup-image ${className}`} />;
}
