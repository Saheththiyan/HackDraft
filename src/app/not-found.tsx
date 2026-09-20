import Link from "next/link";
export default function NotFound() {
  return <main className="mx-auto max-w-xl px-6 py-20"><p className="page-context">Page unavailable</p><h1 className="page-title">We couldn’t find that page.</h1><p className="page-lede">The link may be outdated, or this content may not belong to your workspace.</p><Link className="cta-link mt-6" href="/dashboard">Back to workspace</Link></main>;
}
