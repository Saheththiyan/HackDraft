"use client";
import { Document, Font, Image, Link, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { sectionTitles, type ReportSnapshot } from "@/lib/writeup";

type MdNode = { type: string; value?: string; url?: string; depth?: number; ordered?: boolean; children?: MdNode[] };
const colors = { ink: "#172234", muted: "#526174", green: "#047857", line: "#d9e2e8", pale: "#f4f8f7" };
const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 55, paddingHorizontal: 54, fontFamily: "Noto", fontSize: 9.5, color: colors.ink, lineHeight: 1.5 },
  cover: { paddingTop: 115, paddingHorizontal: 62, fontFamily: "Noto", color: colors.ink },
  brand: { fontSize: 11, fontWeight: 700, color: colors.green, letterSpacing: 2 },
  coverTitle: { marginTop: 38, fontSize: 31, fontWeight: 700, lineHeight: 1.2 },
  subtitle: { marginTop: 14, fontSize: 15, color: colors.muted },
  coverRule: { height: 5, width: 90, marginTop: 38, backgroundColor: colors.green },
  coverMeta: { marginTop: 44, fontSize: 10, color: colors.muted },
  kicker: { fontSize: 8, fontWeight: 700, color: colors.green, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { marginTop: 10, marginBottom: 8, fontSize: 22, fontWeight: 700, lineHeight: 1.25 },
  heading: { marginTop: 22, marginBottom: 9, fontSize: 13, fontWeight: 700, color: colors.ink },
  subheading: { marginTop: 14, marginBottom: 6, fontSize: 11, fontWeight: 700 },
  meta: { marginBottom: 20, fontSize: 9, color: colors.muted },
  paragraph: { marginBottom: 8, lineHeight: 1.5 },
  codeBlock: { marginVertical: 9, padding: 10, backgroundColor: colors.pale, borderLeftWidth: 2, borderLeftColor: colors.green },
  code: { fontFamily: "NotoMono", fontSize: 8, lineHeight: 1.35 },
  inlineCode: { fontFamily: "NotoMono", fontSize: 8.5, color: colors.green },
  listRow: { flexDirection: "row", marginBottom: 5 },
  listMark: { width: 20, color: colors.green },
  listContent: { flex: 1 },
  quote: { borderLeftWidth: 2, borderLeftColor: colors.green, paddingLeft: 10, marginVertical: 8, color: colors.muted },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 12 },
  tocRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  tocNumber: { width: 28, color: colors.green, fontWeight: 700 },
  tocName: { flex: 1 },
  summaryRow: { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.line },
  summaryName: { width: "52%" }, summaryCategory: { width: "25%", color: colors.muted }, summaryPoints: { width: "23%", textAlign: "right", color: colors.muted },
  image: { maxWidth: "100%", maxHeight: 340, objectFit: "contain", marginTop: 10 },
  caption: { marginTop: 4, marginBottom: 12, fontSize: 8, color: colors.muted },
  footer: { position: "absolute", bottom: 25, left: 54, right: 54, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: colors.muted },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line },
  tableCell: { flex: 1, padding: 5 },
});
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const origin = window.location.origin;
  Font.register({ family: "Noto", fonts: [
    { src: `${origin}/fonts/NotoSans-Regular.ttf`, fontWeight: 400 },
    { src: `${origin}/fonts/NotoSans-Bold.ttf`, fontWeight: 700 },
  ] });
  Font.register({ family: "NotoMono", src: `${origin}/fonts/NotoSansMono-Regular.ttf` });
  fontsRegistered = true;
}
function plain(node: MdNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(plain).join(node.type === "paragraph" ? "" : " ");
}
function inline(nodes: MdNode[]): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`;
    if (node.type === "strong") return <Text key={key} style={{ fontWeight: 700 }}>{inline(node.children ?? [])}</Text>;
    if (node.type === "emphasis") return <Text key={key} style={{ fontStyle: "italic" }}>{inline(node.children ?? [])}</Text>;
    if (node.type === "inlineCode") return <Text key={key} style={styles.inlineCode}>{node.value}</Text>;
    if (node.type === "link" && node.url && /^https?:\/\//i.test(node.url)) return <Link key={key} src={node.url} style={{ color: colors.green }}>{inline(node.children ?? [])}</Link>;
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
    if (node.type === "list") return <View key={key}>{(node.children ?? []).map((item, itemIndex) => <View key={itemIndex} style={styles.listRow}><Text style={styles.listMark}>{node.ordered ? `${itemIndex + 1}.` : "•"}</Text><Text style={styles.listContent}>{plain(item)}</Text></View>)}</View>;
    if (node.type === "blockquote") return <View key={key} style={styles.quote}><Text>{plain(node)}</Text></View>;
    if (node.type === "thematicBreak") return <View key={key} style={styles.rule} />;
    if (node.type === "table") return <View key={key}>{(node.children ?? []).map((row, rowIndex) => <View key={rowIndex} style={styles.tableRow}>{(row.children ?? []).map((cell, cellIndex) => <Text key={cellIndex} style={[styles.tableCell, rowIndex === 0 ? { fontWeight: 700 } : {}]}>{plain(cell)}</Text>)}</View>)}</View>;
    return null;
  });
}
function Footer({ title }: { title: string }) {
  return <View style={styles.footer} fixed><Text>{title}</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>;
}
function ReportPdf({ content, imageData }: { content: ReportSnapshot; imageData: Record<string, string> }) {
  return <Document title={`${content.title} — CTF report`} author="HackDraft" subject="CTF challenge write-ups">
    <Page size="A4" style={styles.cover}><Text style={styles.brand}>HACKDRAFT / CTF REPORT</Text><Text style={styles.coverTitle}>{content.title}</Text><Text style={styles.subtitle}>Challenge write-ups</Text><View style={styles.coverRule} /><Text style={styles.coverMeta}>{content.eventDate ? `Event date: ${content.eventDate}\n` : ""}{content.challenges.length} reviewed {content.challenges.length === 1 ? "challenge" : "challenges"}</Text><Footer title={content.title} /></Page>
    <Page size="A4" style={styles.page}><Text style={styles.kicker}>Overview</Text><Text style={styles.title}>Contents</Text>{content.description && <Text style={styles.paragraph}>{content.description}</Text>}{content.challenges.map((challenge, index) => <View style={styles.tocRow} key={challenge.id}><Text style={styles.tocNumber}>{String(index + 1).padStart(2, "0")}</Text><Link src={`#challenge-${challenge.id}`} style={styles.tocName}>{challenge.name}</Link></View>)}<Text style={styles.heading}>Challenge summary</Text><View style={styles.summaryRow}><Text style={[styles.summaryName, { fontWeight: 700 }]}>Challenge</Text><Text style={[styles.summaryCategory, { fontWeight: 700 }]}>Category</Text><Text style={[styles.summaryPoints, { fontWeight: 700 }]}>Points</Text></View>{content.challenges.map(challenge => <View style={styles.summaryRow} key={challenge.id}><Text style={styles.summaryName}>{challenge.name}</Text><Text style={styles.summaryCategory}>{challenge.category || "General"}</Text><Text style={styles.summaryPoints}>{challenge.points ?? "—"}</Text></View>)}<Footer title={content.title} /></Page>
    {content.challenges.map((challenge, index) => <Page key={challenge.id} size="A4" style={styles.page}><Text style={styles.kicker}>Challenge {index + 1} · {challenge.category || "General"}</Text><Text id={`challenge-${challenge.id}`} style={styles.title}>{challenge.name}</Text><Text style={styles.meta}>{[challenge.points != null ? `${challenge.points} points` : "", challenge.author ? `Solved by ${challenge.author}` : ""].filter(Boolean).join(" · ")}</Text>
      {challenge.sections.filter(section => section.markdown.trim() || section.evidenceIds.length).map(section => <View key={section.id}><Text style={styles.heading} minPresenceAhead={40}>{sectionTitles[section.id]}</Text>{markdownBlocks(section.markdown, `${challenge.id}-${section.id}`)}{section.evidenceIds.map(id => { const image = challenge.evidence.find(item => item.id === id); return image && imageData[id] ? <View key={id} wrap={false}>
        {/* react-pdf Image has no alt prop; the following caption provides accessible text in the report. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={imageData[id]} style={styles.image} />
        <Text style={styles.caption}>{image.caption || "Screenshot"}</Text>
      </View> : null; })}</View>)}<Footer title={content.title} /></Page>)}
  </Document>;
}
export async function generateReportPdf(content: ReportSnapshot, imageData: Record<string, string>) {
  registerFonts();
  return pdf(<ReportPdf content={content} imageData={imageData} />).toBlob();
}
