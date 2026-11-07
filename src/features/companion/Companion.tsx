import { View, type ViewStyle } from 'react-native';
import type { CompanionMood, CompanionThemeV1 } from '../../contracts';
import { colors } from '../theme';

/**
 * Poko, the companion, drawn with plain views so it works on every platform without an SVG
 * dependency. The body, face and moods are fixed app assets; the validated theme supplies the body
 * color, cheek color, accent color and headpiece (props are in the contract but not drawn). Every other tone (belly patch, rim shadow,
 * highlight, feet, costume shading) is derived from those three colors in code, so any generated
 * palette produces a finished-looking character.
 *
 * Geometry lives on a 96 x 104 unit canvas and scales by `size / 96`. Nothing is drawn outside
 * x 0..96 / y 0..104, so the rendered box is exactly `size` wide and `size * 1.08` tall. Strokes
 * never fall below 1.5 device-independent pixels so the character still reads at 44.
 *
 * Layers, back to front: headphone band · feet · body (head, shoulders, belly as one outlined
 * silhouette) · rim shadow · belly patch · highlight · face · headpiece. No arms or hands (owner decision).
 */
export function Companion({ theme, mood = 'happy', size = 96 }: { theme: CompanionThemeV1; mood?: CompanionMood; size?: number }) {
  const s = size / 96;
  const pal = derivePalette(theme);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={describeCompanion(theme, mood)} style={{ width: size, height: size * 1.08 }}>
      {theme.headpiece === 'headphones' && <HeadphoneBand s={s} accent={theme.accentColor} />}

      <Outlined s={s} fill={pal.feet} parts={FEET} />
      <Outlined s={s} fill={theme.bodyColor} parts={BODY_PARTS} />
      {/* Rim shadow: the belly pill in a deeper tone, then the body tone shifted up, leaving a crescent at the bottom edge. */}
      <Rect p={BELLY} s={s} color={pal.bodyDeep} />
      <Rect p={{ ...BELLY, y: BELLY.y - 4 }} s={s} color={theme.bodyColor} />
      <Rect p={BELLY_PATCH} s={s} color={pal.belly} />
      <Rect p={HIGHLIGHT} s={s} color={pal.bodyLight} />

      <Face s={s} mood={mood} theme={theme} />
      <Headpiece kind={theme.headpiece} s={s} accent={theme.accentColor} pal={pal} />
      {/* No arms or hands (owner decision 2026-11-07, #61): the body, face and headpiece carry the character. */}
    </View>
  );
}

/**
 * Nonvisual description, e.g. "Zest, your companion, happy, wearing a sprig". Props are part of the
 * contract but are not rendered (owner decision 2026-11-07), so they are not described either.
 */
export function describeCompanion(theme: CompanionThemeV1, mood: CompanionMood): string {
  const parts = [`${theme.name}, your companion`, mood];
  if (theme.headpiece !== 'none') parts.push(`wearing ${HEADPIECE_LABEL[theme.headpiece]}`);
  return parts.join(', ');
}

const HEADPIECE_LABEL: Record<Exclude<CompanionThemeV1['headpiece'], 'none'>, string> = {
  sprig: 'a sprig',
  chefHat: 'a chef hat',
  antenna: 'an antenna',
  beanie: 'a beanie',
  headphones: 'headphones',
  leaf: 'a leaf',
  crown: 'a crown',
  glasses: 'glasses',
  bandana: 'a bandana',
};


/* ---------------------------------------------------------------- geometry (96 x 104 canvas units) */

type Pt = { x: number; y: number };
/** A rounded rectangle (or circle when r >= min(w, h) / 2) in canvas units, optionally rotated about its center. */
type Part = { x: number; y: number; w: number; h: number; r?: number; radii?: [number, number, number, number]; rotate?: number; color?: string };

const INK = colors.ink;
const WHITE = '#FFFFFF';
const OUTLINE = 2.5;
const THIN = 1.75;
const MIN_STROKE_PX = 1.5;

/** The head: a 60-unit circle whose top sits at y 16, leaving 16 units of headroom for costumes. */
const HEAD = { cx: 48, cy: 46, r: 30 } as const;
/** Head, shoulders and belly overlap into one pear silhouette, wider at the bottom. */
const BELLY: Part = { x: 12, y: 46, w: 72, h: 46, r: 23 };
const BODY_PARTS: Part[] = [
  { x: HEAD.cx - HEAD.r, y: HEAD.cy - HEAD.r, w: HEAD.r * 2, h: HEAD.r * 2, r: HEAD.r },
  { x: 15, y: 40, w: 66, h: 42, r: 21 },
  BELLY,
];
const FEET: Part[] = [
  { x: 20, y: 90, w: 20, h: 10, r: 5 },
  { x: 56, y: 90, w: 20, h: 10, r: 5 },
];
const BELLY_PATCH: Part = { x: 31, y: 68, w: 34, h: 20, r: 10 };
const HIGHLIGHT: Part = { x: 26, y: 23, w: 13, h: 7, r: 3.5, rotate: -35 };

const EYE = { lx: 36, rx: 60, y: 44, d: 20, iris: 11 } as const;
function disc(center: Pt, d: number, color?: string): Part {
  return { x: center.x - d / 2, y: center.y - d / 2, w: d, h: d, r: d / 2, color };
}

/* ---------------------------------------------------------------- color */

function parseHex(hex: string): [number, number, number] | null {
  const n = parseInt(hex.slice(1, 7), 16);
  if (hex.length !== 7 || Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear mix of `hex` toward `target` by `t` (0 keeps hex, 1 gives target). Unparseable input is returned as is. */
function mix(hex: string, target: string, t: number): string {
  const a = parseHex(hex);
  const b = parseHex(target);
  if (!a || !b) return hex;
  return `#${a.map((c, i) => Math.round(c + ((b[i] ?? c) - c) * t).toString(16).padStart(2, '0')).join('')}`;
}

type Palette = { bodyLight: string; belly: string; bodyDeep: string; feet: string; accentDeep: string; accentLight: string };

function derivePalette(theme: CompanionThemeV1): Palette {
  return {
    bodyLight: mix(theme.bodyColor, WHITE, 0.55),
    belly: mix(theme.bodyColor, WHITE, 0.3),
    bodyDeep: mix(theme.bodyColor, INK, 0.22),
    feet: mix(theme.bodyColor, INK, 0.14),
    accentDeep: mix(theme.accentColor, INK, 0.3),
    accentLight: mix(theme.accentColor, WHITE, 0.4),
  };
}

/* ---------------------------------------------------------------- drawing helpers */

/** Stroke width in canvas units that never renders thinner than MIN_STROKE_PX. */
function stroke(units: number, s: number): number {
  return Math.max(units * s, MIN_STROKE_PX) / s;
}

function cornerStyle(p: Part, grow: number, s: number): ViewStyle {
  if (p.radii) {
    const [tl, tr, br, bl] = p.radii;
    return {
      borderTopLeftRadius: (tl + grow) * s,
      borderTopRightRadius: (tr + grow) * s,
      borderBottomRightRadius: (br + grow) * s,
      borderBottomLeftRadius: (bl + grow) * s,
    };
  }
  return { borderRadius: ((p.r ?? 0) + grow) * s };
}

function Rect({ p, s, color, grow = 0, opacity }: { p: Part; s: number; color: string; grow?: number; opacity?: number }) {
  const style: ViewStyle = {
    position: 'absolute',
    left: (p.x - grow) * s,
    top: (p.y - grow) * s,
    width: (p.w + 2 * grow) * s,
    height: (p.h + 2 * grow) * s,
    backgroundColor: color,
    opacity,
    transform: p.rotate ? [{ rotate: `${p.rotate}deg` }] : undefined,
    ...cornerStyle(p, grow, s),
  };
  return <View style={style} />;
}

/**
 * A compound shape with one continuous ink outline: every part is first drawn in ink grown by the
 * outline width, then every part is drawn in its fill color on top, so overlaps leave no seams.
 */
function Outlined({ parts, s, fill, outline = OUTLINE }: { parts: Part[]; s: number; fill: string; outline?: number }) {
  const grow = stroke(outline, s);
  return (
    <>
      {parts.map((p, i) => (
        <Rect key={`o${i}`} p={p} s={s} color={INK} grow={grow} />
      ))}
      {parts.map((p, i) => (
        <Rect key={`f${i}`} p={p} s={s} color={p.color ?? fill} />
      ))}
    </>
  );
}

/** A circle or rounded rect drawn as a ring (transparent inside), in canvas units. */
function Ring({ p, s, color, width, rotate }: { p: Omit<Part, 'rotate'>; s: number; color: string; width: number; rotate?: number }) {
  const style: ViewStyle = {
    position: 'absolute',
    left: p.x * s,
    top: p.y * s,
    width: p.w * s,
    height: p.h * s,
    borderRadius: (p.r ?? 0) * s,
    borderWidth: stroke(width, s) * s,
    borderColor: color,
    transform: rotate ? [{ rotate: `${rotate}deg` }] : undefined,
  };
  return <View style={style} />;
}

type Clip = { x: number; y: number; w: number; h: number };

/**
 * Part of a circular ring: the ring (outer radius `r`, stroke `width`, centered on cx, cy) clipped
 * to `clip`. Bands that wrap the head, smiles and closed eyes are all arcs.
 */
function Arc({ cx, cy, r, width, clip, s, color }: { cx: number; cy: number; r: number; width: number; clip: Clip; s: number; color: string }) {
  return (
    <View style={{ position: 'absolute', left: clip.x * s, top: clip.y * s, width: clip.w * s, height: clip.h * s, overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          left: (cx - r - clip.x) * s,
          top: (cy - r - clip.y) * s,
          width: 2 * r * s,
          height: 2 * r * s,
          borderRadius: r * s,
          borderWidth: stroke(width, s) * s,
          borderColor: color,
        }}
      />
    </View>
  );
}

/** An arc with an ink outline and round caps at its cut ends (the caps are drawn outside the clip). */
function OutlinedArc({ cx, cy, r, width, clip, caps, s, fill, outline = OUTLINE }: { cx: number; cy: number; r: number; width: number; clip: Clip; caps: Pt[]; s: number; fill: string; outline?: number }) {
  const o = stroke(outline, s);
  return (
    <>
      <Arc cx={cx} cy={cy} r={r + o} width={width + 2 * o} clip={{ x: clip.x - o, y: clip.y - o, w: clip.w + 2 * o, h: clip.h + o }} s={s} color={INK} />
      {caps.map((c, i) => (
        <Rect key={`c${i}`} p={disc(c, width)} s={s} color={INK} grow={o} />
      ))}
      <Arc cx={cx} cy={cy} r={r} width={width} clip={clip} s={s} color={fill} />
      {caps.map((c, i) => (
        <Rect key={`f${i}`} p={disc(c, width)} s={s} color={fill} />
      ))}
    </>
  );
}

/** The head circle (grown by `grow`) clipped to y `top`..`bottom`, with an ink edge: beanie domes and bandana caps. */
function Cap({ s, fill, top, bottom, grow = 1 }: { s: number; fill: string; top: number; bottom: number; grow?: number }) {
  const o = stroke(OUTLINE, s);
  const r = HEAD.r + grow;
  return (
    <View style={{ position: 'absolute', left: (HEAD.cx - r - o) * s, top: top * s, width: 2 * (r + o) * s, height: (bottom - top) * s, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, top: (HEAD.cy - r - o - top) * s, width: 2 * (r + o) * s, height: 2 * (r + o) * s, borderRadius: (r + o) * s, backgroundColor: INK }} />
      <View style={{ position: 'absolute', left: o * s, top: (HEAD.cy - r - top) * s, width: 2 * r * s, height: 2 * r * s, borderRadius: r * s, backgroundColor: fill }} />
    </View>
  );
}

/* ---------------------------------------------------------------- face */

function Face({ s, mood, theme }: { s: number; mood: CompanionMood; theme: CompanionThemeV1 }) {
  const pal = { tongue: mix(theme.cheekColor, '#C2185B', 0.45) };
  return (
    <>
      <Rect p={{ x: 21, y: 52, w: 14, h: 8, r: 4 }} s={s} color={theme.cheekColor} />
      <Rect p={{ x: 61, y: 52, w: 14, h: 8, r: 4 }} s={s} color={theme.cheekColor} />
      <Eye s={s} cx={EYE.lx} cy={EYE.y} mood={mood} lid={theme.bodyColor} />
      <Eye s={s} cx={EYE.rx} cy={EYE.y} mood={mood} lid={theme.bodyColor} />
      <Brows s={s} mood={mood} />
      <Mouth s={s} mood={mood} tongue={pal.tongue} />
    </>
  );
}

function Eye({ s, cx, cy, mood, lid }: { s: number; cx: number; cy: number; mood: CompanionMood; lid: string }) {
  if (mood === 'cheering') {
    // Happy closed eye: the top of a ring.
    return <OutlinedArc cx={cx} cy={cy + 2} r={8.5} width={3} clip={{ x: cx - 9, y: cy - 7, w: 18, h: 9 }} caps={[{ x: cx - 6.7, y: cy + 2 }, { x: cx + 6.7, y: cy + 2 }]} s={s} fill={INK} outline={0} />;
  }
  const o = stroke(THIN, s);
  const d = EYE.d;
  const look = mood === 'thinking' ? { x: 3, y: -2 } : mood === 'curious' ? { x: 1.5, y: -1 } : { x: 0, y: 0 };
  const iris = EYE.iris;
  const irisX = (d - iris) / 2 + look.x;
  const irisY = (d - iris) / 2 + look.y;
  return (
    <View style={{ position: 'absolute', left: (cx - d / 2 - o) * s, top: (cy - d / 2 - o) * s, width: (d + 2 * o) * s, height: (d + 2 * o) * s, borderRadius: (d / 2 + o) * s, backgroundColor: INK }}>
      <View style={{ position: 'absolute', left: o * s, top: o * s, width: d * s, height: d * s, borderRadius: (d / 2) * s, backgroundColor: WHITE, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: irisX * s, top: irisY * s, width: iris * s, height: iris * s, borderRadius: (iris / 2) * s, backgroundColor: INK }} />
        <View style={{ position: 'absolute', left: (irisX + 1.5) * s, top: (irisY + 1.5) * s, width: 4 * s, height: 4 * s, borderRadius: 2 * s, backgroundColor: WHITE }} />
        {mood === 'thinking' && (
          <View style={{ position: 'absolute', left: -2 * s, right: -2 * s, top: -2 * s, height: (d * 0.45 + 2) * s, backgroundColor: lid, borderBottomWidth: o * s, borderBottomColor: INK }} />
        )}
      </View>
    </View>
  );
}

function Brows({ s, mood }: { s: number; mood: CompanionMood }) {
  const t = stroke(3, s);
  if (mood === 'curious')
    return (
      <>
        <Rect p={{ x: 27, y: 27.5, w: 14, h: t, r: t / 2, rotate: -12 }} s={s} color={INK} />
        <Rect p={{ x: 55, y: 27.5, w: 14, h: t, r: t / 2, rotate: 12 }} s={s} color={INK} />
      </>
    );
  if (mood === 'thinking')
    return (
      <>
        <Rect p={{ x: 29, y: 31, w: 13, h: t, r: t / 2, rotate: 8 }} s={s} color={INK} />
        <Rect p={{ x: 54, y: 27, w: 13, h: t, r: t / 2, rotate: -10 }} s={s} color={INK} />
      </>
    );
  return null;
}

function Mouth({ s, mood, tongue }: { s: number; mood: CompanionMood; tongue: string }) {
  switch (mood) {
    case 'cheering':
      return (
        <>
          <Rect p={{ x: 36, y: 57, w: 24, h: 13, radii: [2, 2, 12, 12] }} s={s} color={INK} />
          <View style={{ position: 'absolute', left: 36 * s, top: 57 * s, width: 24 * s, height: 13 * s, borderBottomLeftRadius: 12 * s, borderBottomRightRadius: 12 * s, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', left: 5 * s, top: 7 * s, width: 14 * s, height: 14 * s, borderRadius: 7 * s, backgroundColor: tongue }} />
          </View>
        </>
      );
    case 'thinking':
      return <Rect p={{ x: 49, y: 62, w: 11, h: stroke(3, s), r: 1.5, rotate: -14 }} s={s} color={INK} />;
    case 'curious':
      return <Rect p={disc({ x: 48, y: 62 }, 6.5)} s={s} color={INK} />;
    default:
      // Smile: the bottom of a ring, with round ends.
      return <OutlinedArc cx={48} cy={55} r={11} width={3.25} clip={{ x: 36, y: 59, w: 24, h: 8 }} caps={[{ x: 39.5, y: 59 }, { x: 56.5, y: 59 }]} s={s} fill={INK} outline={0} />;
  }
}

/* ---------------------------------------------------------------- headpieces */

function Headpiece({ kind, s, accent, pal }: { kind: CompanionThemeV1['headpiece']; s: number; accent: string; pal: Palette }) {
  const cx = HEAD.cx;
  switch (kind) {
    case 'none':
      return null;
    case 'sprig':
      return (
        <>
          <Rect p={{ x: cx - 1.5, y: 11, w: 3, h: 9, r: 1.5 }} s={s} color={INK} />
          <Outlined
            s={s}
            fill={accent}
            outline={THIN}
            parts={[
              { x: cx - 11.5, y: 2.7, w: 9, h: 14, r: 4.5, rotate: -62 },
              { x: cx + 1.5, y: 2.7, w: 9, h: 14, r: 4.5, rotate: 62, color: pal.accentDeep },
            ]}
          />
          <Rect p={{ x: cx - 7.6, y: 4.7, w: 1.2, h: 10, r: 0.6, rotate: -62 }} s={s} color={pal.accentLight} />
          <Rect p={{ x: cx + 5.4, y: 4.7, w: 1.2, h: 10, r: 0.6, rotate: 62 }} s={s} color={pal.accentLight} />
        </>
      );
    case 'chefHat':
      return (
        <>
          <Outlined
            s={s}
            fill={accent}
            parts={[
              { x: cx - 18, y: 6.5, w: 13, h: 13, r: 6.5 },
              { x: cx + 5, y: 6.5, w: 13, h: 13, r: 6.5 },
              { x: cx - 7.5, y: 2.5, w: 15, h: 15, r: 7.5 },
            ]}
          />
          <OutlinedArc cx={cx} cy={HEAD.cy} r={34} width={8} clip={{ x: 8, y: 12, w: 80, h: 14 }} caps={[{ x: 25.6, y: 26 }, { x: 70.4, y: 26 }]} s={s} fill={pal.accentDeep} />
        </>
      );
    case 'antenna':
      return (
        <>
          <Outlined s={s} fill={pal.accentDeep} outline={2} parts={[{ x: cx - 5.5, y: 14, w: 11, h: 6, r: 3 }]} />
          <Rect p={{ x: cx - 1.25, y: 7, w: 2.5, h: 9 }} s={s} color={INK} />
          <Outlined s={s} fill={accent} outline={2} parts={[disc({ x: cx, y: 7 }, 9)]} />
          <Rect p={disc({ x: cx - 1.5, y: 5.5 }, 2.8)} s={s} color={WHITE} />
        </>
      );
    case 'beanie':
      return (
        <>
          <Cap s={s} fill={accent} top={12.5} bottom={30} />
          <Rect p={{ x: cx - 9, y: 17, w: 1.6, h: 11, r: 0.8, rotate: 8 }} s={s} color={pal.accentDeep} />
          <Rect p={{ x: cx - 0.8, y: 15.5, w: 1.6, h: 12, r: 0.8 }} s={s} color={pal.accentDeep} />
          <Rect p={{ x: cx + 7.4, y: 17, w: 1.6, h: 11, r: 0.8, rotate: -8 }} s={s} color={pal.accentDeep} />
          <OutlinedArc cx={cx} cy={HEAD.cy} r={34.5} width={7.5} clip={{ x: 8, y: 19.5, w: 80, h: 13.5 }} caps={[{ x: 20.1, y: 33 }, { x: 75.9, y: 33 }]} s={s} fill={pal.accentDeep} />
          <Outlined s={s} fill={pal.accentLight} parts={[disc({ x: cx, y: 13 }, 13)]} />
        </>
      );
    case 'headphones':
      return (
        <>
          <Outlined
            s={s}
            fill={accent}
            parts={[
              { x: 8, y: 36, w: 14, h: 22, r: 6 },
              { x: 74, y: 36, w: 14, h: 22, r: 6 },
            ]}
          />
          <Rect p={{ x: 11, y: 40, w: 8, h: 14, r: 4 }} s={s} color={pal.accentDeep} />
          <Rect p={{ x: 77, y: 40, w: 8, h: 14, r: 4 }} s={s} color={pal.accentDeep} />
          <Rect p={{ x: 10, y: 39, w: 2, h: 7, r: 1 }} s={s} color={WHITE} opacity={0.6} />
          <Rect p={{ x: 76, y: 39, w: 2, h: 7, r: 1 }} s={s} color={WHITE} opacity={0.6} />
        </>
      );
    case 'leaf':
      return (
        <>
          <Rect p={{ x: cx - 1.5, y: 12, w: 3, h: 7, r: 1.5 }} s={s} color={INK} />
          <Outlined s={s} fill={accent} outline={THIN} parts={[{ x: cx - 2, y: 5, w: 26, h: 12, r: 6, rotate: -15 }]} />
          <Rect p={{ x: cx, y: 10.3, w: 22, h: 1.4, r: 0.7, rotate: -15 }} s={s} color={pal.accentDeep} />
          <Rect p={disc({ x: cx + 15, y: 7.5 }, 3)} s={s} color={WHITE} opacity={0.85} />
        </>
      );
    case 'crown':
      return (
        <>
          <Outlined
            s={s}
            fill={accent}
            parts={[
              { x: cx - 16.5, y: 7.5, w: 9, h: 9, r: 1.5, rotate: 45 },
              { x: cx - 4.5, y: 4.5, w: 9, h: 9, r: 1.5, rotate: 45 },
              { x: cx + 7.5, y: 7.5, w: 9, h: 9, r: 1.5, rotate: 45 },
            ]}
          />
          <OutlinedArc cx={cx} cy={HEAD.cy} r={35} width={9} clip={{ x: 6, y: 8.5, w: 84, h: 18.5 }} caps={[{ x: 24.1, y: 27 }, { x: 71.9, y: 27 }]} s={s} fill={accent} />
          <Rect p={disc({ x: cx - 11, y: 19 }, 4)} s={s} color={pal.accentDeep} />
          <Rect p={disc({ x: cx, y: 16.5 }, 4)} s={s} color={pal.accentDeep} />
          <Rect p={disc({ x: cx + 11, y: 19 }, 4)} s={s} color={pal.accentDeep} />
        </>
      );
    case 'glasses':
      return (
        <>
          <Outlined s={s} fill={accent} outline={1.5} parts={[{ x: 9, y: 42.5, w: 15, h: 3.5, r: 1.75 }, { x: 72, y: 42.5, w: 15, h: 3.5, r: 1.75 }, { x: 45, y: 41.5, w: 6, h: 4, r: 1.5 }]} />
          {[EYE.lx, EYE.rx].map((ex) => (
            <View key={ex}>
              <Ring p={{ x: ex - 13.5, y: EYE.y - 13.5, w: 27, h: 27, r: 13.5 }} s={s} color={INK} width={6} />
              <Ring p={{ x: ex - 12, y: EYE.y - 12, w: 24, h: 24, r: 12 }} s={s} color={accent} width={3} />
              <Rect p={{ x: ex - 7, y: EYE.y - 8, w: 4.5, h: 2, r: 1, rotate: -35 }} s={s} color={WHITE} opacity={0.75} />
            </View>
          ))}
        </>
      );
    case 'bandana':
      return (
        <>
          <Cap s={s} fill={accent} top={12.5} bottom={31} />
          <Rect p={disc({ x: 36, y: 20 }, 5)} s={s} color={WHITE} opacity={0.8} />
          <Rect p={disc({ x: 48, y: 25 }, 4)} s={s} color={WHITE} opacity={0.8} />
          <Rect p={disc({ x: 59, y: 18.5 }, 5)} s={s} color={WHITE} opacity={0.8} />
          <Rect p={disc({ x: 27, y: 27 }, 3.5)} s={s} color={WHITE} opacity={0.8} />
          <Rect p={{ x: 18.5, y: 29, w: 59, h: stroke(OUTLINE, s), r: 1 }} s={s} color={INK} />
          <Outlined
            s={s}
            fill={accent}
            outline={THIN}
            parts={[
              { x: 78, y: 23, w: 14, h: 6, r: 3, rotate: 25 },
              { x: 79, y: 30, w: 13, h: 6, r: 3, rotate: -8 },
              { x: 73, y: 25.5, w: 9, h: 9, r: 4.5, color: pal.accentDeep },
            ]}
          />
        </>
      );
  }
}

/** Headphone band: an ink arc with an accent stripe, drawn behind the body so the head covers its lower half. */
function HeadphoneBand({ s, accent }: { s: number; accent: string }) {
  const clip = { x: 6, y: 8.5, w: 84, h: 31.5 };
  return (
    <>
      <Arc cx={HEAD.cx} cy={HEAD.cy} r={37.5} width={5} clip={clip} s={s} color={INK} />
      <Arc cx={HEAD.cx} cy={HEAD.cy} r={36.25} width={2.5} clip={clip} s={s} color={accent} />
    </>
  );
}
