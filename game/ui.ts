import { canvas, ctx } from "../util/canvas.js";
import { color } from "../util/color.js";
import { config } from "../util/config.js";
import { mouse } from "../util/key.js";
import { math } from "../util/math.js";
import { player } from "./player.js";

export const ui = {

  time: 0,
  width: canvas.width,
  height: canvas.width,
  size: 0,

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
        ui.click.new_fns[button]();
      }
      ui.click.new_fns_exist = [false, false, false];
    },
  },

  init: function() {

  },

  tick: function() {
    ui.time++;
    ui.click.tick();
  },

  draw: function() {
    ui.draw_health();
  },

  draw_health: function() {
    if (!player.health) return;
    const total_health = player.health.capacity / 100;
    const health_display = player.health.display / 100;
    const health_ipart = Math.floor(health_display + math.epsilon_bigger);
    const health_fpart = health_display - health_ipart;
    let size = ui.size;
    let x = size * 7;
    let y = size * 5;
    let r = size * 1.25;
    ctx.lineWidth = config.graphics.linewidth_mult;
    const angle = -ui.time / 10 * config.graphics.health_rotate_speed;
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
    ctx.fillStyle = color.white + "11";
    ctx.beginPath();
    ctx.rectangle(x + w / 2, y, w, r * 3);
    ctx.fill();
    w = size * 3.5 * health_display;
    ctx.beginPath();
    ctx.rectangle(x + r * 0.625 + w / 2, y, w, r * 3);
    ctx.fill();
    if (player.enemy_can_see) {
      
    }
  },

};

window.addEventListener("resize", function(_event) {
  ui.width = canvas.width;
  ui.height = canvas.height;
  ui.size = Math.sqrt(canvas.width * canvas.height) * 0.01;
});