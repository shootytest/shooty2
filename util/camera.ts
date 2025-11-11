import { math } from "./math.js";
import { vector, vector3 } from "./vector.js";
import { mouse } from "./key.js";
import { canvas } from "./canvas.js";
import { config } from "./config.js";

export const ZEPSILON = 0.0001;

export const camera = {
  position: vector.create(0, 0),
  position_target: vector.create(0, 0),
  z: 1, // camera_z
  look_z: 0, // which z is the "normal" z (on grid)
  time: 0,
  scale: 1,
  scale_target: 1,
  scaling_point: vector.create(0, 0),
  lerp_factor: config.graphics.camera_smoothness,
  get x(): number {
    return this.position.x;
  },
  get y(): number {
    return this.position.y;
  },
  get mouse_v(): vector {
    return mouse.position;
  },
  get halfscreen(): vector {
    return vector.create(canvas.width / 2, canvas.height / 2);
  },
  get sqrtscale(): number {
    return Math.sqrt(this.scale);
  },
  // stuff
  get halfworld(): vector {
    return vector.mult(this.halfscreen, 1 / this.scale);
  },
  get location(): vector { // zero position on screen in world coords
    return vector.add(this.position, this.halfworld);
  },
  get location3(): vector3 {
    return vector3.create2(camera.location, camera.z);
  },
  set location(loc: vector) {
    this.position = vector.sub(loc, this.halfworld);
  },
  set location_target(loc: vector) {
    this.position_target = vector.sub(loc, this.halfworld);
  },
  screen2world: function(screen_vector: vector, scale?: number): vector {
    if (scale == undefined) scale = this.scale;
    return vector.add(vector.mult(screen_vector, 1 / scale), this.position);
  },
  world2screen: function(world_vector: vector, scale?: number): vector {
    if (scale == undefined) scale = this.scale;
    return vector.mult(vector.sub(world_vector, this.position), scale);
  },
  /*screen3world: function(screen_vector: vector2, z: number, scale?: number): vector3 {
    if (scale == undefined) scale = this.scale;
    // todo
  },*/
  world3screen: function(world_vector: vector3, world_center?: vector, scale?: number): vector {
    const centre = world_center ? camera.world2screen(world_center) : this.halfscreen;
    const sv = this.world2screen(world_vector, scale);
    return vector.add(centre, vector.mult(vector.sub(sv, centre), this.zscale(world_vector.z)));
  },
  zscale: function(z: number): number {
    let z_ = (this.z - this.look_z) / (this.z - z + ZEPSILON); // replaced this.z / this.scale
    if (z_ <= 0) z_ = 1 / ZEPSILON;
    return z_;
  },
  zscale_inverse: function(z: number): number {
    let z_ = (this.z - z) / (this.z - this.look_z + ZEPSILON); // replaced this.z / this.scale
    if (z_ <= 0) z_ = 1 / ZEPSILON;
    return z_;
  },
  init: function() {
    // initial camera properties here?
    this.location = vector.create();
  },
  tick: function(dt: number) {
    this.time += dt;
    // lerp
    this.position = vector.lerp(this.position, this.position_target, this.lerp_factor);
    if (!math.equal(this.scale, this.scale_target)) {
      this.scale = 1 / math.lerp(1 / this.scale, 1 / this.scale_target, this.lerp_factor);
    }
    if (math.equal(this.lerp_factor, config.graphics.camera_smoothness) || this.lerp_factor === 1) this.lerp_factor = config.graphics.camera_smoothness;
  },
  position_jump: function() {
    this.position = this.position_target;
  },
  scale_jump: function() {
    this.scale = this.scale_target;
  },
  move_by_mouse: function(mouse_button = 0) {
    this.move_by(vector.mult(mouse.drag_change[mouse_button], -1 / this.scale_target));
    this.lerp_factor = 1;
  },
  move_by: function(move_by_vector: vector) {
    this.position_target = vector.add(this.position_target, move_by_vector);
  },
  scale_by: function(screen_position: vector, scale: number) {
    this.scaling_point = screen_position;
    this.scale_target = math.bound(this.scale_target * scale, 0.1, 10);
    this.scale_adjust(screen_position);
  },
  scale_to: function(screen_position: vector, scale: number) {
    this.scaling_point = screen_position;
    this.scale_target = math.bound(scale, 0.1, 10);
    this.scale_adjust(screen_position);
  },
  scale_adjust: function(screen_position: vector) {
    this.position_target = vector.sub(vector.add(this.position, vector.mult(screen_position, 1 / this.scale)), vector.mult(screen_position, 1 / this.scale_target));
  },
  scale_adjust2: function(screen_position: vector) {
    this.position_target = vector.sub(vector.add(this.position_target, vector.mult(screen_position, 1 / this.scale)), vector.mult(screen_position, 1 / this.scale_target));
  },
  jump_to: function(world_position: vector, scale: number, screen_position = vector.create(canvas.width / 2, canvas.height / 2)) {
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