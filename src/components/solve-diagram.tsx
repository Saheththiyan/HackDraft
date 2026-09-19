export function SolveDiagram() {
  return <div className="solve-diagram" aria-label="Turn solve notes and evidence into a reviewed report">
    <div className="diagram-heading"><span>THE SOLVE → THE STORY</span><span aria-hidden="true">✳</span></div>
    <div className="diagram-note"><span className="diagram-file">01 / FIELD NOTES</span><code><span>$</span> capture the breakthrough</code><div className="diagram-lines" aria-hidden="true"><i /><i /><i /></div><span className="diagram-tag">notes + evidence</span></div>
    <div className="diagram-connector" aria-hidden="true"><span>↓</span><span>shape · review</span></div>
    <div className="diagram-document"><div><span className="diagram-file">02 / THE WRITE-UP</span><strong>Every step. Accounted for.</strong></div><span className="diagram-check" aria-hidden="true">✓</span><div className="diagram-document-footer"><span>Overview · Solution · Flag</span><span>PDF / DOCX ↗</span></div></div>
  </div>;
}
