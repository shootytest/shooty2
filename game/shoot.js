import { Vector } from "../matter.js";
import { STYLES, STYLES_ } from "../util/color.js";
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
    delayed = 0;
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
    get ratio() {
        if (this.time >= (this.stats.reload ?? 0))
            return 1;
        return math.bound((this.time / (this.stats.reload ?? 1) - (this.stats.delay ?? 0) + 1) % 1, 0, 1);
    }
    set_stats(new_stats) {
        override_object(this.stats, new_stats);
        // for (const [k, v] of Object.entries(new_stats)) {
        //   (this.stats as any)[k] = v;
        // }
    }
    tick(dt) {
        if (this.time < (this.stats.reload ?? 0)) {
            this.time += math.bound(dt / config.seconds, 0, (this.stats.reload ?? 0));
            this.update_shape();
        }
        if (this.delayed > 0 && Thing.time >= this.delayed) {
            this.shoot_bullet();
            this.delayed = 0;
        }
        if (this.stats.always_shoot)
            this.shoot();
    }
    shoot() {
        const S = this.stats;
        const reload = (S.reload ?? 0);
        let number_of_shoots = 0;
        while (reload > 0 && this.time >= reload) {
            this.delayed = Thing.time + (S.delay ?? 0) * reload;
            this.time -= reload;
            number_of_shoots++;
        }
        return number_of_shoots;
    }
    // todo make this function faster? perhaps?
    shoot_bullet() {
        const S = this.stats;
        const position = vector.add(this.thing.position, Vector.rotate(vector.create((this.offset.x ?? 0) + (this.stats.offset?.x ?? 0), (this.offset.y ?? 0) + (this.stats.offset?.y ?? 0)), this.thing.angle));
        const bullet = new Bullet();
        bullet.position = position;
        bullet.z = this.thing.z;
        bullet.is_bullet = true;
        bullet.damage = S.damage ?? 0;
        bullet.parent = this.thing.parent;
        bullet.make(S.make ?? "bullet", true);
        bullet.create_room(this.thing.room_id);
        if (bullet.team === 0)
            bullet.team = this.thing.team;
        if (bullet.parent.is_player) {
            const player = bullet.parent;
            const str = player.current_gun + "/" + (S.make ?? "bullet");
            player.stats.bullets_shot[str] = (player.stats.bullets_shot[str] ?? 0) + 1;
        }
        let angle = S.spread_angle === -1 ? math.randangle() : math.randgauss(this.thing.angle + (vector.deg_to_rad(S.angle ?? 0)), S.spread_angle ?? 0);
        if (S.random_angle)
            angle += math.rand(-S.random_angle, S.random_angle);
        let speed = math.randgauss(S.speed ?? 0, S.spread_speed ?? 0);
        if (S.random_speed)
            speed += math.rand(-S.random_speed, S.random_speed);
        let angular_speed = math.randgauss(S.angular_speed ?? 0, S.spread_angular_speed ?? 0);
        if (S.random_angular_speed)
            speed += math.rand(-S.random_angular_speed, S.random_angular_speed);
        const thing_velocity = Vector.rotate(this.thing.velocity, -angle).x;
        if (speed !== 0 && thing_velocity !== 0)
            speed += thing_velocity * config.physics.velocity_shoot_boost * (S.boost_mult ?? 1);
        bullet.velocity = vector.createpolar(angle, speed);
        bullet.angular_velocity = angular_speed;
        bullet.angle = angle;
        bullet.bullet_total_time = (S.time ?? 1000000) * config.seconds;
        bullet.bullet_time = Thing.time + bullet.bullet_total_time;
        bullet.target.facing = vector.clone(this.thing.target.facing);
        this.bullets.push(bullet);
        let size = S.size == undefined ? 1 : math.randgauss(S.size, S.spread_size ?? 0);
        if (S.random_size)
            size += math.rand(-S.random_size, S.random_size);
        if (bullet.shapes.length <= 0) {
            const shape = Shape.circle(bullet, size);
            shape.thing = bullet;
            shape.seethrough = true;
            shape.style = clone_object(this.thing.shapes[0].style);
            shape.has_style = true;
            if (S.style)
                override_object(shape.style, (STYLES_[S.style] ?? STYLES.error));
            if (S.style_)
                override_object(shape.style, S.style_);
        }
        else {
            for (const shape of bullet.shapes) {
                shape.scale_size(size);
                shape.thing = bullet;
                if (!shape.has_style) {
                    shape.style = clone_object(this.thing.shapes[0].style);
                    shape.has_style = true;
                }
                if (shape.index === 0) {
                    if (S.style)
                        override_object(shape.style, (STYLES_[S.style] ?? STYLES.error));
                    if (S.style_)
                        override_object(shape.style, S.style_);
                }
            }
        }
        const body_options = bullet.create_body_options(bullet.is_bullet ? filters.bullet(bullet.team) : filters.thing(bullet.team));
        body_options.frictionAir = S.friction ?? body_options.frictionAir ?? 0;
        body_options.restitution = S.restitution ?? body_options.restitution ?? 0;
        body_options.density = S.density ?? body_options.density ?? 0;
        bullet.create_body(body_options);
        // do recoil
        if (S.recoil !== 0 && speed && S.speed) {
            let recoil = (S.recoil == undefined) ? 1 : S.recoil;
            recoil *= speed * (bullet.body?.mass || 0) * config.physics.force_factor * config.physics.recoil_factor;
            this.thing.push_in_direction(angle, -recoil);
        }
        // other miscellaneous bullet options
        if (S.death != undefined)
            bullet.options.death = (clone_object({ a: S.death }).a);
        if (S.detect_range_mult != undefined && bullet.options.enemy_detect_range)
            bullet.options.enemy_detect_range *= S.detect_range_mult;
        return bullet;
    }
    remove_bullet(bullet) {
        this.bullets.remove(bullet);
    }
    remove() {
        for (const b of this.bullets) {
            this.remove_bullet(b);
        }
        this.thing.shoots.remove(this);
    }
    update_shape(ratio = this.ratio) {
        if (!this.shape)
            return;
        this.shape.scale = vector.create(ratio, ratio);
    }
}
;
