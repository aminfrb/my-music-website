// Minimal, themeable spider-web SVG (a nod to Spider-Man). Purely decorative.
// Stroke uses `currentColor`, so control it with any text color utility
// (e.g. `text-primary/10`). Threads sag slightly toward the center for a
// hand-spun, web-like feel.

export function SpiderWeb({
  className,
  spokes = 12,
  rings = 5,
  strokeWidth = 1,
}: {
  className?: string;
  spokes?: number;
  rings?: number;
  strokeWidth?: number;
}) {
  const size = 100;
  const c = size / 2;
  const maxR = size / 2;
  const sag = 0.86; // how far ring threads dip toward the center between spokes

  const angles = Array.from({ length: spokes }, (_, i) => (i / spokes) * Math.PI * 2);
  const ringRadii = Array.from({ length: rings }, (_, i) => ((i + 1) / rings) * maxR);
  const pt = (r: number, a: number): readonly [number, number] => [
    c + r * Math.cos(a),
    c + r * Math.sin(a),
  ];

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Radial spokes */}
      {angles.map((a, i) => {
        const [x, y] = pt(maxR, a);
        return <line key={`spoke-${i}`} x1={c} y1={c} x2={x} y2={y} />;
      })}

      {/* Concentric ring threads, sagging between each pair of spokes */}
      {ringRadii.map((r, ri) => {
        let d = "";
        angles.forEach((a, i) => {
          const [x, y] = pt(r, a);
          if (i === 0) {
            d += `M ${x} ${y}`;
          } else {
            const [cx, cy] = pt(r * sag, (angles[i - 1] + a) / 2);
            d += ` Q ${cx} ${cy} ${x} ${y}`;
          }
        });
        // Close the ring back to the first spoke.
        const [x0, y0] = pt(r, angles[0]);
        const [cx, cy] = pt(r * sag, (angles[angles.length - 1] + Math.PI * 2 + angles[0]) / 2);
        d += ` Q ${cx} ${cy} ${x0} ${y0}`;
        return <path key={`ring-${ri}`} d={d} />;
      })}
    </svg>
  );
}
