// A decorative quarter web spun into the top corner, with a spider hanging from
// its dragline on a gentle sway. Purely ornamental.
//
// Colour comes from `currentColor` (set via a text-* utility), so the spider is
// near-black on the light theme and near-white on the dark one. The sway is
// disabled automatically under prefers-reduced-motion (see globals.css).

/**
 * The spider, drawn once at a comfortable scale and shrunk into place.
 *
 * It is a filled silhouette rather than stroked outlines: legs that taper from
 * a thick joint to a needle point can't be drawn with a uniform stroke width,
 * and the taper is what makes the shape read as a spider at this size. Each leg
 * is a closed crescent — an outer edge out to the tip, an inner edge back to
 * the body — and one side is mirrored to make the other.
 */
function Spider({ id }: { id: string }) {
  return (
    <g>
      <g id={id}>
        {/* front pair: out to a sharp elbow, then hooking high */}
        <path d="M 6 -32 C 34 -46 56 -56 58 -96 C 50 -56 36 -32 9 -24 Z" />
        {/* second pair: reaching wide, tips flicking up */}
        <path d="M 9 -21 C 40 -28 66 -30 78 -50 C 62 -22 38 -13 10 -11 Z" />
        {/* third pair: out and down */}
        <path d="M 10 -8 C 42 -6 68 4 78 38 C 60 12 36 6 9 2 Z" />
        {/* rear pair: the long sweep down */}
        <path d="M 9 4 C 34 16 52 42 57 88 C 45 44 25 22 6 15 Z" />
      </g>
      <use href={`#${id}`} transform="scale(-1,1)" />
      {/* one continuous body: thorax flowing into a slim, pointed abdomen */}
      <path
        d="M 0 -36 C 6.5 -36 9 -28 8 -18 C 10.5 0 10.5 14 7 32 C 4.5 50 2 60 0 70
           C -2 60 -4.5 50 -7 32 C -10.5 14 -10.5 0 -8 -18 C -9 -28 -6.5 -36 0 -36 Z"
      />
      {/* palps */}
      <path d="M -3.5 -36 C -6 -43 -8 -47 -10 -51 C -5.5 -46 -2.5 -41 -1.5 -36.5 Z" />
      <path d="M 3.5 -36 C 6 -43 8 -47 10 -51 C 5.5 -46 2.5 -41 1.5 -36.5 Z" />
    </g>
  );
}

export function CornerSpiderWeb({ className }: { className?: string }) {
  const W = 200;
  const H = 340;
  const cx = W; // web anchor = top-right corner
  const cy = 0;
  const spokes = 6;
  const rings = 4;
  const maxR = 150;

  // Quarter fan: from straight-down (90°) to straight-left (180°).
  const a0 = Math.PI / 2;
  const a1 = Math.PI;
  const angles = Array.from({ length: spokes }, (_, i) => a0 + (i / (spokes - 1)) * (a1 - a0));
  const radii = Array.from({ length: rings }, (_, i) => ((i + 1) / rings) * maxR);
  const pt = (r: number, a: number): readonly [number, number] => [
    cx + r * Math.cos(a),
    cy + r * Math.sin(a),
  ];

  // The spider hangs from a point on one of the inner spokes.
  const anchor = pt(maxR * 0.62, angles[2]);
  const sx = anchor[0];
  const threadTop = anchor[1];
  const sy = 246; // spider body centre
  // Big enough for the tapered legs to actually read; the spider still clears
  // the content column on the widths where the corner is visible at all.
  const scale = 0.5;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Web — spokes and sagging ring threads */}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.28}
      >
        {angles.map((a, i) => {
          const [x, y] = pt(maxR, a);
          return <line key={`spoke-${i}`} x1={cx} y1={cy} x2={x} y2={y} />;
        })}
        {radii.map((r, ri) => {
          let d = "";
          angles.forEach((a, i) => {
            const [x, y] = pt(r, a);
            if (i === 0) {
              d += `M ${x} ${y}`;
            } else {
              const [qx, qy] = pt(r * 0.9, (angles[i - 1] + a) / 2);
              d += ` Q ${qx} ${qy} ${x} ${y}`;
            }
          });
          return <path key={`ring-${ri}`} d={d} />;
        })}
      </g>

      {/* Dragline + spider, swaying from the web anchor */}
      <g className="spider-sway" style={{ transformOrigin: `${sx}px ${threadTop}px` }}>
        <line
          x1={sx}
          y1={threadTop}
          x2={sx}
          y2={sy - 18}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.4}
        />
        <g transform={`translate(${sx} ${sy}) scale(${scale})`} fill="currentColor">
          <Spider id="corner-spider-leg" />
        </g>
      </g>
    </svg>
  );
}
