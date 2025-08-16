import { math } from "../util/math.js";
import { vector } from "../util/vector.js";
import { filters } from "./detector.js";
import { make } from "./make.js";
import { Thing } from "./thing.js";
export class Enemy extends Thing {
    static cumulative_ids = {};
    spawner;
    wave_number = -1;
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
        }
        this.position = position;
        this.create_body({
            frictionAir: 0.2,
            restitution: 0.1,
            collisionFilter: filters.thing(this.team),
        });
        if (this.body)
            this.body.label = id;
        else
            console.error("[enemy/make_enemy] no body?");
    }
    tick() {
        super.tick();
    }
    remove() {
        const index = this.spawner.enemies.indexOf(this);
        if (index != undefined && index > -1) {
            this.spawner.enemies.splice(index, 1);
        }
        this.spawner.calc_progress();
        super.remove();
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
    uid = ++Spawner.cumulative_id;
    id = "generic spawner #" + this.uid;
    spawn;
    waves = [];
    wave_progress = -1;
    vertices = [];
    enemies = [];
    delays = [];
    constructor() {
        Spawner.spawners.push(this);
    }
    make_map(o) {
        this.vertices = vector.clone_list(o.vertices);
        this.create_id(o.id);
        this.spawn = {
            enemy: o.options.spawn_enemy ?? "enemy",
        };
    }
    create_id(id) {
        this.id = id;
        Spawner.spawners_lookup[id] = this;
    }
    tick() {
        if (this.spawn && this.wave_progress < 0 && this.enemies.length <= 0) {
            if (this.spawn.delay)
                this.delays.push({ enemy: this.spawn.enemy, time: Thing.time + this.spawn.delay });
            else
                this.spawn_enemy(this.spawn.enemy, this.spawn.position);
        }
        else if (this.waves.length >= 1 && this.wave_progress < this.waves.length) {
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
            this.wave_progress = this.enemies.length <= 0 ? 0 : -1;
        }
        else {
            // todo waves
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
