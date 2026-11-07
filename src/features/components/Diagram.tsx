import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ComponentV1 } from '../../contracts/components';
import { colors, fonts, palette } from '../theme';

type DiagramComponent = Extract<ComponentV1, { type: 'diagram' }>;

const NODE_W = 96;
const NODE_H = 44;

/**
 * Boxes on a 0-100 grid joined by straight lines. Plain views, no SVG dependency.
 * The required altText carries the meaning for screen readers.
 */
export function Diagram({ component }: { component: DiagramComponent }) {
  const [width, setWidth] = useState(0);
  const height = Math.max(180, Math.round(width * 0.7));
  const pos = (x: number, y: number) => ({
    cx: (x / 100) * (width - NODE_W) + NODE_W / 2,
    cy: (y / 100) * (height - NODE_H) + NODE_H / 2,
  });
  const byId = new Map(component.nodes.map((n) => [n.id, n] as const));

  return (
    <View style={styles.card} accessible accessibilityLabel={component.altText}>
      {component.title ? <Text style={styles.title}>{component.title}</Text> : null}
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
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
            return (
              <View
                key={i}
                aria-hidden
                style={[
                  styles.edge,
                  edge.style === 'dashed' && styles.edgeDashed,
                  {
                    width: len,
                    left: (p.cx + q.cx) / 2 - len / 2,
                    top: (p.cy + q.cy) / 2 - 1.5,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              >
                {edge.style !== 'line' && <View style={[styles.arrowHead, { right: -2 }]} />}
                {edge.label ? (
                  <Text style={[styles.edgeLabel, { transform: [{ rotate: `${-angle}deg` }] }]}>{edge.label}</Text>
                ) : null}
              </View>
            );
          })}
        {width > 0 &&
          component.nodes.map((node) => {
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
                <Text style={[styles.nodeText, { color: c.text }]} numberOfLines={2}>
                  {node.label}
                </Text>
              </View>
            );
          })}
      </View>
      <Text style={styles.alt}>{component.altText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 24, backgroundColor: colors.soft, gap: 10 },
  title: { fontFamily: fonts.black, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.purple },
  edge: { position: 'absolute', height: 3, backgroundColor: '#B8AED6', borderRadius: 2, justifyContent: 'center' },
  edgeDashed: { opacity: 0.6 },
  arrowHead: { position: 'absolute', width: 10, height: 10, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#B8AED6', transform: [{ rotate: '45deg' }] },
  edgeLabel: { position: 'absolute', alignSelf: 'center', top: -22, fontFamily: fonts.bold, fontSize: 11, color: colors.muted, backgroundColor: colors.soft, paddingHorizontal: 4 },
  node: { position: 'absolute', width: NODE_W, height: NODE_H, borderRadius: 12, borderBottomWidth: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  nodeCircle: { borderRadius: NODE_H / 2 },
  nodePill: { borderRadius: 999 },
  nodeText: { fontFamily: fonts.black, fontSize: 12, textAlign: 'center' },
  alt: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
});
