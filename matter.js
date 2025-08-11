
// Matter.use('matter-attractors');
// Matter.use('matter-wrap');\

import polyDecomp from 'https://cdn.jsdelivr.net/npm/poly-decomp@0.3.0/+esm';
Matter.Common.setDecomp(polyDecomp);

import polygonOffset from 'https://cdn.jsdelivr.net/npm/polygon-offset@0.3.2/+esm';
Matter.Common.polygonOffset = polygonOffset;

import { breakIntersections, compute, computeViewport, convertToSegments, inPolygon, inViewport } from 'https://cdn.jsdelivr.net/npm/visibility-polygon@1.1.0/+esm';
Matter.Common.visibilityPolygon = { breakIntersections, compute, computeViewport, convertToSegments, inPolygon, inViewport };

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