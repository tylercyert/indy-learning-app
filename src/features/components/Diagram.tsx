import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ComponentV1 } from '../../contracts/components';
import { colors, fonts, palette } from '../theme';

type DiagramComponent = Extract<ComponentV1, { type: 'diagram' }>;

const NODE_H = 48;
const PAD = 8;
const ROW_PITCH = 92;
const MAX_COLS_PHONE = 3;

/**
 * Boxes joined by straight lines, laid out ORDINALLY: the model's x/y values only decide which
 * column and row a node sits in; columns and rows are then spaced evenly for the real width, so
 * nodes can never overlap whatever the grid numbers were. Edge labels sit at a third of the edge,
 * alternate above/below, and only draw when the edge is long enough to carry them.
 * The required altText is the accessible content; it is shown visibly only when short.
 */
export function Diagram({ component }: { component: DiagramComponent }) {
  const [width, setWidth] = useState(0);

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

  const gap = 10;
  const nodeW = width > 0 ? Math.max(72, Math.min(120, (width - PAD * 2 - gap * (layout.cols - 1)) / layout.cols)) : 100;
  const height = PAD * 2 + NODE_H + (layout.rows - 1) * ROW_PITCH;
  const colX = (col: number) => (layout.cols === 1 ? width / 2 : PAD + nodeW / 2 + col * ((width - PAD * 2 - nodeW) / (layout.cols - 1)));
  const rowY = (row: number) => PAD + NODE_H / 2 + row * ROW_PITCH;
  const byId = new Map(layout.nodes.map((n) => [n.id, n] as const));
  const showAlt = component.altText.length <= 160;

  return (
    <View style={styles.card}>
      {component.title ? <Text style={styles.title}>{component.title}</Text> : null}
      <View style={{ height }} role="img" aria-label={component.altText} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 &&
          component.edges.map((edge, i) => {
            const a = byId.get(edge.from);
            const b = byId.get(edge.to);
            if (!a || !b) return null;
            const p = { cx: colX(a.col), cy: rowY(a.row) };
            const q = { cx: colX(b.col), cy: rowY(b.row) };
            const dx = q.cx - p.cx;
            const dy = q.cy - p.cy;
            const len = Math.hypot(dx, dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            // Trim so the line runs between box edges, not centers.
            const trimA = edgeInset(dx, dy, nodeW, NODE_H);
            const drawn = Math.max(0, len - trimA * 2);
            return (
              <View
                key={`e${i}`}
                aria-hidden
                style={[
                  styles.edge,
                  edge.style === 'dashed' && styles.edgeDashed,
                  { width: drawn, left: (p.cx + q.cx) / 2 - drawn / 2, top: (p.cy + q.cy) / 2 - 1.5, transform: [{ rotate: `${angle}deg` }] },
                ]}
              >
                {edge.style !== 'line' && <View style={styles.arrowHead} />}
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
                style={[
                  styles.node,
                  node.shape === 'circle' && { borderRadius: NODE_H / 2 },
                  node.shape === 'pill' && { borderRadius: 999 },
                  { width: nodeW, left: colX(node.col) - nodeW / 2, top: rowY(node.row) - NODE_H / 2, backgroundColor: c.fill, borderBottomColor: c.shadow },
                ]}
              >
                <Text style={[styles.nodeText, { color: c.text, fontSize: nodeW < 90 ? 11 : 12 }]} numberOfLines={3}>
                  {node.label}
                </Text>
              </View>
            );
          })}
        {width > 0 &&
          component.edges.map((edge, i) => {
            if (!edge.label) return null;
            const a = byId.get(edge.from);
            const b = byId.get(edge.to);
            if (!a || !b) return null;
            const p = { cx: colX(a.col), cy: rowY(a.row) };
            const q = { cx: colX(b.col), cy: rowY(b.row) };
            const len = Math.hypot(q.cx - p.cx, q.cy - p.cy);
            const inset = edgeInset(q.cx - p.cx, q.cy - p.cy, nodeW, NODE_H);
            if (len - inset * 2 < 56) return null;
            // A third of the way along, alternating sides, drawn above the nodes so it is never hidden.
            const t = 0.38;
            const lx = p.cx + (q.cx - p.cx) * t;
            const ly = p.cy + (q.cy - p.cy) * t + (i % 2 === 0 ? -14 : 14);
            return (
              <View key={`l${i}`} aria-hidden style={[styles.edgeLabelWrap, { left: lx - 40, top: ly - 9, width: 80 }]}>
                <Text style={styles.edgeLabel} numberOfLines={1}>
                  {edge.label}
                </Text>
              </View>
            );
          })}
      </View>
      {showAlt ? <Text style={styles.alt}>{component.altText}</Text> : null}
    </View>
  );
}

/** Distance from a box center to its border along a direction. */
function edgeInset(dx: number, dy: number, w: number, h: number): number {
  const len = Math.hypot(dx, dy) || 1;
  const ux = Math.abs(dx / len);
  const uy = Math.abs(dy / len);
  const tx = ux > 0 ? w / 2 / ux : Infinity;
  const ty = uy > 0 ? h / 2 / uy : Infinity;
  return Math.min(tx, ty) + 4;
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 24, backgroundColor: colors.soft, gap: 10 },
  title: { fontFamily: fonts.black, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.purple },
  edge: { position: 'absolute', height: 3, backgroundColor: '#A99DD1', borderRadius: 2, justifyContent: 'center' },
  edgeDashed: { opacity: 0.55 },
  arrowHead: { position: 'absolute', right: -1, top: -4, width: 10, height: 10, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#A99DD1', transform: [{ rotate: '45deg' }] },
  edgeLabelWrap: { position: 'absolute', alignItems: 'center' },
  edgeLabel: { fontFamily: fonts.extraBold, fontSize: 11, color: '#4B4365', backgroundColor: colors.soft, paddingHorizontal: 5, borderRadius: 6 },
  node: { position: 'absolute', minHeight: NODE_H, borderRadius: 12, borderBottomWidth: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 6 },
  nodeText: { fontFamily: fonts.black, lineHeight: 14, textAlign: 'center' },
  alt: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
});
