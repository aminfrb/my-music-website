// A small, decorative quarter spider-web spun into the top-right corner, with a
// little spider dangling from a thread on a gentle sway. Purely ornamental.
// Color comes from `currentColor` (set via a text-* utility); the sway is
// disabled automatically under prefers-reduced-motion (see globals.css).

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
  const sy = 250; // spider body centre

  // Eight legs described once for the left side, then mirrored.
  const legs = [
    { y: -6, bx: -13, by: -12, ex: -18, ey: -6 },
    { y: -2, bx: -15, by: -3, ex: -20, ey: 2 },
    { y: 2, bx: -15, by: 6, ex: -19, ey: 11 },
    { y: 6, bx: -12, by: 12, ex: -15, ey: 19 },
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Web — spokes */}
      <g opacity={0.55}>
        {angles.map((a, i) => {
          const [x, y] = pt(maxR, a);
          return <line key={`spoke-${i}`} x1={cx} y1={cy} x2={x} y2={y} />;
        })}
        {/* Web — ring threads, sagging toward the corner between spokes */}
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
      <g
        className="spider-sway"
        style={{ transformOrigin: `${sx}px ${threadTop}px` }}
      >
        <line x1={sx} y1={threadTop} x2={sx} y2={sy - 14} strokeWidth={1} opacity={0.6} />
        <g transform={`translate(${sx} ${sy})`}>
          {legs.map((l, i) => (
            <path
              key={`leg-l-${i}`}
              d={`M -3 ${l.y} Q ${l.bx} ${l.by} ${l.ex} ${l.ey}`}
              strokeWidth={1.4}
            />
          ))}
          {legs.map((l, i) => (
            <path
              key={`leg-r-${i}`}
              d={`M 3 ${l.y} Q ${-l.bx} ${l.by} ${-l.ex} ${l.ey}`}
              strokeWidth={1.4}
            />
          ))}
          {/* Body */}
          <circle cx={0} cy={-8} r={4} fill="currentColor" stroke="none" />
          <ellipse cx={0} cy={4} rx={6.5} ry={9} fill="currentColor" stroke="none" />
        </g>
      </g>
    </svg>
  );
}
