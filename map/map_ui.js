import { math } from "../util/math.js";
import { vector } from "../util/vector.js";
import { camera } from "../util/camera.js";
import { ctx, view } from "../util/canvas.js";
import { color } from "../util/color.js";
import { key, keys, mouse } from "../util/key.js";
import { map_draw } from "../util/map_draw.js";
import { TEST_MAP, map_serialiser } from "../util/map_type.js";
import { settings_default } from "./settings.js";
import { SVG } from "../util/svg.js";
// globals, why not?
let width = window.innerWidth;
let height = window.innerHeight;
let x, y, w, h;
let r, c, size;
let o;
let hover, hovering, clicking;
export const ui = {
    time: 0,
    map: TEST_MAP,
    settings: {
        slot: settings_default.slot,
    },
    mouse: {
        click: false,
        new_click: false,
        was_click: false,
        release_click: false,
        mclick: false,
        new_mclick: false,
        was_mclick: false,
        release_mclick: false,
        rclick: false,
        new_rclick: false,
        was_rclick: false,
        release_rclick: false,
        clickbuttons: [false, false, false],
        double_click: false,
        hover_target: {},
        drag_target: [{}, {}, {}],
    },
    click: {
        new_fns: [() => { }, () => { }, () => { }],
        new_fns_exist: [false, false, false],
        new: function (fn, button = 0, overwrite = true) {
            if ((button === 0 && ui.mouse.new_click) || (button === 1 && ui.mouse.new_mclick) || (button === 2 && ui.mouse.new_rclick)) {
                if (overwrite || !ui.click.new_fns_exist[button]) {
                    ui.click.new_fns[button] = fn;
                    ui.click.new_fns_exist[button] = true;
                }
            }
        },
        tick: function () {
            for (let button = 0; button < 3; button++) {
                ui.click.new_fns[button]();
            }
            ui.click.new_fns_exist = [false, false, false];
        },
    },
    get viewport() {
        return {
            min_x: 60,
            max_x: width - Math.min(300, width * 0.23),
            min_y: height * 0.065,
            max_y: height,
        };
    },
    get world_viewport() {
        const [v1, v2] = vector.aabb2vs(ui.viewport);
        return vector.make_aabb([
            camera.screen2world(v1),
            camera.screen2world(v2),
        ]);
    },
    init: function () {
        key.add_keydown_listener((event) => {
            let dz = 0;
            if (event.code === "KeyQ" && event.shiftKey)
                dz -= 0.1;
            if (event.code === "KeyE" && event.shiftKey)
                dz += 0.1;
            if (event.code === "KeyZ" && event.ctrlKey) {
                if (event.shiftKey) { // full undo
                    if (confirm("undo all the way to the start?") && map_serialiser.initial_state) {
                        ui.map = map_serialiser.parse(map_serialiser.initial_state);
                        ui.init_map();
                        map_draw.change("undo all the way", []);
                    }
                }
                else { // one step undo
                    const undo = map_serialiser.undo();
                    if (undo) {
                        ui.map = undo;
                        ui.init_map();
                        map_draw.change("undo", []);
                    }
                }
            }
            camera.look_z += dz;
        });
        key.add_key_listener("Escape", () => {
            if (ui.properties_selecting_parent) {
                ui.properties_selecting_parent = "";
                ui.update_directory();
                ui.update_properties();
                ui.open_properties();
            }
            else if (ui.mouse.drag_target[0]) {
                const target = ui.mouse.drag_target[0];
                ui.deselect_shape();
                if (ui.mouse.click) {
                    target.shape.vertices = target.vertex_old;
                    // map_draw.change("reset 'move vertex'", target.shape); // pressing escape shouldn't change stuff
                }
            }
        });
        ui.map = map_serialiser.load("auto");
        ui.init_map();
        // focus on the all shape
        ui.directory_jump_fns.all();
        ui.properties_selected = ui.all_shape;
        // load initial undo state
        map_draw.change("nothing!", []);
    },
    init_map: function () {
        map_draw.compute_map(ui.map);
        ui.update_directory();
        ui.update_properties();
        ui.update_right_sidebar();
    },
    tick: function () {
        ui.time++;
        ui.mouse.double_click = mouse.double_click;
        ui.mouse.click = mouse.buttons[0];
        ui.mouse.new_click = mouse.down_buttons[0];
        ui.mouse.was_click = ui.mouse.clickbuttons[0];
        ui.mouse.release_click = mouse.up_buttons[0];
        ui.mouse.mclick = mouse.buttons[1];
        ui.mouse.new_mclick = mouse.down_buttons[1];
        ui.mouse.was_mclick = ui.mouse.clickbuttons[1];
        ui.mouse.release_mclick = mouse.up_buttons[1];
        ui.mouse.rclick = mouse.buttons[2];
        ui.mouse.new_rclick = mouse.down_buttons[2];
        ui.mouse.was_rclick = ui.mouse.clickbuttons[2];
        ui.mouse.release_rclick = mouse.up_buttons[2];
        ui.mouse.clickbuttons = [ui.mouse.click, ui.mouse.mclick, ui.mouse.rclick];
        ui.click.new_fns = [() => { }, () => { }, () => { }];
        const MOVE_SPEED = 10;
        let dx = 0;
        let dy = 0;
        if (keys.KeyW)
            dy -= 1;
        if (keys.KeyS)
            dy += 1;
        if (keys.KeyA)
            dx -= 1;
        if (keys.KeyD)
            dx += 1;
        if (dx !== 0 || dy !== 0)
            camera.move_by(vector.mult(vector.normalise(vector.create(dx, dy)), MOVE_SPEED / camera.scale));
        let dz = 1;
        if (keys.KeyQ && !(keys.ShiftLeft || keys.ShiftRight))
            dz *= 1.08;
        if (keys.KeyE && !(keys.ShiftLeft || keys.ShiftRight))
            dz /= 1.08;
        if (dz !== 1)
            camera.scale_by(camera.halfscreen, dz);
    },
    draw: () => {
        ui.draw_clear();
        ui.draw_grid();
        ui.draw_map();
        ui.draw_overlay();
        ui.draw_top();
        ui.draw_left();
        ui.draw_mouse();
        ui.update_camera();
        ui.click.tick();
    },
    editor: {
        mode: "none",
        settings: false,
    },
    top: [
        {
            name: "clear",
            icon: "x",
            action: () => { ui.editor.mode = "none"; }
        },
        {
            name: "add",
            icon: "add",
            action: () => { ui.editor.mode = "add"; }
        },
        {
            name: "edit",
            icon: "edit",
            action: () => { ui.editor.mode = "edit"; }
        },
        {
            name: "select",
            icon: "select",
            action: () => { ui.editor.mode = "select"; }
        },
        {
            name: "delete",
            icon: "delete",
            action: () => { ui.editor.mode = "delete"; }
        },
        {
            name: "settings",
            icon: "settings",
            action: () => { ui.editor.settings = true; }
        },
    ],
    top_settings: [
        {
            name: "save",
            icon: "save",
            action: () => {
                map_serialiser.save(ui.settings.slot, ui.map);
            },
        },
        {
            name: "load",
            icon: "load",
            action: () => {
                ui.map = map_serialiser.load(ui.settings.slot);
                map_draw.compute_map(ui.map);
            },
        },
        {
            name: "copy",
            icon: "copy",
            action: () => {
                map_draw.compute_map(ui.map);
                map_serialiser.copy(ui.map);
            },
        },
        {
            name: "back",
            icon: "start_left",
            action: () => { ui.editor.settings = false; }
        },
    ],
    circle_menu: {
        active: false,
        active_time: -1,
        target: {},
        activate: (active = true, force_animation = false) => {
            if (ui.circle_menu.active !== active || force_animation)
                ui.circle_menu.active_time = ui.time;
            ui.circle_menu.active = active;
        },
        deactivate: () => ui.circle_menu.activate(false),
        options: [
            {
                i: 0,
                name: "insert vertex",
                svg: "add",
                color: "#03fc77",
                fn: () => {
                    const target = ui.circle_menu.target;
                    target.shape.vertices.splice(target.index + (key.shift() ? 1 : 0), 0, vector.add(target.shape.vertices[target.index], vector.create(10, 10)));
                    map_draw.change("insert vertex", target.shape);
                },
                enabled: () => true,
            },
            {
                i: 1,
                name: "delete vertex",
                svg: "minus",
                color: "#fc6203",
                fn: () => {
                    const target = ui.circle_menu.target;
                    if (target.shape.vertices.length === 1) {
                        ui.circle_menu.options[3].fn(); // run delete shape function
                    }
                    else {
                        target.shape.vertices.splice(target.index, 1);
                        ui.circle_menu.deactivate();
                        map_draw.change("delete vertex", target.shape);
                    }
                },
                enabled: () => true,
            },
            {
                i: 2,
                name: "duplicate shape",
                svg: "copy",
                color: "#cc2be1",
                fn: () => {
                    const target = ui.circle_menu.target;
                    const insert_index = ui.map.shapes.indexOf(target.shape) + 1;
                    const new_shape = map_draw.duplicate_shape(target.shape);
                    if (new_shape.options.parent) {
                        ui.map.computed?.shape_map?.[new_shape.options.parent]?.options.contains?.push(new_shape.id);
                    }
                    if (insert_index >= 0)
                        ui.map.shapes.splice(insert_index, 0, new_shape);
                    ui.update_directory();
                    map_draw.change("duplicate shape", new_shape);
                },
                enabled: () => true,
            },
            {
                i: 3,
                name: "delete shape",
                svg: "delete",
                color: "#fc0b03",
                fn: () => {
                    const target = ui.circle_menu.target;
                    if (!key.shift()) {
                        if (!confirm("ARE YOU SURE YOU WANT TO DELETE [" + target.shape.id + "]"))
                            return;
                    }
                    const remove_index = ui.map.shapes.indexOf(target.shape);
                    if (remove_index >= 0)
                        ui.map.shapes.splice(remove_index, 1);
                    ui.circle_menu.deactivate();
                    ui.update_directory();
                    map_draw.change("delete shape", target.shape);
                },
                enabled: () => true,
            },
            {
                i: 4,
                name: "split shape",
                svg: "split",
                color: "#655fff",
                fn: () => {
                    const target = ui.circle_menu.target;
                    if (target.index === target.shape.vertices.length - 1)
                        return;
                    const insert_index = ui.map.shapes.indexOf(target.shape) + 1;
                    const new_shape = map_draw.duplicate_shape(target.shape, target.index);
                    if (new_shape.options.parent) {
                        ui.map.computed?.shape_map?.[new_shape.options.parent]?.options.contains?.push(new_shape.id);
                    }
                    if (insert_index >= 0)
                        ui.map.shapes.splice(insert_index, 0, new_shape);
                    ui.update_directory();
                    // map_draw.change("split shape at vertex " + target.index, new_shape);
                },
                enabled: () => {
                    const target = ui.circle_menu.target;
                    return target.index !== target.shape.vertices.length - 1;
                },
            },
            {
                i: 5,
                name: "open properties",
                svg: "info",
                color: "#3ca2f6ff",
                fn: () => {
                    const target = ui.circle_menu.target;
                    // console.log(target);
                    ui.open_properties(target.shape);
                    ui.directory_jump_fns[target.shape.id]?.();
                },
                enabled: () => true,
            },
        ],
    },
    draw_clear: () => {
        // draw all
        ctx.clear();
        ctx.fillStyle = color.black;
        ctx.begin();
        ctx.rect(0, 0, width, height);
        ctx.fill();
    },
    draw_top: () => {
        const top = ui.editor.settings ? ui.top_settings : ui.top;
        size = height * 0.065;
        ctx.fillStyle = color.white + "be";
        ctx.begin();
        ctx.rect(0, 0, width, size);
        ctx.fill();
        ctx.strokeStyle = color.white;
        ctx.lineWidth = 2;
        ctx.line(0, size, width, size);
        // draw the buttons
        w = width / (top.length + 0.5);
        x = w * 0.75;
        y = size / 2;
        ctx.fillStyle = color.black;
        for (const button of top) {
            ctx.beginPath();
            ctx.rectangle(x, y, w, size);
            hovering = ctx.point_in_path_v(mouse);
            ctx.fillStyle = hovering ? color.red_dark : color.black;
            ctx.svg(button.icon, x, y, size * 0.8);
            if (button.name === ui.editor.mode) {
                ctx.strokeStyle = color.blue;
                ctx.line(x - w / 2, size, x + w / 2, size);
            }
            else if (hovering) {
                ctx.strokeStyle = color.red_dark;
                ctx.line(x - w / 2, size, x + w / 2, size);
            }
            x += w;
            if (hovering)
                ui.click.new(button.action);
        }
    },
    draw_left: () => {
        ctx.save("draw_left");
        ctx.lineCap = "round";
        size = 60; // math.bound(Math.min(width, height * 2) * 0.065, 50, 70);
        ctx.fillStyle = color.white + "be";
        ctx.begin();
        ctx.rect(0, height * 0.065, size, height * 0.935);
        ctx.fill();
        x = size / 2;
        ctx.strokeStyle = color.white;
        ctx.lineWidth = 2;
        ctx.line(size, height * 0.065, size, height);
        ctx.strokeStyle = color.black;
        ctx.lineWidth = 5;
        ctx.line(x, height * 0.1, x, height * 0.965);
        // circles
        r = size / 5;
        // first circle
        const one = 0.5 - 0.1 * camera.z / camera.scale;
        y = height * (0.1 + one * 0.865);
        ctx.fillStyle = color.blue;
        ctx.begin();
        ctx.circle(x, y, r);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color.black;
        ctx.set_font_condensed(10);
        ctx.text(math.round_dp(camera.z / camera.scale, 1) + "", x, y);
        hovering = ctx.point_in_path_v(mouse);
        if (hovering) {
            ui.click.new(() => ui.mouse.drag_target[2] = { id: "_leftbar_z", change: 0, }, 2);
        }
        if (ui.mouse.drag_target[2].id === "_leftbar_z") {
            o = ui.mouse.drag_target[2];
            let dy = mouse.drag_change[2].y;
            dy /= height * 0.865 / 10;
            dy = camera.z / (camera.z / camera.scale - dy);
            camera.scale_to(camera.halfscreen, dy);
        }
        const two = 0.5 - 0.1 * camera.look_z;
        y = height * (0.1 + two * 0.865);
        ctx.fillStyle = color.green;
        ctx.begin();
        ctx.circle(x, y, r);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color.black;
        ctx.text(math.round_dp(camera.look_z, 1) + "", x, y);
        hovering = ctx.point_in_path_v(mouse);
        if (hovering) {
            ui.click.new(() => ui.mouse.drag_target[2] = { id: "_leftbar_zlook", change: 0, }, 2);
        }
        if (ui.mouse.drag_target[2].id === "_leftbar_zlook") {
            o = ui.mouse.drag_target[2];
            let dy = mouse.drag_change[2].y;
            dy /= height * 0.865 / 10;
            o.change -= dy;
            if (math.abs(o.change) >= 0.1) {
                const d = math.round_to(o.change, 0.1) ?? 0;
                camera.look_z += d;
                o.change -= d;
            }
        }
        // respond to mousedrag
        ctx.restore("draw_left");
    },
    draw_map: () => {
        ui.draw_a_map(ui.map);
    },
    draw_a_map: (map) => {
        map_draw.draw(ctx, map);
    },
    draw_overlay: () => {
        // draw right click circle menu
        if (ui.circle_menu.active || (ui.circle_menu.target?.id && (ui.time - ui.circle_menu.active_time <= 20))) {
            const target = ui.circle_menu.target;
            const v = target.shape.computed?.screen_vertices ? (target.shape.computed?.screen_vertices[target.index] ?? target.vertex) : target.vertex;
            let ratio = Math.min(1, (ui.time - ui.circle_menu.active_time) ** 0.7 / 5);
            if (!ui.circle_menu.active)
                ratio = 1 - ratio;
            const a = Math.PI * 2 / ui.circle_menu.options.length;
            const a_ = (ui.time / 100) % (Math.PI * 2);
            size = 50 * ratio;
            for (const option of ui.circle_menu.options) {
                const i = option.i;
                const disabled = !option.enabled();
                ctx.fillStyle = disabled ? color.grey : option.color;
                ctx.beginPath();
                ctx.donut_arc(v.x, v.y, 90 * ratio, 10 * ratio, a_ + a * (i + 0.05), a_ + a * (i + 0.95), a_ + a * (i + 0.4), a_ + a * (i + 0.6));
                hovering = ctx.point_in_path_v(mouse);
                ctx.globalAlpha = 0.2 * ratio + ((hovering && !disabled) ? 0.3 : 0);
                ctx.fill();
                ctx.beginPath();
                ctx.donut_arc(v.x, v.y, 90 * ratio, 80 * ratio, a_ + a * (i + 0.05), a_ + a * (i + 0.95), a_ + a * (i + 0.05625), a_ + a * (i + 0.94375));
                ctx.globalAlpha = 0.7 * ratio + ((hovering && !disabled) ? 0.2 : 0);
                ctx.fill();
                ctx.svg(option.svg, v.x + size * Math.cos(a_ + a * (i + 0.5)), v.y + size * Math.sin(a_ + a * (i + 0.5)), size * 0.9);
                if (hovering)
                    ui.click.new(disabled ? () => { } : option.fn);
            }
            ctx.globalAlpha = 1;
            if (!vector.in_circle(mouse, v, 100)) {
                const close_fn = () => {
                    ui.circle_menu.deactivate();
                    ui.deselect_shape();
                };
                ui.click.new(close_fn);
                ui.click.new(close_fn, 2, false); // don't overwrite
            }
        }
    },
    draw_selection: (map) => {
    },
    draw_grid: () => {
        const grid_size = camera.scale * 10;
        if (grid_size >= 50)
            ui.draw_a_grid(grid_size / 5, color.darkgrey, camera.sqrtscale * 0.1);
        if (grid_size >= 6)
            ui.draw_a_grid(grid_size, color.darkgrey, camera.sqrtscale * 0.4);
        if (grid_size >= 2)
            ui.draw_a_grid(grid_size * 5, color.darkgrey, camera.sqrtscale * 0.8);
        ui.draw_a_grid(grid_size * 10, color.darkgrey, camera.sqrtscale * 1.1);
        ui.draw_a_grid(grid_size * 100, color.darkgrey, camera.sqrtscale * 2.0);
        ui.draw_a_grid(grid_size * 1000000, color.grey, camera.sqrtscale * 2.0);
        // behaviour when clicked outside of anything important
        if (ui.mouse.drag_target[0]?.id && !ui.circle_menu.active) {
            ui.click.new(ui.deselect_shape);
        }
    },
    draw_a_grid: (grid_size, color, line_width) => {
        let xx = (-camera.position.x * camera.scale);
        let yy = (-camera.position.y * camera.scale);
        let x = xx % grid_size;
        let y = yy % grid_size;
        ctx.strokeStyle = color;
        ctx.lineWidth = line_width;
        while (x < view.width) {
            ctx.line(x, 0, x, view.height);
            x += grid_size;
        }
        while (y < view.height) {
            ctx.line(0, y, view.width, y);
            y += grid_size;
        }
    },
    select_shape: (target) => {
        const old_id = ui.mouse.drag_target[0]?.shape?.id;
        ui.mouse.drag_target[0] = target;
        ui.color_directory_element(old_id, "");
        ui.color_directory_element(target.shape.id, "#ff000033");
        if (ui.circle_menu.active) {
            ui.circle_menu.target = target;
        }
    },
    deselect_shape: () => {
        ui.color_directory_element(ui.mouse.drag_target[0]?.shape?.id, "");
        ui.mouse.drag_target[0] = {};
    },
    draw_mouse: () => {
        const size = 10;
        const mode = ui.editor.mode;
        let v = vector.clone(mouse);
        let offset = vector.create();
        if (mode === "select")
            offset = vector.create(size * 0.6, size);
        if (mode === "edit")
            offset = vector.create(size * 0.7, -size * 0.7);
        v = vector.add(v, offset);
        ctx.fillStyle = color.white;
        ctx.svg(ui.editor.mode, v.x, v.y, size * 2);
    },
    update_camera: () => {
        if (ui.mouse.click && ui.mouse.drag_target[0]?.id == undefined) {
            camera.move_by_mouse();
        }
        if (ui.mouse.rclick) {
            // camera.move_by_mouse();
        }
        if (mouse.scroll !== 0 && !keys.Shift) {
            if (mouse.scroll < 0) {
                camera.scale_by(vector.clone(mouse), 1.3);
            }
            else {
                camera.scale_by(vector.clone(mouse), 1 / 1.3);
            }
        }
    },
    right_sidebar_mode: "directory",
    directory_elements: {},
    directory_jump_fns: {},
    all_aabb: vector.make_aabb(),
    all_shape: {
        id: "all",
        z: 0,
        vertices: [],
        style: {},
        options: { contains: [], },
    },
    color_directory_element: (shape_id, color) => {
        if (ui.directory_elements[shape_id]?.querySelector("span")) {
            ui.directory_elements[shape_id].querySelector("span").style.backgroundColor = color;
        }
    },
    update_right_sidebar: () => {
        const aside_directory = document.getElementById("directory");
        const aside_properties = document.getElementById("properties");
        if (aside_directory == undefined)
            return console.error("[ui/update_right_sidebar] right sidebar directory <aside> not found!");
        if (aside_properties == undefined)
            return console.error("[ui/update_right_sidebar] right sidebar properties <aside> not found!");
        aside_directory.style.display = ui.right_sidebar_mode === "directory" ? "block" : "none";
        aside_properties.style.display = ui.right_sidebar_mode === "properties" ? "block" : "none";
    },
    update_directory: () => {
        const aside = document.getElementById("directory");
        if (aside == undefined)
            return console.error("[ui/update_directory] right sidebar directory <aside> not found!");
        // clear stuff
        aside.innerHTML = ``;
        ui.directory_elements = {};
        ui.directory_jump_fns = {};
        // this shape contains everything!
        ui.all_shape = {
            id: "all",
            z: 0,
            vertices: [],
            options: { contains: [], },
        };
        const sorted_shapes = ui.map.shapes?.sort((s1, s2) => s1.computed?.depth - s2.computed?.depth);
        for (const shape of [ui.all_shape].concat(sorted_shapes ?? [])) {
            const id = shape.id;
            if (id !== "all") {
                ui.all_shape.options.contains?.push(id);
                if (shape.computed)
                    ui.all_aabb = vector.aabb_combine(ui.all_aabb, shape.computed.aabb);
                else
                    console.error("[ui/update_directory] shape not computed: " + id);
            }
            if (shape.options == undefined)
                shape.options = {};
            if (shape.options.parent == undefined)
                shape.options.parent = "all";
            const li = document.createElement("li");
            let clickable = li;
            if (id === "all" || (shape.options.contains?.length ?? 0) > 0) {
                // is a folder
                const details = document.createElement("details");
                details.classList.add("folder");
                details.setAttribute("open", "");
                const summary = document.createElement("summary");
                summary.innerHTML = `<span>${id}</span>`;
                details.appendChild(summary);
                const ul = document.createElement("ul");
                details.appendChild(ul);
                if (id === "all") {
                    aside.appendChild(details);
                }
                else {
                    li.appendChild(details);
                    if (!ui.directory_elements[shape.options.parent])
                        console.error("[ui/update_directory] parent folder (" + shape.options.parent + ") not found for folder (" + id + ")");
                    else
                        ui.directory_elements[shape.options.parent].querySelector("ul").appendChild(li);
                }
                ui.directory_elements[id] = details;
                clickable = summary;
            }
            else {
                // is a leaf
                const span = document.createElement("span");
                span.classList.add("file");
                span.style.backgroundImage = `url("/shape.svg")`;
                span.innerHTML = `<span>${id}</span>`;
                li.appendChild(span);
                if (!ui.directory_elements[shape.options.parent])
                    console.error("[ui/update_directory] parent folder (" + shape.options.parent + ") not found for leaf (" + id + ")");
                else
                    ui.directory_elements[shape.options.parent].querySelector("ul").appendChild(li);
                ui.directory_elements[id] = span;
                clickable = li;
            }
            ui.directory_jump_fns[id] = function () {
                let aabb = vector.make_aabb();
                if (id === "all") {
                    aabb = ui.all_aabb;
                }
                else {
                    if (!shape.computed)
                        return;
                    aabb = shape.computed.aabb;
                }
                const view_v = vector.aabb2v(ui.viewport);
                const size_v = vector.aabb2v(aabb);
                if (size_v.x <= 0 && size_v.y <= 0)
                    size = camera.scale;
                else
                    size = Math.min(view_v.x / size_v.x, view_v.y / size_v.y) / 1.5;
                camera.jump_to(vector.aabb_centre(aabb), size, vector.aabb_centre(ui.viewport));
            };
            clickable.addEventListener("click", function (event) {
                const style = window.getComputedStyle(clickable, null);
                const pLeft = parseFloat(style.getPropertyValue('padding-left'));
                if (event.offsetX > pLeft) {
                    // it is not a click on the file
                    event.preventDefault();
                    if (ui.properties_selecting_parent && ui.properties_selecting_parent !== shape.id)
                        ui.select_parent(shape);
                    else
                        ui.open_properties(shape);
                }
            });
            clickable.addEventListener("contextmenu", function (event) {
                event.preventDefault();
                ui.directory_jump_fns[id]();
            });
        }
    },
    properties_selected: {},
    properties_selecting_parent: "",
    properties_options: {
        shape: {
            parent: {
                name: "parent",
                type: "button",
            },
            open_loop: {
                name: "open loop",
                type: "checkbox",
            },
            style: {
                name: "style",
                type: "text",
            },
        },
        /*parent: {
          name: "parent",
          type: "text",
        },*/
    },
    properties_options_metadata: {
        shape: {
            name: "Shape",
        },
    },
    update_properties: () => {
        const aside = document.getElementById("properties");
        if (aside == undefined)
            return console.error("[ui/update_properties] right sidebar properties <aside> not found!");
        const shape = ui.properties_selected;
        if (shape == undefined || shape.id == undefined)
            return;
        aside.innerHTML = `
      <button id="close" title="close">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="${SVG.x}"/></svg>
      </button>
      <h3 style="margin: 0; user-select: none;">properties for <span id="jump_to_shape">${shape.id}</span>
      <button id="edit_id" title="edit id">
        <svg xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em;" viewBox="0 0 24 24"><path fill="currentColor" d="${SVG.edit}"/></svg>
      </button>
      </h3>
      <div style="float: left; user-select: none;"></div>
    `;
        document.getElementById("jump_to_shape")?.addEventListener("click", function (event) {
            ui.directory_jump_fns[shape.id]?.();
        });
        document.getElementById("close")?.addEventListener("click", function (event) {
            ui.properties_selected = ui.all_shape;
            ui.right_sidebar_mode = "directory";
            ui.update_right_sidebar();
        });
        if (shape.id === "all")
            document.getElementById("edit_id").style.display = "none";
        else
            document.getElementById("edit_id")?.addEventListener("click", function (event) {
                const old_id = shape.id;
                const new_id = prompt("new id?", shape.id);
                if (new_id == null || new_id === old_id)
                    return;
                if (ui.map.computed?.shape_map == undefined)
                    map_serialiser.compute(ui.map);
                const shape_map = ui.map.computed?.shape_map;
                for (const s of shape.options.contains ?? []) {
                    shape_map[s].options.parent = new_id;
                }
                if (shape.options.parent && shape.options.parent !== "all") {
                    const contains = shape_map[shape.options.parent].options.contains;
                    const index = contains?.indexOf(old_id);
                    if (contains != undefined && index != undefined && index >= 0)
                        contains[index] = new_id;
                }
                shape.id = new_id;
                map_serialiser.compute(ui.map);
                ui.update_directory();
                ui.update_properties();
                map_draw.change("edit ID) (from " + old_id + " to " + new_id, shape);
            });
        const div = document.querySelector("aside#properties > div");
        if (div == undefined)
            return console.error("[ui/update_properties] aside > div not found!");
        if (shape.id === "all") {
            div.innerHTML = `
        <p>Total shapes: <b>${shape.options.contains?.length ?? 0}</b></p>
      `;
        }
        else {
            for (const group_key in ui.properties_options) {
                const group = ui.properties_options[group_key];
                // todo: property groups
                // const details = document.createElement("details");
                // const summary = document.createElement("summary");
                // summary.textContent = group_key;
                for (const option_key in group) {
                    const option = group[option_key];
                    const p = document.createElement("p");
                    p.classList.add(option.type);
                    const label = document.createElement("label");
                    label.textContent = option.name;
                    label.setAttribute("for", option_key);
                    const input = document.createElement("input");
                    input.setAttribute("type", option.type);
                    input.setAttribute("autocomplete", "off");
                    input.setAttribute("name", option_key);
                    input.setAttribute("id", option_key);
                    p.appendChild(label);
                    p.appendChild(input);
                    if (option.type === "checkbox") {
                        input.checked = shape.options[option_key];
                        input.addEventListener("change", function (event) {
                            if (input.checked)
                                shape.options[option_key] = true;
                            else
                                delete shape.options[option_key];
                            map_draw.change("edit property: " + option_key, shape);
                        });
                    }
                    else if (option.type === "text") {
                        input.value = shape.options[option_key];
                        input.addEventListener("change", function (event) {
                            if (input.value.length)
                                shape.options[option_key] = input.value;
                            else
                                delete shape.options[option_key];
                            map_draw.change("edit property: " + option_key, shape);
                        });
                    }
                    else if (option.type === "button") {
                        if (option_key === "parent") {
                            const is_selecting = ui.properties_selected.id === ui.properties_selecting_parent;
                            label.innerHTML += `
                : ${(shape.options.parent === "all" ? "&lt;none&gt;" : (shape.options.parent ?? "&lt;none&gt;"))}
                <button style="font-size: 0.8em;" id="edit_parent" title="${is_selecting ? "don't edit parent" : "edit parent"}">
                  <svg xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em;" viewBox="0 0 24 24"><path fill="currentColor" d="${is_selecting ? SVG.edit_off : SVG.edit}"/></svg>
                </button>
              `.trim();
                            input.style.display = "none";
                            label.querySelector("button")?.addEventListener("click", function (event) {
                                if (is_selecting) {
                                    ui.properties_selecting_parent = "";
                                    ui.directory_elements.all.style.backgroundColor = "";
                                    ui.update_properties();
                                }
                                else {
                                    ui.properties_selecting_parent = ui.properties_selected.id;
                                    ui.right_sidebar_mode = "directory";
                                    ui.update_directory();
                                    ui.directory_elements.all.style.backgroundColor = "#d7e11155";
                                    ui.update_right_sidebar();
                                }
                            });
                        }
                        else {
                            // why
                        }
                    }
                    div.appendChild(p);
                }
            }
        }
    },
    open_properties: (shape) => {
        if (shape)
            ui.properties_selected = shape;
        ui.right_sidebar_mode = "properties";
        ui.update_properties();
        ui.update_right_sidebar();
    },
    select_parent: (shape) => {
        const child_id = ui.properties_selected.id;
        const old_parent_id = ui.properties_selected.options.parent;
        if (old_parent_id === shape.id || child_id === shape.id || child_id === undefined)
            return;
        if (ui.check_child(child_id, shape))
            return console.error(`[ui/select_parent] child '${shape.id}' can't be set to the parent of '${child_id}'!`);
        const old_parent = old_parent_id == undefined ? undefined :
            (old_parent_id === "all" ? ui.all_shape : ui.map.computed?.shape_map[old_parent_id]);
        if (shape.id === "all")
            delete ui.properties_selected.options.parent;
        else
            ui.properties_selected.options.parent = shape.id; // actually set the parent
        // make parent contain child
        if (shape.options.contains === undefined)
            shape.options.contains = [child_id];
        else
            shape.options.contains?.push(child_id);
        // delete child from old parent
        if (old_parent !== undefined && old_parent.id !== "all") {
            const found_index = old_parent.options.contains?.indexOf(child_id);
            if (found_index !== undefined && found_index >= 0)
                old_parent.options.contains?.splice(found_index, 1);
            if ((old_parent.options.contains?.length ?? -1) === 0)
                delete old_parent.options.contains;
        }
        ui.properties_selecting_parent = "";
        map_serialiser.compute(ui.map);
        ui.update_directory();
        ui.right_sidebar_mode = "directory";
        ui.update_right_sidebar();
        map_draw.change("edit property: parent", ui.properties_selected);
    },
    // recursive
    check_child: (check_id, shape) => {
        if ((shape.options.parent?.length ?? 0) <= 0 || shape.options.parent === "all")
            return false;
        let s = shape;
        let depth = 1;
        while ((s?.options.parent?.length ?? 0) > 0 && s?.options.parent !== "all" && depth < 100) {
            const parent_id = s?.options.parent;
            s = ui.map.computed?.shape_map[parent_id];
            if (s == undefined) {
                console.error(`[ui/check_child] (${shape.id}) why is '${parent_id}' not in the computed shape map?`);
                return false;
            }
            if (s.id === check_id || s?.options.parent === check_id)
                return true;
            depth++;
        }
        return false;
    },
};
window.addEventListener("resize", function (event) {
    width = window.innerWidth;
    height = window.innerHeight;
});
