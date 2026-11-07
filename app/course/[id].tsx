import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NodeV1, TreeView } from '../../src/contracts';
import { Companion } from '../../src/features/companion/Companion';
import { colors, fonts } from '../../src/features/theme';
import { BackButton, ErrorBox, Eyebrow, Loading, Screen } from '../../src/features/ui/Screen';
import { useAsync } from '../../src/features/ui/useAsync';
import { api } from '../../src/services/api';

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const view = useAsync(() => api.getCourse(id), [id]);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const data = view.data;
  const current: TreeView | undefined = data?.trees.at(-1);
  const nextTitle = current ? current.tree.nodes.find((n) => n.id === current.nextNodeId)?.title : null;

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
            <Companion theme={data.course.companion} mood={current.complete ? 'cheering' : 'happy'} size={88} />
            <View style={{ flex: 1, gap: 6 }}>
              <Eyebrow color={colors.coralDeep}>{`${data.course.companion.name} says`}</Eyebrow>
              <Text style={styles.greeting}>
                {current.complete ? 'You did it! Every required lesson is done.' : nextTitle ? `Up next: ${nextTitle}. Ready?` : data.course.companion.greeting}
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

          {opening ? <Loading message={`${data.course.companion.name} is writing this lesson for you… about a minute.`} /> : null}
          {error ? <ErrorBox message={error} /> : null}

          <View style={styles.path}>
            {current.tree.nodes.map((node, i) => (
              <NodeCard
                key={node.id}
                node={node}
                index={i}
                state={current.nodeStates[node.id] ?? 'locked'}
                isNext={current.nextNodeId === node.id}
                disabled={!!opening}
                onPress={() => void open(node.id)}
              />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function NodeCard({
  node,
  index,
  state,
  isNext,
  disabled,
  onPress,
}: {
  node: NodeV1;
  index: number;
  state: 'locked' | 'available' | 'completed';
  isNext: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const side = index % 2 === 0 ? 'flex-start' : 'flex-end';
  const locked = state === 'locked';
  const requires = [...(node.rule.allOf ?? []), ...(node.rule.anyOf ?? []), ...(node.rule.atLeast?.of ?? [])];
  return (
    <View style={{ alignItems: side, width: '100%' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${node.title}. ${state === 'completed' ? 'Done.' : locked ? 'Locked.' : isNext ? 'Up next.' : 'Available.'} ${node.required ? '' : 'Optional branch.'}`}
        accessibilityState={{ disabled: locked || disabled }}
        disabled={locked || disabled}
        onPress={onPress}
        style={[styles.node, state === 'completed' && styles.nodeDone, isNext && styles.nodeNext, locked && styles.nodeLocked, !node.required && styles.nodeOptional]}
      >
        <View style={[styles.dot, state === 'completed' && styles.dotDone, isNext && styles.dotNext, locked && styles.dotLocked]}>
          <Text style={styles.dotText}>{state === 'completed' ? '✓' : locked ? '🔒' : isNext ? '★' : '•'}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.nodeTitle, locked && { color: colors.muted }]}>{node.title}</Text>
          <Text style={styles.nodeMeta} numberOfLines={2}>
            {isNext ? 'UP NEXT · ' : ''}
            {node.kind === 'orientation' ? 'Start here' : node.required ? 'Core' : 'Optional branch'}
            {locked && requires.length ? ` · after ${requires.join(node.rule.anyOf ? ' or ' : ', ')}` : ''}
          </Text>
        </View>
      </Pressable>
    </View>
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
  path: { gap: 14 },
  node: { width: '88%', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, borderWidth: 3, borderColor: colors.line, borderBottomWidth: 7, backgroundColor: colors.bg },
  nodeDone: { borderColor: colors.purpleTint, backgroundColor: colors.soft },
  nodeNext: { borderColor: colors.yellow, borderBottomColor: colors.yellowDeep, backgroundColor: '#FFFBEB' },
  nodeLocked: { opacity: 0.7 },
  nodeOptional: { borderStyle: 'dashed' },
  dot: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.purple },
  dotNext: { backgroundColor: colors.yellow },
  dotLocked: { backgroundColor: colors.line },
  dotText: { fontFamily: fonts.black, fontSize: 18, color: colors.ink },
  nodeTitle: { fontFamily: fonts.black, fontSize: 17, color: colors.ink },
  nodeMeta: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted },
});
