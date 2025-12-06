
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
  const { MakePath64, Path64, Paths64, Point64, PointInPolygon64, InflatePaths64, Union64, JoinType, EndType, FillRule } = clipper2z;
  const precision_mult = 10;
  Matter.Common.expand = function(vertices, width) { // might want to add some more options here
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
  Matter.Common.union = function(polygon_list) {
    if (polygon_list.length === 0) return [];
    let unioned;
    for (const polygon of polygon_list) {
      const paths = new Paths64();
      const flattened = [];
      for (const v of polygon) flattened.push(Math.floor(v.x * precision_mult), Math.floor(v.y * precision_mult));
      paths.push_back(MakePath64(flattened));
      if (unioned == undefined) unioned = paths;
      else unioned = Union64(unioned, paths, FillRule.NonZero);
    }
    const result = [];
    for (let i = 0; i < unioned.size(); i++) {
      const onion = unioned.get(i);
      const path = [];
      for (let j = 0; j < onion.size(); j++) {
        const point = onion.get(j);
        path.push({ x: Number(point.x) / precision_mult, y: Number(point.y) / precision_mult });
      }
      result.push(path);
    }
    return result;
  };
  Matter.Common.point_in_polygon = function(point, polygon) {
    const flattened = [];
    for (const v of polygon) flattened.push(Math.floor(v.x * precision_mult), Math.floor(v.y * precision_mult));
    const path = MakePath64(flattened); // slow!!!
    const pt = new Point64(Math.floor(point.x * precision_mult), Math.floor(point.y * precision_mult), 0);
    return PointInPolygon64(pt, path);
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