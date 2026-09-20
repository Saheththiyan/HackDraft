import { BrandMark, BrandWordmark } from "@/components/brand";

export function LoadingScreen({ title = "Opening your workspace", description = "Gathering your challenges and write-ups.", overlay = false }: {
  title?: string;
  description?: string;
  overlay?: boolean;
}) {
  return <div className={overlay ? "loading-screen loading-screen-overlay" : "loading-screen"} role="status" aria-live="polite" aria-label={title}>
    <div className="loading-card">
      <div className="loading-brand"><BrandMark size={32} /><BrandWordmark /></div>
      <div className="loading-art" aria-hidden="true">
        <div className="loading-sheet"><span /><span /><span /><span /></div>
        <div className="loading-pen" />
        <div className="loading-spark loading-spark-one" />
        <div className="loading-spark loading-spark-two" />
      </div>
      <p className="loading-kicker">WORK IN PROGRESS <span className="loading-dots" aria-hidden="true"><i /><i /><i /></span></p>
      <h2 className="loading-title">{title}</h2>
      <p className="loading-description">{description}</p>
      <div className="loading-track" aria-hidden="true"><span /></div>
    </div>
  </div>;
}
