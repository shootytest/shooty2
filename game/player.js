import { camera } from "../util/camera.js";
import { config } from "../util/config.js";
import { keys } from "../util/key.js";
import { vector, vector3 } from "../util/vector.js";
import { filters } from "./detector.js";
import { Thing } from "./thing.js";
export class Player extends Thing {
    autoshoot = false;
    constructor() {
        super();
        this.is_player = true;
        this.team = 1;
        this.make("player");
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
        const controls = {
            up: keys["ArrowUp"] === true || (keys["KeyW"] === true),
            down: keys["ArrowDown"] === true || (keys["KeyS"] === true),
            left: keys["ArrowLeft"] === true || (keys["KeyA"] === true),
            right: keys["ArrowRight"] === true || (keys["KeyD"] === true),
            toggle_autoshoot: keys["KeyF"] === true,
            shoot: keys["Mouse"] === true || (keys["Space"] === true),
            rshoot: keys["MouseRight"] === true || ((keys["ShiftLeft"] === true || keys["ShiftRight"] === true)),
            facingx: Math.floor(camera.mouse_v.x),
            facingy: Math.floor(camera.mouse_v.y),
            exit: (keys["KeyP"] === true),
        };
        this.target.facing = vector.add(vector.sub(camera.mouse_v, camera.world2screen(this.position) ?? this.target.position), this.position);
        const move_x = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
        const move_y = (controls.down ? 1 : 0) - (controls.up ? 1 : 0);
        const move_v = vector.normalise(vector.create(move_x, move_y));
        if (this.body) {
            this.push_by(vector.mult(move_v, this.options.move_speed ?? config.physics.player_speed));
            this.update_angle();
        }
        if (controls.toggle_autoshoot) {
            this.autoshoot = !this.autoshoot;
        }
        if (controls.shoot || this.autoshoot) {
            this.shoot();
        }
    }
    camera_position() {
        let v = vector.sub(this.target.facing, camera.world2screen(this.position) ?? this.target.position);
        v = vector.normalise(v, vector.length(v) / 30 * camera.scale);
        return vector.add(player.position, v);
    }
    camera_scale() {
        const v = camera.halfscreen;
        return Math.sqrt(v.x * v.y) / 500;
    }
}
;
export const player = new Player();
