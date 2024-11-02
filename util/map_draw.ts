import { ui } from "../map/ui.js";
import { camera, ZEPSILON } from "./camera.js";
import { color } from "./color.js";
import { Context } from "./draw.js";
import { key, keys, mouse } from "./key.js";
import { map_shape_type, map_type } from "./map_type.js";
import { AABB3, vector, vector3 } from "./vector.js";

export const map_draw = {


  shapes_on_screen: [] as map_shape_type[],


  compute: (map: map_type) => {

    if (map.shapes != undefined) {
      for (const shape of map.shapes) {
        const world_vertices = vector3.create_many(shape.vertices, shape.z);
        shape.computed = {
          aabb: vector.make_aabb(world_vertices),
          aabb3: vector3.make_aabb(world_vertices),
          centroid: vector3.mean(world_vertices),
          vertices: world_vertices,
        };
      }
    }

  },



  draw: (ctx: Context, map: map_type) => {

    if (map.shapes != undefined) {
      const cam = vector3.create2(camera.location, camera.z);
      const screen_topleft = camera.screen2world({ x: 0, y: 0 });
      const screen_bottomright = camera.screen2world({ x: ctx.canvas.width, y: ctx.canvas.height });
      const screen_aabb3: AABB3 = {
        min_x: screen_topleft.x, min_y: screen_topleft.y, max_x: screen_bottomright.x, max_y: screen_bottomright.y, min_z: -Infinity, max_z: Infinity, // todo z culling (first pass)?
      };
      // loop: compute shape stuff
      for (const shape of map.shapes) {
        if (shape.computed == undefined) {
          map_draw.compute(map);
        }
        if (shape.computed != undefined) {
          // compute vertices
          shape.computed.vertices = vector3.create_many(shape.vertices, shape.z);
          // compute distance
          shape.computed.distance2 = vector.length2(vector.sub(shape.computed?.centroid, cam));
          // compute location on screen
          const vs: vector3[] = [];
          let i = 0;
          shape.computed.on_screen = vector3.aabb_intersect(shape.computed.aabb3, screen_aabb3) && shape.z <= camera.z / camera.scale;
          for (const world_v of shape.computed.vertices) {
            const v = camera.world3screen(world_v);
            vs.push(vector3.create2(v, world_v.z - camera.look_z));
            i++;
          }
          shape.computed.screen_vertices = vs;
        }
      }
      // console.log(map_draw.shapes_on_screen.length);
      map_draw.shapes_on_screen = map.shapes.filter((s) => s.computed?.on_screen).sort((a, b) => b.computed?.distance2!! - a.computed?.distance2!!);
      let i = 0;
      for (const shape of map_draw.shapes_on_screen) {
        map_draw.draw_shape(ctx, shape);
        map_draw.draw_shape_ui(ctx, shape);
        i++;
      }
    }
    
  },



  draw_shape: (ctx: Context, shape: map_shape_type) => {

    if (shape.computed?.screen_vertices == undefined || shape.computed.screen_vertices.length <= 0) return;
    ctx.save("draw_shape");
    const style = shape.style;
    ctx.begin();
    ctx.lines_v(shape.computed.screen_vertices);
    ctx.lineCap = "square";
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = (style.width ?? 1) * camera.sqrtscale * 2;
    ctx.globalAlpha = style.opacity ?? 1;
    ctx.stroke();
    if (style.fill) {
      ctx.fillStyle = style.fill;
      ctx.globalAlpha = style.fill_opacity ?? 1;
      ctx.fill();
    }
    ctx.restore("draw_shape");

  },



  draw_shape_ui: (ctx: Context, shape: map_shape_type) => {

    if (shape.computed?.screen_vertices == undefined || shape.computed.screen_vertices.length <= 0) return;

    const style = shape.style;
    const id_prefix = shape.id + "__";
    
    for (const [i, v] of shape.computed.screen_vertices.entries()) {
      const id_ = id_prefix + i;
      if (Math.abs(v.z) <= 0.005) {
        ctx.begin();
        ctx.circle(v.x, v.y, 4);
        ctx.fillStyle = style.stroke;
        ctx.lineWidth = camera.sqrtscale * 2;
        ctx.fill();
      }
      if (vector.in_circle(mouse, v, 10)) {
        // mouse hover
        ctx.begin();
        ctx.circle(v.x, v.y, 10);
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = camera.sqrtscale * 2;
        ctx.stroke();
        // also set target
        const target = { shape: shape as map_shape_type, vertex: v, id: id_, index: i, };
        ui.mouse.hover_target = target;
        if (ui.mouse.new_rclick) {
          ui.mouse.new_rclick = false;
          ui.mouse.drag_target[2] = target;
        }
      }
      if (ui.mouse.drag_target[2].id === id_) {
        const o = ui.mouse.drag_target[2] as { shape: map_shape_type, vertex: vector3, id: string, index: number, };
        const ov = o.shape.vertices[o.index];
        const change = vector.div(mouse.drag_change[2] as vector, camera.scale * camera.zscale(o.vertex.z));
        ov.x += change.x;
        ov.y += change.y;
        if (ui.mouse.release_rclick && !key.shift()) {
          o.shape.vertices[o.index] = vector.round_to(ov, 10);
        }
      }
    }

  },



};