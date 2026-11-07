import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NodeV1, TreeView } from '../../src/contracts';
import { Companion } from '../../src/features/companion/Companion';
import { colors, fonts } from '../../src/features/theme';
import { ChunkyButton } from '../../src/features/ui/ChunkyButton';
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
  const [editingCompanion, setEditingCompanion] = useState(false);
  const [newName, setNewName] = useState('');
  const [companionBusy, setCompanionBusy] = useState(false);
  const [extending, setExtending] = useState(false);

  const data = view.data;

  const companionAction = async (action: 'rename' | 'reroll') => {
    if (!data) return;
    setCompanionBusy(true);
    setError(null);
    try {
      const next = action === 'rename' ? await api.updateCompanion(id, { action: 'rename', name: newName.trim() }) : await api.updateCompanion(id, { action: 'reroll' });
      view.setData(next);
      setEditingCompanion(false);
      setNewName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the companion');
    } finally {
      setCompanionBusy(false);
    }
  };

  const keepGoing = async () => {
    setExtending(true);
    setError(null);
    try {
      view.setData(await api.addTree(id, { kind: 'continue' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not plan the next skill tree');
    } finally {
      setExtending(false);
    }
  };
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
    if (opening) {
      const title = current.tree.nodes.find((n) => n.id === opening)?.title ?? 'your lesson';
      return current.readyNodeIds.includes(opening) ? `Opening "${title}"…` : `Finishing "${title}" for you now…`;
    }
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${data.course.companion.name}, your companion. Rename or get a new look.`}
            onPress={() => setEditingCompanion((v) => !v)}
            style={styles.hero}
          >
            <Companion theme={data.course.companion} mood={current.complete ? 'cheering' : nextReady ? 'happy' : 'thinking'} size={72} />
            <View style={{ flex: 1, gap: 6 }}>
              <Eyebrow color={colors.coralDeep}>{`${data.course.companion.name} · your guide, picked by Pip`}</Eyebrow>
              <Text style={styles.greeting} accessibilityLiveRegion="polite">
                {companionLine()}
              </Text>
              <Text style={styles.heroHint}>{editingCompanion ? 'Tap to close' : 'Tap to rename or change look'}</Text>
            </View>
          </Pressable>
          {editingCompanion ? (
            <View style={styles.companionPanel}>
              <TextInput
                accessibilityLabel="New companion name"
                placeholder={`Rename ${data.course.companion.name} (one word)`}
                placeholderTextColor="#7E76A0"
                value={newName}
                onChangeText={setNewName}
                autoCapitalize="words"
                maxLength={10}
                style={styles.input}
                editable={!companionBusy}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <ChunkyButton label="Rename" variant="secondary" onPress={() => void companionAction('rename')} disabled={!/^[A-Z][a-z]{1,9}$/.test(newName.trim())} loading={companionBusy} style={{ flex: 1 }} />
                <ChunkyButton label="New look" variant="outline" onPress={() => void companionAction('reroll')} loading={companionBusy} style={{ flex: 1 }} />
              </View>
            </View>
          ) : null}

          {current.complete ? (
            <View style={styles.completeCard}>
              <Text style={styles.completeTitle}>Skill tree complete</Text>
              <Text style={styles.completeText}>Stop here with a finished course, or let {data.course.companion.name} plan the next stage: deeper, broader, or more applied.</Text>
              <ChunkyButton label="Keep going: plan the next tree" onPress={() => void keepGoing()} loading={extending} />
            </View>
          ) : null}
          {extending ? <Loading message={`${data.course.companion.name} is planning your next skill tree…`} /> : null}

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

          {error ? <ErrorBox message={error} /> : null}

          <SkillPath tree={current} openingNodeId={opening} onOpen={(nodeId) => void open(nodeId)} />

          <ChunkyButton
            label="Learn something different"
            variant="ghost"
            onPress={async () => {
              setError(null);
              try {
                const session = await api.startIntake(`Within my course "${data.course.title}", I want to go in a new direction.`, id);
                router.push({ pathname: '/intake/[id]', params: { id: session.id } });
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not start that');
              }
            }}
            accessibilityHint="Tell your companion what you want to explore; it becomes a new skill tree in this course"
          />
        </>
      ) : null}
    </Screen>
  );
}

const ROW_H = 116;
const R = 38;
/** The path winds inside a fixed-width lane so it reads the same on a phone and a laptop. */
const LANE_MAX = 520;
/** Horizontal positions (fraction of lane) for the winding path: center, left, center, right… */
const COLS = [0.5, 0.24, 0.5, 0.76];

function SkillPath({ tree, openingNodeId, onOpen }: { tree: TreeView; openingNodeId: string | null; onOpen: (nodeId: string) => void }) {
  const disabled = !!openingNodeId;
  const [width, setWidth] = useState(0);
  const nodes = tree.tree.nodes;
  const lane = Math.min(width, LANE_MAX);
  const offset = (width - lane) / 2;
  const center = (i: number) => ({ cx: offset + COLS[i % COLS.length]! * lane, cy: i * ROW_H + R + 10 });

  return (
    <View style={{ height: nodes.length * ROW_H + 20, width: '100%' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
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
            width={lane}
            state={tree.nodeStates[node.id] ?? 'locked'}
            isNext={tree.nextNodeId === node.id}
            ready={tree.readyNodeIds.includes(node.id)}
            generating={tree.generatingNodeIds.includes(node.id)}
            opening={openingNodeId === node.id}
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
  opening,
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
  /** This node is being opened: its lesson is loading or being written right now. */
  opening: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const locked = state === 'locked';
  const done = state === 'completed';
  const statusWord = done ? 'Done.' : locked ? 'Locked.' : isNext ? 'Up next.' : 'Available.';
  const readiness = done || locked ? '' : ready ? 'Ready to open.' : generating ? 'Being written now.' : 'Will be written when opened.';
  const fill = done ? colors.purple : isNext ? colors.yellow : locked ? colors.line : colors.mint;
  const shadow = done ? colors.purpleDeep : isNext ? colors.yellowDeep : locked ? '#D6D0E8' : colors.mintDeep;
  const labelW = Math.min(190, width / 2 - R - 24);
  const labelLeft = labelSide === 'right' ? cx + R + 12 : cx - R - 12 - labelW;
  // Text aligns toward the circle: left-aligned when the label sits to the right of it, and vice versa.
  const textAlign = labelSide === 'right' ? 'left' : 'right';
  // Only the next node advertises generation progress; other available nodes just say Ready when they are.
  const tag = opening ? (ready ? 'Opening…' : 'Writing…') : done || locked ? null : ready ? 'Ready' : isNext && generating ? 'Writing…' : isNext ? 'Tap to write' : null;
  const meta = done ? 'Done' : node.kind === 'orientation' ? 'Start here' : node.required ? 'Core' : 'Optional';

  return (
    <>
      {isNext ? <View aria-hidden style={[styles.ring, { left: cx - R - 7, top: cy - R - 7 }]} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${node.title}. ${statusWord} ${meta}. ${readiness}`}
        aria-disabled={locked || disabled}
        disabled={locked || disabled}
        onPress={onPress}
        style={[styles.circle, { left: cx - R, top: cy - R, backgroundColor: fill, borderBottomColor: shadow }, !node.required && styles.circleOptional, locked && styles.circleLocked]}
      >
        {opening ? (
          <ActivityIndicator color={colors.ink} accessibilityLabel="Loading lesson" />
        ) : (
          <Text style={[styles.circleIcon, done && { color: '#FFFFFF' }]}>{done ? '✓' : locked ? '🔒' : isNext ? '★' : '•'}</Text>
        )}
      </Pressable>
      <View aria-hidden style={[styles.label, { left: labelLeft, width: labelW, top: cy - 36, alignItems: labelSide === 'right' ? 'flex-start' : 'flex-end' }]}>
        <Text style={[styles.labelTitle, locked && { color: colors.muted }, { textAlign, width: '100%' }]}>{node.title}</Text>
        <Text style={[styles.labelMeta, { textAlign, width: '100%' }]}>
          {isNext ? 'UP NEXT · ' : ''}
          {meta}
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
  heroHint: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted },
  companionPanel: { gap: 10, padding: 14, borderRadius: 20, borderWidth: 3, borderColor: colors.line },
  input: { minHeight: 52, borderWidth: 3, borderColor: '#C4B5FD', borderRadius: 16, paddingHorizontal: 14, backgroundColor: colors.bg, fontFamily: fonts.extraBold, fontSize: 16, color: colors.ink },
  completeCard: { gap: 10, padding: 16, borderRadius: 22, backgroundColor: colors.mintTint },
  completeTitle: { fontFamily: fonts.black, fontSize: 18, color: colors.mintDeep },
  completeText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.ink },
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
  tagText: { fontFamily: fonts.black, fontSize: 10, letterSpacing: 0.4, color: '#5B5370' },
});
