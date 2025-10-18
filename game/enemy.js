import { math } from "../util/math.js";
import { vector } from "../util/vector.js";
import { detector, filters } from "./detector.js";
import { make } from "./make.js";
import { player } from "./player.js";
import { save } from "./save.js";
import { Thing } from "./thing.js";
export class Enemy extends Thing {
    static cumulative_ids = {};
    static cumulative_team_ids = {};
    spawner;
    wave_number = -1;
    player_position = player.position;
    is_seeing_player = false;
    constructor(spawner) {
        super();
        this.spawner = spawner;
        this.is_enemy = true;
    }
    make_enemy(key, position, room_id, id) {
        if (make[key] == undefined)
            return console.error(`[enemy/make_enemy] no such enemy: '${key}'`);
        this.make(key);
        this.create_room(room_id);
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
        if (!this.options.decoration)
            this.create_body(this.create_body_options(filters.thing(this.team)));
        if (this.body)
            this.body.label = id;
        if (this.options.switch && save.check_switch(this.spawner.id)) {
            this.shapes[0].glowing = 1;
        }
    }
    die() {
        const id = this.spawner.id;
        const bypass_remove = detector.before_death_fns[id]?.(this);
        if (bypass_remove)
            return;
        super.die();
    }
    tick(dt) {
        super.tick(dt);
    }
    shoot() {
        if (this.is_seeing_player)
            player.enemy_can_see = true;
        super.shoot();
    }
    remove() {
        this.remove_spawner();
        super.remove();
    }
    remove_spawner() {
        this.spawner.enemies.remove(this);
        this.spawner.calc_progress();
    }
    remove_static() {
        this.remove_spawner();
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
    remove_deco() {
        this.remove_spawner();
        if (this.is_removed)
            return;
        delete this.health;
        this.remove_death();
        this.remove_body();
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
    static spawners_rooms = {};
    static cumulative_id = 0;
    static tick_spawners() {
        for (const spawner of Spawner.spawners) {
            spawner.tick();
        }
    }
    static check_progress(spawner_id) {
        return this.spawners_lookup[spawner_id]?.wave_progress ?? -1;
    }
    static get_enemy(spawner_id) {
        return Spawner.spawners_lookup[spawner_id]?.enemies?.[0];
    }
    uid = ++Spawner.cumulative_id;
    id = "generic spawner #" + this.uid;
    room_id = "";
    spawn;
    waves = [];
    wave_progress = 0;
    vertices = [];
    enemies = [];
    delays = [];
    permanent = false;
    removed = false;
    constructor() {
        Spawner.spawners.push(this);
    }
    make_map(o) {
        this.vertices = vector.clone_list(o.vertices);
        this.create_id(o.id);
        if (o.options.room_id) {
            this.room_id = o.options.room_id;
            if (Spawner.spawners_rooms[this.room_id] == undefined)
                Spawner.spawners_rooms[this.room_id] = [];
            Spawner.spawners_rooms[this.room_id].push(this);
        }
        this.spawn = {
            enemy: o.options.spawn_enemy ?? "enemy",
            delay: o.options.spawn_delay,
            repeat: o.options.spawn_repeat,
            repeat_delay: o.options.spawn_repeat_delay,
        };
        if (o.options.spawn_permanent)
            this.permanent = o.options.spawn_permanent;
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
        e.make_enemy(key, position ?? this.random_position(), this.room_id);
        e.wave_number = this.wave_progress + 1;
        e.create_room(this.room_id);
        this.enemies.push(e);
        return e;
    }
    do_waves() {
    }
    calc_progress() {
        if (this.removed)
            return;
        if (this.spawn) {
            this.wave_progress = (this.enemies.length <= 0) ? 1 : 0;
        }
        else {
            // todo waves
        }
        if (this.permanent && this.wave_progress > -1) {
            save.set_switch(this.id, this.wave_progress);
        }
        detector.spawner_calc_fns[this.id]?.(this);
    }
    random_position() {
        if (this.vertices.length === 0) {
            console.error("[spawner/random_position] no vertices in polygon!");
            return vector.create();
        }
        return math.rand_point_in_polygon(this.vertices);
    }
    remove() {
        this.removed = true;
        Spawner.spawners.remove(this);
        delete Spawner.spawners_lookup[this.id];
    }
    check_progress(spawner_id) {
        return Spawner.check_progress(spawner_id);
    }
    // useful
    thing_lookup(thing_id) {
        return Thing.things_lookup[thing_id];
    }
}
;
