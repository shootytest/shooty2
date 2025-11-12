
// Matter.use('matter-attractors');
// Matter.use('matter-wrap');\

import polyDecomp from 'https://cdn.jsdelivr.net/npm/poly-decomp@0.3.0/+esm';
Matter.Common.setDecomp(polyDecomp);

import polygonOffset from 'https://cdn.jsdelivr.net/npm/polygon-offset@0.3.2/+esm';
Matter.Common.polygonOffset = polygonOffset;

import earcut from 'https://cdn.jsdelivr.net/npm/earcut@3.0.2/+esm';
Matter.Common.earcut = earcut;

import { breakIntersections, compute, computeViewport, convertToSegments, inPolygon, inViewport } from 'https://cdn.jsdelivr.net/npm/visibility-polygon@1.1.0/+esm';
Matter.Common.visibilityPolygon = { breakIntersections, compute, computeViewport, convertToSegments, inPolygon, inViewport };

import heap from 'https://cdn.jsdelivr.net/npm/heap-js@2.7.1/+esm';
Matter.Common.heap = heap;
export const Heap = heap;

import { chroma } from './chroma.js';
window.chroma = chroma;

import clipper2Wasm from 'https://cdn.jsdelivr.net/npm/clipper2-wasm@0.2.1/dist/es/clipper2z.js';
clipper2Wasm().then((clipper2z) => {
  const { MakePath64, Paths64, InflatePaths64, JoinType, EndType } = clipper2z;
  Matter.Common.expand = function(vertices, width) { // might want to add some more options here
    const precision_mult = 10;
    const flattened = [];
    for (const v of vertices) flattened.push(Math.floor(v.x * precision_mult), Math.floor(v.y * precision_mult));
    const paths = new Paths64();
    paths.push_back(MakePath64(flattened));
    // input, inflate amount, join type (miter/square/bevel/round), end type (polygon for closed paths, joined/square/round/butt for open paths), miter limit, precision, arc tolerance
    const inflated = InflatePaths64(paths, width, JoinType.Square, EndType.Polygon, 2, 0).get(0); // assume only 1 path in output...
    const expanded = [];
    for (let i = 0; i < inflated.size(); i++) {
      const point = inflated.get(i);
      expanded.push({ x: Number(point.x) / precision_mult, y: Number(point.y) / precision_mult });
    }
    return expanded;
  };
});

export default Matter;

export const Axes = Matter.Axes;
export const Bodies = Matter.Bodies;
export const Body = Matter.Body;
export const Bounds = Matter.Bounds;
export const Collision = Matter.Collision;
export const Common = Matter.Common;
export const Composite = Matter.Composite;
export const Composites = Matter.Composites;
export const Constraint = Matter.Constraint;
export const Contact = Matter.Contact;
export const Detector = Matter.Detector;
export const Engine = Matter.Engine;
export const Events = Matter.Events;
// export const Grid = Matter.Grid;
export const Mouse = Matter.Mouse;
export const MouseConstraint = Matter.MouseConstraint;
export const Pair = Matter.Pair;
export const Pairs = Matter.Pairs;
export const Plugin = Matter.Plugin;
export const Query = Matter.Query;
export const Render = Matter.Render;
export const Resolver = Matter.Resolver;
export const Runner = Matter.Runner;
// export const SAT = Matter.SAT;
export const Sleeping = Matter.Sleeping;
export const Svg = Matter.Svg;
export const Vector = Matter.Vector;
export const Vertices = Matter.Vertices;
export const World = Matter.World;