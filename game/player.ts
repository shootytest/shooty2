import { Body } from "../matter.js";
import { camera } from "../util/camera.js";
import { color } from "../util/color.js";
import { config } from "../util/config.js";
import { keys } from "../util/key.js";
import { vector, vector3 } from "../util/vector.js";
import { Shape } from "./shape.js";
import { Thing } from "./thing.js";

export class Player extends Thing {

  constructor() {
    super();
    
    const s = Shape.circle(this, 30);
    s.thing = this;
    s.style.fill = color.neon_blue + "99";
    this.shapes.push(s);

    this.create_id("generic player #0"); // hmmm

    this.is_player = true;
    this.position = vector3.create();
  }

  create_player() {
    this.create_body({
      frictionAir: 0.2,
      restitution: 0.1,
    });
  }

  tick() {
    super.tick();
    const controls = {
      up: keys["ArrowUp"] === true || (keys["KeyW"] === true),
      down: keys["ArrowDown"] === true || (keys["KeyS"] === true),
      left: keys["ArrowLeft"] === true || (keys["KeyA"] === true),
      right: keys["ArrowRight"] === true || (keys["KeyD"] === true),
      shoot: keys["Mouse"] === true || (keys["Space"] === true),
      rshoot: keys["MouseRight"] === true || ((keys["ShiftLeft"] === true || keys["ShiftRight"] === true)),
      facingx: Math.floor(camera.mouse_v.x),
      facingy: Math.floor(camera.mouse_v.y),
      exit: (keys["KeyP"] === true),
    };
    this.target.facing = vector.clone(camera.mouse_v);
    const move_x = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    const move_y = (controls.down ? 1 : 0) - (controls.up ? 1 : 0);
    const move_v = vector.normalise(vector.create(move_x, move_y));
    if (this.body) {
      Body.applyForce(this.body, this.position, vector.mult(move_v, 10 * this.body.mass * config.physics.force_factor));
    }
  }

  camera_scale() {
    const v = camera.halfscreen;
    return Math.sqrt(v.x * v.y) / 500;
  }

};

export const player: Player = new Player();
