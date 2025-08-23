import { Query } from "../matter.js";
import { math } from "../util/math.js";
import { vector, vector3 } from "../util/vector.js";
import { detector, filters } from "./detector.js";
import { make } from "./make.js";
import { player } from "./player.js";
import { save } from "./save.js";
import { Shape } from "./shape.js";
import { Thing } from "./thing.js";
export class Enemy extends Thing {
    static cumulative_ids = {};
    static cumulative_team_ids = {};
    static tick() {
        this.update_body_list();
    }
    static body_list = [];
    static update_body_list() {
        const result = [];
        for (const s of Shape.draw_shapes) {
            if (s.seethrough)
                continue;
            const body = s.thing.body;
            if (body != undefined && !result.includes(body)) {
                if (body.walls) {
                    for (const w of body.walls) {
                        if (!result.includes(w))
                            result.push(w);
                    }
                }
                else {
                    result.push(body);
                }
            }
        }
        Enemy.body_list = result;
        return result;
    }
    spawner;
    wave_number = -1;
    player_position = player.position;
    constructor(spawner) {
        super();
        this.spawner = spawner;
        this.is_enemy = true;
    }
    make_enemy(key, position, id) {
        if (make[key] == undefined)
            return console.error(`[enemy/make_enemy] no such enemy: '${key}'`);
        this.make(key);
        if (id)
            this.create_id(id);
        else {
            if (Enemy.cumulative_ids[key] == undefined)
                Enemy.cumulative_ids[key] = 1;
            id = key + " #" + Enemy.cumulative_ids[key]++;
            this.create_id(id);
            if (Enemy.cumulative_team_ids[this.team] == undefined)
                Enemy.cumulative_team_ids[this.team] = 1;
            this.team += (Enemy.cumulative_team_ids[this.team]++) * 0.000000000001; // a trillion possible enemies per team
        }
        this.position = position;
        if (!this.options.angle)
            this.angle = math.rand(0, Math.PI * 2);
        this.create_body(this.create_body_options(filters.thing(this.team)));
        if (this.body)
            this.body.label = id;
        else
            console.error("[enemy/make_enemy] no body?");
    }
    die() {
        const id = this.spawner.id;
        const bypass_remove = detector.before_death_fns[id]?.(this);
        if (bypass_remove)
            return;
        super.die();
    }
    tick() {
        super.tick();
        this.tick_enemy();
    }
    tick_enemy() {
        if (!this.can_see_player())
            return;
        this.shoot();
        this.face_enemy();
        this.move_enemy();
    }
    can_see_player() {
        if (vector.length2(vector.sub(this.position, player.position)) > (this.options.enemy_detect_range ?? 1000) ** 2) {
            return false;
        }
        const player_size = player.shapes[0]?.radius ?? 0;
        const checks = [
            player.position,
            vector3.add(player.position, vector3.create(player_size, 0, 0)),
            vector3.add(player.position, vector3.create(0, player_size, 0)),
            vector3.add(player.position, vector3.create(-player_size, 0, 0)),
            vector3.add(player.position, vector3.create(0, -player_size, 0)),
        ];
        for (const check of checks) {
            if (Query.ray(Enemy.body_list, this.position, check).length === 0) {
                this.player_position = check;
                return check;
            }
        }
        return false;
    }
    face_enemy() {
        const face_type = this.options.face_type ?? "none";
        if (face_type === "static") {
        }
        else if (face_type === "predict2") {
            this.target.facing = vector.add(this.player_position, vector.mult(player.velocity, (vector.length(vector.sub(this.position, this.player_position)) ** 0.5) * 3));
            this.update_angle(this.options.face_smoothness ?? 0.3);
        }
        else if (face_type === "predict") {
            this.target.facing = vector.add(this.player_position, vector.mult(player.velocity, vector.length(vector.sub(this.position, this.player_position)) * 0.3));
            this.update_angle(this.options.face_smoothness ?? 0.3);
        }
        else if (face_type.startsWith("direct")) {
            this.target.facing = this.player_position;
            this.update_angle(this.options.face_smoothness ?? 1);
        }
    }
    move_enemy() {
        const move_type = this.options.move_type ?? "none";
        if (move_type === "static") {
        }
        else if (move_type === "hover") {
            const dist2 = vector.length2(vector.sub(this.position, this.player_position));
            this.push_to(this.target.facing, (this.options.move_speed ?? 1) * ((dist2 < (this.options.move_hover_distance ?? 300) ** 2) ? -1 : 1));
        }
        else if (move_type === "direct") {
            this.push_to(this.target.facing, (this.options.move_speed ?? 1));
        }
        else if (move_type === "spiral") {
            const v = vector.rotate(vector.create(), vector.sub(this.position, this.player_position), vector.deg_to_rad(80));
            this.push_to(vector.add(this.target.facing, vector.mult(v, 0.5)), (this.options.move_speed ?? 1));
        }
    }
    remove() {
        const index = this.spawner.enemies.indexOf(this);
        if (index != undefined && index > -1) {
            this.spawner.enemies.splice(index, 1);
        }
        this.spawner.calc_progress();
        super.remove();
    }
    remove_static() {
        const index = this.spawner.enemies.indexOf(this);
        if (index != undefined && index > -1) {
            this.spawner.enemies.splice(index, 1);
        }
        this.spawner.calc_progress();
        if (this.is_removed)
            return;
        this.remove_death();
        delete this.health; // important! prevents remove on tick (health.is_zero)
        if (this.body)
            this.body.isStatic = true;
        for (const shoot of this.shoots)
            shoot.update_shape(1);
        this.remove_children();
        this.remove_shoots();
    }
}
;
;
;
export class Spawner {
    static spawners = [];
    static spawners_lookup = {};
    static cumulative_id = 0;
    static tick_spawners() {
        for (const spawner of Spawner.spawners) {
            spawner.tick();
        }
    }
    static check_progress(spawner_id) {
        return this.spawners_lookup[spawner_id]?.wave_progress ?? -1;
    }
    uid = ++Spawner.cumulative_id;
    id = "generic spawner #" + this.uid;
    spawn;
    waves = [];
    wave_progress = 0;
    vertices = [];
    enemies = [];
    delays = [];
    permanent = false;
    constructor() {
        Spawner.spawners.push(this);
    }
    make_map(o) {
        this.vertices = vector.clone_list(o.vertices);
        this.create_id(o.id);
        this.spawn = {
            enemy: o.options.spawn_enemy ?? "enemy",
            delay: o.options.spawn_delay,
            repeat: o.options.spawn_repeat,
            repeat_delay: o.options.spawn_repeat_delay,
        };
        this.permanent = o.options.spawn_permanent ?? false;
        if (this.permanent) {
            this.wave_progress = save.get_switch(this.id);
        }
    }
    create_id(id) {
        this.id = id;
        Spawner.spawners_lookup[id] = this;
    }
    tick() {
        if (this.spawn && this.wave_progress <= 0 && this.enemies.length <= 0) {
            for (let i = 0; i < (this.spawn.repeat ?? 1); i++) {
                this.delays.push({ enemy: this.spawn.enemy, time: Thing.time + (this.spawn.delay ?? 0) + i * (this.spawn.repeat_delay ?? 0) });
            }
        }
        else if (this.waves.length >= 1 && this.wave_progress < this.waves.length + 1) {
            // todo waves
        }
        this.delays = this.delays.filter((d) => {
            if (Thing.time < d.time)
                return true;
            this.spawn_enemy(d.enemy);
            return false;
        });
    }
    spawn_enemy(key, position) {
        const e = new Enemy(this);
        e.make_enemy(key, position ?? this.random_position());
        this.enemies.push(e);
        return e;
    }
    do_waves() {
    }
    calc_progress() {
        if (this.spawn) {
            this.wave_progress = (this.enemies.length <= 0) ? 1 : 0;
        }
        else {
            // todo waves
        }
        if (this.permanent && this.wave_progress > -1) {
            save.set_switch(this.id, this.wave_progress);
        }
    }
    random_position() {
        if (this.vertices.length === 0) {
            console.error("[spawner/random_position] no vertices in polygon!");
            return vector.create();
        }
        return math.rand_point_in_polygon(this.vertices);
    }
    remove() {
        const index = Spawner.spawners.indexOf(this);
        if (index != undefined && index > -1) {
            Spawner.spawners.splice(index, 1);
        }
        delete Spawner.spawners_lookup[this.id];
    }
}
;
