import React from "react";
import { DIMENSIONS } from "@/data/uqa-questions";

interface DataPoint {
  dimensionId: string;
  score: number;
}

interface Props {
  data: DataPoint[];
  size?: number;
}

const RadarChart: React.FC<Props> = ({ data, size = 280 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const levels = 5;
  const n = DIMENSIONS.length;

  // angle for each dimension (start from top, clockwise)
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const point = (r: number, i: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });

  // grid polygons
  const gridPolygons = Array.from({ length: levels }, (_, lvl) => {
    const r = (radius * (lvl + 1)) / levels;
    const pts = Array.from({ length: n }, (_, i) => {
      const p = point(r, i);
      return `${p.x},${p.y}`;
    }).join(" ");
    return pts;
  });

  // data polygon
  const dataPoints = DIMENSIONS.map((dim, i) => {
    const entry = data.find((d) => d.dimensionId === dim.id);
    const score = entry?.score ?? 0;
    const ratio = Math.min(score / dim.maxScore, 1);
    const p = point(radius * ratio, i);
    return `${p.x},${p.y}`;
  }).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="radar-chart">
      {/* grid */}
      {gridPolygons.map((pts, lvl) => (
        <polygon
          key={lvl}
          points={pts}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={1}
        />
      ))}

      {/* axes */}
      {DIMENSIONS.map((_, i) => {
        const p = point(radius, i);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        );
      })}

      {/* data area */}
      <polygon
        points={dataPoints}
        fill="rgba(99,102,241,0.2)"
        stroke="#6366f1"
        strokeWidth={2}
      />

      {/* data dots */}
      {DIMENSIONS.map((dim, i) => {
        const entry = data.find((d) => d.dimensionId === dim.id);
        const score = entry?.score ?? 0;
        const ratio = Math.min(score / dim.maxScore, 1);
        const p = point(radius * ratio, i);
        return (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="#6366f1" />
        );
      })}

      {/* labels */}
      {DIMENSIONS.map((dim, i) => {
        const labelRadius = radius + 22;
        const p = point(labelRadius, i);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fill="#64748b"
            fontWeight={500}
          >
            {dim.name}
          </text>
        );
      })}
    </svg>
  );
};

export default RadarChart;
