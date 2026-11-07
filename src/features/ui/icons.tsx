import { View, type ViewStyle } from 'react-native';

/**
 * Skill-path node icons drawn with plain views (no font glyphs, no emoji), so they render the same
 * on every platform and scale with the node. Each icon lives on a 24-unit grid scaled by size / 24
 * and is decorative: the node's accessibility label carries the meaning.
 */
type IconProps = { color: string; size?: number };

/** A capsule from one point to another on the 24-unit grid. */
function Bar({ from, to, t, s, color }: { from: [number, number]; to: [number, number]; t: number; s: number; color: string }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) + t;
  const style: ViewStyle = {
    position: 'absolute',
    left: ((from[0] + to[0]) / 2 - t / 2) * s,
    top: ((from[1] + to[1]) / 2 - len / 2) * s,
    width: t * s,
    height: len * s,
    borderRadius: (t / 2) * s,
    backgroundColor: color,
    transform: [{ rotate: `${(Math.atan2(-dx, dy) * 180) / Math.PI}deg` }],
  };
  return <View style={style} />;
}

function Frame({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      {children}
    </View>
  );
}

export function CheckIcon({ color, size = 24 }: IconProps) {
  const s = size / 24;
  return (
    <Frame size={size}>
      <Bar from={[5, 12.5]} to={[10, 17.5]} t={4.2} s={s} color={color} />
      <Bar from={[10, 17.5]} to={[19.5, 7]} t={4.2} s={s} color={color} />
    </Frame>
  );
}

export function LockIcon({ color, size = 24, holeColor = '#FFFFFF' }: IconProps & { holeColor?: string }) {
  const s = size / 24;
  return (
    <Frame size={size}>
      {/* Shackle: the top of a ring. */}
      <View style={{ position: 'absolute', left: 5.5 * s, top: 2 * s, width: 13 * s, height: 9 * s, overflow: 'hidden' }}>
        <View style={{ width: 13 * s, height: 13 * s, borderRadius: 6.5 * s, borderWidth: 3 * s, borderColor: color }} />
      </View>
      <View style={{ position: 'absolute', left: 3.5 * s, top: 10 * s, width: 17 * s, height: 12 * s, borderRadius: 3 * s, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 10.5 * s, top: 13.5 * s, width: 3 * s, height: 3 * s, borderRadius: 1.5 * s, backgroundColor: holeColor }} />
      <View style={{ position: 'absolute', left: 11.25 * s, top: 15.5 * s, width: 1.5 * s, height: 3.5 * s, borderRadius: 0.75 * s, backgroundColor: holeColor }} />
    </Frame>
  );
}

/** A five-point star: five triangles (the border trick) rotated about the center. */
export function StarIcon({ color, size = 24 }: IconProps) {
  const s = size / 24;
  const R = 11.5;
  const half = 0.325 * R;
  return (
    <Frame size={size}>
      {[0, 72, 144, 216, 288].map((deg) => (
        <View
          key={deg}
          style={{
            position: 'absolute',
            left: (12 - half) * s,
            top: (12 - R) * s,
            width: 0,
            height: 0,
            borderLeftWidth: half * s,
            borderRightWidth: half * s,
            borderBottomWidth: R * s,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: color,
            transform: [{ translateY: (R / 2) * s }, { rotate: `${deg}deg` }, { translateY: (-R / 2) * s }],
          }}
        />
      ))}
    </Frame>
  );
}

/** An arrow pointing up and to the right: a side branch leaving the main path. */
export function BranchIcon({ color, size = 24 }: IconProps) {
  const s = size / 24;
  return (
    <Frame size={size}>
      <Bar from={[6, 18]} to={[17, 7]} t={3.6} s={s} color={color} />
      <Bar from={[9.5, 6.5]} to={[17.5, 6.5]} t={3.6} s={s} color={color} />
      <Bar from={[17.5, 6.5]} to={[17.5, 14.5]} t={3.6} s={s} color={color} />
    </Frame>
  );
}
