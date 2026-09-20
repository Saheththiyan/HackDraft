"use client";
import { Document, Font, G, Image, Link, Page, Path, StyleSheet, Svg, Text, View, pdf } from "@react-pdf/renderer";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { sectionTitles, type ReportSnapshot } from "@/lib/writeup";

type MdNode = { type: string; value?: string; url?: string; depth?: number; ordered?: boolean; children?: MdNode[] };
// Same tokens as globals.css: paper/ink with one cobalt accent; orange is reserved for flags.
const colors = { ink: "#131a2b", muted: "#5b6273", faint: "#8b91a1", accent: "#2447c4", line: "#e4e4dd", surface2: "#f4f4f0" };
const styles = StyleSheet.create({
  page: { paddingTop: 60, paddingBottom: 55, paddingHorizontal: 54, fontFamily: "Sans", fontSize: 9.5, color: colors.ink, lineHeight: 1.55 },
  cover: { paddingTop: 60, paddingBottom: 55, paddingHorizontal: 54, fontFamily: "Sans", color: colors.ink },
  coverBrandRow: { flexDirection: "row", alignItems: "center", paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  brand: { marginLeft: 9, fontSize: 11, fontWeight: 600, color: colors.ink },
  coverTitle: { marginTop: 30, fontFamily: "Serif", fontSize: 30, fontWeight: 500, lineHeight: 1.2 },
  subtitle: { marginTop: 10, fontSize: 12.5, color: colors.muted, lineHeight: 1.6, maxWidth: 340 },
  coverFacts: { marginTop: 16, fontSize: 9.5, color: colors.muted, lineHeight: 1.8 },
  context: { fontSize: 8.5, color: colors.muted },
  title: { marginTop: 6, marginBottom: 8, fontFamily: "Serif", fontSize: 20, fontWeight: 500, lineHeight: 1.22 },
  heading: { marginTop: 20, marginBottom: 8, fontSize: 12.5, fontWeight: 600, color: colors.ink },
  subheading: { marginTop: 13, marginBottom: 6, fontSize: 10.5, fontWeight: 600 },
  meta: { marginBottom: 18, fontSize: 9, color: colors.muted },
  paragraph: { marginBottom: 8, lineHeight: 1.55 },
  codeBlock: { marginVertical: 9, padding: 10, backgroundColor: colors.surface2, borderLeftWidth: 2, borderLeftColor: colors.accent },
  code: { fontFamily: "Mono", fontSize: 8, lineHeight: 1.4 },
  // No backgroundColor here: react-pdf paints an inline Text's background across
  // the full line box, which produces a stray filled rectangle wherever the run wraps.
  inlineCode: { fontFamily: "Mono", fontSize: 8.5, color: colors.ink },
  listRow: { flexDirection: "row", marginBottom: 5 },
  listMark: { width: 18, color: colors.accent },
  listContent: { flex: 1 },
  quote: { borderLeftWidth: 2, borderLeftColor: colors.line, paddingLeft: 10, marginVertical: 8, color: colors.muted },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 12 },
  tocRow: { flexDirection: "row", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  tocNumber: { width: 24, color: colors.faint },
  tocName: { flex: 1, color: colors.ink, textDecoration: "none" },
  summaryRow: { flexDirection: "row", paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.line },
  summaryName: { width: "52%" }, summaryCategory: { width: "25%", color: colors.muted }, summaryPoints: { width: "23%", textAlign: "right", color: colors.muted },
  image: { maxWidth: "100%", maxHeight: 340, objectFit: "contain", marginTop: 10, borderWidth: 1, borderColor: colors.line },
  caption: { marginTop: 4, marginBottom: 12, fontSize: 8, color: colors.muted },
  footer: { position: "absolute", bottom: 25, left: 54, right: 54, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: colors.faint },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line },
  tableCell: { flex: 1, padding: 5 },
});
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const origin = window.location.origin;
  Font.register({ family: "Sans", fonts: [
    { src: `${origin}/fonts/IBMPlexSans-Regular.ttf`, fontWeight: 400 },
    { src: `${origin}/fonts/IBMPlexSans-Medium.ttf`, fontWeight: 500 },
    { src: `${origin}/fonts/IBMPlexSans-SemiBold.ttf`, fontWeight: 600 },
    { src: `${origin}/fonts/IBMPlexSans-Italic.ttf`, fontWeight: 400, fontStyle: "italic" },
  ] });
  Font.register({ family: "Serif", fonts: [
    { src: `${origin}/fonts/Newsreader24pt-Regular.ttf`, fontWeight: 400 },
    { src: `${origin}/fonts/Newsreader24pt-Medium.ttf`, fontWeight: 500 },
    { src: `${origin}/fonts/Newsreader24pt-Italic.ttf`, fontWeight: 400, fontStyle: "italic" },
  ] });
  Font.register({ family: "Mono", src: `${origin}/fonts/IBMPlexMono-Regular.ttf` });
  Font.registerHyphenationCallback(word => [word]);
  fontsRegistered = true;
}
// Same pen-nib-and-flag mark as components/brand.tsx, redrawn with react-pdf's SVG primitives.
function BrandMark({ size = 20 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path d="M20 7h36l-8 10.5L56 28H20z" fill={colors.accent} />
    <G stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round">
      <Path d="M27 12.5h18" /><Path d="M27 17.5h13" /><Path d="M27 22.5h16" />
    </G>
    <Path d="M14 5.5a3 3 0 0 1 6 0V42h-6z" fill={colors.ink} />
    <Path d="M11.5 42h11L17 60z" fill={colors.ink} />
  </Svg>;
}
function plain(node: MdNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(plain).join(node.type === "paragraph" ? "" : " ");
}
function inline(nodes: MdNode[]): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`;
    if (node.type === "strong") return <Text key={key} style={{ fontWeight: 600 }}>{inline(node.children ?? [])}</Text>;
    if (node.type === "emphasis") return <Text key={key} style={{ fontStyle: "italic" }}>{inline(node.children ?? [])}</Text>;
    if (node.type === "inlineCode") return <Text key={key} style={styles.inlineCode}>{node.value}</Text>;
    if (node.type === "link" && node.url && /^https?:\/\//i.test(node.url)) return <Link key={key} src={node.url} style={{ color: colors.accent }}>{inline(node.children ?? [])}</Link>;
    if (node.type === "break") return <Text key={key}>{"\n"}</Text>;
    if (node.type === "image" || node.type === "html") return null;
    if (node.children) return <Text key={key}>{inline(node.children)}</Text>;
    return <Text key={key}>{node.value ?? ""}</Text>;
  });
}
function markdownBlocks(markdown: string, prefix: string) {
  const root = unified().use(remarkParse).use(remarkGfm).parse(markdown) as unknown as MdNode;
  return (root.children ?? []).map((node, index) => {
    const key = `${prefix}-${index}`;
    if (node.type === "paragraph") return <Text key={key} style={styles.paragraph}>{inline(node.children ?? [])}</Text>;
    if (node.type === "heading") return <Text key={key} style={node.depth === 1 ? styles.heading : styles.subheading}>{inline(node.children ?? [])}</Text>;
    if (node.type === "code") return <View key={key} style={styles.codeBlock}><Text style={styles.code}>{node.value ?? ""}</Text></View>;
    if (node.type === "list") return <View key={key}>{(node.children ?? []).map((item, itemIndex) => <View key={itemIndex} style={styles.listRow}><Text style={styles.listMark}>{node.ordered ? `${itemIndex + 1}.` : "–"}</Text><Text style={styles.listContent}>{plain(item)}</Text></View>)}</View>;
    if (node.type === "blockquote") return <View key={key} style={styles.quote}><Text>{plain(node)}</Text></View>;
    if (node.type === "thematicBreak") return <View key={key} style={styles.rule} />;
    if (node.type === "table") return <View key={key}>{(node.children ?? []).map((row, rowIndex) => <View key={rowIndex} style={styles.tableRow}>{(row.children ?? []).map((cell, cellIndex) => <Text key={cellIndex} style={[styles.tableCell, rowIndex === 0 ? { fontWeight: 600 } : {}]}>{plain(cell)}</Text>)}</View>)}</View>;
    return null;
  });
}
function Footer({ title }: { title: string }) {
  return <View style={styles.footer} fixed><Text>{title}</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>;
}
function ReportPdf({ content, imageData, createdAt }: { content: ReportSnapshot; imageData: Record<string, string>; createdAt?: string }) {
  const count = `${content.challenges.length} reviewed ${content.challenges.length === 1 ? "challenge" : "challenges"}`;
  return <Document title={`${content.title} — CTF report`} author="HackDraft" subject="CTF challenge write-ups">
    <Page size="A4" style={styles.cover}>
      <View style={styles.coverBrandRow}><BrandMark size={20} /><Text style={styles.brand}>HackDraft</Text></View>
      <Text style={styles.context}>{createdAt ? `Saved report, ${new Date(createdAt).toLocaleString()}` : "Saved report"}</Text>
      <Text style={styles.coverTitle}>{content.title}</Text>
      <Text style={styles.subtitle}>{count}. The write-ups and screenshots that follow are fixed as they were when this report was saved.</Text>
      {content.eventDate && <Text style={styles.coverFacts}>Event date {content.eventDate}</Text>}
      <Footer title={content.title} />
    </Page>
    <Page size="A4" style={styles.page}>
      <Text style={styles.context}>Contents</Text>
      {content.description && <Text style={[styles.paragraph, { marginTop: 8 }]}>{content.description}</Text>}
      <View style={{ marginTop: 8 }}>{content.challenges.map((challenge, index) => <View style={styles.tocRow} key={challenge.id}><Text style={styles.tocNumber}>{index + 1}</Text><Link src={`#challenge-${challenge.id}`} style={styles.tocName}>{challenge.name}</Link></View>)}</View>
      <Text style={styles.heading}>Challenge summary</Text>
      <View style={styles.summaryRow}><Text style={[styles.summaryName, { fontWeight: 600 }]}>Challenge</Text><Text style={[styles.summaryCategory, { fontWeight: 600 }]}>Category</Text><Text style={[styles.summaryPoints, { fontWeight: 600 }]}>Points</Text></View>
      {content.challenges.map(challenge => <View style={styles.summaryRow} key={challenge.id}><Text style={styles.summaryName}>{challenge.name}</Text><Text style={styles.summaryCategory}>{challenge.category || "General"}</Text><Text style={styles.summaryPoints}>{challenge.points ?? "—"}</Text></View>)}
      <Footer title={content.title} />
    </Page>
    {content.challenges.map((challenge, index) => <Page key={challenge.id} size="A4" style={styles.page}><Text style={styles.context}>Challenge {index + 1}{challenge.category ? `, ${challenge.category}` : ""}</Text><Text id={`challenge-${challenge.id}`} style={styles.title}>{challenge.name}</Text><Text style={styles.meta}>{[challenge.points != null ? `${challenge.points} points` : "", challenge.author ? `Solved by ${challenge.author}` : ""].filter(Boolean).join(" · ")}</Text>
      {challenge.sections.filter(section => section.markdown.trim() || section.evidenceIds.length).map(section => <View key={section.id}><Text style={styles.heading} minPresenceAhead={40}>{sectionTitles[section.id]}</Text>{markdownBlocks(section.markdown, `${challenge.id}-${section.id}`)}{section.evidenceIds.map(id => { const image = challenge.evidence.find(item => item.id === id); return image && imageData[id] ? <View key={id} wrap={false}>
        {/* react-pdf Image has no alt prop; the following caption provides accessible text in the report. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={imageData[id]} style={styles.image} />
        <Text style={styles.caption}>{image.caption || "Screenshot"}</Text>
      </View> : null; })}</View>)}<Footer title={content.title} /></Page>)}
  </Document>;
}
export async function generateReportPdf(content: ReportSnapshot, imageData: Record<string, string>, createdAt?: string) {
  registerFonts();
  return pdf(<ReportPdf content={content} imageData={imageData} createdAt={createdAt} />).toBlob();
}
