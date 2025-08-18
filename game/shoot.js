import { Vector } from "../matter.js";
import { STYLES } from "../util/color.js";
import { config } from "../util/config.js";
import { math } from "../util/math.js";
import { vector } from "../util/vector.js";
import { filters } from "./detector.js";
import { clone_object, override_object } from "./make.js";
import { Shape } from "./shape.js";
import { Bullet, Thing } from "./thing.js";
export class Shoot {
    thing;
    shape;
    index = -1;
    active = false;
    is_player = false;
    time = 0;
    duration = 0;
    duration_time = 0;
    delay = 0;
    offset = vector.create();
    bullets = [];
    stats;
    constructor(thing, stats = {}, shape) {
        this.thing = thing;
        this.shape = shape;
        if (this.shape)
            this.shape.activate_scale = true;
        this.stats = stats;
        if (thing.is_player || (thing.is_bullet && thing.bullet_shoot?.is_player))
            this.is_player = true;
    }
    set_stats(new_stats) {
        override_object(this.stats, new_stats);
        // for (const [k, v] of Object.entries(new_stats)) {
        //   (this.stats as any)[k] = v;
        // }
    }
    tick() {
        if (this.time < (this.stats.reload ?? 0)) {
            this.time++;
            if (this.shape) {
                const ratio = math.bound(this.time / (this.stats.reload ?? 1), 0, 1);
                this.shape.scale = vector.create(ratio, ratio);
            }
        }
    }
    shoot() {
        const S = this.stats;
        const reload = S.reload ?? 0;
        while (reload != undefined && this.time >= reload) {
            this.shoot_bullet();
            this.time -= reload;
        }
    }
    // todo make this function faster? perhaps?
    shoot_bullet() {
        const S = this.stats;
        const position = vector.add(this.thing.position, Vector.rotate(vector.create((this.offset.x || 0), (this.offset.y || 0)), this.thing.angle));
        const bullet = new Bullet();
        bullet.position = position;
        bullet.is_bullet = true;
        bullet.team = this.thing.team;
        bullet.damage = S.damage ?? 0;
        bullet.make(S.make ?? "bullet", true);
        const angle = math.randgauss(this.thing.angle + (vector.deg_to_rad(S.angle ?? 0)), S.spread ?? 0);
        const spreadv = S.spread_speed ?? 0;
        let speed = spreadv === 0 ? (S.speed ?? 0) : math.randgauss(S.speed ?? 0, spreadv);
        const thing_velocity = Vector.rotate(this.thing.velocity, -angle).x;
        if (speed !== 0)
            speed += thing_velocity * config.physics.velocity_shoot_boost * (S.boost_mult ?? 1);
        bullet.velocity = vector.createpolar(angle, speed);
        bullet.angle = angle;
        bullet.bullet_time = Thing.time + (S.time ?? 200);
        bullet.target.facing = vector.clone(this.thing.target.facing);
        this.bullets.push(bullet);
        const spreadsize = S.spread_size ?? 0;
        const size = spreadsize === 0 ? (S.size ?? 0) : math.randgauss(S.size ?? 0, spreadsize);
        const s = Shape.circle(bullet, size);
        s.thing = bullet;
        s.seethrough = true;
        s.style = clone_object(this.thing.shapes[0].style);
        if (S.style)
            override_object(s.style, (STYLES[S.style] ?? STYLES.error));
        if (S.style_)
            override_object(s.style, S.style_);
        const body_options = bullet.create_body_options(filters.bullet(bullet.team));
        body_options.frictionAir = S.friction ?? body_options.frictionAir ?? 0;
        body_options.restitution = S.restitution ?? body_options.restitution ?? 0;
        bullet.create_body(body_options);
        if (S.recoil !== 0 && speed && S.speed) {
            let recoil = (S.recoil == undefined) ? 1 : S.recoil;
            recoil *= speed * (bullet.body?.mass || 0) * config.physics.force_factor * config.physics.recoil_factor;
            this.thing.push_in_direction(angle, -recoil);
        }
        if (S.death != undefined) {
            bullet.options.death = (clone_object({ a: S.death }).a);
        }
        return bullet;
    }
    remove_bullet(bullet) {
        const index = this.bullets.indexOf(bullet);
        if (index >= 0) {
            this.bullets.splice(index, 1);
        }
    }
    remove() {
        for (const b of this.bullets) {
            this.remove_bullet(b);
        }
        const index = this.thing.shoots.indexOf(this);
        if (index >= 0) {
            this.thing.shoots.splice(index, 1);
        }
    }
}
;
