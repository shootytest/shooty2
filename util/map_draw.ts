import { clone_object, make, make_shapes, maketype, maketype_shape, override_object } from "../game/make.js";
import { m_ui } from "../map/map_ui.js";
import { camera } from "./camera.js";
import { color, color2hex_map, STYLES, STYLES_ } from "./color.js";
import { Context } from "./draw.js";
import { key, mouse } from "./key.js";
import { map_serialiser, map_shape_type, map_type, map_vertex_type, style_type } from "./map_type.js";
import { math } from "./math.js";
import { AABB3, vector, vector3 } from "./vector.js";

export const map_draw = {


  shapes_on_screen: [] as map_shape_type[],


  compute_map: (map: map_type) => {

    map_serialiser.compute(map);

    if (map.shapes != undefined) {
      for (const shape of map.shapes) {
        map_draw.compute_shape(shape);
      }
    }

  },

  compute_shape: (shape: map_shape_type) => {
    const world_vertices = vector3.create_many(shape.vertices, shape.z);
    const screen_vertices = shape.computed?.screen_vertices ?? [];
    const depth = shape.computed?.depth ?? 0;
    const options = shape.computed?.options;
    shape.computed = {
      aabb: vector.make_aabb(world_vertices),
      aabb3: vector3.make_aabb(world_vertices),
      mean: vector3.mean(world_vertices),
      vertices: world_vertices,
      screen_vertices: screen_vertices,
      depth: depth,
      options: options,
    };
    m_ui.all_aabb = vector.aabb_combine(m_ui.all_aabb, shape.computed.aabb);
  },

  duplicate_shape: (shape: map_shape_type, at_vertex_index = 0): map_shape_type => {
    const new_shape = map_serialiser.clone_shape(shape);
    if (at_vertex_index > 0) { // splitting shape
      // wow 1 line, this works because the deleted vertices from the old shape are exactly the new shape
      new_shape.vertices = shape.vertices.splice(at_vertex_index, shape.vertices.length - at_vertex_index);
      if (new_shape.vertices[0]) shape.vertices.push(vector3.clone_(new_shape.vertices[0])); // also duplicate the vertex at the split location
    } else {
      if (key.shift()) { // not cloning vertices
        new_shape.vertices = [vector.add(new_shape.vertices[m_ui.circle_menu.target.index], vector.create(10, 10))];
      } else { // copy vertices but move the shape by a lot
        const move_vector = shape.computed ? vector.aabb2v(shape.computed?.aabb) : vector.create(10, 10);
        for (const v of new_shape.vertices) {
          v.x += move_vector.x;
          v.y += move_vector.y;
        }
      }
    }
    // set id of new shape
    const split_by = " ";
    let shape_id_number = +(new_shape.id.split(split_by).pop() as string);
    if (isNaN(shape_id_number) || shape_id_number == undefined) {
      shape_id_number = 0;
      new_shape.id += split_by + "0";
    } else shape_id_number++;
    const splitted = new_shape.id.split(split_by);
    while (m_ui.map.computed?.shape_map?.[new_shape.id] != undefined && shape_id_number <= 9999) {
      splitted[splitted.length - 1] = shape_id_number.toString();
      new_shape.id = splitted.join(split_by);
      shape_id_number++;
    }
    // make sure new shape doesn't contain anything
    delete new_shape.options.contains;
    return new_shape;
  },

  draw: (ctx: Context, map: map_type) => {

    if (map.shapes != undefined) {
      const screen_topleft = camera.screen2world({ x: 0, y: 0 });
      const screen_bottomright = camera.screen2world({ x: ctx.canvas.width, y: ctx.canvas.height });
      const screen_aabb3: AABB3 = {
        min_x: screen_topleft.x, min_y: screen_topleft.y, max_x: screen_bottomright.x, max_y: screen_bottomright.y, min_z: -999, max_z: 999, // todo z culling?
      };
      const memo_aabb3: { [key: string]: AABB3 } = {};
      // loop: compute shape stuff
      for (const shape of map.shapes) {
        if (shape.computed == undefined) {
          map_draw.compute_map(map);
        }
        if (shape.computed != undefined) {
          // compute vertices
          shape.computed.vertices = vector3.create_many(shape.vertices, shape.z);
          // compute distance (not really applicable now, but previously i was sorting by it)
          // shape.computed.distance2 = vector.length2(vector.sub(shape.computed?.mean, vector3.create2(camera.location, camera.z)));
          // compute location on screen
          if (memo_aabb3[shape.z] == undefined) {
            const z_scale = camera.zscale_inverse(shape.z);
            memo_aabb3[shape.z] = vector3.aabb_scale(screen_aabb3, vector3.create(z_scale, z_scale, 1));
          }
          shape.computed.on_screen = vector3.aabb_intersect(shape.computed.aabb3, memo_aabb3[shape.z]) && shape.z <= camera.z / camera.scale;
          if (shape.computed.on_screen && shape.id !== m_ui.properties_selected.id) {
            if ((!m_ui.editor.layers.floors && shape.computed.options?.floor) ||
                (!m_ui.editor.layers.sensors && shape.computed.options?.sensor) ||
                (!m_ui.editor.layers.spawners && shape.computed.options?.is_spawner) ||
                (!m_ui.editor.layers.decoration && shape.computed.options?.decoration && !shape.computed.options?.floor) ||
                (!m_ui.editor.layers.z && !math.equal(shape.z, camera.look_z))
            ) {
              shape.computed.on_screen = false;
            }
          }
          if (m_ui.directory_spans[shape.id]) m_ui.directory_spans[shape.id].style.color = shape.computed.on_screen ? "black" : "#999999";
          if (!shape.computed.on_screen) continue; // hmmm can i get away with doing this (seems so)
          const screen_vs: vector3[] = [];
          const shadow_vs: vector3[] = []; // only use if shadows enabled
          for (const world_v of shape.computed.vertices) {
            const v = camera.world3screen(world_v);
            screen_vs.push(vector3.create2(v, world_v.z - camera.look_z));
          }
          if (m_ui.editor.layers.z >= 2 || m_ui.editor.map_mode) {
            for (const world_v of shape.computed.vertices)
              shadow_vs.push(vector3.create2(camera.world3screen(vector3.create2(world_v, camera.look_z)), 0));
          }
          shape.computed.screen_vertices = screen_vs;
          shape.computed.shadow_vertices = shadow_vs;
        }
      }
      // TODO optimisation:
      //   filter by world AABB instead of screen AABB
      //   so that static objects (which should be the majority?) don't always recompute world AABB
      //   and only calculate screen position for all objects on screen
      //   hopefully this is fast enough? although i'll probably make a chunk-like system too?
      map_draw.shapes_on_screen = map.shapes.filter((s) => s.computed?.on_screen).sort((a, b) => {
        if (a.id === m_ui.properties_selected.id) return 1;
        if (b.id === m_ui.properties_selected.id) return -1;
        if (b.z !== a.z || b.computed?.options == undefined || a.computed?.options == undefined) return a.z - b.z;
        const o1 = a.computed.options, o2 = b.computed.options;
        const layer = (o1.force_layer ?? 0) - (o2.force_layer ?? 0);
        if (!math.equal(layer, 0)) return layer;
        if (o1.map_parent && !o2.map_parent) return 1;
        if (o2.map_parent && !o1.map_parent) return -1;
        if (o1.is_map && !o2.is_map) return 1;
        if (o2.is_map && !o1.is_map) return -1;
        if (o1.sensor && !o2.sensor) return 1;
        if (o2.sensor && !o1.sensor) return -1;
        if (o1.is_spawner && !o2.is_spawner) return 1;
        if (o2.is_spawner && !o1.is_spawner) return -1;
        if (o1.floor && !o2.floor) return -1;
        if (o2.floor && !o1.floor) return 1;
        return 0;
      });
      if (m_ui.editor.map_mode) {
        for (const shape of map_draw.shapes_on_screen) {
          const style = map_draw.get_style(shape);
          const is_map = Boolean(shape.computed?.options?.is_map);
          if (is_map) {
            map_draw.draw_shape(ctx, shape, style);
            map_draw.draw_shape_ui(ctx, shape, style);
          } else if (m_ui.editor.layers.z < 2) {
            map_draw.draw_shape(ctx, shape, style, true);
          }
        }
      } else {
        for (const shape of map_draw.shapes_on_screen) {
          const style = map_draw.get_style(shape);
          if (shape.computed?.options?.is_map) continue;
          map_draw.draw_shape(ctx, shape, style);
          map_draw.draw_shape_ui(ctx, shape, style);
          if (m_ui.editor.layers.z >= 2 && !math.equal(shape.z, camera.look_z)) {
            map_draw.draw_shape(ctx, shape, style, true);
            map_draw.draw_shape_ui(ctx, shape, style, true);
          }
        }
      }
    }

  },

  draw_shape: (ctx: Context, shape: map_shape_type, style: style_type, shadow: boolean = false) => {

    if (shape.computed?.screen_vertices == undefined || shape.computed.screen_vertices.length <= 0 || shape.computed.shadow_vertices == undefined) return;
    if (shape.computed.screen_vertices.length <= 1 && shape.computed.options?.is_spawner && shape.computed.options.spawn_enemy) {
      ctx.ctx.save();
      const options: maketype = make[shape.computed.options.spawn_enemy];
      const shapes: maketype_shape[] = make_shapes[shape.computed.options.spawn_enemy] ?? [];
      for (const o of shapes) {
        map_draw.draw_spawned_shape(ctx, shape, style, o, options, shadow);
      }
      ctx.ctx.restore();
      return;
    }
    const open_loop = Boolean(shape.options.open_loop);
    ctx.ctx.save();
    ctx.beginPath();
    ctx.lines_v((shadow ? shape.computed.shadow_vertices : shape.computed.screen_vertices), !open_loop);
    ctx.lineCap = "square";
    if (open_loop && !style.stroke) style.stroke = style.fill; // hmmm
    if (style.fill && !open_loop) {
      ctx.fillStyle = color2hex_map(style.fill, shape.options.room_id ?? "default");
      ctx.globalAlpha = math.bound((style.opacity ?? 1) * (style.fill_opacity ?? 1) * (shadow ? 0.5 : 1), 0, 0.75);
      ctx.fill();
    }
    if (style.stroke) {
      ctx.strokeStyle = color2hex_map(style.stroke, shape.options.room_id ?? "default");
      ctx.lineWidth = (style.width ?? 1) * camera.sqrtscale * 2;
      ctx.globalAlpha = (style.opacity ?? 1) * (style.stroke_opacity ?? 1) * (shadow ? 0.5 : 1);
      ctx.stroke();
    }
    if (m_ui.editor.layers.debug && shape.computed.aabb) {
      const aabb = shape.computed?.aabb;
      const topleft = camera.world2screen({ x: aabb.min_x, y: aabb.min_y });
      const bottomright = camera.world2screen({ x: aabb.max_x, y: aabb.max_y });
      const aabb2 = { min_x: topleft.x, min_y: topleft.y, max_x: bottomright.x, max_y: bottomright.y, };
      ctx.beginPath();
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = camera.sqrtscale;
      ctx.strokeStyle = color.white;
      ctx.rect(aabb2.min_x, aabb2.min_y, aabb2.max_x - aabb2.min_x, aabb2.max_y - aabb2.min_y);
      ctx.stroke();
    }
    ctx.ctx.restore();

  },



  draw_spawned_shape: (ctx: Context, shape: map_shape_type, style: style_type, o: maketype_shape, options: maketype, shadow: boolean = false) => {
    if (shape.computed?.screen_vertices == undefined || shape.computed.screen_vertices.length <= 0 || shape.computed.shadow_vertices == undefined) return;
    let centre = shadow ? shape.computed.shadow_vertices[0] : shape.computed.screen_vertices[0];
    const z = (m_ui.editor.map_mode && !shape.computed.options?.is_map) ? camera.look_z : shape.z + (o.z ?? 0);
    const mult = camera.zscale(z) * camera.scale;
    const r = (o.radius ?? 0) * mult;
    if (o.style) style = clone_object(STYLES_[o.style ?? "error"] ?? style);
    if (o.style_) override_object(style, o.style_);
    const angle = (options.angle ?? 0) + vector.deg_to_rad(shape.options.spawn_angle ?? 0);
    if (o.offset) centre = vector3.create2(vector.add(centre, vector.mult(vector.rotate(o.offset, angle), mult)), centre.z);
    ctx.beginPath();
    if (o.type === "circle") {
      ctx.circle_v(centre, r);
    } else if (o.type === "arc") {
      ctx.arc_v(centre, r, angle + (o.arc_start ?? 0), angle + (o.arc_end ?? 0), true);
    } else if (o.type === "polygon") {
      const sides = o.sides ?? 16;
      let a = angle + (o.angle ?? 0);
      ctx.moveTo(centre.x + r * Math.cos(a), centre.y + r * Math.sin(a));
      for (let i = 0; i < sides; i++) {
        a += math.two_pi / sides;
        ctx.lineTo(centre.x + r * Math.cos(a), centre.y + r * Math.sin(a)); // funny function call
      }
    } else if (o.type === "line") {
      ctx.moveTo_v(vector.add(centre, vector.rotate(vector.mult(o.v1 ?? vector.create(), mult), angle)));
      ctx.lineTo_v(vector.add(centre, vector.rotate(vector.mult(o.v2 ?? vector.create(), mult), angle)));
    } else if (o.type === "polyline") {
      const vs = vector.mult_list(o.vs ?? [], mult);
      vector.add_to_list(vs, centre);
      ctx.lines_v(vs, !o.open_loop);
    }
    if (style.fill) {
      ctx.fillStyle = color2hex_map(style.fill, shape.options.room_id ?? "default");
      ctx.globalAlpha = math.bound((style.opacity ?? 1) * (style.fill_opacity ?? 1) * (shadow ? 0.5 : 1), 0, 0.75);
      ctx.fill();
    }
    if (style.stroke) {
      ctx.strokeStyle = color2hex_map(style.stroke, shape.options.room_id ?? "default");
      ctx.lineWidth = (style.width ?? 1) * camera.sqrtscale * 2;
      ctx.globalAlpha = (style.opacity ?? 1) * (style.stroke_opacity ?? 1) * (shadow ? 0.5 : 1);
      ctx.stroke();
    }
    if (options.enemy_detect_range) {
      ctx.beginPath();
      ctx.circle_v(centre, options.enemy_detect_range * mult);
      if (!style.stroke) ctx.strokeStyle = color.enemy_main;
      ctx.lineWidth = (style.width ?? 1) * camera.sqrtscale * 2;
      ctx.globalAlpha = 0.1;
      ctx.stroke();
    }
    if (options.repel_range) {
      ctx.beginPath();
      ctx.circle_v(centre, options.repel_range * mult);
      ctx.fillStyle = color.white;
      ctx.strokeStyle = color.white;
      ctx.lineWidth = (style.width ?? 1) * camera.sqrtscale * 2;
      ctx.globalAlpha = 0.05;
      ctx.fill();
      ctx.globalAlpha = 0.1;
      ctx.stroke();
    }
  },



  draw_shape_ui: (ctx: Context, shape: map_shape_type, style: style_type, shadow: boolean = false) => {

    if (shape.computed?.screen_vertices == undefined || shape.computed.screen_vertices.length <= 0 || shape.computed.shadow_vertices == undefined) return;
    const screen_vertices = shadow ? shape.computed.shadow_vertices : shape.computed.screen_vertices;

    const id_prefix = shape.id + "__";
    const selected = shape.id === m_ui.mouse.drag_target[0]?.shape?.id;

    for (const [i, v] of screen_vertices.entries()) {
      if (!math.equal(v.z, 0) && shape.id !== m_ui.properties_selected.id && screen_vertices.length >= 2) continue;
      const id_ = id_prefix + i;
      const vertex_size = (shape.id === "start") ? camera.scale * 30 : camera.sqrtscale * 5;
      const colorhex = color2hex_map((style.stroke ?? style.fill ?? color.purewhite), shape.options.room_id ?? "default");
      // draw room
      if (shape.options.is_room && shape.options.room_connections && m_ui.editor.layers.rooms) {
        for (const cid of shape.options.room_connections) {
          const connection = m_ui.map.computed?.shape_map[cid];
          if (!connection) continue;
          const cv = camera.world3screen(vector3.create_(connection.vertices[0], connection.z));
          ctx.globalAlpha = 1;
          ctx.strokeStyle = color.white + "55";
          ctx.lineWidth = camera.sqrtscale * 5;
          ctx.line_v(v, cv);
        }
      }
      // draw vertex circle
      if (selected || math.equal(v.z, 0) || screen_vertices.length < 2) {
        ctx.begin();
        ctx.circle(v.x, v.y, vertex_size);
        ctx.fillStyle = colorhex + (shadow ? "88" : "");
        ctx.lineWidth = camera.sqrtscale * 2;
        ctx.fill();
        if (selected && shape.vertices.length > 1) {
          const size = 10;
          ctx.textAlign = "center";
          if (camera.sqrtscale * 6 >= size) {
            ctx.fillStyle = color.black;
            ctx.set_font_mono(camera.sqrtscale * 5);
            ctx.text("" + i, v.x, v.y);
          } else {
            ctx.fillStyle = color.white;
            ctx.set_font_mono(size);
            ctx.text("" + i, v.x + size, v.y + size);
          }
        }
      }
      if (!math.equal(v.z, 0) && shape.id !== m_ui.properties_selected.id) continue;
      // draw hover circle (faint)
      const hove_r = Math.max(6, vertex_size + camera.sqrtscale * 5);
      if (vector.in_circle(mouse.position, v, hove_r)) {
        // mouse hover
        ctx.begin();
        ctx.circle(v.x, v.y, hove_r);
        ctx.fillStyle = colorhex;
        ctx.lineWidth = camera.sqrtscale * 2;
        ctx.globalAlpha = 0.4;
        ctx.fill();
        ctx.globalAlpha = 1;
        // also set target
        const target: map_vertex_type = {
          shape: shape,
          vertex: v,
          vertex_old: vector3.clone_list_(shape.vertices),
          id: id_,
          index: i,
          new: true,
        };
        m_ui.mouse.hover_target = target;
        m_ui.click.new(() => m_ui.select_shape(target));
        m_ui.click.new(() => { // right click
          m_ui.circle_menu.activate(true, m_ui.circle_menu.target.id !== target.id);
          m_ui.select_shape(target); // ui.circle_menu.target = target;
        }, 2);
      }
      // draw selected circle (stroke)
      if (m_ui.mouse.drag_target[0].id === id_) {
        ctx.begin();
        ctx.circle(v.x, v.y, hove_r);
        ctx.strokeStyle = color.purewhite; // (style.stroke ?? style.fill ?? color.purewhite);
        ctx.lineWidth = camera.sqrtscale * 2;
        ctx.stroke();
        const o = m_ui.mouse.drag_target[0] as map_vertex_type;
        const ov = o.shape.vertices[o.index];
        if (mouse.drag_vector_old[0] !== false && !m_ui.circle_menu.active) { // if the user is actually dragging the mouse
          if (o.new) {
            if (mouse.buttons[0]) {
              const newpos = camera.screen2world(mouse.position);
              if (key.shift()) {
                if (o.shape.vertices.length === 1 && (o.shape.options.contains?.length ?? 0) > 0) {
                  const same_difference = vector.sub(newpos, ov);
                  map_draw.move_vertices_recursively(o.shape, same_difference);
                }
                const difference = vector.sub(newpos, o.vertex_old[o.index]);
                for (let i = 0; i < o.shape.vertices.length; i++) {
                  o.shape.vertices[i].x = o.vertex_old[i].x + difference.x;
                  o.shape.vertices[i].y = o.vertex_old[i].y + difference.y;
                }
              } else {
                ov.x = newpos.x;
                ov.y = newpos.y;
                // todo only run when the shift key is let go instead of when it isn't pressed
                for (let i = 0; i < o.shape.vertices.length; i++) {
                  if (i === o.index || !o.vertex_old[i]) continue;
                  o.shape.vertices[i] = vector3.clone_(o.vertex_old[i]);
                }
              }
            }
          } else {
            // this case probably doesn't occur now (hmmm maybe sometimes?)
            const change = vector.div(mouse.drag_change[0] as vector, camera.scale * camera.zscale(o.vertex.z - camera.look_z));
            const round_to_number = key.ctrl() ? 1 : 10;
            ov.x = math.round_to(ov.x + change.x, round_to_number);
            ov.y = math.round_to(ov.y + change.y, round_to_number);
          }
        }
        // handle vertex drag end
        if (m_ui.mouse.release_click) {
          /*if (vector.in_circle(mouse.position, v, 10) && (mouse.drag_vector_old[0] === false || vector.length2(mouse.drag_vector_old[0]) < 30)) {
            ui.circle_menu.active = true;
            ui.circle_menu.active_time = ui.time;
            ui.circle_menu.target = o;
          }*/
          o.new = false;
          if (!(mouse.drag_vector_old[0] === false)) {
            if (vector.length2(mouse.drag_vector_old[0]) < 25) {
              // dragged but for less than 5 pixels so it doesn't count
              if (o.shape.vertices.length === o.vertex_old.length) {
                for (let i = 0; i < o.shape.vertices.length; i++) {
                  if (!o.vertex_old[i]) continue;
                  o.shape.vertices[i] = vector3.clone_(o.vertex_old[i]);
                }
              }
            } else {
              // if actually dragged
              const round_to_number = key.ctrl() ? 1 : 10;
              if (key.shift()) {
                for (let i = 0; i < o.shape.vertices.length; i++) {
                  o.shape.vertices[i].x = math.round_to(o.shape.vertices[i].x, round_to_number);
                  o.shape.vertices[i].y = math.round_to(o.shape.vertices[i].y, round_to_number);
                }
                map_draw.change("move shape", o.shape);
              } else {
                o.shape.vertices[o.index].x = math.round_to(ov.x, round_to_number);
                o.shape.vertices[o.index].y = math.round_to(ov.y, round_to_number);
                map_draw.change("move vertex #" + o.index, o.shape);
              }
              map_draw.compute_shape(o.shape);
            }
          } else {
          }
        }
      }
    }

  },

  move_vertices_recursively: (shape: map_shape_type, move_by: vector) => {
    for (const s_id of shape.options.contains ?? []) {
      const s = m_ui.map.computed?.shape_map?.[s_id];
      if (s == undefined) {
        console.error(`[map_draw/move_vertices_recursively] unknown shape id in contains list: ${s_id}`);
        continue;
      }
      for (let i = 0; i < s.vertices.length; i++) {
        s.vertices[i].x = s.vertices[i].x + move_by.x;
        s.vertices[i].y = s.vertices[i].y + move_by.y;
      }
      map_draw.compute_shape(s);
      map_draw.move_vertices_recursively(s, move_by);
    }
  },

  get_style: (shape: map_shape_type): style_type => {
    if (shape.options.is_room && shape.id !== "start") return STYLES.room;
    let key = shape.options.make_id;
    if (shape.options.is_spawner) {
      if (shape.vertices.length <= 1 && shape.options.spawn_enemy) {
        key = shape.options.spawn_enemy;
      } else return STYLES.spawner;
    }
    // if (shape.options.is_map) return STYLES.map;
    if (key != undefined) {
      const m = make[key];
      if (!m) return STYLES.error;
      if (!m.style && m.style_) return clone_object(m.style_);
      const result = clone_object(STYLES_[shape.options.style ?? m.style ?? "error"] ?? STYLES.error);
      if (m.style_) override_object(result, m.style_);
      return result;
    } else {
      return STYLES_[shape.options.style ?? "error"] ?? STYLES.error;
    }
  },

  change: (type: string, shapes: map_shape_type | map_shape_type[]) => {
    if (!Array.isArray(shapes)) shapes = [shapes];
    let s = `[change] (${type}) `;
    for (const shape of shapes) {
      s += shape.id + ", ";
    }
    console.log("%c%s", "background-color: #111; color: #abcdef", s.substring(0, s.length - (shapes.length <= 0 ? 1 : 2)));
    const raw_string = map_serialiser.save("auto", m_ui.map);
    if (!type.startsWith("undo")) map_serialiser.save_undo_state(raw_string);
  },

  delete_shape: (shape: map_shape_type) => {
    if (!key.shift()) {
      if (!confirm("ARE YOU SURE YOU WANT TO DELETE [" + shape.id + "]")) return;
    }
    m_ui.map.shapes.remove(shape);
    // handle parent
    let contains: string[] | undefined = undefined;
    if (shape.options.parent && shape.options.parent !== "all") {
      contains = m_ui.map.computed?.shape_map[shape.options.parent].options.contains;
      contains?.remove(shape.id);
    }
    // handle children
    if (shape.options.contains?.length) {
      for (const s_id of shape.options.contains ?? []) {
        if (contains) {
          contains.push(s_id);
          m_ui.map.computed!.shape_map[s_id].options.parent = shape.options.parent;
        } else delete m_ui.map.computed?.shape_map[s_id].options.parent; // orphan :(
      }
    }
    // deselect from sidebar
    if (m_ui.properties_selected === shape) {
      m_ui.properties_selected = m_ui.all_shape;
      m_ui.right_sidebar_mode = "directory";
      m_ui.update_right_sidebar();
    }
    m_ui.circle_menu.deactivate();
    m_ui.update_directory();
    map_draw.change("delete shape", shape);
  }


};