import { make_from_map_shape, MAP } from "../index.js";
import { camera } from "../util/camera.js";
import { config } from "../util/config.js";
import { keys } from "../util/key.js";
import { math } from "../util/math.js";
import { vector, vector3 } from "../util/vector.js";
import { filters } from "./detector.js";
import { Spawner } from "./enemy.js";
import { override_object, shallow_clone_array } from "./make.js";
import { save } from "./save.js";
import { Thing } from "./thing.js";
export class Player extends Thing {
    autoshoot = false;
    fov_mult = 1;
    autosave_time = -1;
    old_position = vector.create();
    checkpoint = vector.create();
    checkpoint_room = "";
    current_gun = "";
    enemy_can_see = false;
    guns = [];
    xp = 0;
    level = 0;
    stats = {
        deaths: 0,
        pixels_walked: 0,
        enemies_killed: 0,
        currencies_total: {},
    };
    camera_target = vector.create();
    camera_target_target = vector.create();
    room_list = [];
    constructor() {
        super();
        this.is_player = true;
        this.team = 1;
        this.make("player", true);
        // this.make_shape("player_basic");
        this.create_id("player");
        this.position = vector3.create();
    }
    create_player() {
        this.create_body(this.create_body_options(filters.thing(this.team)));
        if (this.body)
            this.body.label = "player";
    }
    tick() {
        super.tick();
        if (vector.equal(this.camera_target_target, this.position)) {
            this.camera_target = this.position;
        }
        this.camera_target_target = this.position;
        const controls = {
            up: keys["ArrowUp"] === true || (keys["KeyW"] === true),
            down: keys["ArrowDown"] === true || (keys["KeyS"] === true),
            left: keys["ArrowLeft"] === true || (keys["KeyA"] === true),
            right: keys["ArrowRight"] === true || (keys["KeyD"] === true),
            jump: false && keys["Space"] === true,
            shoot: keys["Mouse"] === true,
            toggle_autoshoot: keys["KeyF"] === true,
            rshoot: keys["MouseRight"] === true || ((keys["ShiftLeft"] === true || keys["ShiftRight"] === true)),
            facingx: Math.floor(camera.mouse_v.x),
            facingy: Math.floor(camera.mouse_v.y),
            exit: (keys["KeyP"] === true),
        };
        this.target.facing = vector.add(vector.sub(camera.mouse_v, camera.world2screen(this.position)), this.position);
        const move_x = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
        const move_y = (controls.down ? 1 : 0) - (controls.up ? 1 : 0);
        const move_z = (this.target.vz < 0 && this.z < math.epsilon) ? (controls.jump ? 1 : 0) : 0;
        const move_v = vector.normalise(vector.create(move_x, move_y));
        if (this.body) {
            this.push_by(vector.mult(move_v, this.options.move_speed ?? config.physics.player_speed));
            this.update_angle();
        }
        this.stats.pixels_walked += Math.floor(vector.length(vector.sub(this.position, this.old_position)));
        this.old_position = this.position;
        if (move_z > 0)
            this.target.vz = move_z * 0.03;
        this.target.position.z = math.bound(this.target.position.z + this.target.vz, 0, 0.5);
        this.target.vz = this.target.vz - 0.0015;
        if (controls.toggle_autoshoot) {
            this.autoshoot = !this.autoshoot;
        }
        if (controls.shoot || this.autoshoot) {
            this.shoot();
        }
        if (Thing.time >= this.autosave_time) {
            if (this.autosave_time < 0)
                this.autosave_time = Thing.time + config.game.autosave_interval;
            else
                this.save();
        }
    }
    die() {
        this.stats.deaths++;
        this.reset_velocity();
        this.teleport_to(this.checkpoint);
        if (this.health) {
            this.health.heal_all();
            this.health.display = this.health.value;
            this.health.set_invincible(config.game.invincibility_time);
        }
        this.reload_all_rooms();
    }
    hit(damage) {
        super.hit(damage);
        if (damage > 0)
            this.health?.set_invincible(config.game.invincibility_time);
    }
    camera_position() {
        this.camera_target = vector.lerp(this.camera_target, this.camera_target_target, 0.05);
        const position = vector.lerp(this.camera_target, this.position, 0.5);
        return vector.add(position, vector.mult(camera.mouse_v, 1 / 30 * camera.scale));
        // todo remove
        // let v = vector.sub(this.target.facing, camera.world2screen(this.position));
        // v = vector.normalise(v, vector.length(v) / 30 * camera.scale);
        // return vector.add(this.position, v);
    }
    camera_scale() {
        const v = camera.halfscreen;
        return Math.sqrt(v.x * v.y) / 500 / this.fov_mult;
    }
    remake_shoot(shoot_id) {
        if (!shoot_id)
            shoot_id = this.current_gun;
        this.make_shape("player", true);
        this.make_shape("player_" + shoot_id);
    }
    save_but_health_only() {
        save.save.player.health = this.health?.value ?? 0;
        save.save.player.ability = this.ability?.value ?? 0;
    }
    save() {
        if (this.enemy_can_see) {
            this.enemy_can_see = false;
            return false;
        }
        this.autosave_time = Thing.time + config.game.autosave_interval;
        const o = {
            position: this.position,
            room_id: this.room_id,
            fov_mult: this.fov_mult,
            health: this.health?.value ?? 0,
            ability: this.ability?.value ?? 0,
            xp: this.xp,
            checkpoint: this.checkpoint,
            current_gun: this.current_gun,
            guns: this.guns,
            stats: this.stats,
        };
        save.save.player = o;
        save.changed();
        return true;
    }
    load(o) {
        if (o.position) {
            this.position = o.position;
            this.old_position = o.position;
            this.reset_velocity();
            this.teleport_to(o.position);
        }
        this.change_room(o.room_id ?? MAP.computed?.shape_map.start.options.room_connections?.[0] ?? "");
        if (o.checkpoint)
            this.checkpoint = o.checkpoint;
        if (o.checkpoint_room)
            this.checkpoint_room = o.checkpoint_room;
        if (o.fov_mult)
            this.fov_mult = o.fov_mult;
        if (o.xp)
            this.xp = o.xp;
        if (this.health && o.health)
            this.health.value = o.health;
        if (this.ability && o.ability)
            this.ability.value = o.ability;
        if (o.guns)
            this.guns = o.guns;
        if (o.current_gun) {
            this.current_gun = o.current_gun;
            this.remake_shoot();
        }
        if (o.stats)
            override_object(this.stats, o.stats);
    }
    add_xp(xp) {
        this.xp += xp;
        this.level = 0; // todo level formula
    }
    collect(o) {
        if (o.restore_health)
            this.health?.heal_all();
        if (o.gun) {
            if (!this.guns.includes(o.gun))
                this.guns.push(o.gun);
            this.current_gun = o.gun;
            this.remake_shoot();
        }
        if (o.currency_name) {
            save.add_currency(o.currency_name, o.currency_amount);
        }
    }
    set_checkpoint(position, room_id) {
        this.checkpoint = position;
        this.checkpoint_room = room_id ?? this.room_id;
    }
    set_checkpoint_to_thing(thing) {
        this.checkpoint = thing.position;
        this.checkpoint_room = thing.room_id;
    }
    change_room(room_id) {
        if (!room_id)
            return;
        const old_room_id = this.room_id;
        this.room_id = room_id;
        this.set_rooms(this.connected_rooms(1), this.connected_rooms(2));
    }
    connected_rooms(depth = 1, room_id) {
        if (!room_id)
            room_id = this.room_id;
        if (depth === 0)
            return [room_id];
        const result = [];
        result.push(room_id);
        for (const id of (MAP.computed?.shape_map[room_id]?.options.room_connections ?? [])) {
            for (const i of this.connected_rooms(depth - 1, id)) {
                if (result.includes(i))
                    continue;
                result.push(i);
            }
        }
        return result;
    }
    set_rooms(add_rooms, dont_remove_rooms = add_rooms) {
        for (const room_id of add_rooms) {
            if (!this.room_list.includes(room_id))
                this.load_room(room_id);
        }
        for (const room_id of shallow_clone_array(this.room_list)) {
            if (!dont_remove_rooms.includes(room_id))
                this.unload_room(room_id);
        }
    }
    load_room(room_id) {
        // console.log("loading room " + room_id);
        for (const id of MAP.computed?.room_map[room_id] ?? []) {
            const s = MAP.computed?.shape_map[id];
            if (s)
                make_from_map_shape(s);
        }
        this.room_list.push(room_id);
    }
    unload_room(room_id) {
        // console.log("unloading room " + room_id);
        for (const spawner of shallow_clone_array(Spawner.spawners_rooms[room_id] ?? [])) {
            spawner.remove();
        }
        for (const thing of shallow_clone_array(Thing.things_rooms[room_id] ?? [])) {
            thing.remove();
        }
        this.room_list.remove(room_id);
    }
    reload_room(room_id) {
        this.unload_room(room_id);
        this.load_room(room_id);
    }
    reload_all_rooms() {
        // console.log("reloading all rooms");
        for (const room_id of shallow_clone_array(this.room_list)) {
            this.reload_room(room_id);
        }
    }
}
;
export const player = new Player();
