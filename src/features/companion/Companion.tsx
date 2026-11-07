import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { CompanionMood, CompanionThemeV1 } from '../../contracts';
import { colors } from '../theme';

/**
 * The companion, drawn with plain views so it works on every platform without an SVG dependency.
 * Body and cheek colors come from the validated theme; eyes and mouth are always ink. The headpiece
 * sits on top of the head and the prop is held at the lower right, both in the theme's accent color
 * with ink outlines like the mockup's companion-system board.
 *
 * Geometry lives on a 96 x 104 unit canvas (the mockup's viewBox) and scales by size / 96. The body
 * is a 72-unit circle at the bottom, leaving ~30 units of headroom for hats. Nothing is drawn beyond
 * x 0..96, so the rendered box is exactly `size` wide and `size * 1.08` tall and callers that already
 * reserve that space keep working.
 */
export function Companion({ theme, mood = 'happy', size = 96 }: { theme: CompanionThemeV1; mood?: CompanionMood; size?: number }) {
  const s = size / 96;
  const accent = theme.accentColor;
  const eyeOffset = mood === 'curious' ? 2 * s : 0;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={describeCompanion(theme, mood)}
      style={{ width: size, height: size * 1.08 }}
    >
      {mood === 'cheering' && (
        <>
          <View style={[styles.arm, { backgroundColor: theme.bodyColor, width: 14 * s, height: 40 * s, left: 2 * s, top: 10 * s, transform: [{ rotate: '25deg' }] }]} />
          <View style={[styles.arm, { backgroundColor: theme.bodyColor, width: 14 * s, height: 40 * s, right: 2 * s, top: 10 * s, transform: [{ rotate: '-25deg' }] }]} />
        </>
      )}

      {/* Behind-the-head headpiece parts (the headphone band passes behind the head). */}
      {theme.headpiece === 'headphones' && <HeadphoneBand s={s} />}

      {/* Body and face. */}
      <View style={{ position: 'absolute', left: BODY.x * s, top: BODY.y * s, width: BODY.d * s, height: BODY.d * s, borderRadius: (BODY.d / 2) * s, backgroundColor: theme.bodyColor }}>
        {theme.headpiece === 'bandana' && <BandanaCap s={s} accent={accent} />}
        <Eye s={s} x={16} offset={eyeOffset} squint={mood === 'cheering'} />
        <Eye s={s} x={40} offset={eyeOffset} squint={mood === 'cheering'} />
        <View style={{ position: 'absolute', left: 6 * s, top: 40 * s, width: 9 * s, height: 9 * s, borderRadius: 5 * s, backgroundColor: theme.cheekColor }} />
        <View style={{ position: 'absolute', left: 57 * s, top: 40 * s, width: 9 * s, height: 9 * s, borderRadius: 5 * s, backgroundColor: theme.cheekColor }} />
        <Mouth s={s} mood={mood} />
      </View>

      <Headpiece kind={theme.headpiece} s={s} accent={accent} />
      {/* Held items are not drawn (owner decision 2026-11-07): the theme keeps the token, the art omits it. */}
    </View>
  );
}

/** Nonvisual description, e.g. "Zest, your companion, happy, wearing a sprig, holding a whisk". */
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PROP_LABEL: Record<Exclude<CompanionThemeV1['prop'], 'none'>, string> = {
  umbrella: 'an umbrella',
  whisk: 'a whisk',
  wrench: 'a wrench',
  book: 'a book',
  coin: 'a coin',
  brush: 'a brush',
  racket: 'a racket',
  guitar: 'a guitar',
  flag: 'a flag',
};

// Canvas geometry in 96-unit space. The body circle: x 12..84, y 30..102.
const BODY = { x: 12, y: 30, d: 72 } as const;
const HEAD_CX = BODY.x + BODY.d / 2;
// Where the prop is gripped (canvas coordinates); every prop's handle passes through this point.
const GRIP = { x: 84, y: 84 } as const;
const OUTLINE = 2.5;
const WHITE = '#FFFFFF';

/* ---------------------------------------------------------------- face */

function Eye({ s, x, offset, squint }: { s: number; x: number; offset: number; squint: boolean }) {
  if (squint) return <View style={{ position: 'absolute', left: (x + 1) * s, top: 28 * s, width: 14 * s, height: 4 * s, borderRadius: 2 * s, backgroundColor: colors.ink }} />;
  return (
    <View style={{ position: 'absolute', left: x * s, top: 22 * s, width: 16 * s, height: 16 * s, borderRadius: 8 * s, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 8 * s, height: 8 * s, borderRadius: 4 * s, backgroundColor: colors.ink, transform: [{ translateX: offset }] }} />
    </View>
  );
}

function Mouth({ s, mood }: { s: number; mood: CompanionMood }) {
  if (mood === 'thinking') return <View style={{ position: 'absolute', left: 28 * s, top: 46 * s, width: 16 * s, height: 3.5 * s, borderRadius: 2 * s, backgroundColor: colors.ink }} />;
  if (mood === 'cheering')
    return <View style={{ position: 'absolute', left: 22 * s, top: 40 * s, width: 28 * s, height: 16 * s, borderBottomLeftRadius: 14 * s, borderBottomRightRadius: 14 * s, backgroundColor: colors.ink }} />;
  return (
    <View
      style={{
        position: 'absolute',
        left: 25 * s,
        top: 42 * s,
        width: 22 * s,
        height: 11 * s,
        borderBottomLeftRadius: 11 * s,
        borderBottomRightRadius: 11 * s,
        borderWidth: 3.5 * s,
        borderTopWidth: 0,
        borderColor: colors.ink,
      }}
    />
  );
}

/* ---------------------------------------------------------------- drawing helpers */

/** A rounded rectangle (or circle when r >= min(w, h) / 2) in canvas units, optionally rotated about its center. */
type Part = { x: number; y: number; w: number; h: number; r?: number; rotate?: number; color?: string };

function Rect({ p, s, color, grow = 0 }: { p: Part; s: number; color: string; grow?: number }) {
  const style: ViewStyle = {
    position: 'absolute',
    left: (p.x - grow) * s,
    top: (p.y - grow) * s,
    width: (p.w + 2 * grow) * s,
    height: (p.h + 2 * grow) * s,
    borderRadius: ((p.r ?? 0) + grow) * s,
    backgroundColor: color,
    transform: p.rotate ? [{ rotate: `${p.rotate}deg` }] : undefined,
  };
  return <View style={style} />;
}

/**
 * A compound shape with one continuous ink outline: every part is first drawn in ink grown by the
 * outline width, then every part is drawn in its fill color on top, so overlaps leave no seams.
 */
function Outlined({ parts, s, fill, outline = OUTLINE }: { parts: Part[]; s: number; fill: string; outline?: number }) {
  return (
    <>
      {parts.map((p, i) => (
        <Rect key={`o${i}`} p={p} s={s} color={colors.ink} grow={outline} />
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
    borderWidth: width * s,
    borderColor: color,
    transform: rotate ? [{ rotate: `${rotate}deg` }] : undefined,
  };
  return <View style={style} />;
}

/** Darken a hex color so a single accent token can give a shape a shadow side or a stripe. */
function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  if (Number.isNaN(n)) return hex;
  const ch = (shift: number) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * factor)));
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('')}`;
}

/* ---------------------------------------------------------------- headpieces */

function Headpiece({ kind, s, accent }: { kind: CompanionThemeV1['headpiece']; s: number; accent: string }) {
  const top = BODY.y; // y of the top of the head
  switch (kind) {
    case 'none':
      return null;
    case 'bandana':
      // The cap is drawn inside the body so it clips to the head; only the knot lives out here.
      return <BandanaKnot s={s} accent={accent} />;
    case 'sprig':
      return (
        <>
          <Rect p={{ x: HEAD_CX - 1.5, y: top - 10, w: 3, h: 13, r: 1.5 }} s={s} color={colors.ink} />
          <Outlined
            s={s}
            fill={accent}
            outline={1.75}
            parts={[
              { x: HEAD_CX - 15, y: top - 20, w: 11, h: 20, r: 6, rotate: -38 },
              { x: HEAD_CX + 3, y: top - 23, w: 11, h: 22, r: 6, rotate: 30, color: shade(accent, 0.8) },
            ]}
          />
        </>
      );
    case 'chefHat':
      return (
        <>
          <Outlined
            s={s}
            fill={accent}
            parts={[
              { x: HEAD_CX - 13, y: top - 23, w: 26, h: 26, r: 13 },
              { x: HEAD_CX - 22, y: top - 16, w: 18, h: 18, r: 9 },
              { x: HEAD_CX + 4, y: top - 16, w: 18, h: 18, r: 9 },
              { x: HEAD_CX - 18, y: top - 10, w: 36, h: 10 },
              { x: HEAD_CX - 20, y: top - 4, w: 40, h: 9, r: 3, color: shade(accent, 0.86) },
            ]}
          />
        </>
      );
    case 'antenna':
      return (
        <>
          <Rect p={{ x: HEAD_CX - 1.5, y: top - 20, w: 3, h: 23, r: 1.5 }} s={s} color={colors.ink} />
          <Outlined s={s} fill={accent} parts={[{ x: HEAD_CX - 6, y: top - 28, w: 12, h: 12, r: 6 }]} />
          <Rect p={{ x: HEAD_CX - 3, y: top - 25.5, w: 3.5, h: 3.5, r: 2 }} s={s} color={WHITE} />
        </>
      );
    case 'beanie':
      return (
        <>
          {/* Dome: the head's own circle, clipped to its top 16 units, in accent with an ink edge. */}
          <View style={{ position: 'absolute', left: (BODY.x - OUTLINE) * s, top: (top - OUTLINE) * s, width: (BODY.d + 2 * OUTLINE) * s, height: 17 * s, overflow: 'hidden' }}>
            <View style={{ width: (BODY.d + 2 * OUTLINE) * s, height: (BODY.d + 2 * OUTLINE) * s, borderRadius: ((BODY.d + 2 * OUTLINE) / 2) * s, backgroundColor: colors.ink }} />
            <View style={{ position: 'absolute', left: OUTLINE * s, top: OUTLINE * s, width: BODY.d * s, height: BODY.d * s, borderRadius: (BODY.d / 2) * s, backgroundColor: accent }} />
          </View>
          {/* Cuff across the brow. */}
          <Outlined s={s} fill={shade(accent, 0.82)} parts={[{ x: HEAD_CX - 30, y: top + 11, w: 60, h: 9, r: 4.5 }]} />
          {/* Pom-pom. */}
          <Outlined s={s} fill={shade(accent, 1.15)} parts={[{ x: HEAD_CX - 7, y: top - 10, w: 14, h: 14, r: 7 }]} />
        </>
      );
    case 'headphones':
      return (
        <>
          <Outlined
            s={s}
            fill={accent}
            parts={[
              { x: 5, y: top + 22, w: 14, h: 22, r: 6 },
              { x: 77, y: top + 22, w: 14, h: 22, r: 6 },
            ]}
          />
          <Rect p={{ x: 9, y: top + 27, w: 3, h: 12, r: 1.5 }} s={s} color="rgba(255,255,255,0.55)" />
        </>
      );
    case 'leaf':
      return (
        <>
          <Rect p={{ x: HEAD_CX - 1.5, y: top - 7, w: 3, h: 10, r: 1.5 }} s={s} color={colors.ink} />
          <Outlined s={s} fill={accent} outline={1.75} parts={[{ x: HEAD_CX - 4, y: top - 21, w: 30, h: 13, r: 7, rotate: -22 }]} />
          <Rect p={{ x: HEAD_CX - 1, y: top - 15.5, w: 24, h: 1.6, r: 1, rotate: -22 }} s={s} color={shade(accent, 0.6)} />
        </>
      );
    case 'crown':
      return (
        <>
          <Outlined
            s={s}
            fill={accent}
            parts={[
              { x: HEAD_CX - 15, y: top - 19, w: 10, h: 10, r: 2, rotate: 45 },
              { x: HEAD_CX - 5, y: top - 22, w: 10, h: 10, r: 2, rotate: 45 },
              { x: HEAD_CX + 5, y: top - 19, w: 10, h: 10, r: 2, rotate: 45 },
              { x: HEAD_CX - 19, y: top - 14, w: 38, h: 15, r: 3 },
            ]}
          />
          <Rect p={{ x: HEAD_CX - 11.5, y: top - 7.5, w: 5, h: 5, r: 2.5 }} s={s} color={WHITE} />
          <Rect p={{ x: HEAD_CX - 2.5, y: top - 7.5, w: 5, h: 5, r: 2.5 }} s={s} color={WHITE} />
          <Rect p={{ x: HEAD_CX + 6.5, y: top - 7.5, w: 5, h: 5, r: 2.5 }} s={s} color={WHITE} />
        </>
      );
    case 'glasses': {
      // Lenses are centered on the eyes (body-relative eye centers at (24, 30) and (48, 30)).
      const ey = BODY.y + 30;
      const lens = { w: 24, h: 24, r: 12 };
      return (
        <>
          <Rect p={{ x: BODY.x + 2, y: ey - 1.75, w: 12, h: 3.5, r: 1.5 }} s={s} color={accent} />
          <Rect p={{ x: BODY.x + 58, y: ey - 1.75, w: 12, h: 3.5, r: 1.5 }} s={s} color={accent} />
          <Rect p={{ x: HEAD_CX - 4, y: ey - 1.75, w: 8, h: 3.5, r: 1.5 }} s={s} color={accent} />
          <Ring p={{ x: BODY.x + 24 - 12, y: ey - 12, ...lens }} s={s} color={accent} width={3.5} />
          <Ring p={{ x: BODY.x + 48 - 12, y: ey - 12, ...lens }} s={s} color={accent} width={3.5} />
        </>
      );
    }
  }
}

/** Headphone band: a thick ink arc behind the head, clipped so only the part above the ear cups shows. */
function HeadphoneBand({ s }: { s: number }) {
  const d = 86;
  return (
    <View style={{ position: 'absolute', left: (HEAD_CX - d / 2) * s, top: (BODY.y - 4) * s, width: d * s, height: 40 * s, overflow: 'hidden' }}>
      <View style={{ width: d * s, height: d * s, borderRadius: (d / 2) * s, borderWidth: 5 * s, borderColor: colors.ink }} />
    </View>
  );
}

/** Bandana cap: fills the head from the top down to the brow, clipped by the head circle (rendered inside the body). */
function BandanaCap({ s, accent }: { s: number; accent: string }) {
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: BODY.d * s, height: BODY.d * s, borderRadius: (BODY.d / 2) * s, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 19 * s, backgroundColor: accent }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 16.5 * s, height: OUTLINE * s, backgroundColor: colors.ink }} />
      <View style={{ position: 'absolute', left: 20 * s, top: 3 * s, width: 7 * s, height: 7 * s, borderRadius: 3.5 * s, backgroundColor: 'rgba(255,255,255,0.7)' }} />
      <View style={{ position: 'absolute', left: 34 * s, top: 8 * s, width: 5 * s, height: 5 * s, borderRadius: 2.5 * s, backgroundColor: 'rgba(255,255,255,0.7)' }} />
      <View style={{ position: 'absolute', left: 48 * s, top: 3 * s, width: 7 * s, height: 7 * s, borderRadius: 3.5 * s, backgroundColor: 'rgba(255,255,255,0.7)' }} />
    </View>
  );
}

/** Bandana knot and two tails at the right side of the head. */
function BandanaKnot({ s, accent }: { s: number; accent: string }) {
  return (
    <Outlined
      s={s}
      fill={accent}
      outline={1.75}
      parts={[
        { x: 78, y: BODY.y + 8, w: 16, h: 6, r: 3, rotate: 30 },
        { x: 79, y: BODY.y + 15, w: 15, h: 6, r: 3, rotate: -8 },
        { x: 74, y: BODY.y + 10, w: 9, h: 9, r: 4.5, color: shade(accent, 0.82) },
      ]}
    />
  );
}

/* ---------------------------------------------------------------- props */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Prop({ kind, s, accent, bodyColor }: { kind: CompanionThemeV1['prop']; s: number; accent: string; bodyColor: string }) {
  if (kind === 'none') return null;
  return (
    <>
      {/* Arm reaching out from the body to the grip. */}
      <Rect p={{ x: GRIP.x - 7, y: GRIP.y - 18, w: 12, h: 24, r: 6, rotate: -28 }} s={s} color={bodyColor} />
      <PropArt kind={kind} s={s} accent={accent} />
      {/* Hand closing over the handle. */}
      <Rect p={{ x: GRIP.x - 5.5, y: GRIP.y - 5, w: 11, h: 11, r: 5.5 }} s={s} color={bodyColor} />
    </>
  );
}

function PropArt({ kind, s, accent }: { kind: Exclude<CompanionThemeV1['prop'], 'none'>; s: number; accent: string }) {
  const gx = GRIP.x;
  const gy = GRIP.y;
  switch (kind) {
    case 'umbrella':
      return (
        <>
          <Rect p={{ x: gx - 1.5, y: gy - 20, w: 3, h: 34, r: 1.5 }} s={s} color={colors.ink} />
          <Rect p={{ x: gx - 4, y: gy + 11, w: 6, h: 4, r: 2 }} s={s} color={colors.ink} />
          {/* Canopy: the top half of an outlined, striped disc. */}
          <View style={{ position: 'absolute', left: (gx - 12 - OUTLINE) * s, top: (gy - 32 - OUTLINE) * s, width: (24 + 2 * OUTLINE) * s, height: (12 + OUTLINE) * s, overflow: 'hidden' }}>
            <View style={{ width: (24 + 2 * OUTLINE) * s, height: (24 + 2 * OUTLINE) * s, borderRadius: (12 + OUTLINE) * s, backgroundColor: colors.ink }} />
            <View style={{ position: 'absolute', left: OUTLINE * s, top: OUTLINE * s, width: 24 * s, height: 24 * s, borderRadius: 12 * s, backgroundColor: accent, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', left: 4 * s, top: 0, width: 4 * s, height: 24 * s, backgroundColor: shade(accent, 0.72) }} />
              <View style={{ position: 'absolute', left: 12 * s, top: 0, width: 4 * s, height: 24 * s, backgroundColor: shade(accent, 0.72) }} />
              <View style={{ position: 'absolute', left: 20 * s, top: 0, width: 4 * s, height: 24 * s, backgroundColor: shade(accent, 0.72) }} />
            </View>
          </View>
          <Rect p={{ x: gx - 12, y: gy - 21.5, w: 24, h: 2.5, r: 1 }} s={s} color={colors.ink} />
        </>
      );
    case 'whisk':
      return (
        <>
          <Ring p={{ x: gx - 7, y: gy - 34, w: 14, h: 26, r: 7 }} s={s} color={colors.ink} width={1.75} />
          <Ring p={{ x: gx - 3, y: gy - 34, w: 6, h: 26, r: 3 }} s={s} color={colors.ink} width={1.75} />
          <Rect p={{ x: gx - 2, y: gy - 24, w: 4, h: 16 }} s={s} color={colors.ink} />
          <Outlined s={s} fill={accent} outline={1.75} parts={[{ x: gx - 3, y: gy - 10, w: 6, h: 24, r: 3 }]} />
        </>
      );
    case 'wrench':
      return (
        <>
          <Outlined
            s={s}
            fill={accent}
            parts={[
              { x: gx - 3.5, y: gy - 16, w: 7, h: 30, r: 3.5, rotate: 18 },
              { x: gx - 8, y: gy - 26, w: 16, h: 16, r: 8, rotate: 18 },
            ]}
          />
          {/* Open jaw. */}
          <Rect p={{ x: gx - 2.5, y: gy - 28, w: 5, h: 8, r: 1, rotate: 18 }} s={s} color={colors.ink} />
        </>
      );
    case 'book':
      return (
        <>
          <Outlined s={s} fill={accent} parts={[{ x: gx - 10, y: gy - 20, w: 20, h: 24, r: 3, rotate: -12 }]} />
          <Rect p={{ x: gx - 10, y: gy - 20, w: 5, h: 24, r: 2, rotate: -12 }} s={s} color={shade(accent, 0.7)} />
          <Rect p={{ x: gx - 2, y: gy - 13, w: 9, h: 2, r: 1, rotate: -12 }} s={s} color="rgba(255,255,255,0.8)" />
          <Rect p={{ x: gx - 1, y: gy - 8, w: 9, h: 2, r: 1, rotate: -12 }} s={s} color="rgba(255,255,255,0.8)" />
        </>
      );
    case 'coin':
      return (
        <>
          <Outlined s={s} fill={accent} parts={[{ x: gx - 11, y: gy - 23, w: 22, h: 22, r: 11 }]} />
          <Ring p={{ x: gx - 7, y: gy - 19, w: 14, h: 14, r: 7 }} s={s} color={shade(accent, 0.7)} width={2} />
          <Rect p={{ x: gx - 1.5, y: gy - 16, w: 3, h: 8, r: 1.5 }} s={s} color={shade(accent, 0.7)} />
          <Rect p={{ x: gx + 2, y: gy - 20.5, w: 3.5, h: 3.5, r: 2 }} s={s} color="rgba(255,255,255,0.85)" />
        </>
      );
    case 'brush':
      return (
        <>
          <Outlined s={s} fill={accent} outline={1.75} parts={[{ x: gx - 2.5, y: gy - 12, w: 5, h: 26, r: 2.5 }]} />
          <Rect p={{ x: gx - 4.5, y: gy - 17, w: 9, h: 6, r: 1 }} s={s} color={colors.ink} />
          <Outlined s={s} fill={WHITE} outline={1.75} parts={[{ x: gx - 5, y: gy - 30, w: 10, h: 15, r: 4 }]} />
          <View style={{ position: 'absolute', left: (gx - 5) * s, top: (gy - 30) * s, width: 10 * s, height: 6 * s, borderTopLeftRadius: 4 * s, borderTopRightRadius: 4 * s, backgroundColor: accent }} />
        </>
      );
    case 'racket':
      return (
        <>
          <Rect p={{ x: gx - 2, y: gy - 14, w: 4, h: 28, r: 2, rotate: -14 }} s={s} color={colors.ink} />
          <View
            style={{
              position: 'absolute',
              left: (gx - 10) * s,
              top: (gy - 36) * s,
              width: 20 * s,
              height: 26 * s,
              borderRadius: 11 * s,
              borderWidth: 3.5 * s,
              borderColor: accent,
              backgroundColor: 'rgba(255,255,255,0.75)',
              overflow: 'hidden',
              transform: [{ rotate: '-14deg' }],
            }}
          >
            <View style={{ position: 'absolute', left: 6.5 * s, top: 0, width: 1.5 * s, height: 26 * s, backgroundColor: colors.ink, opacity: 0.6 }} />
            <View style={{ position: 'absolute', left: 11 * s, top: 0, width: 1.5 * s, height: 26 * s, backgroundColor: colors.ink, opacity: 0.6 }} />
            <View style={{ position: 'absolute', left: 0, top: 7 * s, width: 20 * s, height: 1.5 * s, backgroundColor: colors.ink, opacity: 0.6 }} />
            <View style={{ position: 'absolute', left: 0, top: 13 * s, width: 20 * s, height: 1.5 * s, backgroundColor: colors.ink, opacity: 0.6 }} />
          </View>
          <Ring p={{ x: gx - 10, y: gy - 36, w: 20, h: 26, r: 11 }} s={s} color={colors.ink} width={1.5} rotate={-14} />
        </>
      );
    case 'guitar':
      return (
        <>
          <Rect p={{ x: gx - 2, y: gy - 36, w: 4, h: 26, r: 1.5, rotate: -12 }} s={s} color={colors.ink} />
          <Outlined s={s} fill={shade(accent, 0.75)} outline={1.75} parts={[{ x: gx - 6, y: gy - 41, w: 7, h: 8, r: 2, rotate: -12 }]} />
          <Outlined
            s={s}
            fill={accent}
            parts={[
              { x: gx - 7, y: gy - 16, w: 14, h: 14, r: 7, rotate: -12 },
              { x: gx - 9, y: gy - 7, w: 18, h: 18, r: 9, rotate: -12 },
            ]}
          />
          <Rect p={{ x: gx - 3, y: gy - 5, w: 6, h: 6, r: 3, rotate: -12 }} s={s} color={colors.ink} />
          <Rect p={{ x: gx - 0.5, y: gy - 16, w: 1.2, h: 24, rotate: -12 }} s={s} color="rgba(255,255,255,0.8)" />
        </>
      );
    case 'flag':
      return (
        <>
          <Rect p={{ x: gx - 1.5, y: gy - 38, w: 3, h: 50, r: 1.5 }} s={s} color={colors.ink} />
          <Rect p={{ x: gx - 3, y: gy - 40, w: 6, h: 6, r: 3 }} s={s} color={colors.ink} />
          <Outlined s={s} fill={accent} parts={[{ x: gx - 23, y: gy - 36, w: 22, h: 15, r: 2 }]} />
          <Rect p={{ x: gx - 17, y: gy - 32, w: 7, h: 7, r: 3.5 }} s={s} color="rgba(255,255,255,0.85)" />
        </>
      );
  }
}

const styles = StyleSheet.create({
  arm: { position: 'absolute', borderRadius: 999 },
});
