import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CompanionThemeV1, TreeView } from '../../src/contracts';
import { Companion } from '../../src/features/companion/Companion';
import { layoutPath, type PlacedNode } from '../../src/features/course/path-layout';
import { ProgressGlass } from '../../src/features/ui/ProgressGlass';
import { colors, fonts } from '../../src/features/theme';
import { ChunkyButton } from '../../src/features/ui/ChunkyButton';
import { AppBar, ErrorBox, Eyebrow, Loading, Screen } from '../../src/features/ui/Screen';
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
    if (opening) return; // one open at a time; a second tap while generating must not race
    setOpening(nodeId);
    setError(null);
    try {
      const exp = await api.openNode(id, nodeId, current?.tree.id);
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
    <Screen header={<AppBar back={{ label: 'Back to home', onPress: () => router.replace('/') }} streak={data?.streak.count ?? 0} />}>
      {view.loading && !data ? <Loading message="Loading your course…" /> : null}
      {view.error ? <ErrorBox message={view.error} onRetry={view.reload} /> : null}

      {data && current ? (
        <>
          <View style={styles.unit}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.unitEyebrow} numberOfLines={2}>
                Skill tree {current.tree.sequence + 1} · {data.course.title}
              </Text>
              <Text style={styles.unitTitle} accessibilityRole="header">
                {current.tree.title}
              </Text>
            </View>
            <ProgressGlass completed={current.progress.completed} required={current.progress.required} width={52} height={84} liquid={colors.yellow} showCount={false} />
            <Text style={styles.unitProgress} aria-hidden>
              {current.progress.completed}/{current.progress.required}
            </Text>
          </View>

          <View style={styles.hero}>
            <Companion theme={data.course.companion} mood={current.complete ? 'cheering' : nextReady ? 'happy' : 'thinking'} size={56} />
            <View style={{ flex: 1, gap: 2 }}>
              <Eyebrow color={colors.coralDeep}>{data.course.companion.name}</Eyebrow>
              <Text style={styles.greeting} accessibilityLiveRegion="polite" numberOfLines={3}>
                {companionLine()}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${data.course.companion.name}, your companion. Rename or get a new look.`}
              aria-expanded={editingCompanion}
              onPress={() => setEditingCompanion((v) => !v)}
              style={styles.pencil}
            >
              <Text style={styles.pencilIcon}>{editingCompanion ? '✕' : '✎'}</Text>
            </Pressable>
          </View>
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

          {data.trees.length > 1 ? (
            <View style={styles.priorTrees} accessibilityRole="summary">
              {data.trees.slice(0, -1).map((t) => (
                <View key={t.tree.id} style={styles.priorTree}>
                  <Text style={styles.priorCheck}>{t.complete ? '✓' : '•'}</Text>
                  <Text style={styles.priorTitle} numberOfLines={1}>
                    Skill tree {t.tree.sequence + 1} · {t.tree.title}
                  </Text>
                  <Text style={styles.priorProgress}>
                    {t.progress.completed}/{t.progress.required}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {error ? <ErrorBox message={error} /> : null}

          <SkillPath tree={current} companion={data.course.companion} openingNodeId={opening} onOpen={(nodeId) => void open(nodeId)} />

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

/** The path winds inside a fixed-width lane so it reads the same on a phone and a laptop. */
const LANE_MAX = 520;
const DOT_SPACING = 34;

function SkillPath({
  tree,
  companion,
  openingNodeId,
  onOpen,
}: {
  tree: TreeView;
  companion: CompanionThemeV1;
  openingNodeId: string | null;
  onOpen: (nodeId: string) => void;
}) {
  const disabled = !!openingNodeId;
  const [width, setWidth] = useState(0);
  const lane = Math.min(width, LANE_MAX);
  const offset = (width - lane) / 2;
  const layout = useMemo(() => layoutPath(tree.tree.nodes, lane, offset), [tree.tree.nodes, lane, offset]);
  const byId = useMemo(() => new Map(layout.nodes.map((p) => [p.node.id, p])), [layout]);

  return (
    <View style={{ height: layout.height, width: '100%' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 &&
        layout.edges.map((edge) => {
          const a = byId.get(edge.from);
          const b = byId.get(edge.to);
          if (!a || !b) return null;
          const dx = b.cx - a.cx;
          const dy = b.cy - a.cy;
          const len = Math.hypot(dx, dy);
          // Connectors leave below a node's label when the label sits under the circle (shared rows).
          const exit = a.labelMode === 'below' ? a.r + 60 : a.r + 10;
          const start = Math.min(exit / len, 0.6);
          const end = 1 - (b.r + 10) / len;
          const count = Math.max(2, Math.round((len * (end - start)) / DOT_SPACING));
          const fromDone = tree.nodeStates[edge.from] === 'completed';
          // Branch connectors are teal; the main path is purple once its source is done, lilac before.
          const color = edge.branch ? (fromDone ? colors.mint : '#99E6DB') : fromDone ? colors.purple : '#C4B5FD';
          const size = edge.long ? 6 : 10;
          return Array.from({ length: count + 1 }, (_, k) => {
            const t = start + (end - start) * (k / count);
            return (
              <View
                key={`${edge.from}-${edge.to}-${k}`}
                aria-hidden
                style={[styles.dot, { left: a.cx + dx * t - size / 2, top: a.cy + dy * t - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: edge.long ? 0.7 : 1 }]}
              />
            );
          });
        })}
      {width > 0 &&
        layout.nodes.map((placed) => (
          <PathNode
            key={placed.node.id}
            placed={placed}
            companion={companion}
            state={tree.nodeStates[placed.node.id] ?? 'locked'}
            isNext={tree.nextNodeId === placed.node.id}
            ready={tree.readyNodeIds.includes(placed.node.id)}
            generating={tree.generatingNodeIds.includes(placed.node.id)}
            opening={openingNodeId === placed.node.id}
            disabled={disabled}
            onPress={() => onOpen(placed.node.id)}
          />
        ))}
    </View>
  );
}

function PathNode({
  placed,
  companion,
  state,
  isNext,
  ready,
  generating,
  opening,
  disabled,
  onPress,
}: {
  placed: PlacedNode;
  companion: CompanionThemeV1;
  state: NodeStatus;
  isNext: boolean;
  ready: boolean;
  generating: boolean;
  /** This node is being opened: its lesson is loading or being written right now. */
  opening: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { node, cx, cy, r, labelMode, labelSide, labelWidth } = placed;
  const locked = state === 'locked';
  const done = state === 'completed';
  const branch = !node.required;
  const statusWord = done ? 'Done.' : locked ? 'Locked.' : isNext ? 'Up next.' : 'Available.';
  const readiness = done || locked ? '' : ready ? 'Ready to open.' : generating ? 'Being written now.' : 'Will be written when opened.';
  const fill = done ? colors.purple : isNext ? colors.yellow : locked ? colors.line : branch ? colors.mintTint : colors.mint;
  const shadow = done ? colors.purpleDeep : isNext ? colors.yellowDeep : locked ? '#D6D0E8' : colors.mintDeep;
  // Only the next node advertises generation progress; other available nodes just say Ready when they are.
  const tag = opening ? (ready ? 'Opening…' : 'Writing…') : done || locked ? null : ready ? 'Ready' : isNext && generating ? 'Writing…' : isNext ? 'Tap to write' : null;
  const meta = done ? 'Done' : node.kind === 'orientation' ? 'Start here' : branch ? 'Branch' : 'Core';
  const icon = done ? '✓' : locked ? '🔒' : isNext ? '★' : branch ? '↗' : '•';

  const labelStyle =
    labelMode === 'below'
      ? { left: cx - labelWidth / 2, width: labelWidth, top: cy + r + 8, alignItems: 'center' as const }
      : {
          left: labelSide === 'right' ? cx + r + 12 : cx - r - 12 - labelWidth,
          width: labelWidth,
          top: cy - 36,
          alignItems: labelSide === 'right' ? ('flex-start' as const) : ('flex-end' as const),
        };
  // Text aligns toward the circle when beside it, and is centered when under it.
  const textAlign = labelMode === 'below' ? 'center' : labelSide === 'right' ? 'left' : 'right';
  // The companion stands beside the next lesson when there is room (single-node rows only).
  const companionLeft = labelMode === 'side' ? (labelSide === 'right' ? cx - r - 12 - 56 : cx + r + 12) : null;

  return (
    <>
      {isNext ? <View aria-hidden style={[styles.ring, { left: cx - r - 7, top: cy - r - 7, width: r * 2 + 14, height: r * 2 + 14, borderRadius: r + 7 }]} /> : null}
      {isNext && companionLeft !== null ? (
        <View aria-hidden style={{ position: 'absolute', left: companionLeft, top: cy - 30 }}>
          <Companion theme={companion} mood="curious" size={56} />
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${node.title}. ${statusWord} ${meta}${branch ? ', a side branch' : ''}. ${readiness}`}
        aria-disabled={locked || disabled}
        disabled={locked || disabled}
        onPress={onPress}
        style={[
          styles.circle,
          { left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: fill, borderBottomColor: shadow },
          branch && styles.circleOptional,
          locked && styles.circleLocked,
        ]}
      >
        {opening ? (
          <ActivityIndicator color={colors.ink} accessibilityLabel="Loading lesson" />
        ) : (
          <Text style={[styles.circleIcon, branch && styles.circleIconSmall, done && { color: '#FFFFFF' }]}>{icon}</Text>
        )}
      </Pressable>
      <View aria-hidden style={[styles.label, labelStyle]}>
        <Text style={[styles.labelTitle, (branch || labelMode === 'below') && styles.labelTitleBelow, locked && { color: colors.muted }, { textAlign, width: '100%' }]} numberOfLines={2}>
          {node.title}
        </Text>
        <Text style={[styles.labelMeta, branch && !locked && { color: colors.mintDeep }, { textAlign, width: '100%' }]}>
          {isNext ? 'UP NEXT · ' : ''}
          {meta.toUpperCase()}
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
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 22, backgroundColor: colors.coralTint },
  pencil: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  pencilIcon: { fontFamily: fonts.black, fontSize: 20, color: colors.coralDeep },
  greeting: { fontFamily: fonts.extraBold, fontSize: 15, lineHeight: 20, color: colors.ink },
  companionPanel: { gap: 10, padding: 14, borderRadius: 20, borderWidth: 3, borderColor: colors.line },
  input: { minHeight: 52, borderWidth: 3, borderColor: '#C4B5FD', borderRadius: 16, paddingHorizontal: 14, backgroundColor: colors.bg, fontFamily: fonts.extraBold, fontSize: 16, color: colors.ink },
  completeCard: { gap: 10, padding: 16, borderRadius: 22, backgroundColor: colors.mintTint },
  completeTitle: { fontFamily: fonts.black, fontSize: 18, color: colors.mintDeep },
  completeText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.ink },
  priorTrees: { gap: 6 },
  priorTree: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.soft },
  priorCheck: { fontFamily: fonts.black, fontSize: 14, color: colors.purple, width: 16, textAlign: 'center' },
  priorTitle: { flex: 1, fontFamily: fonts.extraBold, fontSize: 13, color: colors.ink },
  priorProgress: { fontFamily: fonts.black, fontSize: 13, color: colors.purple },
  unit: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: colors.purple, borderBottomWidth: 6, borderBottomColor: colors.purpleDeep },
  unitEyebrow: { fontFamily: fonts.black, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.purpleTint },
  unitTitle: { fontFamily: fonts.black, fontSize: 20, color: '#FFFFFF' },
  unitProgress: { fontFamily: fonts.black, fontSize: 20, color: colors.yellow },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  ring: { position: 'absolute', borderWidth: 4, borderColor: colors.yellowTint },
  circle: { position: 'absolute', borderBottomWidth: 7, alignItems: 'center', justifyContent: 'center' },
  circleOptional: { borderWidth: 3, borderColor: colors.mintDeep, borderStyle: 'dashed' },
  circleLocked: { opacity: 0.85 },
  circleIcon: { fontFamily: fonts.black, fontSize: 28, lineHeight: 32, color: colors.ink, marginTop: -4 },
  circleIconSmall: { fontSize: 22, lineHeight: 26 },
  label: { position: 'absolute', gap: 2 },
  labelTitle: { fontFamily: fonts.black, fontSize: 15, lineHeight: 18, color: colors.ink },
  labelTitleBelow: { fontSize: 13, lineHeight: 16 },
  labelMeta: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 2 },
  tagReady: { backgroundColor: colors.mintTint },
  tagWriting: { backgroundColor: colors.yellowTint },
  tagIdle: { backgroundColor: colors.soft },
  tagText: { fontFamily: fonts.black, fontSize: 10, letterSpacing: 0.4, color: '#5B5370' },
});
