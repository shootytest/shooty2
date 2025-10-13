import { camera } from "../util/camera.js";
import { canvas, ctx } from "../util/canvas.js";
import { color } from "../util/color.js";
import { config } from "../util/config.js";
import { key, keys, mouse } from "../util/key.js";
import { math } from "../util/math.js";
import { vector } from "../util/vector.js";
import { player } from "./player.js";
export const ui = {
    time: 0,
    width: canvas.width,
    height: canvas.width,
    size: 0,
    click: {
        new_fns: [() => { }, () => { }, () => { }],
        new_fns_exist: [false, false, false],
        new: function (fn, button = 0, overwrite = true) {
            if (mouse.down_buttons[button]) {
                if (overwrite || !ui.click.new_fns_exist[button]) {
                    ui.click.new_fns[button] = fn;
                    ui.click.new_fns_exist[button] = true;
                }
            }
        },
        tick: function () {
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
    init: function () {
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
    tick: function () {
        ui.time++;
    },
    draw: function () {
        ui.draw_health();
        if (player.paused)
            ui.draw_pause_menu();
        ui.click.tick();
    },
    health: {
        xp_ratio_display: 0,
        xp_display: 0,
        xp_change_display: 0,
        xp_show: 0,
    },
    draw_health: function () {
        if (!player.health)
            return;
        const total_health = player.health.capacity / 100;
        const health_display = player.health.display / 100;
        const health_ipart = Math.floor(health_display + math.epsilon_bigger);
        const health_fpart = health_display - health_ipart;
        const size = ui.size;
        let x = size * 7;
        let y = size * 5;
        let r = size * 1.25;
        ctx.lineWidth = config.graphics.linewidth_mult;
        const angle = -ui.time / 10 * config.graphics.health_rotate_speed;
        for (let i = 0; i < total_health; i++) {
            if (i < health_display - math.epsilon_bigger) {
                if (i === health_ipart && health_fpart < 0.1)
                    ctx.globalAlpha = 0.5 + health_fpart * 5;
                ctx.fillStyle = color.white + "66";
                ctx.strokeStyle = color.white;
                ctx.beginPath();
                if (i === health_ipart)
                    ctx.arc(x, y, r, angle % (Math.PI * 2), (angle - health_fpart * Math.PI * 2) % (Math.PI * 2));
                else
                    ctx.circle(x, y, r);
                ctx.stroke();
            }
            else {
                ctx.fillStyle = color.white + "33";
            }
            ctx.beginPath();
            ctx.circle(x, y, r + config.graphics.linewidth_mult / 2);
            ctx.fill();
            x += size * 3.5;
            if (i === health_ipart && health_fpart < 0.1)
                ctx.globalAlpha = 1;
        }
        let w = size * 3.5 * Math.floor(total_health - 1) + r * 4;
        x = size * 7 - r * 2;
        ctx.fillStyle = color.white + "11";
        ctx.beginPath();
        ctx.rectangle(x + w / 2, y, w, r * 3);
        ctx.fill();
        const w_ = size * 3.5 * health_display;
        ctx.beginPath();
        ctx.rectangle(x + r * 0.625 + w_ / 2, y, w_, r * 3);
        ctx.fill();
        if (player.enemy_can_see) {
            // todo health ui is "scared" lol
        }
        // xp
        const is_showing = (player.thing_time - player.xp_time) < config.graphics.xp_display_time;
        const show = math.lerp(ui.health.xp_show, Number(is_showing), config.graphics.xp_display_smoothness);
        ui.health.xp_show = show;
        const ratio = math.lerp(ui.health.xp_ratio_display, player.xp_ratio, config.graphics.xp_display_smoothness);
        ui.health.xp_ratio_display = ratio;
        const xp_display = math.lerp(ui.health.xp_display, player.xp - player.level2xp(player.level), config.graphics.xp_display_smoothness);
        ui.health.xp_display = xp_display;
        let xp_change = math.lerp(ui.health.xp_change_display, player.xp_change, config.graphics.xp_display_smoothness * (is_showing ? 3 : 1));
        ui.health.xp_change_display = xp_change;
        xp_change = Math.round(xp_change);
        if (!is_showing && player.xp_change)
            player.xp_change = 0;
        ctx.ctx.save();
        ctx.beginPath();
        ctx.rect(x, y + r * 1.5, w, ui.height);
        ctx.clip();
        ctx.lineWidth = config.graphics.linewidth_mult * 2;
        ctx.strokeStyle = color.green + "bb";
        y += r * 2 - r * 3.3 * (1 - show);
        ctx.line(x, y, x + w * ratio, y);
        ctx.strokeStyle = color.green + "22";
        ctx.line(x, y, x + w, y);
        ctx.fillStyle = color.green + "bb";
        ctx.set_font_mono(r * 1.5, "bold");
        ctx.textAlign = "left";
        const level_text = "" + player.level;
        ctx.text(level_text, x, y + r * 1.5);
        ctx.textAlign = "right";
        ctx.fillStyle = color.green + "77";
        ctx.text("" + (player.level + 1), x + w, y + r * 1.5);
        x += ctx.measureText(level_text).width;
        ctx.set_font_mono(r * 1);
        ctx.textAlign = "left";
        ctx.fillStyle = color.green + "bb";
        const xp_details_text = Math.round(xp_display) + "/"
            + ((player.level + 1) * config.game.level_1_xp)
            + "  " + (xp_change ? "+" + xp_change : "");
        ctx.text(xp_details_text, x + r, y + r * 1.5 + 2);
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
                fn: function () {
                    player.paused = false;
                },
            },
            {
                logo: "settings",
                color: color.blue,
                fn: function () {
                },
            },
            {
                logo: "logout",
                color: color.red,
                fn: function () {
                },
            },
            {
                logo: "map",
                color: color.gold,
                fn: function () {
                },
            },
            {
                logo: "info",
                color: color.dimgrey,
                fn: function () {
                },
            },
            {
                logo: "load",
                color: color.purple,
                fn: function () {
                },
            },
        ],
    },
    draw_pause_menu: function () {
        const size = ui.size;
        const centre = camera.world2screen(player.position);
        let r = 8 * camera.scale;
        const length = ui.pause.menu.length;
        ctx.strokeStyle = color.white;
        for (let i = 0; i < length; i++) {
            const a = ((i - 1) * 360 / (length - 1) + 0.1 * ui.pause.time) % 360;
            const v = i === 0 ? centre : vector.add(centre, vector.createpolar_deg(a, r * 1.5));
            const o = ui.pause.menu[i];
            ctx.fillStyle = color.white;
            ctx.svg_v(o.logo, v, r);
            ctx.beginPath();
            ctx.circle_v(v, r * 0.7);
            const hovering = ctx.point_in_path_v(mouse.position);
            if (hovering)
                ui.click.new(o.fn);
            ctx.beginPath();
            ctx.circle_v(v, r * 0.64);
            ctx.fillStyle = (hovering ? o.color : color.white) + "22";
            ctx.fill();
            if (hovering)
                ctx.stroke();
            if (i === 0)
                r *= 1.25;
        }
    },
};
window.addEventListener("resize", function (_event) {
    ui.width = canvas.width;
    ui.height = canvas.height;
    ui.size = Math.sqrt(canvas.width * canvas.height) * 0.01;
});
