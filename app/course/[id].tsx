import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NodeV1, TreeView } from '../../src/contracts';
import { Companion } from '../../src/features/companion/Companion';
import { colors, fonts } from '../../src/features/theme';
import { BackButton, ErrorBox, Eyebrow, Loading, Screen } from '../../src/features/ui/Screen';
import { useAsync } from '../../src/features/ui/useAsync';
import { api } from '../../src/services/api';

type NodeStatus = 'locked' | 'available' | 'completed';

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const view = useAsync(() => api.getCourse(id), [id]);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = view.data;
  const current: TreeView | undefined = data?.trees.at(-1);
  const nextNode = current ? current.tree.nodes.find((n) => n.id === current.nextNodeId) : undefined;
  const nextReady = !!current && !!nextNode && current.readyNodeIds.includes(nextNode.id);

  // While the next lesson is still being written on the server, refresh until it is ready.
  useEffect(() => {
    if (!current || !nextNode || nextReady) return;
    const timer = setInterval(() => view.reload(), 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.tree.id, nextNode?.id, nextReady]);

  const open = async (nodeId: string) => {
    setOpening(nodeId);
    setError(null);
    try {
      const exp = await api.openNode(id, nodeId);
      router.push({ pathname: '/lesson/[id]', params: { id: exp.experience.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that lesson');
    } finally {
      setOpening(null);
    }
  };

  const companionLine = (): string => {
    if (!data || !current) return '';
    if (current.complete) return 'You did it! Every required lesson is done.';
    if (nextNode && !nextReady) return `Writing "${nextNode.title}" for you now… it'll be ready in a moment.`;
    if (nextNode) return `"${nextNode.title}" is ready. Shall we?`;
    return data.course.companion.greeting;
  };

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton label="Back to home" onPress={() => router.replace('/')} />
        {data ? (
          <View style={styles.streak} accessibilityLabel={`${data.streak.count} day streak`}>
            <Text style={styles.streakText}>🔥 {data.streak.count}</Text>
          </View>
        ) : null}
      </View>

      {view.loading && !data ? <Loading message="Loading your course…" /> : null}
      {view.error ? <ErrorBox message={view.error} onRetry={view.reload} /> : null}

      {data && current ? (
        <>
          <View style={styles.hero}>
            <Companion theme={data.course.companion} mood={current.complete ? 'cheering' : nextReady ? 'happy' : 'thinking'} size={88} />
            <View style={{ flex: 1, gap: 6 }}>
              <Eyebrow color={colors.coralDeep}>{`${data.course.companion.name} says`}</Eyebrow>
              <Text style={styles.greeting} accessibilityLiveRegion="polite">
                {companionLine()}
              </Text>
            </View>
          </View>

          <Text accessibilityRole="header" style={styles.title}>
            {data.course.title}
          </Text>
          <Text style={styles.summary}>{data.course.summary}</Text>

          <View style={styles.unit}>
            <View style={{ flex: 1 }}>
              <Text style={styles.unitEyebrow}>Skill tree {current.tree.sequence + 1}</Text>
              <Text style={styles.unitTitle}>{current.tree.title}</Text>
            </View>
            <Text style={styles.unitProgress}>
              {current.progress.completed}/{current.progress.required}
            </Text>
          </View>

          {opening ? <Loading message={`${data.course.companion.name} is finishing this lesson for you…`} /> : null}
          {error ? <ErrorBox message={error} /> : null}

          <SkillPath tree={current} disabled={!!opening} onOpen={(nodeId) => void open(nodeId)} />
        </>
      ) : null}
    </Screen>
  );
}

const ROW_H = 116;
const R = 38;
/** Horizontal positions (fraction of width) for the winding path: center, left, center, right… */
const COLS = [0.5, 0.24, 0.5, 0.76];

function SkillPath({ tree, disabled, onOpen }: { tree: TreeView; disabled: boolean; onOpen: (nodeId: string) => void }) {
  const [width, setWidth] = useState(0);
  const nodes = tree.tree.nodes;
  const center = (i: number) => ({ cx: COLS[i % COLS.length]! * width, cy: i * ROW_H + R + 10 });

  return (
    <View
      style={{ height: nodes.length * ROW_H + 20, width: '100%' }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="list"
    >
      {width > 0 &&
        nodes.slice(1).map((_, i) => {
          const a = center(i);
          const b = center(i + 1);
          const dx = b.cx - a.cx;
          const dy = b.cy - a.cy;
          const len = Math.hypot(dx, dy);
          const start = (R + 10) / len;
          const end = 1 - (R + 10) / len;
          const doneA = tree.nodeStates[nodes[i]!.id] === 'completed';
          return [0, 0.5, 1].map((k) => {
            const t = start + (end - start) * k;
            return (
              <View
                key={`${i}-${k}`}
                aria-hidden
                style={[styles.dot, { left: a.cx + dx * t - 5, top: a.cy + dy * t - 5, backgroundColor: doneA ? colors.purple : '#C4B5FD' }]}
              />
            );
          });
        })}
      {width > 0 &&
        nodes.map((node, i) => (
          <PathNode
            key={node.id}
            node={node}
            cx={center(i).cx}
            cy={center(i).cy}
            labelSide={COLS[i % COLS.length]! > 0.5 ? 'left' : 'right'}
            width={width}
            state={tree.nodeStates[node.id] ?? 'locked'}
            isNext={tree.nextNodeId === node.id}
            ready={tree.readyNodeIds.includes(node.id)}
            generating={tree.generatingNodeIds.includes(node.id)}
            disabled={disabled}
            onPress={() => onOpen(node.id)}
          />
        ))}
    </View>
  );
}

function PathNode({
  node,
  cx,
  cy,
  labelSide,
  width,
  state,
  isNext,
  ready,
  generating,
  disabled,
  onPress,
}: {
  node: NodeV1;
  cx: number;
  cy: number;
  labelSide: 'left' | 'right';
  width: number;
  state: NodeStatus;
  isNext: boolean;
  ready: boolean;
  generating: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const locked = state === 'locked';
  const done = state === 'completed';
  const statusWord = done ? 'Done.' : locked ? 'Locked.' : isNext ? 'Up next.' : 'Available.';
  const readiness = done || locked ? '' : ready ? 'Ready to open.' : generating ? 'Being written now.' : 'Will be written when opened.';
  const fill = done ? colors.purple : isNext ? colors.yellow : locked ? colors.line : colors.mint;
  const shadow = done ? colors.purpleDeep : isNext ? colors.yellowDeep : locked ? '#D6D0E8' : colors.mintDeep;
  const labelW = Math.min(170, width / 2 - R - 24);
  const labelLeft = labelSide === 'right' ? cx + R + 12 : cx - R - 12 - labelW;
  const tag = done || locked ? null : ready ? 'Ready' : generating ? 'Writing…' : 'Tap to write';

  return (
    <>
      {isNext ? <View aria-hidden style={[styles.ring, { left: cx - R - 7, top: cy - R - 7 }]} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${node.title}. ${statusWord} ${node.required ? '' : 'Optional branch.'} ${readiness}`}
        accessibilityState={{ disabled: locked || disabled }}
        disabled={locked || disabled}
        onPress={onPress}
        style={[styles.circle, { left: cx - R, top: cy - R, backgroundColor: fill, borderBottomColor: shadow }, !node.required && styles.circleOptional, locked && styles.circleLocked]}
      >
        <Text style={[styles.circleIcon, done && { color: '#FFFFFF' }]}>{done ? '✓' : locked ? '🔒' : isNext ? '★' : '•'}</Text>
      </Pressable>
      <View aria-hidden style={[styles.label, { left: labelLeft, width: labelW, top: cy - 36, alignItems: labelSide === 'right' ? 'flex-start' : 'flex-end' }]}>
        <Text style={[styles.labelTitle, locked && { color: colors.muted }, { textAlign: labelSide }]}>{node.title}</Text>
        <Text style={[styles.labelMeta, { textAlign: labelSide }]}>
          {isNext ? 'UP NEXT · ' : ''}
          {node.kind === 'orientation' ? 'Start here' : node.required ? 'Core' : 'Optional'}
        </Text>
        {tag ? (
          <View style={[styles.tag, ready ? styles.tagReady : generating ? styles.tagWriting : styles.tagIdle]}>
            <Text style={[styles.tagText, ready && { color: colors.mintDeep }]}>{tag}</Text>
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streak: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.coralTint },
  streakText: { fontFamily: fonts.black, fontSize: 14, color: colors.ink },
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, padding: 16, borderRadius: 24, backgroundColor: colors.coralTint },
  greeting: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 22, color: colors.ink },
  title: { fontFamily: fonts.black, fontSize: 28, lineHeight: 33, color: colors.ink },
  summary: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, color: colors.muted },
  unit: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, backgroundColor: colors.purple, borderBottomWidth: 6, borderBottomColor: colors.purpleDeep },
  unitEyebrow: { fontFamily: fonts.black, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.purpleTint },
  unitTitle: { fontFamily: fonts.black, fontSize: 20, color: '#FFFFFF' },
  unitProgress: { fontFamily: fonts.black, fontSize: 22, color: colors.yellow },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  ring: { position: 'absolute', width: R * 2 + 14, height: R * 2 + 14, borderRadius: R + 7, borderWidth: 4, borderColor: colors.yellowTint },
  circle: { position: 'absolute', width: R * 2, height: R * 2, borderRadius: R, borderBottomWidth: 7, alignItems: 'center', justifyContent: 'center' },
  circleOptional: { borderWidth: 3, borderColor: colors.mintDeep, borderStyle: 'dashed' },
  circleLocked: { opacity: 0.85 },
  circleIcon: { fontFamily: fonts.black, fontSize: 28, lineHeight: 32, color: colors.ink, marginTop: -4 },
  label: { position: 'absolute', gap: 2 },
  labelTitle: { fontFamily: fonts.black, fontSize: 15, lineHeight: 18, color: colors.ink },
  labelMeta: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 2 },
  tagReady: { backgroundColor: colors.mintTint },
  tagWriting: { backgroundColor: colors.yellowTint },
  tagIdle: { backgroundColor: colors.soft },
  tagText: { fontFamily: fonts.black, fontSize: 10, letterSpacing: 0.4, color: colors.muted },
});
