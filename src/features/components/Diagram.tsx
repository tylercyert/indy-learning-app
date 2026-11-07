import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { diagramCollisions, type ComponentV1 } from '../../contracts/components';
import { colors, fonts, palette } from '../theme';

type DiagramComponent = Extract<ComponentV1, { type: 'diagram' }>;
type DNode = DiagramComponent['nodes'][number];

const NODE_W = 100;
const NODE_H = 46;
const PAD = 8;

/**
 * Boxes on a 0-100 grid joined by straight lines. Plain views, no SVG dependency.
 * Readability is enforced twice: the contract rejects nodes too close together, and if stored
 * content still collides (older documents), the renderer re-lays the nodes out on a clean grid.
 * Edge labels are drawn only when the edge is long enough to carry them. The required altText
 * carries the meaning for screen readers.
 */
export function Diagram({ component }: { component: DiagramComponent }) {
  const [width, setWidth] = useState(0);
  const nodes = useMemo(() => (diagramCollisions(component.nodes).length ? autoLayout(component.nodes) : component.nodes), [component.nodes]);
  const rows = new Set(nodes.map((n) => n.y)).size;
  const height = Math.max(160, Math.min(360, rows * 78 + 60));
  const pos = (x: number, y: number) => ({
    cx: PAD + NODE_W / 2 + (x / 100) * (width - NODE_W - PAD * 2),
    cy: PAD + NODE_H / 2 + (y / 100) * (height - NODE_H - PAD * 2),
  });
  const byId = new Map(nodes.map((n) => [n.id, n] as const));

  return (
    <View style={styles.card}>
      {component.title ? <Text style={styles.title}>{component.title}</Text> : null}
      <View style={{ height }} role="img" aria-label={component.altText} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 &&
          component.edges.map((edge, i) => {
            const a = byId.get(edge.from);
            const b = byId.get(edge.to);
            if (!a || !b) return null;
            const p = pos(a.x, a.y);
            const q = pos(b.x, b.y);
            const dx = q.cx - p.cx;
            const dy = q.cy - p.cy;
            const len = Math.hypot(dx, dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            // Trim the line so it starts and ends at the box edges rather than the centers.
            const trim = Math.min(len / 2 - 4, Math.max(NODE_W, NODE_H) / 2);
            const drawn = Math.max(0, len - trim * 2);
            const showLabel = !!edge.label && drawn > 110;
            return (
              <View
                key={i}
                aria-hidden
                style={[
                  styles.edge,
                  edge.style === 'dashed' && styles.edgeDashed,
                  { width: drawn, left: (p.cx + q.cx) / 2 - drawn / 2, top: (p.cy + q.cy) / 2 - 1.5, transform: [{ rotate: `${angle}deg` }] },
                ]}
              >
                {edge.style !== 'line' && <View style={styles.arrowHead} />}
                {showLabel ? (
                  <View style={[styles.edgeLabelWrap, { transform: [{ rotate: `${-angle}deg` }] }]}>
                    <Text style={styles.edgeLabel} numberOfLines={1}>
                      {edge.label}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        {width > 0 &&
          nodes.map((node) => {
            const p = pos(node.x, node.y);
            const c = palette[node.color ?? 'neutral'];
            return (
              <View
                key={node.id}
                aria-hidden
                style={[
                  styles.node,
                  node.shape === 'circle' && styles.nodeCircle,
                  node.shape === 'pill' && styles.nodePill,
                  { left: p.cx - NODE_W / 2, top: p.cy - NODE_H / 2, backgroundColor: c.fill, borderBottomColor: c.shadow },
                ]}
              >
                <Text style={[styles.nodeText, { color: c.text }]}>{node.label}</Text>
              </View>
            );
          })}
      </View>
      <Text style={styles.alt}>{component.altText}</Text>
    </View>
  );
}

/** Deterministic fallback layout: rows of up to three, evenly spread, ignoring stored positions. */
function autoLayout(nodes: readonly DNode[]): DNode[] {
  const perRow = nodes.length <= 4 ? 2 : 3;
  const rows = Math.ceil(nodes.length / perRow);
  return nodes.map((n, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, nodes.length - row * perRow);
    const col = i % perRow;
    const x = inRow === 1 ? 50 : Math.round((col / (inRow - 1)) * 100);
    const y = rows === 1 ? 50 : Math.round((row / (rows - 1)) * 100);
    return { ...n, x, y };
  });
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 24, backgroundColor: colors.soft, gap: 10 },
  title: { fontFamily: fonts.black, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.purple },
  edge: { position: 'absolute', height: 3, backgroundColor: '#B8AED6', borderRadius: 2, justifyContent: 'center' },
  edgeDashed: { opacity: 0.55 },
  arrowHead: { position: 'absolute', right: -1, top: -4, width: 10, height: 10, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#B8AED6', transform: [{ rotate: '45deg' }] },
  edgeLabelWrap: { position: 'absolute', alignSelf: 'center', top: -24, backgroundColor: colors.soft, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  edgeLabel: { fontFamily: fonts.extraBold, fontSize: 11, color: colors.muted },
  // minHeight, not height: labels wrap and the box grows rather than clipping text.
  node: { position: 'absolute', width: NODE_W, minHeight: NODE_H, borderRadius: 12, borderBottomWidth: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 6 },
  nodeCircle: { borderRadius: NODE_H / 2 },
  nodePill: { borderRadius: 999 },
  nodeText: { fontFamily: fonts.black, fontSize: 12, lineHeight: 14, textAlign: 'center' },
  alt: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
});
