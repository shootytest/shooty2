import { math } from "./math.js";
import { vector, vector3 } from "./vector.js";
import { mouse } from "./key.js";

export const ZEPSILON = 0.0001;

export const camera = {
  position: vector.create(0, 0),
  position_target: vector.create(0, 0),
  z: 1, // camera_z
  look_z: 0, // which z is the "normal" z (on grid)
  scale: 1,
  scale_target: 1,
  scaling_point: vector.create(0, 0),
  get x() {
    return this.position.x;
  },
  get y() {
    return this.position.y;
  },
  get mouse_v() {
    return vector.create(mouse.x, mouse.y);
  },
  get halfscreen() {
    return vector.create(window.innerWidth / 2, window.innerHeight / 2);
  },
  get sqrtscale() {
    return Math.sqrt(this.scale);
  },
  // stuff
  get halfworld() {
    return vector.mult(this.halfscreen, 1 / this.scale);
  },
  get location() { // zero position on screen in world coords
    return vector.add(this.position, this.halfworld);
  },
  set location(loc) {
    this.position = vector.sub(loc, this.halfworld);
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
  world3screen: function(world_vector: vector3, scale?: number): vector {
    if (scale == undefined) scale = this.scale;
    const sv = this.world2screen(vector.create3(world_vector), scale);
    let z = this.zscale(world_vector.z);
    return vector.add(this.halfscreen, vector.mult(vector.sub(sv, this.halfscreen), z));
  },
  zscale: function(z: number): number {
    let z_ = (this.z / this.scale - this.look_z) / (this.z / this.scale - z + ZEPSILON);
    if (z_ <= 0) z = 1 / ZEPSILON;
    return z_;
  },
  init: function() {
    // initial camera properties here?
    this.location = vector.create();
  },
  tick: function() {
    // lerp
    this.position = vector.lerp(this.position, this.position_target, 0.1);
    this.scale_tick(this.scaling_point, math.lerp(this.scale, this.scale_target, 0.1));
  },
  position_jump: function() {
    this.position = this.position_target;
  },
  scale_jump: function() {
    this.scale = this.scale_target;
  },
  move_by_mouse: function(mouse_button = 0) {
    this.move_by(vector.mult(mouse.drag_change[mouse_button], -1 / this.scale_target));
  },
  move_by: function(move_by_vector: vector) {
    this.position_target = vector.add(this.position_target, move_by_vector);
    this.position_jump();
  },
  scale_tick: function(screen_position: vector, newscale: number) {
    // copied from myself 1.5 years ago, which is copied from myself 2 years ago
    const world_point = vector.add(vector.mult(screen_position, 1 / this.scale), this.position);
    this.scale = newscale;
    this.position_target = vector.sub(world_point, vector.mult(screen_position, 1 / this.scale));
    this.position_jump();
  },
  scale_by: function(screen_position: vector, scale: number) {
    this.scaling_point = screen_position;
    this.scale_target *= scale;
    this.scale_target = math.bound(this.scale_target, 0.1, 10);
  },
  scale_to: function(screen_position: vector, scale: number) {
    this.scaling_point = screen_position;
    this.scale_target = scale;
    this.scale_target = math.bound(this.scale_target, 0.1, 10);
  },
};