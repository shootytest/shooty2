import { Heap } from "../matter.js";
import { camera } from "../util/camera.js";
import { canvas, ctx } from "../util/canvas.js";
import { color } from "../util/color.js";
import { config } from "../util/config.js";
import { key, keys, mouse } from "../util/key.js";
import { math } from "../util/math.js";
import { vector } from "../util/vector.js";
import { shallow_clone_array } from "./make.js";
import { player } from "./player.js";
import { save } from "./save.js";

export const ui = {

  time: 0,
  tick_time: 0,
  width: canvas.width,
  height: canvas.width,
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

  init: function() {

    const pause_fn = () => {
      player.paused = !player.paused;
      ui.pause.start_time = player.paused ? ui.time : -1;
    };
    key.add_key_listener("KeyP", pause_fn);
    key.add_key_listener("Escape", pause_fn);

    key.add_key_listener("KeyF", () => {
      player.autoshoot = !player.autoshoot;
    });

  },

  tick: function(dt: number) {
    ui.tick_time++;
    ui.time += dt;
    ui.debug.dt_queue.push(dt);
    ui.debug.dt_total += dt;
    while (ui.debug.dt_queue.length > 100) {
      ui.debug.dt_total -= ui.debug.dt_queue.shift() ?? 0;
    }
  },

  draw: function() {
    ui.draw_debug();
    ui.draw_health();
    if (player.paused) ui.draw_pause_menu();
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
    if (!config.game.debug_mode) return;
    const size = ui.size * 1.2;
    const fps = ui.debug.dt_queue.length === 100 ? 1000000 / ui.debug.dt_total : ui.debug.dt_queue.length * 10000 / ui.debug.dt_total; // wow a million
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

    const real_max = math.max(...ui.debug.dt_queue);
    const display_max = math.lerp(ui.debug.dt_max, real_max, real_max > ui.debug.dt_max ? 0.1 : 0.08);
    ui.debug.dt_max = display_max;
    const points = [] as vector[];
    points.push(vector.create(x, y + size * 3));
    for (let i = 0; i < ui.debug.dt_queue.length; i++) {
      points.push(vector.create(ui.width - size / 10 * (105 - i), y + size + size * 2 * (1 - math.bound(ui.debug.dt_queue[i] / display_max, 0, 1))));
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
    let x = size * 7;
    let y = size * 5;
    let r = size * 1.25;
    ctx.lineWidth = 1.25 * config.graphics.linewidth_mult;
    const angle = -ui.time / config.seconds * config.graphics.health_rotate_speed;
    for (let i = 0; i < total_health; i++) {
      if (i < health_display - math.epsilon_bigger) {
        if (i === health_ipart && health_fpart < 0.1) ctx.globalAlpha = 0.5 + health_fpart * 5;
        ctx.fillStyle = color.white + "66";
        ctx.strokeStyle = color.white;
        ctx.beginPath();
        if (i === health_ipart) ctx.arc(x, y, r, angle % (Math.PI * 2), (angle - health_fpart * Math.PI * 2) % (Math.PI * 2));
        else ctx.circle(x, y, r);
        ctx.stroke();
      } else {
        ctx.fillStyle = color.white + "33";
      }
      ctx.beginPath();
      ctx.circle(x, y, r + config.graphics.linewidth_mult / 2);
      ctx.fill();
      x += size * 3.5;
      if (i === health_ipart && health_fpart < 0.1) ctx.globalAlpha = 1;
    }
    let w = size * 3.5 * Math.floor(total_health - 1) + r * 4;
    x = size * 7 - r * 2;
    ctx.fillStyle = (player.enemy_can_see ? color.red : color.white) + "11";
    ctx.beginPath();
    ctx.rectangle(x + w / 2, y, w, r * 3);
    ctx.fill();
    const w_ = size * 3.5 * health_display;
    ctx.beginPath();
    ctx.rectangle(x + r * 0.625 + w_ / 2, y, w_, r * 3);
    ctx.fill();
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
    ctx.lineWidth = config.graphics.linewidth_mult * 2;
    ctx.set_font_mono(r * 1.5, "bold");
    ctx.strokeStyle = color.green + "aa";
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
    get time() {
      return ui.time - this.start_time;
    },
    menu: [
      {
        logo: "x",
        color: color.green,
        fn: function() {
          player.paused = false;
        },
      },
      {
        logo: "settings",
        color: color.blue,
        fn: function() {
        },
      },
      {
        logo: "logout",
        color: color.red,
        fn: function() {
        },
      },
      {
        logo: "map",
        color: color.gold,
        fn: function() {
        },
      },
      {
        logo: "info",
        color: color.dimgrey,
        fn: function() {
        },
      },
      {
        logo: "load",
        color: color.purple,
        fn: function() {
        },
      },
    ] as { logo: string, color: string, fn: () => void }[],
  },

  draw_pause_menu: function() {
    const size = ui.size;
    const centre = camera.world2screen(player.position);
    let r = 8 * camera.scale;
    const length = ui.pause.menu.length;
    ctx.strokeStyle = color.white;
    for (let i = 0; i < length; i++) {
      const a = ((i - 1) * 360 / (length - 1) + ui.pause.time / 1000) % 360;
      const v = i === 0 ? centre : vector.add(centre, vector.createpolar_deg(a, r * 1.5));
      const o = ui.pause.menu[i];
      ctx.fillStyle = color.white;
      ctx.svg_v(o.logo, v, r);
      ctx.beginPath();
      ctx.circle_v(v, r * 0.7);
      const hovering = ctx.point_in_path_v(mouse.position);
      if (hovering) ui.click.new(o.fn);
      ctx.beginPath();
      ctx.circle_v(v, r * 0.64);
      ctx.fillStyle = (hovering ? o.color : color.white) + "22";
      ctx.fill();
      if (hovering) ctx.stroke();
      if (i === 0) r *= 1.25;
    }
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

};

window.addEventListener("resize", function(_event) {
  ui.width = canvas.width;
  ui.height = canvas.height;
  ui.size = Math.sqrt(canvas.width * canvas.height) * 0.01;
});