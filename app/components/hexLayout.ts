import type { AxialCoord } from "../engine/board/types";
import type { Vertex } from "../engine/board/topology";

export interface Point {
  x: number;
  y: number;
}

/** Pointy-top axial-to-pixel, matching the engine's NEIGHBOR_DIRS ordering. */
export function axialToPixel(coord: AxialCoord, size: number): Point {
  return {
    x: size * Math.sqrt(3) * (coord.q + coord.r / 2),
    y: size * 1.5 * coord.r,
  };
}

/** A hex corner is the centroid of the (up to 3) tile centers that meet there. */
export function vertexToPixel(vertex: Vertex, size: number): Point {
  const points = vertex.tileCoords.map((c) => axialToPixel(c, size));
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return { x, y };
}

/** The 6 corners of a single hex tile, in drawing order, for a pointy-top hexagon. */
export function hexCorners(center: Point, size: number): Point[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angleDeg = 60 * i - 30;
    const angleRad = (Math.PI / 180) * angleDeg;
    return {
      x: center.x + size * Math.cos(angleRad),
      y: center.y + size * Math.sin(angleRad),
    };
  });
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointToward(from: Point, to: Point, amount: number): Point {
  const d = distance(from, to);
  if (d === 0) return from;
  const t = amount / d;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/**
 * SVG path for a polygon with softly rounded corners — clips each corner
 * back by `radius` along its two edges and bridges the gap with a quadratic
 * curve through the original corner point. Gives hex tiles a carved,
 * hand-cut look instead of razor-sharp machine edges.
 */
export function roundedPolygonPath(points: Point[], radius: number): string {
  const n = points.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const start = pointToward(curr, prev, radius);
    const end = pointToward(curr, next, radius);
    d += i === 0 ? `M ${start.x} ${start.y} ` : `L ${start.x} ${start.y} `;
    d += `Q ${curr.x} ${curr.y} ${end.x} ${end.y} `;
  }
  return `${d}Z`;
}
