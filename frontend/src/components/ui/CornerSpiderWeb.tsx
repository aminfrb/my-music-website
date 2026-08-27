// A decorative quarter web spun into the top corner, with the brand spider
// hanging from its dragline on a gentle sway. Purely ornamental.
//
// Colour comes from `currentColor` (set via a text-* utility), so the spider is
// near-black on the light theme and near-white on the dark one. The sway is
// disabled automatically under prefers-reduced-motion (see globals.css).

import { SpiderMark, SPIDER_HEAD_Y } from "./SpiderMark";

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
  const sy = 246; // spider centre
  // Large enough for the legs to read, small enough that the spider still
  // clears the content column on the widths where the corner shows at all.
  const scale = 0.45;

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
          y2={sy + SPIDER_HEAD_Y * scale}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.4}
        />
        <g transform={`translate(${sx} ${sy}) scale(${scale})`} fill="currentColor">
          <SpiderMark />
        </g>
      </g>
    </svg>
  );
}
