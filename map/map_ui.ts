import { math } from "../util/math.js";
import { AABB, vector, vector3 } from "../util/vector.js";
import { camera } from "../util/camera.js";
import { canvas, ctx } from "../util/canvas.js";
import { color } from "../util/color.js";
import { key, keys, mouse } from "../util/key.js";
import { map_draw } from "../util/map_draw.js";
import { TEST_MAP, map_serialiser, map_shape_options_type, map_shape_type, map_type, map_vertex_type } from "../util/map_type.js";
import { settings_default } from "./settings.js";
import { SVG } from "../util/svg.js";
import { make, override_object } from "../game/make.js";
import { save_map_settings } from "./map_index.js";

// globals, why not?
let width = canvas.width;
let height = canvas.height;
let x: number, y: number, w: number, h: number;
let r: number, size: number;
let o: any;
let hovering: boolean;

export const m_ui = {

  time: 0,

  map: TEST_MAP as map_type,

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
    hover_target: {} as any,
    drag_target: [{}, {}, {}] as any[],
  },

  click: {
    new_fns: [() => {}, () => {}, () => {}] as (() => void)[],
    new_fns_exist: [false, false, false] as boolean[],
    new: function(fn: () => void, button: 0 | 1 | 2 = 0, overwrite = true) {
      if ((button === 0 && m_ui.mouse.new_click) || (button === 1 && m_ui.mouse.new_mclick) || (button === 2 && m_ui.mouse.new_rclick)) {
        if (overwrite || !m_ui.click.new_fns_exist[button]) {
          m_ui.click.new_fns[button] = fn;
          m_ui.click.new_fns_exist[button] = true;
        }
      }
    },
    tick: function() {
      for (let button = 0; button < 3; button++) {
        if (m_ui.click.new_fns_exist[button]) {
          m_ui.click.new_fns[button]();
          keys[["Mouse", "MouseRight", "MouseWheel"][button]] = false;
        }
      }
      m_ui.click.new_fns_exist = [false, false, false];
    },
  },

  get viewport(): AABB {
    return {
      min_x: 60,
      max_x: width - Math.min(300, width * 0.23),
      min_y: height * 0.065,
      max_y: height,
    } as AABB;
  },

  get world_viewport(): AABB {
    const [v1, v2] = vector.aabb2vs(m_ui.viewport);
    return vector.make_aabb([
      camera.screen2world(v1),
      camera.screen2world(v2),
    ]);
  },

  init: function() {

    key.add_keydown_listener((event) => {
      if (event.shiftKey) { // handle shift
        let dz = 0;
        if (event.code === "KeyQ") dz -= 0.1;
        if (event.code === "KeyE") dz += 0.1;
        if (m_ui.mouse.drag_target[0] != undefined && m_ui.mouse.drag_target[0].shape && m_ui.mouse.drag_target[0].id !== "all") {
          let dx = 0, dy = 0;
          if (event.code === "KeyA") dx -= 1;
          if (event.code === "KeyD") dx += 1;
          if (event.code === "KeyW") dy -= 1;
          if (event.code === "KeyS") dy += 1;
          const target = m_ui.mouse.drag_target[0] as map_vertex_type;
          const v = target.shape.vertices[target.index];
          if (event.code === "KeyR" || (dx === 0 && dy === 0 && dz !== 0 && target.shape.z === (v.z ?? target.shape.z) + dz)) {
            target.shape.vertices[target.index] = vector.clone(target.shape.vertices[target.index]);
            map_draw.change("reset z of vertex #" + target.index, target.shape);
          } else {
            v.x = math.round(v.x + dx);
            v.y = math.round(v.y + dy);
            v.z = math.round_to((v.z ?? target.shape.z) + dz, 0.1);
            if (dx || dy || dz) map_draw.change("move vertex #" + target.index, target.shape);
          }
        } else {
          if (event.code === "KeyR") dz -= camera.look_z;
          camera.look_z = math.round_to(camera.look_z + dz, 0.1);
          save_map_settings();
        }
      }
      if (event.code === "KeyZ" && event.ctrlKey) {
        if (event.shiftKey) { // full undo
          if (confirm("undo all and revert to initial state?") && map_serialiser.initial_state) {
            m_ui.map = map_serialiser.parse(map_serialiser.initial_state);
            m_ui.init_map();
            map_draw.change("undo all", []);
          }
        } else { // one step undo
          const undo = map_serialiser.undo();
          if (undo) {
            m_ui.map = undo;
            m_ui.init_map();
            map_draw.change("undo", []);
          }
        }
      }
      // show all
      if (event.code === "Digit0") {
        m_ui.editor.map_mode = false;
        m_ui.editor.layers.z = 1;
        m_ui.editor.layers.floors = true;
        m_ui.editor.layers.spawners = true;
        m_ui.editor.layers.sensors = true;
        m_ui.editor.layers.rooms = true;
        m_ui.editor.layers.decoration = true;
        m_ui.editor.layers.debug = false;
      }
      // toggle map
      if (event.code === "Tab" || event.code === "KeyM") m_ui.top[0].action();
      // top buttons
      for (let i = 1; i <= 6; i++) {
        if (event.code === "Digit" + i) {
          m_ui.top[i].action();
        }
      }
    });

    key.add_key_listener("Escape", () => {
      if (m_ui.properties_selecting_parent || m_ui.properties_selecting_connection) {
        m_ui.properties_selecting_parent = "";
        m_ui.properties_selecting_connection = "";
        m_ui.update_directory();
        m_ui.update_properties();
        m_ui.open_properties();
      } else if (m_ui.mouse.drag_target[0]) {
        const target = m_ui.mouse.drag_target[0] as map_vertex_type;
        m_ui.deselect_shape();
        if (m_ui.mouse.click) {
          target.shape.vertices = target.vertex_old;
          // map_draw.change("reset 'move vertex'", target.shape); // pressing escape shouldn't change stuff
        }
      }
      if (m_ui.properties_selected) {
        m_ui.properties_selected = m_ui.all_shape;
        m_ui.right_sidebar_mode = "directory";
        m_ui.update_right_sidebar();
      }
    });

    key.add_key_listener("KeyF", () => {
      m_ui.right_sidebar_mode = m_ui.right_sidebar_mode === "directory" ? "properties" : "directory";
      if (m_ui.right_sidebar_mode === "directory") m_ui.update_directory();
      else m_ui.update_properties();
      m_ui.update_right_sidebar();
    });

    m_ui.map = map_serialiser.load("auto");
    if (m_ui.map.shapes.length <= 0) m_ui.map = TEST_MAP;

    m_ui.init_map();

    // focus on the all shape
    m_ui.directory_jump_fns.all();
    m_ui.properties_selected = m_ui.all_shape;

    // load initial undo state
    map_draw.change("nothing!", []);

  },

  init_map: function() {

    map_draw.compute_map(m_ui.map);
    m_ui.update_directory();
    m_ui.update_properties();
    m_ui.update_right_sidebar();

  },

  tick: function() {
    m_ui.time++;
    m_ui.mouse.double_click = mouse.double_click;
    m_ui.mouse.click = mouse.buttons[0];
    m_ui.mouse.new_click = mouse.down_buttons[0];
    m_ui.mouse.was_click = m_ui.mouse.clickbuttons[0];
    m_ui.mouse.release_click = mouse.up_buttons[0];
    m_ui.mouse.mclick = mouse.buttons[1];
    m_ui.mouse.new_mclick = mouse.down_buttons[1];
    m_ui.mouse.was_mclick = m_ui.mouse.clickbuttons[1];
    m_ui.mouse.release_mclick = mouse.up_buttons[1];
    m_ui.mouse.rclick = mouse.buttons[2];
    m_ui.mouse.new_rclick = mouse.down_buttons[2];
    m_ui.mouse.was_rclick = m_ui.mouse.clickbuttons[2];
    m_ui.mouse.release_rclick = mouse.up_buttons[2];
    m_ui.mouse.clickbuttons = [m_ui.mouse.click, m_ui.mouse.mclick, m_ui.mouse.rclick];

    m_ui.click.new_fns = [() => {}, () => {}, () => {}];

    const MOVE_SPEED = 10;
    if (!key.shift() && !keys.ShiftLeft && !keys.ShiftRight) {
      let dx = 0;
      let dy = 0;
      if (keys.KeyW) dy -= 1;
      if (keys.KeyS) dy += 1;
      if (keys.KeyA) dx -= 1;
      if (keys.KeyD) dx += 1;
      if (dx !== 0 || dy !== 0) {
        camera.move_by(vector.mult(vector.normalise(vector.create(dx, dy)), MOVE_SPEED / camera.scale));
        save_map_settings();
      }
      let dz = 1;
      if (keys.KeyQ) dz *= 1.08;
      if (keys.KeyE) dz /= 1.08;
      if (dz !== 1) {
        camera.scale_by(camera.halfscreen, dz);
        save_map_settings();
      }
    }
  },

  draw: function() {

    m_ui.draw_clear();
    m_ui.draw_grid();
    m_ui.draw_map();
    m_ui.draw_circle_menu();
    m_ui.draw_overlay();
    m_ui.draw_top();
    m_ui.draw_left();
    m_ui.draw_mouse();
    m_ui.update_camera();
    m_ui.click.tick();

  },

  editor: {
    mode: "none",
    map_mode: false,
    old_look_z: 0,
    layers: {
      z: 1,
      floors: true,
      spawners: true,
      sensors: true,
      rooms: true,
      decoration: true,
      debug: false,
    },
    settings: false,
  },

  top: [
    {
      name: "clear",
      icon: "map",
      action: () => {
        m_ui.editor.map_mode = !m_ui.editor.map_mode;
        m_ui.update_directory();
        if (m_ui.editor.map_mode) {
          m_ui.editor.old_look_z = camera.look_z;
          camera.look_z = 0;
        } else camera.look_z = m_ui.editor.old_look_z;
        save_map_settings();
      },
      color: (): string => m_ui.editor.map_mode ? "#6958ed" : color.black,
    },
    // {
    //   name: "clear",
    //   icon: "x",
    //   action: () => {
    //     m_ui.editor.layers.z = 1;
    //     m_ui.editor.layers.floors = true;
    //     m_ui.editor.layers.spawners = true;
    //     m_ui.editor.layers.sensors = true;
    //     m_ui.editor.layers.rooms = true;
    //     m_ui.editor.layers.decoration = true;
    //     m_ui.editor.layers.debug = false;
    //   },
    //   color: (): string => color.black,
    // },
    {
      name: "z",
      get icon(): string {
        return (m_ui.editor.layers.z >= 2) ? "layers_" : "layers";
      },
      action: function() {
        m_ui.editor.layers.z += 1;
        m_ui.editor.layers.z %= 3;
      },
      color: (): string => [color.black, "#479e33", "#699e33"][m_ui.editor.layers.z],
    },
    {
      name: "wall",
      icon: "wall",
      action: () => { m_ui.editor.layers.floors = !m_ui.editor.layers.floors; },
      color: (): string => m_ui.editor.layers.floors ? "#004ab3" : color.black,
    },
    {
      name: "spawner",
      icon: "spawner",
      action: () => { m_ui.editor.layers.spawners = !m_ui.editor.layers.spawners; },
      color: (): string => m_ui.editor.layers.spawners ? color.spawner : color.black,
    },
    {
      name: "sensor",
      icon: "sensor",
      action: () => { m_ui.editor.layers.sensors = !m_ui.editor.layers.sensors; },
      color: (): string => m_ui.editor.layers.sensors ? "#009bb3" : color.black,
    },
    {
      name: "room",
      icon: "room",
      action: () => { m_ui.editor.layers.rooms = !m_ui.editor.layers.rooms; },
      color: (): string => m_ui.editor.layers.rooms ? "#e00b6f" : color.black,
    },
    {
      name: "decoration",
      icon: "decoration",
      action: () => { m_ui.editor.layers.decoration = !m_ui.editor.layers.decoration; },
      color: (): string => m_ui.editor.layers.decoration ? "#ad8118" : color.black,
    },
    {
      name: "settings",
      icon: "settings",
      action: () => { m_ui.editor.settings = true; },
      color: (): string => color.black,
    },
  ],

  top_settings: [
    {
      name: "debug",
      get icon(): string {
        return (m_ui.editor.layers.debug) ? "debug_frame" : "debug";
      },
      action: () => { m_ui.editor.layers.debug = !m_ui.editor.layers.debug; },
      color: (): string => m_ui.editor.layers.debug ? "#ad1818" : color.black,
    },
    {
      name: "save",
      icon: "save",
      action: () => {
        map_serialiser.save(m_ui.settings.slot, m_ui.map);
      },
      color: (): string => color.black,
    },
    {
      name: "load",
      icon: "load",
      action: () => {
        m_ui.map = map_serialiser.load(m_ui.settings.slot);
        map_draw.compute_map(m_ui.map);
      },
      color: (): string => color.black,
    },
    {
      name: "copy",
      icon: "copy",
      action: () => {
        map_draw.compute_map(m_ui.map);
        map_serialiser.copy(m_ui.map);
      },
      color: (): string => color.black,
    },
    {
      name: "back",
      icon: "start_left",
      action: () => { m_ui.editor.settings = false; },
      color: (): string => color.black,
    },
  ],

  circle_menu: {
    active: false,
    active_time: -1,
    target: {} as map_vertex_type,
    activate: (active = true, force_animation = false) => {
      if (m_ui.circle_menu.active !== active || force_animation) m_ui.circle_menu.active_time = m_ui.time;
      m_ui.circle_menu.active = active;
    },
    deactivate: () => m_ui.circle_menu.activate(false),
    options: [
      {
        i: 0,
        name: "insert vertex",
        svg: "add",
        color: "#03fc77",
        fn: () => {
          const target = m_ui.circle_menu.target;
          target.shape.vertices.splice(
            target.index + (key.shift() ? 1 : 0),
            0,
            vector.add(target.shape.vertices[target.index], vector.create(10, 10))
          );
          target.vertex_old = vector3.clone_list_(target.shape.vertices);
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
          const target = m_ui.circle_menu.target;
          if (target.shape.vertices.length === 1) {
            m_ui.circle_menu.options[3].fn(); // run delete shape function
          } else {
            target.shape.vertices.splice(target.index, 1);
            target.vertex_old = vector3.clone_list_(target.shape.vertices);
            m_ui.circle_menu.deactivate();
            map_draw.change("delete vertex #" + target.index, target.shape);
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
          const target = m_ui.circle_menu.target;
          const insert_index = m_ui.map.shapes.indexOf(target.shape) + 1;
          const new_shape = map_draw.duplicate_shape(target.shape);
          if (new_shape.options.parent) {
            m_ui.map.computed?.shape_map?.[new_shape.options.parent]?.options.contains?.push(new_shape.id);
          }
          if (insert_index >= 0) m_ui.map.shapes.splice(insert_index, 0, new_shape);
          m_ui.update_directory();
          // todo switch focus to newly duplicated shape
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
          const target = m_ui.circle_menu.target;
          map_draw.delete_shape(target.shape);
        },
        enabled: () => true,
      },
      {
        i: 4,
        name: "split shape",
        svg: "split",
        color: "#655fff",
        fn: () => {
          const target = m_ui.circle_menu.target;
          if (target.index === target.shape.vertices.length - 1) return;
          const insert_index = m_ui.map.shapes.indexOf(target.shape) + 1;
          const new_shape = map_draw.duplicate_shape(target.shape, target.index);
          if (new_shape.options.parent) {
            m_ui.map.computed?.shape_map?.[new_shape.options.parent]?.options.contains?.push(new_shape.id);
          }
          if (insert_index >= 0) m_ui.map.shapes.splice(insert_index, 0, new_shape);
          m_ui.update_directory();
          map_draw.change("split shape at vertex " + target.index, new_shape);
        },
        enabled: (): boolean => {
          const target = m_ui.circle_menu.target;
          return target.index !== target.shape.vertices.length - 1;
        },
      },
      {
        i: 5,
        name: "open properties",
        svg: "info",
        color: "#3ca2f6ff",
        fn: () => {
          const target = m_ui.circle_menu.target;
          console.log(target.shape.vertices[target.index]);
          m_ui.open_properties(target.shape);
          m_ui.directory_jump_fns[target.shape.id]?.();
        },
        enabled: () => true,
      },
    ],
  },

  draw_clear: function() {
    // draw all
    ctx.clear();
    ctx.fillStyle = color.black;
    ctx.begin();
    ctx.rect(0, 0, width, height);
    ctx.fill();
  },

  draw_top: function() {
    const top = m_ui.editor.settings ? m_ui.top_settings : m_ui.top;
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
      hovering = ctx.point_in_path_v(mouse.position);
      const button_color = button.color();
      ctx.fillStyle = hovering ? color.red_dark : button_color;
      ctx.svg(button.icon as keyof typeof SVG, x, y, size * 0.8);
      if (button.name === m_ui.editor.mode) {
        ctx.strokeStyle = color.blue;
        ctx.line(x - w / 2, size, x + w / 2, size);
      } else if (hovering) {
        ctx.strokeStyle = color.red_dark;
        ctx.line(x - w / 2, size, x + w / 2, size);
      } else if (button_color !== color.black) {
        ctx.strokeStyle = button_color;
        ctx.line(x - w / 2, size, x + w / 2, size);
      }
      x += w;
      if (hovering) m_ui.click.new(button.action);
    }
  },

  draw_left: function() {
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
    hovering = ctx.point_in_path_v(mouse.position);
    if (hovering) {
      m_ui.click.new(() => m_ui.mouse.drag_target[2] = { id: "_leftbar_z", change: 0, }, 2);
    }
    if (m_ui.mouse.drag_target[2].id === "_leftbar_z") {
      o = m_ui.mouse.drag_target[2] as { id: string, change: number, };
      let dy = (mouse.drag_change[2] as vector).y;
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
    hovering = ctx.point_in_path_v(mouse.position);
    if (hovering) {
      m_ui.click.new(() => m_ui.mouse.drag_target[2] = { id: "_leftbar_zlook", change: 0, }, 2);
    }
    if (m_ui.mouse.drag_target[2].id === "_leftbar_zlook") {
      o = m_ui.mouse.drag_target[2];
      let dy = (mouse.drag_change[2] as vector).y;
      dy /= height * 0.865 / 10;
      o.change -= dy;
      if (math.abs(o.change) >= 0.1) {
        const d = math.round_to(o.change, 0.1) ?? 0;
        camera.look_z = math.round_to(camera.look_z + d, 0.1);
        o.change -= d;
      }
    }
    // respond to mousedrag

    ctx.restore("draw_left");
  },

  draw_map: function() {
    m_ui.draw_a_map(m_ui.map);
  },

  draw_a_map: function(map: map_type) {
    map_draw.draw(ctx, map);
  },

  draw_circle_menu: function() {
    if (m_ui.circle_menu.active || (m_ui.circle_menu.target?.id && (m_ui.time - m_ui.circle_menu.active_time <= 20))) {
      const target = m_ui.circle_menu.target;
      const v = target.shape.computed?.screen_vertices ? (target.shape.computed?.screen_vertices[target.index] ?? target.vertex) : target.vertex;
      let ratio = Math.min(1, (m_ui.time - m_ui.circle_menu.active_time) ** 0.7 / 5);
      if (!m_ui.circle_menu.active) ratio = 1 - ratio;
      const a = Math.PI * 2 / m_ui.circle_menu.options.length;
      const a_ = (m_ui.time / 100) % (Math.PI * 2);
      size = 50 * ratio;

      ctx.fillStyle = color.black + "99";
      ctx.beginPath();
      ctx.circle(v.x, v.y, size * 1.9);
      ctx.fill();

      for (const option of m_ui.circle_menu.options) {

        const i = option.i;
        const disabled = !option.enabled();
        ctx.fillStyle = disabled ? color.grey : option.color;
        ctx.beginPath();
        ctx.donut_arc(v.x, v.y, 90 * ratio, 10 * ratio, a_ + a * (i + 0.05), a_ + a * (i + 0.95), a_ + a * (i + 0.4), a_ + a * (i + 0.6));
        hovering = ctx.point_in_path_v(mouse.position);
        ctx.globalAlpha = 0.2 * ratio + ((hovering && !disabled) ? 0.3 : 0);
        ctx.fill();

        ctx.beginPath();
        ctx.donut_arc(v.x, v.y, 90 * ratio, 80 * ratio, a_ + a * (i + 0.05), a_ + a * (i + 0.95), a_ + a * (i + 0.05625), a_ + a * (i + 0.94375));
        ctx.globalAlpha = 0.7 * ratio + ((hovering && !disabled) ? 0.2 : 0);
        ctx.fill();
        ctx.svg(option.svg as keyof typeof SVG, v.x + size * Math.cos(a_ + a * (i + 0.5)), v.y + size * Math.sin(a_ + a * (i + 0.5)), size * 0.9);
        if (hovering) m_ui.click.new(disabled ? () => {} : option.fn);

      }
      ctx.globalAlpha = 1;
      if (!vector.in_circle(mouse.position, v, 100)) {
        const close_fn = () => {
          m_ui.circle_menu.deactivate();
          m_ui.deselect_shape();
        };
        m_ui.click.new(close_fn);
        m_ui.click.new(close_fn, 2, false); // don't overwrite
      }
    }
  },

  draw_overlay: function() {

  },

  draw_selection: function(map: map_type) {

  },

  draw_grid: function() {
    const grid_size = camera.scale * 10;
    if (grid_size >= 50) m_ui.draw_a_grid(grid_size / 5, color.darkgrey, camera.sqrtscale * 0.1);
    if (grid_size >= 6) m_ui.draw_a_grid(grid_size, color.darkgrey, camera.sqrtscale * 0.4);
    if (grid_size >= 2) m_ui.draw_a_grid(grid_size * 5, color.darkgrey, camera.sqrtscale * 0.8);
    m_ui.draw_a_grid(grid_size * 10, color.darkgrey, camera.sqrtscale * 1.1);
    m_ui.draw_a_grid(grid_size * 100, color.darkgrey, camera.sqrtscale * 2.0);
    m_ui.draw_a_grid(grid_size * 1000000, color.grey, camera.sqrtscale * 2.0);
    // behaviour when clicked outside of anything important
    if (m_ui.mouse.drag_target[0]?.id && !m_ui.circle_menu.active) {
      m_ui.click.new(m_ui.deselect_shape);
    }
  },

  draw_a_grid: function(grid_size: number, color: string, line_width: number) {
    let xx = (-camera.position.x * camera.scale);
    let yy = (-camera.position.y * camera.scale);
    let x = xx % grid_size;
    let y = yy % grid_size;
    ctx.strokeStyle = color;
    ctx.lineWidth = line_width;
    while (x < width) {
      ctx.line(x, 0, x, height);
      x += grid_size;
    }
    while (y < height) {
      ctx.line(0, y, width, y);
      y += grid_size;
    }
  },

  select_shape: function(target: map_vertex_type, dont_open_properties = false) {
    const old_id = m_ui.mouse.drag_target[0]?.shape?.id;
    m_ui.mouse.drag_target[0] = target;
    m_ui.color_directory_element(old_id, "");
    m_ui.color_directory_element(target.shape.id, "#ff000033");
    m_ui.directory_elements[target.shape.id].querySelector("span")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
    if (m_ui.circle_menu.active) {
      m_ui.circle_menu.target = target;
    }
    if (!dont_open_properties && m_ui.right_sidebar_mode === "properties") {
      m_ui.open_properties(target.shape);
    }
    else m_ui.properties_selected = target.shape;
  },

  deselect_shape: function() {
    m_ui.color_directory_element(m_ui.mouse.drag_target[0]?.shape?.id, "");
    m_ui.mouse.drag_target[0] = {};
  },

  draw_mouse: function() {
    const size = camera.sqrtscale * 15;
    const mode = m_ui.editor.mode;
    let v = vector.clone(mouse.position);
    let offset = vector.create();
    if (mode === "select") offset = vector.create(size * 0.6, size);
    if (mode === "edit") offset = vector.create(size * 0.7, -size * 0.7);
    v = vector.add(v, offset);
    ctx.fillStyle = color.white;
    ctx.svg(m_ui.editor.mode as keyof typeof SVG, v.x, v.y, size * 2);
  },

  update_camera: function() {
    if (m_ui.mouse.click && m_ui.mouse.drag_target[0]?.id == undefined) {
      camera.move_by_mouse();
      save_map_settings();
    }
    if (m_ui.mouse.rclick) {
      // camera.move_by_mouse();
    }
    if (mouse.scroll !== 0 && !keys.Shift) {
      if (mouse.scroll < 0) {
        camera.scale_by(vector.clone(mouse.position), 1.3);
      } else {
        camera.scale_by(vector.clone(mouse.position), 1 / 1.3);
      }
      save_map_settings();
    }
  },

  right_sidebar_mode: "directory",
  directory_elements: {} as { [ key: string ]: HTMLElement },
  directory_spans: {} as { [ key: string ]: HTMLSpanElement },
  directory_jump_fns: {} as { [ key: string ]: () => void },
  all_aabb: vector.make_aabb(),
  all_shape: {
    id: "all",
    z: 0,
    vertices: [],
    style: {},
    options: { contains: [], },
  } as map_shape_type,

  color_directory_element: function(shape_id: string, color: string) {
    if (m_ui.directory_elements[shape_id]?.querySelector("span")) {
      m_ui.directory_elements[shape_id].querySelector("span")!.style.backgroundColor = color;
    }
  },

  update_right_sidebar: function() {
    const aside_directory = document.getElementById("directory");
    const aside_properties = document.getElementById("properties");
    if (aside_directory == undefined) return console.error("[ui/update_right_sidebar] right sidebar directory <aside> not found!");
    if (aside_properties == undefined) return console.error("[ui/update_right_sidebar] right sidebar properties <aside> not found!");
    aside_directory.style.display = m_ui.right_sidebar_mode === "directory" ? "block" : "none";
    aside_properties.style.display = m_ui.right_sidebar_mode === "properties" ? "block" : "none";
  },

  update_directory: function(rooms_only: boolean = false) {

    const aside = document.getElementById("directory");
    if (aside == undefined) return console.error("[ui/update_directory] right sidebar directory <aside> not found!");

    // clear stuff
    aside.innerHTML = ``;
    m_ui.directory_elements = {};
    m_ui.directory_jump_fns = {};
    // this shape contains everything!
    m_ui.all_shape = {
      id: "all",
      z: 0,
      vertices: [],
      options: { contains: [], },
    };

    const sorted_shapes = m_ui.map.shapes?.sort((s1, s2) => {
      const d1 = s1.computed?.depth!, d2 = s2.computed?.depth!;
      if (d1 === d2) {
        // const n1 = +(s1.id.split(" ").pop() ?? -1), n2 = +(s2.id.split(" ").pop() ?? -1);
        return s1.id.localeCompare(s2.id, "en", { numeric: true });
      } else return d1 - d2;
    });

    for (const shape of [m_ui.all_shape].concat(sorted_shapes ?? [])) {
      const id = shape.id;
      const not_room = (m_ui.map.computed?.shape_room[shape.id] && !shape.options.is_room && !shape.computed?.options?.is_room && id !== "all" && id !== "train");
      if (rooms_only && not_room) continue;
      if (m_ui.editor.map_mode && !shape.computed?.options?.is_map && not_room) continue;
      if (!m_ui.editor.map_mode && shape.computed?.options?.is_map) continue;
      if (id !== "all") {
        m_ui.all_shape.options.contains?.push(id);
        if (shape.computed) m_ui.all_aabb = vector.aabb_combine(m_ui.all_aabb, shape.computed.aabb);
        else console.error("[ui/update_directory] shape not computed: " + id);
      }
      if (shape.options == undefined) shape.options = {};
      if (shape.options.parent == undefined) shape.options.parent = "all";
      const parent = shape.options.parent;
      let shortened_id = (shape.id.startsWith(parent) && shape.id !== parent) ? shape.id.substring(parent.length) : shape.id;
      let grandparent = m_ui.map.computed?.shape_map?.[parent]?.options?.parent;
      let depth = 1, ups = 0;
      while (grandparent !== "all" && depth < 1000) {
        if (grandparent == undefined) break;
        if (grandparent !== "all" && shortened_id.startsWith(grandparent) && shortened_id !== grandparent) {
          shortened_id = shortened_id.substring(grandparent.length);
          ups = depth;
          break;
        }
        grandparent = m_ui.map.computed?.shape_map?.[grandparent]?.options?.parent;
        depth++;
      }
      shortened_id = "↑".repeat(ups) + shortened_id;
      if (shortened_id === id) shortened_id = "● " + id;
      const li = document.createElement("li");
      let clickable: HTMLElement = li;
      if (id === "all" || (shape.options.contains?.length ?? 0) > 0) {
        // is a folder
        const details = document.createElement("details");
        details.classList.add("folder");
        details.setAttribute("open", "");
        const summary = document.createElement("summary");
        summary.innerHTML = `<span title="${id}: #${m_ui.map.shapes.indexOf(shape)}">${shortened_id}</span>`;
        details.appendChild(summary);
        const ul = document.createElement("ul");
        details.appendChild(ul);

        if (id === "all") {
          aside.appendChild(details);
        } else {
          li.appendChild(details);
          if (!m_ui.directory_elements[parent]) console.error("[ui/update_directory] parent folder (" + parent + ") not found for folder (" + id + ")");
          else m_ui.directory_elements[parent].querySelector("ul")!.appendChild(li);
        }
        m_ui.directory_elements[id] = details;
        m_ui.directory_spans[id] = summary.querySelector("span")!;
        clickable = summary;
      } else {
        // is a leaf
        const span = document.createElement("span");
        span.classList.add("file");
        span.style.backgroundImage = `url("shape.svg")`;
        span.innerHTML = `<span title="${id}: #${m_ui.map.shapes.indexOf(shape)}">${shortened_id}</span>`;
        li.appendChild(span);
        if (!m_ui.directory_elements[parent]) console.error("[ui/update_directory] parent folder (" + parent + ") not found for leaf (" + id + ")");
        else m_ui.directory_elements[parent].querySelector("ul")!.appendChild(li);
        m_ui.directory_elements[id] = span;
        m_ui.directory_spans[id] = span.querySelector("span") ?? span;
        clickable = li;
      }
      m_ui.directory_jump_fns[id] = function() {
        let aabb = vector.make_aabb();
        if (id === "all") {
          aabb = m_ui.all_aabb;
        } else {
          if (!shape.computed) return;
          aabb = shape.computed.aabb;
        }
        const view_v = vector.aabb2v(m_ui.viewport);
        const size_v = vector.aabb2v(aabb);
        if (size_v.x <= 0 && size_v.y <= 0) size = camera.scale;
        else size = Math.min(view_v.x / size_v.x, view_v.y / size_v.y) / 1.3;
        camera.jump_to(vector.aabb_centre(aabb), size, vector.aabb_centre(m_ui.viewport));
      };
      clickable.addEventListener("click", function(event) {
        const style = window.getComputedStyle(clickable, null);
        const pLeft = parseFloat(style.getPropertyValue('padding-left'));
        if (event.offsetX > pLeft) {
          // it is not a click on the file
          event.preventDefault();
          if (m_ui.properties_selecting_parent && m_ui.properties_selecting_parent !== shape.id) m_ui.select_parent(shape);
          else if (m_ui.properties_selecting_connection && m_ui.properties_selecting_connection !== shape.id) m_ui.select_connection(shape);
          else m_ui.open_properties(shape);
        }
      });
      clickable.addEventListener("contextmenu", function(event) {
        event.preventDefault();
        m_ui.directory_jump_fns[id]();
      });
    }

  },

  properties_selected: {} as map_shape_type,
  properties_selecting_parent: "",
  properties_selecting_connection: "",

  properties_options: {
    shape: {
      parent: {
        name: "parent",
        type: "button",
      },
      make_id: {
        name: "make",
        type: "text",
      },
      style: {
        name: "style",
        type: "text",
      },
      z: {
        name: "z<br>",
        type: "number",
        min: -1,
        max: 1,
        step: 0.1,
      },
      open_loop: {
        name: "open loop",
        type: "checkbox",
      },
      decoration: {
        name: "decoration",
        type: "checkbox",
      },
      invisible: {
        name: "invisible",
        type: "checkbox",
      },
      seethrough: {
        name: "see-through",
        type: "checkbox",
      },
      sensor: {
        name: "sensor",
        type: "checkbox",
      },
      sensor_fov_mult: {
        show: "sensor",
        name: "FOV<br>",
        type: "number",
        min: 0.1,
        max: 2,
        step: 0.1,
      },
      sensor_dont_set_room: {
        show: ["sensor", "floor"],
        name: "don't set room",
        type: "checkbox",
      },
      is_spawner: {
        name: "spawner",
        type: "checkbox",
      },
      spawn_enemy: {
        show: "is_spawner",
        name: "enemy name",
        type: "text",
      },
      spawn_repeat: {
        show: "is_spawner",
        name: "enemy repeat",
        type: "number",
        min: 0,
        max: 100,
        step: 1,
      },
      spawn_permanent: {
        show: "is_spawner",
        name: "death is permanent",
        type: "checkbox",
      },
      floor: {
        name: "floor",
        type: "checkbox",
      },
      safe_floor: {
        show: "floor",
        name: "floor is safe",
        type: "checkbox",
      },
      is_room: {
        name: "room",
        type: "checkbox",
      },
      room_connections: {
        show: "is_room",
        name: "room connections",
        type: "button",
      },
      is_map: {
        name: "part of map",
        type: "checkbox",
      },
      force_layer: {
        show: "is_map",
        name: "force layer",
        type: "number",
        min: -10,
        max: 10,
        step: 1,
      },
      map_hide_when: {
        show: "map_parent",
        name: "hide when",
        type: "text",
      },
      movable: {
        name: "movable object",
        type: "checkbox",
      },
      draggable: {
        name: "draggable object",
        type: "checkbox",
      },
    },
  } as { [key: string]: { [key: string]: { name: string, type: string, min?: number, max?: number, step?: number, show?: string | string[] } } },

  properties_options_metadata: {
    shape: {
      name: "Shape",
    },
  } as { [key: string]: { name: string }},

  update_properties: function() {

    const aside = document.getElementById("properties");
    if (aside == undefined) return console.error("[ui/update_properties] right sidebar properties <aside> not found!");

    const shape = m_ui.properties_selected;
    if (shape == undefined || shape.id == undefined) return;

    aside.innerHTML = `
      <button id="close" title="close">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="${SVG.x}"/></svg>
      </button>
      <h3 style="margin: 0; user-select: none;">properties for <span id="jump_to_shape">${shape.id}</span>
      <span id="button_group">
        <button id="edit_id" title="edit id">
          <svg xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em;" viewBox="0 0 24 24"><path fill="currentColor" d="${SVG.edit}"/></svg>
        </button>
        <button id="delete_shape" title="delete shape">
          <svg xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em;" viewBox="0 0 24 24"><path fill="currentColor" d="${SVG.delete}"/></svg>
        </button>
      </span>
      </h3>
      <div style="float: left; user-select: none;">
      <span style="font-size: 0.8em;">${shape.options.room_id ? "room id: " + shape.options.room_id : ""}</span>
      </div>
    `;

    document.getElementById("jump_to_shape")?.addEventListener("click", function(event) {
      m_ui.directory_jump_fns[shape.id]?.();
    });
    document.getElementById("close")?.addEventListener("click", function(event) {
      m_ui.properties_selected = m_ui.all_shape;
      m_ui.right_sidebar_mode = "directory";
      m_ui.update_right_sidebar();
    });
    if (shape.id === "all") {
      document.getElementById("button_group")!.style.display = "none";
    } else {
      document.getElementById("edit_id")?.addEventListener("click", function(event) {
        const old_id = shape.id;
        const new_id = prompt("new id?", shape.id);
        if (new_id == null || new_id === old_id) return;
        if (m_ui.map.computed?.shape_map == undefined) map_serialiser.compute(m_ui.map);
        const shape_map = m_ui.map.computed?.shape_map!;
        for (const s of shape.options.contains ?? []) {
          shape_map[s].options.parent = new_id;
        }
        if (shape.options.parent && shape.options.parent !== "all") {
          const contains = shape_map[shape.options.parent].options.contains;
          const index = contains?.indexOf(old_id);
          if (contains != undefined && index != undefined && index >= 0) contains[index] = new_id;
        }
        for (const c of shape.options.room_connections ?? []) {
          const arr = shape_map[c].options.room_connections;
          if (!arr) return;
          const index = arr.indexOf(old_id) ?? -1;
          if (index > -1) arr[index] = new_id;
        }
        shape.id = new_id;
        map_serialiser.compute(m_ui.map);
        m_ui.update_directory();
        m_ui.update_properties();
        map_draw.change("edit ID) (from " + old_id + " to " + new_id, shape);
      });
      document.getElementById("delete_shape")?.addEventListener("click", function(event) {
        map_draw.delete_shape(shape);
      });
    }

    const div = document.querySelector("aside#properties > div") as HTMLDivElement;
    if (div == undefined) return console.error("[ui/update_properties] aside > div not found!");
    if (shape.id === "all") {
      div.innerHTML = `
        <p>Total shapes: <b>${shape.options.contains?.length ?? 0}</b></p>
      `;
    } else {
      const options: map_shape_options_type = {};
      const make_options = make[shape.options.make_id ?? "default"] ?? make.default;
      if (shape.options.make_id) override_object(options, make_options);
      override_object(options, shape.options);
      if (shape.computed != undefined) shape.computed.options = options;
      for (const group_key in m_ui.properties_options) {
        const group = m_ui.properties_options[group_key];
        // todo: property groups
        // const details = document.createElement("details");
        // const summary = document.createElement("summary");
        // summary.textContent = group_key;
        for (const option_key in group) {
          const option = group[option_key];
          const showing: boolean = (Array.isArray(option.show))
            ? option.show.map((s) => Boolean((options as any)[s])).reduce((b1, b2) => b1 || b2)
            : !option.show || (options as any)[option.show];
          const exists = option_key === "z" || (shape.options as any)[option_key] != undefined;
          if (!showing && !exists) continue;
          const p = document.createElement("p");
          p.classList.add(option.type);
          const label = document.createElement("label");
          label.innerHTML = `<span style="text-decoration: ${exists ? "underline" : "none"};${!showing ? " color: crimson;" : ""}">${option.name}</span>`;
          label.setAttribute("for", option_key);
          const input = document.createElement("input");
          input.setAttribute("type", option.type);
          input.setAttribute("autocomplete", "off");
          input.setAttribute("name", option_key);
          input.setAttribute("id", option_key);
          p.appendChild(label);
          p.appendChild(input);
          if (option.type === "checkbox") {
            input.checked = (options as any)[option_key];
            input.addEventListener("change", function(event) {
              if (input.checked !== Boolean((make_options as any)[option_key])) (shape.options as any)[option_key] = input.checked;
              else delete (shape.options as any)[option_key];
              map_draw.change("edit property: " + option_key, shape);
              m_ui.update_properties();
            });
          } else if (option.type === "text") {
            input.value = (shape.options as any)[option_key] ?? "";
            input.placeholder = (make_options as any)[option_key] ?? "";
            input.addEventListener("change", function(event) {
              if (input.value.length && input.value !== (make_options as any)[option_key]) (shape.options as any)[option_key] = input.value;
              else delete (shape.options as any)[option_key];
              map_draw.change("edit property: " + option_key, shape);
              m_ui.update_properties();
            });
          } else if (option.type === "number") {
            const span = document.createElement("span");
            const step = (option.step ?? 0).toString();
            span.innerHTML = " " + `
              <button style="font-size: 0.85em;" id="${option_key}_minus" title="${option_key} -= ${step}">
                <svg xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em;" viewBox="0 0 24 24"><path fill="currentColor" d="${SVG.minus}"/></svg>
              </button><button style="font-size: 0.85em;" id="${option_key}_plus" title="${option_key} += ${step}">
                <svg xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em;" viewBox="0 0 24 24"><path fill="currentColor" d="${SVG.add}"/></svg>
              </button>
            `.trim();
            p.appendChild(span);
            input.placeholder = (make_options as any)[option_key] ?? 0;
            input.setAttribute("min", (option.min ?? 0).toString());
            input.setAttribute("max", (option.max ?? 0).toString());
            input.setAttribute("step", step);
            let change_fn = () => {};
            if (option_key === "z") {
              input.value = shape.z.toString();
              change_fn = () => {
                if (input.value.length) shape.z = Number(input.value);
                map_draw.change("edit property: " + option_key, shape);
                m_ui.update_properties();
              };
            } else {
              input.value = (shape.options as any)[option_key] ?? "";
              input.placeholder = (make_options as any)[option_key] ?? 0;
              change_fn = () => {
                if (input.value.length && input.value.toString() !== ((make_options as any)[option_key] ?? 0).toString()) (shape.options as any)[option_key] = Number(input.value);
                else delete (shape.options as any)[option_key];
                map_draw.change("edit property: " + option_key, shape);
                m_ui.update_properties();
              };
            }
            // add change listeners
            input.addEventListener("change", change_fn);
            span.querySelector("#" + option_key + "_minus")?.addEventListener("click", (_) => { input.stepDown(); change_fn(); });
            span.querySelector("#" + option_key + "_plus")?.addEventListener("click", (_) => { input.stepUp(); change_fn(); });
          } else if (option.type === "button") {
            if (option_key === "parent") {
              const is_selecting = m_ui.properties_selected.id === m_ui.properties_selecting_parent;
              input.style.display = "none";
              label.innerHTML += `
                : ${(shape.options.parent === "all" ? "&lt;none&gt;" : (shape.options.parent ?? "&lt;none&gt;"))}
                <button style="font-size: 0.8em;" id="edit_parent" title="${is_selecting ? "don't edit parent" : "edit parent"}">
                  <svg xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em;" viewBox="0 0 24 24"><path fill="currentColor" d="${is_selecting ? SVG.edit_off : SVG.edit}"/></svg>
                </button>
              `.trim();
              label.querySelector("button")?.addEventListener("click", function(_event) {
                if (is_selecting) {
                  m_ui.properties_selecting_parent = "";
                  m_ui.directory_elements.all.style.backgroundColor = "";
                  m_ui.update_properties();
                } else {
                  m_ui.properties_selecting_parent = m_ui.properties_selected.id;
                  m_ui.right_sidebar_mode = "directory";
                  m_ui.update_directory();
                  m_ui.directory_elements.all.style.backgroundColor = "#d7e11155";
                  m_ui.update_right_sidebar();
                }
              });
            } else if (option_key === "room_connections") {
              const is_selecting = m_ui.properties_selected.id === m_ui.properties_selecting_connection;
              input.style.display = "none";
              if (shape.options.room_connections == undefined) label.innerHTML += `: &lt;none&gt;&nbsp;`;
              else {
                label.innerHTML += ":<br>";
                let i = 1;
                for (const cid of shape.options.room_connections) {
                  label.innerHTML += `
                    &nbsp; ${cid} <button style="font-size: 0.6em;" id="remove_connection_${i}" title="remove this connection">
                      <svg xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em;" viewBox="0 0 24 24"><path fill="currentColor" d="${SVG.minus}"/></svg>
                    </button> <br>
                  `.trim();
                  i++;
                }
              }
              label.innerHTML += `
                <button style="font-size: 0.8em;${is_selecting ? " rotate: 45deg;" : ""}" id="add_connection" title="${is_selecting ? "don't add connection" : "add connection"}">
                  <svg xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em;" viewBox="0 0 24 24"><path fill="currentColor" d="${SVG.add}"/></svg>
                </button>
              `.trim();
              let i = 1;
              for (const cid of shape.options.room_connections ?? []) {
                label.querySelector("#remove_connection_" + i)?.addEventListener("click", function(_event) {
                  const other = m_ui.map.computed?.shape_map[cid];
                  if (other) {
                    const index = other.options.room_connections?.indexOf(shape.id) ?? -1;
                    if (index >= 0) other.options.room_connections?.splice(index, 1);
                  }
                  const index = shape.options.room_connections?.indexOf(cid) ?? -1;
                  if (index >= 0) shape.options.room_connections?.splice(index, 1);
                  map_serialiser.compute(m_ui.map);
                  m_ui.update_properties();
                  map_draw.change(`remove room connection "${cid}"`, shape);
                });
                i++;
              }
              label.querySelector("#add_connection")?.addEventListener("click", function(_event) {
                if (is_selecting) {
                  m_ui.properties_selecting_connection = "";
                  m_ui.directory_elements.all.style.backgroundColor = "";
                  m_ui.update_properties();
                } else {
                  m_ui.properties_selecting_connection = m_ui.properties_selected.id;
                  m_ui.right_sidebar_mode = "directory";
                  m_ui.update_directory(true);
                  m_ui.directory_elements.all.style.backgroundColor = "#11e1a955";
                  m_ui.update_right_sidebar();
                }
              });
            } else {
              // how
            }
          }
          div.appendChild(p);
        }
      }
    }

  },

  open_properties: function(shape?: map_shape_type) {
    if (shape) {
      m_ui.properties_selected = shape;
      if (m_ui.mouse.drag_target[0]?.shape?.id !== shape.id) m_ui.select_shape({
        shape: shape,
        vertex: shape.computed?.screen_vertices?.[0] ?? vector3.create(),
        vertex_old: vector3.clone_list_(shape?.vertices),
        id: shape.id + "__0",
        index: 0,
        new: true,
      }, false);
    }
    m_ui.right_sidebar_mode = "properties";
    m_ui.update_properties();
    m_ui.update_right_sidebar();
  },

  select_parent: function(shape: map_shape_type) {

    const selected_shape = m_ui.map.computed?.shape_map[m_ui.properties_selecting_parent] ?? m_ui.properties_selected;
    const child_id = selected_shape.id;
    const old_parent_id = selected_shape.options.parent;
    if (old_parent_id === shape.id || child_id === shape.id || child_id === undefined) return;
    if (m_ui.check_child(child_id, shape)) return console.error(`[ui/select_parent] child '${shape.id}' can't be set to the parent of '${child_id}'!`);
    const old_parent = old_parent_id == undefined ? undefined :
      (old_parent_id === "all" ? m_ui.all_shape : m_ui.map.computed?.shape_map[old_parent_id]);
    if (shape.id === "all") delete selected_shape.options.parent;
    else selected_shape.options.parent = shape.id; // actually set the parent
    // make parent contain child
    if (shape.options.contains === undefined) shape.options.contains = [child_id];
    else shape.options.contains?.push(child_id);
    // delete child from old parent
    if (old_parent !== undefined && old_parent.id !== "all") {
      const found_index = old_parent.options.contains?.indexOf(child_id);
      if (found_index !== undefined && found_index >= 0) old_parent.options.contains?.splice(found_index, 1);
      if ((old_parent.options.contains?.length ?? -1) === 0) delete old_parent.options.contains;
    }
    m_ui.properties_selecting_parent = "";
    map_serialiser.compute(m_ui.map);
    m_ui.update_directory();
    m_ui.right_sidebar_mode = "directory";
    m_ui.update_right_sidebar();
    map_draw.change("edit property: parent", m_ui.properties_selected);

  },

  select_connection: function(shape: map_shape_type) {

    if (!shape.options.is_room) return;
    const selected_id = shape.id;
    const set_shape = m_ui.map.computed?.shape_map[m_ui.properties_selecting_connection] ?? m_ui.properties_selected;
    if (set_shape.options.room_connections == undefined) set_shape.options.room_connections = [];
    else if (set_shape.options.room_connections.includes(selected_id)) return;
    set_shape.options.room_connections.push(selected_id);
    m_ui.properties_selecting_connection = "";
    map_serialiser.compute(m_ui.map);
    m_ui.update_directory(false);
    m_ui.update_properties();
    m_ui.right_sidebar_mode = "properties";
    m_ui.update_right_sidebar();
    map_draw.change("add property: connection", m_ui.properties_selected);

  },

  // recursive
  check_child: function(check_id: string, shape: map_shape_type): boolean {

    if ((shape.options.parent?.length ?? 0) <= 0 || shape.options.parent === "all") return false;
    let s = shape as (map_shape_type | undefined);
    let depth = 1;
    while ((s?.options.parent?.length ?? 0) > 0 && s?.options.parent !== "all" && depth < 100) {
      const parent_id = s?.options.parent!;
      s = m_ui.map.computed?.shape_map[parent_id];
      if (s == undefined) {
        console.error(`[ui/check_child] (${shape.id}) why is '${parent_id}' not in the computed shape map?`);
        return false;
      }
      if (s.id === check_id || s?.options.parent === check_id) return true;
      depth++;
    }
    return false;

  },

};

window.addEventListener("resize", function(_event) {
  width = canvas.width;
  height = canvas.height;
});