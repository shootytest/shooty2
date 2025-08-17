import { vector } from "../util/vector";
export class Particle {
    static particles = [];
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
    vertices = [];
    offset = vector.create();
    velocity = vector.create();
    acceleration = vector.create();
    jerk = vector.create();
    time = -1;
    constructor() {
    }
    tick() {
    }
    draw() {
    }
    remove() {
    }
}
;
