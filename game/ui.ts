import { engine, world } from "../index.js";
import { Composite, Events, Mouse, MouseConstraint } from "../matter.js";
import { camera } from "../util/camera.js";
import { canvas, canvas_, ctx, resize_canvas } from "../util/canvas.js";
import { color, current_theme } from "../util/color.js";
import { config } from "../util/config.js";
import { key, keys, mouse } from "../util/key.js";
import { math } from "../util/math.js";
import { vector } from "../util/vector.js";
import { shallow_clone_array } from "./make.js";
import { Particle } from "./particle.js";
import { player } from "./player.js";
import { save } from "./save.js";
import { Shape } from "./shape.js";
import { Thing } from "./thing.js";

export const ui = {

  time: 0,
  tick_time: 0,
  width: canvas.width,
  height: canvas.height,
  size: 0,

  debug: {
    dt_queue: [] as number[],
    dt_total: 0,
    dt_max: 0,
    fps_display: 0,
  },
  click: {
    new_fns: [() => {}, () => {}, () => {}] as (() => void)[],
    new_fns_exist: [false, false, false] as boolean[],
    new: function(fn: () => void, button: 0 | 1 | 2 = 0, overwrite = true) {
      if (mouse.down_buttons[button]) {
        if (overwrite || !ui.click.new_fns_exist[button]) {
          ui.click.new_fns[button] = fn;
          ui.click.new_fns_exist[button] = true;
        }
      }
    },
    tick: function() {
      for (let button = 0; button < 3; button++) {
        if (mouse.down_buttons[button]) {
          player.stats.clicks[button]++;
        }
        if (ui.click.new_fns_exist[button]) {
          ui.click.new_fns[button]();
          // also cancel shooting or other player actions
          keys[["Mouse", "MouseRight", "MouseWheel"][button]] = false;
        }
      }
      ui.click.new_fns_exist = [false, false, false];
    },
  },

  mouse: {
    mouse: Mouse.create(canvas_),
    constraint: {} as MouseConstraint,
    init: () => {
      ui.mouse.constraint = MouseConstraint.create(player.temp_engine, {
        mouse: ui.mouse.mouse,
        constraint: {
          stiffness: 0.2,
          render: {
            visible: false,
          },
        },
      });
      Events.on(ui.mouse.constraint, "startdrag", (e) => {
        const event = e as { mouse: Mouse, body: Body, source: object, name: string };
      });
    },
    tick: () => {
      Mouse.setScale(ui.mouse.mouse, vector.create(1 / camera.scale, 1 / camera.scale));
      Mouse.setOffset(ui.mouse.mouse, vector.clone(camera.position));
    },
  },

  // toggle functions
  pause_f: () => {
    player.paused = !player.paused;
    ui.settings.open = false;
    ui.settings.start_time = -1;
    ui.pause.start_time = player.paused ? ui.time : -1;
    if (!player.paused) return true;
  },
  toggle_pause: () => {
    if (player.map_mode) ui.toggle_map();
    else if (player.inventory_mode) ui.toggle_inventory();
    else ui.pause_f();
  },
  toggle_map: () => {
    player.paused = player.map_mode;
    ui.pause_f();
    player.map_mode = player.paused;
    if (player.map_mode) ui.map.activate();
    else ui.map.deactivate();
  },
  toggle_inventory: () => {
    player.paused = player.inventory_mode;
    ui.pause_f();
    player.inventory_mode = player.paused;
    if (player.inventory_mode) ui.inventory.activate();
    else ui.inventory.deactivate();
  },

  init: function() {

    key.add_key_listener("KeyP", ui.toggle_pause);
    key.add_key_listener("Escape", ui.toggle_pause);

    key.add_key_listener("KeyF", () => {
      player.autoshoot = !player.autoshoot;
    });

    key.add_key_listener("Tab", ui.toggle_map);
    key.add_key_listener("KeyM", ui.toggle_map);
    key.add_key_listener("KeyI", ui.toggle_inventory);

    key.add_keydown_listener(function(event) {
      if (event.code === "Enter" && key.alt()) {
        ui.toggle_fullscreen();
      }
    });

    ui.mouse.init();

  },

  tick: function(dt: number) {
    ui.tick_time++;
    ui.time += dt;
    ui.map.tick();
    ui.inventory.tick();
    ui.mouse.tick();
    if (dt <= config.seconds && dt > math.epsilon && ui.tick_time >= 5) {
      ui.debug.dt_queue.push(dt);
      ui.debug.dt_total += dt;
      while (ui.debug.dt_queue.length > 100) {
        ui.debug.dt_total -= ui.debug.dt_queue.shift() ?? 0;
      }
    }
    if (player.paused) {
      // don't forget to do health display stuff for things
      for (const thing of Thing.things) {
        thing.health?.do_display();
      }
    }
  },

  draw: function() {
    ui.draw_debug();
    ui.draw_health();
    if (player.paused) {
      ui.draw_pause_menu();
      ui.draw_inventory();
    }
    ui.click.tick();
  },

  xp: {
    ratio: 0,
    ratio_display: 0,
    value: 0,
    value_display: 0,
    change: 0,
    change_display: 0,
    time: -1,
    y_ratio: 0,
    add(xp: number) {
      ui.xp.value = player.xp - player.level2xp(player.level);
      ui.xp.ratio = ui.xp.value / ((player.level + 1) * config.game.level_1_xp);
      ui.xp.time = ui.time;
      ui.xp.change += xp;
    },
  },
  collect: {
    queue: [] as { key: string, number: number, display: number, time: number }[],
    add(key: string, number: number = 1) {
      let exists = false;
      const time = ui.time + config.graphics.collect_display_time;
      for (const o of ui.collect.queue) {
        if (o.key === key) {
          o.number += number;
          o.time = time;
          exists = true;
          return;
        }
      }
      if (!exists) ui.collect.queue.push({
        key, number, time,
        display: 0,
      });
    },
  },

  draw_debug: function() {
    // teleport!
    if (keys.KeyT && config.game.debug_mode) {
      player.teleport_to(camera.screen2world(mouse.position));
      player.map_offset = vector.create();
    }
    if (!config.graphics.debug_display) return;
    const size = ui.size * 1.2;
    const total = ui.debug.dt_total === 0 ? 1 : ui.debug.dt_total;
    const fps = ui.debug.dt_queue.length === 100 ? 1000000 / total : ui.debug.dt_queue.length * 10000 / total; // wow a million
    const display_fps = math.lerp(ui.debug.fps_display, fps, 0.1);
    ui.debug.fps_display = display_fps;
    let x = ui.width - size * 10.5;
    let y = size;
    ctx.fillStyle = color.white + "33";
    ctx.beginPath();
    ctx.rect(x - size / 2, 0, size * 11, size * 4.5);
    ctx.fill();
    ctx.fillStyle = color.white + "aa";
    ctx.set_font_mono(size);
    ctx.textAlign = "left";
    ctx.text(`${display_fps.toFixed(2)} fps`, x, y);
    ctx.textAlign = "right";
    ctx.text(`${Shape.draw_shapes.length + Particle.particles.length}`, x + size * 10, y);

    const points = [] as vector[];
    if (ui.debug.dt_queue.length) {
      const real_max = math.max(...ui.debug.dt_queue);
      const display_max = math.lerp(ui.debug.dt_max, real_max, real_max > ui.debug.dt_max ? 0.1 : 0.08);
      ui.debug.dt_max = display_max;
      points.push(vector.create(x, y + size * 3));
      for (let i = 0; i < ui.debug.dt_queue.length; i++) {
        points.push(vector.create(ui.width - size / 10 * (105 - i), y + size + size * 2 * (1 - math.bound(ui.debug.dt_queue[i] / display_max, 0, 1))));
      }
    }
    points.push(vector.create(ui.width - size * 0.6, y + size * 3));
    ctx.lineWidth = size / 8;
    ctx.lineJoin = "round";
    ctx.strokeStyle = color.white + "88";
    ctx.fillStyle = color.green + "88";
    ctx.beginPath();
    ctx.lines_v(points, false);
    ctx.stroke();
    ctx.fill();
  },

  draw_health: function() {
    if (!player.health) return;
    const total_health = player.health.capacity / 100;
    const health_display = player.health.display / 100;
    const health_ipart = Math.floor(health_display + math.epsilon_bigger);
    const health_fpart = health_display - health_ipart;
    const size = ui.size;
    let r = size * 1.25;
    let x = size * 7 - r * 2;
    let y = size * 5;
    let w = size * 3.5 * Math.floor(total_health - 1) + r * 4;
    ctx.fillStyle = (player.enemy_can_see ? color.red + "11" : color.black + "25");
    ctx.beginPath();
    ctx.rectangle(x + w / 2, y, w, r * 3);
    ctx.fill();
    const w_ = size * 3.5 * health_display;
    ctx.beginPath();
    ctx.rectangle(x + r * 0.625 + w_ / 2, y, w_, r * 3);
    ctx.fill();
    ctx.lineWidth = r * 0.45;
    x = size * 7;
    const angle = -ui.time / config.seconds * config.graphics.health_rotate_speed;
    for (let i = 0; i < total_health; i++) {
      ctx.fillStyle = color.white + "33";
      if (i < health_display - math.epsilon_bigger) {
        ctx.strokeStyle = color.white;
        ctx.beginPath();
        if (i === health_ipart) {
          if (health_fpart < 0.1) {
            ctx.strokeStyle = color.white + math.component_to_hex(255 * (health_fpart * 10) ** 2);
            ctx.fillStyle = color.white + math.component_to_hex(51 * (health_fpart * 10) ** 2);
          }
          ctx.arc(x, y, r, angle % (Math.PI * 2), (angle - health_fpart * Math.PI * 2) % (Math.PI * 2));
          ctx.stroke();
          ctx.beginPath();
          ctx.circle(x, y, r * 1.2);
          ctx.fill();
        } else {
          ctx.circle(x, y, r);
          ctx.stroke();
          ctx.fill();
        }
      }
      if (i === health_ipart && health_fpart < 0.1) ctx.fillStyle = color.white + "33";
      ctx.beginPath();
      ctx.circle(x, y, r + ctx.lineWidth / 2);
      ctx.fill();
      x += size * 3.5;
    }
    x = size * 7 - r * 2;
    // xp
    const is_showing = (ui.time - ui.xp.time) < config.graphics.xp_display_time;
    const y_ratio = math.lerp(ui.xp.y_ratio, Number(is_showing), config.graphics.xp_display_smoothness);
    ui.xp.y_ratio = y_ratio;
    const ratio = math.lerp(ui.xp.ratio_display, ui.xp.ratio, config.graphics.xp_display_smoothness);
    ui.xp.ratio_display = ratio;
    const xp_display_value = math.lerp(ui.xp.value_display, ui.xp.value, config.graphics.xp_display_smoothness * 2);
    ui.xp.value_display = xp_display_value;
    let xp_change = math.lerp(ui.xp.change_display, ui.xp.change, config.graphics.xp_display_smoothness * (is_showing ? 3 : 1));
    ui.xp.change_display = xp_change;
    xp_change = Math.round(xp_change);
    if (!is_showing && ui.xp.change) ui.xp.change = 0;
    const old_x = x, old_y = y;
    ctx.lineWidth = r * 0.75;
    ctx.set_font_mono(r * 1.5, "bold");
    ctx.strokeStyle = color.green + "aa";
    x += ctx.lineWidth / 2;
    w -= ctx.lineWidth;
    y += r * 2;
    if (config.graphics.xp_hide_bar) {
      ctx.ctx.save();
      ctx.beginPath();
      ctx.rect(0, y - r * 0.5, ui.width, ui.height);
      ctx.clip();
      y -= r * 3.3 * (1 - y_ratio);
    }
    ctx.line(x, y, x + w * ratio, y);
    ctx.strokeStyle = color.green + "33";
    ctx.line(x, y, x + w, y);
    if (ctx.point_in_stroke_v(mouse.position)) ui.xp.time = ui.time;
    if (!config.graphics.xp_hide_bar) {
      ctx.ctx.save();
      ctx.beginPath();
      ctx.rect(0, y + r * 0.65, ui.width, ui.height);
      ctx.clip();
      y -= r * 1.5 * (1 - y_ratio);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = color.green + "33";
    ctx.text("" + (player.level + 1), x + w, y + r * 1.5);
    ctx.fillStyle = color.green + "aa";
    ctx.textAlign = "left";
    const level_text = "" + player.level;
    ctx.text(level_text, x, y + r * 1.5);
    x += ctx.measureText(level_text).width;
    ctx.set_font_mono(r * 1);
    ctx.textAlign = "left";
    const xp_details_text =
      Math.round(xp_display_value) + "/"
      + ((player.level + 1) * config.game.level_1_xp)
      + "  " + (xp_change ? "+" + xp_change : "");
    ctx.text(xp_details_text, x + r, y + r * 1.5 + 1.5); // weird y offset to centralise
    ctx.beginPath();
    x = old_x;
    y = Math.max(old_y, y);
    ctx.rect(0, y + r * 1.5, ui.width, ui.height);
    ctx.clip();
    x += r * 1;
    y += r * 3.5;
    for (const o of shallow_clone_array(ui.collect.queue)) {
      if (ui.time > o.time) {
        ui.collect.queue.remove(o);
        continue;
      }
      const item = ui.items[o.key];
      const opacity = Math.min(1, Math.min((config.graphics.collect_display_fancy_slide ? (config.graphics.collect_display_time + ui.time - o.time) / (0.3 * config.seconds) : 1000), (o.time - ui.time) / config.seconds));
      if (config.graphics.collect_display_fancy_slide) x = old_x + r * (1 - 30 * (1 - opacity) ** 2.5);
      o.display = math.lerp(o.display, o.number, config.graphics.xp_display_smoothness * 1.5);
      ctx.globalAlpha = opacity;
      item.draw(x, y, r * 0.5);
      ctx.fillStyle = item.fill;
      ctx.text(save.get_currency(o.key) + " (+" + math.round_to(o.display, (item.multiple ?? 1)) + ")", x + r, y);
      y += r * 1.5 * opacity;
    }
    ctx.ctx.restore();
  },

  pause: {
    start_time: -1,
    get time(): number {
      return ui.time - this.start_time;
    },
    menu: [
      {
        icon: "x",
        color: color.green,
        fn: function() {
          player.paused = false;
        },
      },
      {
        icon: "settings",
        color: color.blue,
        fn: function() {
          ui.settings.open = true;
          ui.settings.start_time = ui.time;
        },
      },
      {
        icon: "logout",
        color: color.red,
        fn: function() {
        },
      },
      {
        icon: "map",
        color: color.gold,
        fn: function() {
          ui.toggle_map();
        },
      },
      {
        icon: "info",
        color: color.dimgrey,
        fn: function() {
        },
      },
      {
        icon: "load",
        color: color.purple,
        fn: function() {
        },
      },
    ] as { icon: string, color: string, fn: () => void }[],
  },

  map: {
    start_time: -999 * config.seconds,
    opacity: 0,
    hide_map: false,
    hide_background: false,
    get time(): number {
      return ui.time - this.start_time;
    },
    tick: () => {
      if (ui.map.time > config.graphics.map_fade_time) ui.map.opacity = player.map_mode ? 1 : 0;
      else {
        const ratio = ui.map.time / config.graphics.map_fade_time;
        ui.map.opacity = math.bound(player.map_mode ? ratio : 1 - ratio, 0, 1);
      }
      ui.map.hide_map = ui.map.opacity < 0.01;
      ui.map.hide_background = ui.map.opacity > 0.99;
    },
    activate: () => {
      player.activate_map();
      if (player.inventory_mode) ui.toggle_inventory();
      ui.map.start_time = -999 * config.seconds; // change to ui.time for fade effect
    },
    deactivate: () => {
      player.deactivate_map();
      ui.map.start_time = -999 * config.seconds; // change to ui.time for fade effect
    },
  },

  inventory: {
    start_time: -999 * config.seconds,
    tick: () => {

    },
    activate: () => {
      player.activate_inventory();
      if (player.map_mode) ui.toggle_map();
      ui.inventory.start_time = ui.time;
    },
    deactivate: () => {
      player.deactivate_inventory();
      ui.inventory.start_time = -999 * config.seconds;
    },
  },

  settings: {
    open: false,
    animation_time: 0.2 * config.seconds,
    get really_open(): boolean {
      return (this.open && this.time > this.animation_time) || (!this.open && this.time < this.animation_time);
    },
    start_time: -1,
    get time(): number {
      return ui.time - this.start_time;
    },
    menu: [
      {
        icon: "x",
        color: color.red,
        fn: function() {
          ui.settings.open = false;
          ui.settings.start_time = ui.time;
          ui.pause.start_time = ui.time;
        },
      },
      {
        icon: "resize",
        color: color.blue,
        fn: function() {
          let r = config.graphics.resolution_mult;
          r = r - 0.1;
          if (r < 0.6 - math.epsilon) r = 1;
          config.graphics.resolution_mult = r;
          camera.lerp_factor = 1;
          resize_canvas();
          window.dispatchEvent(new Event("resize"));
          save.save_settings();
        },
        texts: ["-4", "-3", "-2", "-1", ""],
        text: function() {
          const r = config.graphics.resolution_mult;
          return (this as any).texts[Math.round(r * 10) - 6];
        },
      },
      {
        get icon(): string {
          return "fps_" + config.graphics.fps;
        },
        color: color.green,
        fn: function() {
          const fps = config.graphics.fps;
          if (fps === 60) config.graphics.fps = 30;
          if (fps === 30) config.graphics.fps = 24;
          if (fps === 24) config.graphics.fps = 60;
          ui.debug.dt_queue = [];
          ui.debug.dt_total = 0;
          save.save_settings();
        },
      },
      {
        get icon(): string {
          return document.fullscreenElement ? "fullscreen_exit" : "fullscreen";
        },
        color: color.gold,
        fn: function() {
          config.graphics.fullscreen = !document.fullscreenElement;
          ui.toggle_fullscreen();
          save.save_settings();
        },
      },
      {
        get icon(): string {
          return config.graphics.debug_display ? "debug" : "debug_outline";
        },
        color: color.purple,
        fn: function() {
          config.graphics.debug_display = !config.graphics.debug_display;
          save.save_settings();
        },
      },
    ] as { icon: string, color: string, fn: () => void }[],
  },

  draw_pause_menu: function() {
    if (player.map_mode || player.inventory_mode) return;
    const centre = camera.world2screen(player.position);
    const menu = ui.settings.really_open ? ui.settings.menu : ui.pause.menu;
    const switch_animation = ui.settings.time < 2 * ui.settings.animation_time;
    const switch_ratio = switch_animation ? math.bound(Math.abs(ui.settings.time / ui.settings.animation_time - 1) ** 1.5, math.epsilon, 1) : 1;
    let r = 8 * camera.scale;
    // const pause_ratio = math.bound(ui.pause.time / 50, 0, 168);
    ctx.fillStyle = current_theme.floor + math.component_to_hex(160);
    ctx.beginPath();
    ctx.circle_v(centre, player.radius * camera.scale);
    ctx.fill();
    ctx.ctx.save();
    player.shapes[0].draw_all();
    ctx.ctx.restore();
    const length = menu.length;
    ctx.strokeStyle = color.white;
    ctx.lineWidth = r * 0.15;
    const angle_offset = (ui.settings.open ? ui.settings.time : ui.pause.time) / 1000;
    for (let i = 0; i < length; i++) {
      const a = ((i - 1) * 360 / (length - 1) + angle_offset) % 360;
      const v = i === 0 ? centre : vector.add(centre, vector.createpolar_deg(a, r * 1.5));
      const o = menu[i];
      ctx.fillStyle = color.white;
      ctx.svg_v(o.icon, v, r);
      ctx.beginPath();
      ctx.circle_v(v, r * 0.7);
      const hovering = ctx.point_in_path_v(mouse.position);
      if (hovering) ui.click.new(o.fn);
      ctx.beginPath();
      ctx.circle_v(v, r * 0.64);
      ctx.fillStyle = (hovering ? o.color : color.white) + "22";
      ctx.fill();
      if (hovering) ctx.stroke();
      if (o.icon === "resize") {
        ctx.fillStyle = color.white;
        ctx.set_font_mono(r * 0.35);
        ctx.text_v(`${(o as any).text()}`, v);
      }
      if (i === 0) r *= 1.25 * switch_ratio;
    }
  },

  draw_inventory: function() {
    if (!player.inventory_mode) return;
    
  },

  items: {
    coin: {
      key: "coin",
      name: "coin",
      fill: color.coin,
      multiple: 1,
      draw: function(x: number, y: number, r: number) {
        ctx.fillStyle = color.coin;
        ctx.beginPath();
        ctx.donut(x, y, r * 0.6, r);
        ctx.fill();
      },
    }
  } as { [key: string]: { key: string, name: string, fill: string, multiple?: number, draw: (x: number, y: number, r: number) => void } },

  toggle_fullscreen: () => {
    if (!document.fullscreenElement) {
      canvas_.requestFullscreen();
    } else {
      document.exitFullscreen?.();
    }
  },

};

window.addEventListener("resize", function(_event) {
  ui.width = canvas.width;
  ui.height = canvas.height;
  ui.size = Math.sqrt(canvas.width * canvas.height) * 0.01;
});