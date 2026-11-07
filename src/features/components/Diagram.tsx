import { useMemo, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import type { ComponentV1 } from '../../contracts/components';
import { colors, fonts, palette } from '../theme';
import { LABEL_FONT, LABEL_LINE_H, edgeInset, fitLabel, labelWidth, nodeWidthFor, overlaps, type Rect } from './diagram-layout';

type DiagramComponent = Extract<ComponentV1, { type: 'diagram' }>;

/** Default node height until the real one is measured (labels wrap to up to 3 lines; text may be scaled). */
const NODE_H = 48;
const PAD = 8;
/** Vertical space between rows: room for an arrow and a label beside it. */
const ROW_GAP = 44;
/** Columns can never sit closer than this, so a horizontal edge always has a visible shaft. */
const MIN_COL_GAP = 28;
const MAX_COLS_PHONE = 3;
/**
 * A node taller than this means its label no longer fits three lines at the default text size
 * (3 × 14px + padding = 54px): the learner has large text on, and a spatial canvas would only clip.
 */
const CRAMPED_NODE_H = NODE_H * 1.6;
const CRAMPED_FONT_SCALE = 1.5;

/**
 * Boxes joined by straight lines, laid out ORDINALLY: the model's x/y values only decide which
 * column and row a node sits in; columns and rows are then spaced evenly for the real width, so
 * nodes can never overlap whatever the grid numbers were. Row pitch follows the measured node
 * height, so 3-line labels and large accessibility text sizes push rows apart instead of colliding.
 *
 * Edge labels: an estimated text width decides whether a label fits on one line, two lines, or
 * not at all; candidate spots sit along the edge and are offset perpendicular to it, and a spot is
 * rejected when it touches a node or an already placed label. A label that finds no spot is never
 * dropped: it moves to the legend under the canvas, which also takes over entirely when more
 * than four edges carry labels. The required altText is the accessible content and is shown
 * visibly only when short.
 *
 * Large text: when the OS text scale is high, or the measured nodes show that labels no longer fit
 * three lines, the canvas gives way to a list: every node as a full-width chip and every edge as a
 * legend line. Nothing is clipped and the same information is conveyed, only without geometry.
 */
export function Diagram({ component }: { component: DiagramComponent }) {
  const [width, setWidth] = useState(0);
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});

  const layout = useMemo(() => {
    const xs = [...new Set(component.nodes.map((n) => n.x))].sort((a, b) => a - b);
    const ys = [...new Set(component.nodes.map((n) => n.y))].sort((a, b) => a - b);
    const maxCols = width > 0 && width < 560 ? MAX_COLS_PHONE : 4;
    if (xs.length <= maxCols) {
      return { nodes: component.nodes.map((n) => ({ ...n, col: xs.indexOf(n.x), row: ys.indexOf(n.y) })), cols: xs.length, rows: ys.length };
    }
    // Too many distinct columns for this width: reflow into rows of maxCols, preserving reading order.
    const ordered = [...component.nodes].sort((a, b) => a.y - b.y || a.x - b.x);
    const nodes = ordered.map((n, i) => ({ ...n, col: i % maxCols, row: Math.floor(i / maxCols) }));
    return { nodes, cols: Math.min(maxCols, ordered.length), rows: Math.ceil(ordered.length / maxCols) };
  }, [component.nodes, width]);

  const nodeW = width > 0 ? nodeWidthFor(width, layout.cols, PAD, MIN_COL_GAP) : 100;
  const nodeH = (id: string) => nodeHeights[id] ?? NODE_H;
  const rowH = Math.max(NODE_H, ...layout.nodes.map((n) => nodeH(n.id)));
  const rowPitch = rowH + ROW_GAP;
  const height = PAD * 2 + rowH + (layout.rows - 1) * rowPitch;
  const colX = (col: number) => (layout.cols === 1 ? width / 2 : PAD + nodeW / 2 + col * ((width - PAD * 2 - nodeW) / (layout.cols - 1)));
  const rowY = (row: number) => PAD + rowH / 2 + row * rowPitch;
  const byId = new Map(layout.nodes.map((n) => [n.id, n] as const));
  const showAlt = component.altText.length <= 160;

  const onNodeLayout = (id: string) => (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setNodeHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  };

  const cramped = PixelRatio.getFontScale() >= CRAMPED_FONT_SCALE || layout.nodes.some((n) => nodeH(n.id) > CRAMPED_NODE_H);
  if (cramped) {
    const label = (id: string) => byId.get(id)?.label ?? id;
    return (
      <View style={styles.card}>
        {component.title ? <Text style={styles.title}>{component.title}</Text> : null}
        <View style={styles.chips}>
          {layout.nodes.map((node) => {
            const c = palette[node.color ?? 'neutral'];
            return (
              <View key={node.id} style={[styles.chip, { backgroundColor: c.fill, borderBottomColor: c.shadow }]}>
                <Text style={[styles.chipText, { color: c.text }]}>{node.label}</Text>
              </View>
            );
          })}
        </View>
        {component.edges.length > 0 ? (
          <View style={styles.legend}>
            {component.edges.map((edge, i) => (
              <Text key={`g${i}`} style={styles.legendLine}>
                {label(edge.from)} → {label(edge.to)}
                {edge.label ? `: ${edge.label}` : ''}
              </Text>
            ))}
          </View>
        ) : null}
        {showAlt ? <Text style={styles.alt}>{component.altText}</Text> : null}
      </View>
    );
  }

  // Geometry per edge: centers, direction, and the shaft between box borders (not centers).
  const edges = component.edges.flatMap((edge, index) => {
    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    if (!a || !b) return [];
    const p = { x: colX(a.col), y: rowY(a.row) };
    const q = { x: colX(b.col), y: rowY(b.row) };
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const startInset = edgeInset(dx, dy, nodeW, nodeH(a.id));
    const endInset = edgeInset(dx, dy, nodeW, nodeH(b.id));
    const drawn = Math.max(0, len - startInset - endInset);
    // Midpoint of the visible shaft, not of the center-to-center line.
    const mid = { x: p.x + (dx / len) * (startInset + drawn / 2), y: p.y + (dy / len) * (startInset + drawn / 2) };
    return [{ edge, index, p, q, dx, dy, len, drawn, mid, ux: dx / len, uy: dy / len }];
  });

  const nodeRects = layout.nodes.map((n) => ({ x: colX(n.col) - nodeW / 2, y: rowY(n.row) - nodeH(n.id) / 2, w: nodeW, h: nodeH(n.id) }));
  const placed: Rect[] = [];
  const hits = (r: Rect) => nodeRects.some((n) => overlaps(r, n, 4)) || placed.some((l) => overlaps(r, l, 2));
  const labeledEdges = edges.filter((e) => !!e.edge.label);
  const inlineAllowed = width > 0 && labeledEdges.length <= 4;
  const maxLabelW = Math.min(120, Math.max(72, width / 3));

  const inline: { key: string; x: number; y: number; w: number; lines: string[] }[] = [];
  const legend: typeof labeledEdges = [];
  for (const e of labeledEdges) {
    const label = e.edge.label!;
    const lines = inlineAllowed ? fitLabel(label, maxLabelW) : null;
    if (!lines) {
      legend.push(e);
      continue;
    }
    const w = Math.max(...lines.map(labelWidth));
    const h = lines.length * LABEL_LINE_H;
    // Perpendicular offset puts the label beside the shaft: above/below a horizontal edge, left/right of a
    // vertical one. The clearance is the label's own extent along that normal, so it never covers the shaft.
    // Sitting on the shaft (offset 0, the label has an opaque background) is the last resort before the legend.
    const nx = -e.uy;
    const ny = e.ux;
    const extent = (Math.abs(nx) * w + Math.abs(ny) * h) / 2;
    // On a diagonal the bounding box overstates the label, so the first try hugs the shaft (a corner of
    // the label background may touch the line); axis-aligned edges get full clearance right away.
    const axisAligned = Math.abs(e.ux) < 0.05 || Math.abs(e.uy) < 0.05;
    const tight = axisAligned ? extent + 2 : extent * 0.55 + 4;
    const side = e.index % 2 === 0 ? 1 : -1;
    const along = [0, -0.12, 0.12].map((t) => e.drawn * t);
    const offsets = [...[side, -side].flatMap((s) => [s * tight, s * (extent + 10)]), 0];
    let spot: Rect | null = null;
    for (const d of along) {
      for (const off of offsets) {
        const cx = e.mid.x + e.ux * d + nx * off;
        const cy = e.mid.y + e.uy * d + ny * off;
        const r = { x: cx - w / 2, y: cy - h / 2, w, h };
        if (r.x < 0 || r.x + w > width) continue;
        if (!hits(r)) {
          spot = r;
          break;
        }
      }
      if (spot) break;
    }
    if (!spot) {
      legend.push(e);
      continue;
    }
    placed.push(spot);
    inline.push({ key: `l${e.index}`, x: spot.x, y: spot.y, w, lines });
  }

  return (
    <View style={styles.card}>
      {component.title ? <Text style={styles.title}>{component.title}</Text> : null}
      <View style={{ height }} role="img" aria-label={component.altText} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 &&
          edges.map((e) => {
            const angle = (Math.atan2(e.dy, e.dx) * 180) / Math.PI;
            return (
              <View
                key={`e${e.index}`}
                aria-hidden
                style={[
                  styles.edge,
                  e.edge.style === 'dashed' && styles.edgeDashed,
                  { width: e.drawn, left: e.mid.x - e.drawn / 2, top: e.mid.y - 1.5, transform: [{ rotate: `${angle}deg` }] },
                ]}
              >
                {e.edge.style !== 'line' && <View style={styles.arrowHead} />}
              </View>
            );
          })}
        {width > 0 &&
          layout.nodes.map((node) => {
            const c = palette[node.color ?? 'neutral'];
            return (
              <View
                key={node.id}
                aria-hidden
                onLayout={onNodeLayout(node.id)}
                style={[
                  styles.node,
                  node.shape === 'circle' && { borderRadius: NODE_H / 2 },
                  node.shape === 'pill' && { borderRadius: 999 },
                  { width: nodeW, left: colX(node.col) - nodeW / 2, top: rowY(node.row) - nodeH(node.id) / 2, backgroundColor: c.fill, borderBottomColor: c.shadow },
                ]}
              >
                <Text style={[styles.nodeText, { color: c.text, fontSize: nodeW < 90 ? 11 : 12 }]} numberOfLines={3}>
                  {node.label}
                </Text>
              </View>
            );
          })}
        {inline.map((l) => (
          <View key={l.key} aria-hidden style={[styles.edgeLabelWrap, { left: l.x, top: l.y, width: l.w }]}>
            {l.lines.map((line, i) => (
              <Text key={i} style={styles.edgeLabel} numberOfLines={1}>
                {line}
              </Text>
            ))}
          </View>
        ))}
      </View>
      {legend.length > 0 ? (
        <View style={styles.legend}>
          {legend.map((e) => (
            <Text key={`g${e.index}`} style={styles.legendLine}>
              {byId.get(e.edge.from)?.label ?? e.edge.from} → {byId.get(e.edge.to)?.label ?? e.edge.to}: {e.edge.label}
            </Text>
          ))}
        </View>
      ) : null}
      {showAlt ? <Text style={styles.alt}>{component.altText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 24, backgroundColor: colors.soft, gap: 10 },
  title: { fontFamily: fonts.black, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.purple },
  edge: { position: 'absolute', height: 3, backgroundColor: '#A99DD1', borderRadius: 2, justifyContent: 'center' },
  edgeDashed: { opacity: 0.55 },
  arrowHead: { position: 'absolute', right: -1, top: -4, width: 10, height: 10, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#A99DD1', transform: [{ rotate: '45deg' }] },
  edgeLabelWrap: { position: 'absolute', alignItems: 'center', backgroundColor: colors.soft, borderRadius: 6 },
  edgeLabel: { fontFamily: fonts.extraBold, fontSize: LABEL_FONT, lineHeight: LABEL_LINE_H, color: '#4B4365', paddingHorizontal: 5, textAlign: 'center' },
  node: { position: 'absolute', minHeight: NODE_H, borderRadius: 12, borderBottomWidth: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 6 },
  nodeText: { fontFamily: fonts.black, lineHeight: 14, textAlign: 'center' },
  alt: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  legend: { gap: 2 },
  legendLine: { fontFamily: fonts.bold, fontSize: 12, color: '#4B4365' },
  chips: { gap: 8 },
  chip: { borderRadius: 12, borderBottomWidth: 4, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontFamily: fonts.black, fontSize: 14 },
});
