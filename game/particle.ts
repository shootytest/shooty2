import { vector, vector3_ } from "../util/vector";


export class Particle {

  static particles: Particle[] = [];

  static tick_particles() {
    for (const particle of Particle.particles) {
      particle.tick();
    }
  }

  static draw_particles() {
    for (const particle of Particle.particles) {
      particle.draw();
    }
  }

  
  vertices: vector3_[] = [];
  offset: vector3_ = vector.create();
  velocity: vector3_ = vector.create();
  acceleration: vector3_ = vector.create();
  jerk: vector3_ = vector.create();
  time: number = -1;


  constructor() {

  }

  tick() {

  }

  draw() {

  }

  remove() {

  }

};