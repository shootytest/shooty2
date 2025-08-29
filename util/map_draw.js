import { make } from "../game/make.js";
import { m_ui } from "../map/map_ui.js";
import { camera } from "./camera.js";
import { color, STYLES } from "./color.js";
import { key, mouse } from "./key.js";
import { map_serialiser } from "./map_type.js";
import { vector, vector3 } from "./vector.js";
export const map_draw = {
    shapes_on_screen: [],
    compute_map: (map) => {
        map_serialiser.compute(map);
        if (map.shapes != undefined) {
            for (const shape of map.shapes) {
                map_draw.compute_shape(shape);
            }
        }
    },
    compute_shape: (shape) => {
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
    duplicate_shape: (shape, at_vertex_index = 0) => {
        const new_shape = map_serialiser.clone_shape(shape);
        if (at_vertex_index > 0) { // splitting shape
            // wow 1 line, this works because the deleted vertices from the old shape are exactly the new shape
            new_shape.vertices = shape.vertices.splice(at_vertex_index, shape.vertices.length - at_vertex_index);
            if (new_shape.vertices[0])
                shape.vertices.push(vector3.clone_(new_shape.vertices[0])); // also duplicate the vertex at the split location
        }
        else {
            const move_vector = shape.computed ? vector.aabb2v(shape.computed?.aabb) : vector.create(10, 10);
            for (const v of new_shape.vertices) {
                v.x += move_vector.x;
                v.y += move_vector.y;
            }
        }
        // set id of new shape
        const split_by = " ";
        let shape_id_number = +new_shape.id.split(split_by).pop();
        if (isNaN(shape_id_number) || shape_id_number == undefined) {
            shape_id_number = 0;
            new_shape.id += split_by + "0";
        }
        else
            shape_id_number++;
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
    draw: (ctx, map) => {
        if (map.shapes != undefined) {
            const cam = vector3.create2(camera.location, camera.z);
            const screen_topleft = camera.screen2world({ x: 0, y: 0 });
            const screen_bottomright = camera.screen2world({ x: ctx.canvas.width, y: ctx.canvas.height });
            const screen_aabb3 = {
                min_x: screen_topleft.x, min_y: screen_topleft.y, max_x: screen_bottomright.x, max_y: screen_bottomright.y, min_z: -999, max_z: 999, // todo z culling (first pass)?
            };
            const memo_aabb3 = {};
            // loop: compute shape stuff
            for (const shape of map.shapes) {
                if (shape.computed == undefined) {
                    map_draw.compute_map(map);
                }
                if (shape.computed != undefined) {
                    // compute vertices
                    shape.computed.vertices = vector3.create_many(shape.vertices, shape.z);
                    // compute distance
                    shape.computed.distance2 = vector.length2(vector.sub(shape.computed?.mean, cam));
                    // compute location on screen
                    const vs = [];
                    let i = 0;
                    if (memo_aabb3[shape.z] == undefined) {
                        const z_scale = camera.zscale_inverse(shape.z);
                        memo_aabb3[shape.z] = vector3.aabb_scale(screen_aabb3, vector3.create(z_scale, z_scale, 1));
                    }
                    shape.computed.on_screen = vector3.aabb_intersect(shape.computed.aabb3, memo_aabb3[shape.z]) && shape.z <= camera.z / camera.scale;
                    if (!m_ui.editor.layers.sensors && shape.computed.options?.sensor)
                        shape.computed.on_screen = false;
                    if (!m_ui.editor.layers.spawners && shape.computed.options?.is_spawner)
                        shape.computed.on_screen = false;
                    if (!m_ui.editor.layers.decoration && shape.computed.options?.decoration)
                        shape.computed.on_screen = false;
                    m_ui.directory_spans[shape.id].style.color = shape.computed.on_screen ? "black" : "#999999";
                    if (!shape.computed.on_screen)
                        continue; // hmmm can i get away with doing this
                    for (const world_v of shape.computed.vertices) {
                        const v = camera.world3screen(world_v);
                        vs.push(vector3.create2(v, world_v.z - camera.look_z));
                        i++;
                    }
                    shape.computed.screen_vertices = vs;
                }
            }
            // TODO optimisation:
            //   filter by world AABB instead of screen AABB
            //   so that static objects (which should be the majority?) don't always recompute world AABB
            //   and only calculate screen position for all objects on screen
            //   hopefully this is fast enough? although i'll probably make a chunk-like system too?
            // ok why was i sorting by distance?
            map_draw.shapes_on_screen = map.shapes.filter((s) => s.computed?.on_screen).sort((a, b) => b.computed?.distance2 - a.computed?.distance2);
            let i = 0;
            for (const shape of map_draw.shapes_on_screen) {
                map_draw.draw_shape(ctx, shape);
                map_draw.draw_shape_ui(ctx, shape);
                i++;
            }
        }
    },
    draw_shape: (ctx, shape) => {
        if (shape.computed?.screen_vertices == undefined || shape.computed.screen_vertices.length <= 0)
            return;
        const style = map_draw.get_style(shape);
        const open_loop = Boolean(shape.options.open_loop);
        ctx.save("draw_shape");
        ctx.beginPath();
        ctx.lines_v(shape.computed.screen_vertices, !open_loop);
        ctx.lineCap = "square";
        if (open_loop && !style.stroke)
            style.stroke = style.fill; // hmmm
        if (style.stroke) {
            ctx.strokeStyle = style.stroke;
            ctx.globalAlpha = style.stroke_opacity ?? 1;
            ctx.lineWidth = (style.width ?? 1) * camera.sqrtscale * 2;
        }
        ctx.globalAlpha = (style.opacity ?? 1) * (style.stroke_opacity ?? 1);
        ctx.stroke();
        if (style.fill && !open_loop) {
            ctx.fillStyle = style.fill;
            ctx.globalAlpha = (style.opacity ?? 1) * (style.fill_opacity ?? 1);
            ctx.fill();
        }
        ctx.restore("draw_shape");
    },
    draw_shape_ui: (ctx, shape) => {
        if (shape.computed?.screen_vertices == undefined || shape.computed.screen_vertices.length <= 0)
            return;
        const style = map_draw.get_style(shape);
        const id_prefix = shape.id + "__";
        const selected = shape.id === m_ui.mouse.drag_target[0]?.shape?.id;
        for (const [i, v] of shape.computed.screen_vertices.entries()) {
            const id_ = id_prefix + i;
            const vertex_size = (shape.id === "start") ? camera.scale * 30 : camera.sqrtscale * 5;
            if (Math.abs(v.z) <= 0.005) {
                ctx.begin();
                ctx.circle(v.x, v.y, vertex_size);
                ctx.fillStyle = style.stroke ?? style.fill ?? color.purewhite;
                ctx.lineWidth = camera.sqrtscale * 2;
                ctx.fill();
                if (selected && shape.vertices.length > 1) {
                    const size = 10;
                    if (camera.sqrtscale * 6 >= size) {
                        ctx.fillStyle = color.black;
                        ctx.set_font_mono(camera.sqrtscale * 5);
                        ctx.text("" + i, v.x, v.y);
                    }
                    else {
                        ctx.fillStyle = color.white;
                        ctx.set_font_mono(size);
                        ctx.text("" + i, v.x + size, v.y + size);
                    }
                }
            }
            const hove_r = Math.max(6, vertex_size + camera.sqrtscale * 5);
            if (vector.in_circle(mouse.position, v, hove_r)) {
                // mouse hover
                ctx.begin();
                ctx.circle(v.x, v.y, hove_r);
                ctx.fillStyle = style.fill ?? style.stroke ?? color.purewhite;
                ctx.lineWidth = camera.sqrtscale * 2;
                ctx.globalAlpha = 0.4;
                ctx.fill();
                ctx.globalAlpha = 1;
                // also set target
                const target = {
                    shape: shape,
                    vertex: v,
                    vertex_old: vector3.clone_list_(shape.vertices),
                    id: id_,
                    index: i,
                    new: true,
                };
                m_ui.mouse.hover_target = target;
                m_ui.click.new(() => m_ui.select_shape(target));
                m_ui.click.new(() => {
                    m_ui.circle_menu.activate(true, m_ui.circle_menu.target.id !== target.id);
                    m_ui.select_shape(target); // ui.circle_menu.target = target;
                }, 2);
            }
            if (m_ui.mouse.drag_target[0].id === id_) {
                ctx.begin();
                ctx.circle(v.x, v.y, hove_r);
                ctx.strokeStyle = style.stroke ?? style.fill ?? color.purewhite;
                ctx.lineWidth = camera.sqrtscale * 2;
                ctx.stroke();
                const o = m_ui.mouse.drag_target[0];
                const ov = o.shape.vertices[o.index];
                if (mouse.drag_vector_old[0] !== false && !m_ui.circle_menu.active) { // if the user is actually dragging the mouse
                    if (o.new) {
                        if (mouse.buttons[0]) {
                            const newpos = camera.screen2world(mouse.position);
                            if (key.shift()) {
                                const difference = vector.sub(newpos, o.vertex_old[o.index]);
                                for (let i = 0; i < o.shape.vertices.length; i++) {
                                    o.shape.vertices[i] = vector.add(o.vertex_old[i], difference);
                                }
                                if (o.shape.vertices.length === 1 && (o.shape.options.contains?.length ?? 0) > 0) {
                                    const same_difference = vector.sub(newpos, ov);
                                    map_draw.move_vertices_recursively(o.shape, same_difference);
                                }
                            }
                            else {
                                ov.x = newpos.x;
                                ov.y = newpos.y;
                                // todo probably shouldn't be running this loop every time
                                for (let i = 0; i < o.shape.vertices.length; i++) {
                                    if (i === o.index)
                                        continue;
                                    o.shape.vertices[i] = o.vertex_old[i];
                                }
                            }
                        }
                    }
                    else {
                        // this case probably doesn't occur now
                        const change = vector.div(mouse.drag_change[0], camera.scale * camera.zscale(o.vertex.z));
                        ov.x += change.x;
                        ov.y += change.y;
                    }
                }
                if (m_ui.mouse.release_click) {
                    /*if (vector.in_circle(mouse.position, v, 10) && (mouse.drag_vector_old[0] === false || vector.length2(mouse.drag_vector_old[0]) < 30)) {
                      ui.circle_menu.active = true;
                      ui.circle_menu.active_time = ui.time;
                      ui.circle_menu.target = o;
                    }*/
                    o.new = false;
                    if (!(mouse.drag_vector_old[0] === false || vector.length2(mouse.drag_vector_old[0]) < 30)) {
                        // if actually dragged
                        const round_to_number = key.ctrl() ? 10 : 1;
                        if (key.shift()) {
                            for (let i = 0; i < o.shape.vertices.length; i++) {
                                o.shape.vertices[i] = vector.round_to(o.shape.vertices[i], round_to_number);
                            }
                            map_draw.change("move shape", o.shape);
                        }
                        else {
                            o.shape.vertices[o.index] = vector.round_to(ov, round_to_number);
                            map_draw.change("move vertex #" + o.index, o.shape);
                        }
                        map_draw.compute_shape(o.shape);
                    }
                }
            }
            // draw room
            if (shape.options.is_room && shape.options.room_connections && m_ui.editor.layers.rooms) {
                for (const cid of shape.options.room_connections) {
                    const connection = m_ui.map.computed?.shape_map[cid];
                    if (!connection)
                        continue;
                    const cv = camera.world3screen(vector3.create_(connection.vertices[0], connection.z));
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = color.white + "55";
                    ctx.lineWidth = camera.sqrtscale * 5;
                    ctx.line_v(v, cv);
                }
            }
        }
    },
    move_vertices_recursively: (shape, move_by) => {
        for (const s_id of shape.options.contains ?? []) {
            const s = m_ui.map.computed?.shape_map?.[s_id];
            if (s == undefined)
                continue;
            for (let i = 0; i < s.vertices.length; i++) {
                s.vertices[i] = vector.add(s.vertices[i], move_by);
            }
            map_draw.move_vertices_recursively(s, move_by);
        }
    },
    get_style: (shape) => {
        if (shape.options.is_spawner)
            return STYLES.spawner;
        const style_maybe = shape.options.make_id != undefined ? make[shape.options.make_id]?.style : undefined;
        return STYLES[shape.options.style ?? style_maybe ?? "error"] ?? STYLES.error;
    },
    change: (type, shapes) => {
        if (!Array.isArray(shapes))
            shapes = [shapes];
        let s = `[change] (${type}) `;
        for (const shape of shapes) {
            s += shape.id + ", ";
        }
        console.log("%c%s", "background-color: #111; color: #abcdef", s.substring(0, s.length - (shapes.length <= 0 ? 1 : 2)));
        const raw_string = map_serialiser.save("auto", m_ui.map);
        if (!type.startsWith("undo"))
            map_serialiser.save_undo_state(raw_string);
    },
    delete_shape: (shape) => {
        if (!key.shift()) {
            if (!confirm("ARE YOU SURE YOU WANT TO DELETE [" + shape.id + "]"))
                return;
        }
        m_ui.map.shapes.remove(shape);
        // handle parent
        let contains = undefined;
        if (shape.options.parent && shape.options.parent !== "all") {
            contains = m_ui.map.computed?.shape_map[shape.options.parent].options.contains;
            contains?.remove(shape.id);
        }
        // handle children
        if (shape.options.contains?.length) {
            for (const s_id of shape.options.contains ?? []) {
                if (contains) {
                    contains.push(s_id);
                    m_ui.map.computed.shape_map[s_id].options.parent = shape.options.parent;
                }
                else
                    delete m_ui.map.computed?.shape_map[s_id].options.parent; // orphan :(
            }
        }
        m_ui.circle_menu.deactivate();
        m_ui.update_directory();
        map_draw.change("delete shape", shape);
    }
};
