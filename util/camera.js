import { math } from "./math.js";
import { vector, vector3 } from "./vector.js";
import { mouse } from "./key.js";
import { canvas } from "./canvas.js";
import { config } from "./config.js";
export const ZEPSILON = 0.0001;
export const camera = {
    position: vector.create(0, 0),
    position_target: vector.create(0, 0),
    z: 1,
    look_z: 0,
    time: 0,
    scale: 1,
    scale_target: 1,
    scaling_point: vector.create(0, 0),
    lerp_factor: config.graphics.camera_smoothness,
    get x() {
        return this.position.x;
    },
    get y() {
        return this.position.y;
    },
    get mouse_v() {
        return mouse.position;
    },
    get halfscreen() {
        return vector.create(canvas.width / 2, canvas.height / 2);
    },
    get sqrtscale() {
        return Math.sqrt(this.scale);
    },
    // stuff
    get halfworld() {
        return vector.mult(this.halfscreen, 1 / this.scale);
    },
    get location() {
        return vector.add(this.position, this.halfworld);
    },
    get location3() {
        return vector3.create2(camera.location, camera.z);
    },
    set location(loc) {
        this.position = vector.sub(loc, this.halfworld);
    },
    set location_target(loc) {
        this.position_target = vector.sub(loc, this.halfworld);
    },
    screen2world: function (screen_vector, scale) {
        if (scale == undefined)
            scale = this.scale;
        return vector.add(vector.mult(screen_vector, 1 / scale), this.position);
    },
    world2screen: function (world_vector, scale) {
        if (scale == undefined)
            scale = this.scale;
        return vector.mult(vector.sub(world_vector, this.position), scale);
    },
    /*screen3world: function(screen_vector: vector2, z: number, scale?: number): vector3 {
      if (scale == undefined) scale = this.scale;
      // todo
    },*/
    world3screen: function (world_vector, world_center, scale) {
        const centre = world_center ? camera.world2screen(world_center) : this.halfscreen;
        if (scale == undefined)
            scale = this.scale;
        const sv = this.world2screen(vector.create3(world_vector), scale);
        let z = this.zscale(world_vector.z);
        return vector.add(centre, vector.mult(vector.sub(sv, centre), z));
    },
    zscale: function (z) {
        let z_ = (this.z - this.look_z) / (this.z - z + ZEPSILON); // replaced this.z / this.scale
        if (z_ <= 0)
            z = 1 / ZEPSILON;
        return z_;
    },
    zscale_inverse: function (z) {
        let z_ = (this.z - z) / (this.z - this.look_z + ZEPSILON); // replaced this.z / this.scale
        if (z_ <= 0)
            z = 1 / ZEPSILON;
        return z_;
    },
    init: function () {
        // initial camera properties here?
        this.location = vector.create();
    },
    tick: function (dt) {
        this.time += dt;
        // lerp
        this.position = vector.lerp(this.position, this.position_target, this.lerp_factor);
        if (Math.abs(this.scale - this.scale_target) > math.epsilon) {
            this.scale = 1 / math.lerp(1 / this.scale, 1 / this.scale_target, this.lerp_factor);
        }
        if (Math.abs(this.lerp_factor - config.graphics.camera_smoothness) < math.epsilon || this.lerp_factor === 1)
            this.lerp_factor = config.graphics.camera_smoothness;
    },
    position_jump: function () {
        this.position = this.position_target;
    },
    scale_jump: function () {
        this.scale = this.scale_target;
    },
    move_by_mouse: function (mouse_button = 0) {
        this.move_by(vector.mult(mouse.drag_change[mouse_button], -1 / this.scale_target));
        this.lerp_factor = 1;
    },
    move_by: function (move_by_vector) {
        this.position_target = vector.add(this.position_target, move_by_vector);
    },
    scale_by: function (screen_position, scale) {
        this.scaling_point = screen_position;
        this.scale_target = math.bound(this.scale_target * scale, 0.1, 10);
        this.scale_adjust(screen_position);
    },
    scale_to: function (screen_position, scale) {
        this.scaling_point = screen_position;
        this.scale_target = math.bound(scale, 0.1, 10);
        this.scale_adjust(screen_position);
    },
    scale_adjust: function (screen_position) {
        this.position_target = vector.sub(vector.add(this.position, vector.mult(screen_position, 1 / this.scale)), vector.mult(screen_position, 1 / this.scale_target));
    },
    scale_adjust2: function (screen_position) {
        this.position_target = vector.sub(vector.add(this.position_target, vector.mult(screen_position, 1 / this.scale)), vector.mult(screen_position, 1 / this.scale_target));
    },
    jump_to: function (world_position, scale, screen_position = vector.create(canvas.width / 2, canvas.height / 2)) {
        this.scale_target = scale;
        this.scale_target = math.bound(this.scale_target, 0.1, 10);
        this.position_target = vector.sub(world_position, vector.mult(screen_position, 1 / this.scale_target));
    },
    /*
    scale_tick: function(screen_position: vector, newscale: number) {
      // copied from myself 1.5 years ago, which is copied from myself 2 years ago
      // 2 years later update: i don't need this! see scale_adjust above!
      const world_point = vector.add(vector.mult(screen_position, 1 / this.scale), this.position);
      this.scale = newscale;
      this.position_target = vector.sub(world_point, vector.mult(screen_position, 1 / this.scale));
      this.position_jump();
    },
    */
};
