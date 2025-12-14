import { bullet_mod, make_shoot } from "../game/make.js";
import { vector } from "../util/vector.js";

export const make_shoot_mods: { [key: string]: bullet_mod } = {

  shapey_triangle_speed_1: {
    stats: {
      make: "bullet_triangle",
      speed: 1.5,
      time: 1 / 1.25,
    },
    period: 6,
  },
  shapey_triangle_speed_2: {
    stats: {
      make: "bullet_triangle",
      speed: 1.6,
      time: 1 / 1.3,
    },
    period: 5,
  },
  shapey_triangle_speed_3: {
    stats: {
      make: "bullet_triangle",
      speed: 1.7,
      time: 1 / 1.35,
    },
    period: 4,
  },
  shapey_triangle_speed_4: {
    stats: {
      make: "bullet_triangle",
      speed: 1.8,
      time: 1 / 1.4,
    },
    period: 3,
  },

};

for (const [k, v] of Object.entries(make_shoot_mods)) {
  v.id = k;
}

export default function() {

make_shoot.player = {
  make: "bullet",
  size: 9,
  reload: 0.5,
  speed: 8,
  spread_angle: 0.03,
  friction: 0.0025,
  restitution: 1,
  recoil: 1,
  damage: 100,
  time: 0.8,
};

make_shoot.half_reload = {
  reload: 0.5,
};

make_shoot.player_basic = {
  parent: ["player"],
};

make_shoot.collect_coin = {
  speed: 2.5,
  spread_angle: 0.03,
  spread_speed: 0.1,
  friction: 0.06,
};

make_shoot.enemy = {
  make: "bullet",
  size: 10,
  reload: 0.42,
  speed: 8,
  friction: 0,
  restitution: 1,
  recoil: 1,
  damage: 100,
  time: 1,
};

make_shoot.enemy_easy = {
  parent: ["enemy"],
  size: 11,
  spread_angle: 0.05,
  reload: 1.1,
  speed: 4,
  time: 2,
};

make_shoot.enemy_easy_static = {
  parent: ["enemy"],
  size: 12,
  spread_angle: 0.02,
  reload: 0.6,
  speed: 5,
  time: 1.5,
};

make_shoot.enemy_block = {
  parent: ["enemy"],
  size: 13,
  spread_angle: 0,
  reload: 0.05,
  speed: 10,
  time: 1.6,
  density: 999999,
  damage: 0,
};

make_shoot.enemy_4way = {
  parent: ["enemy"],
  size: 12,
  reload: 1,
  speed: 4,
  recoil: 0,
  time: 1.7,
};

make_shoot.enemy_tutorial_boss_spam = {
  parent: ["enemy"],
  size: 10,
  reload: 0.05,
  speed: 11,
  spread_angle: 0.01,
  damage: 100,
  time: 3,
  friction: 0.005,
};

make_shoot.enemy_tutorial_boss_homing = {
  parent: ["enemy"],
  size: 18,
  reload: 0.5,
  speed: 10,
  spread_angle: 0.06,
  damage: 200,
  time: 3,
  death: [{
    type: "enemy_tutorial_boss_homing",
    stats: { make: "bullet_homing_5", death: [{type: "none"}], speed: 15, friction: 0.06, time: 0.5, damage: 200, },
    repeat: 1,
    angle: 180,
    offset: vector.create(0, -10),
  }],
};

make_shoot.enemy_tutorial_boss_split = {
  parent: ["enemy"],
  make: "bullet_tutorial_boss_split",
  style: "tutorial_boss",
  size: 25,
  reload: 0.5,
  speed: 23,
  random_speed: 7,
  spread_angle: 0.05,
  damage: 200,
  time: 1.5,
  friction: 0.05,
  death: [{ type: "enemy_tutorial_boss_splitted", repeat: 14, angle_increment: 360/14, }],
};

make_shoot.enemy_tutorial_boss_splitted = {
  parent: ["enemy"],
  size: 10,
  speed: 40,
  spread_angle: 0.05,
  damage: 100,
  time: 0.45,
  friction: 0.19,
};



make_shoot.enemy_streets_easy_1 = {
  parent: ["enemy"],
  make: "bullet_triangle",
  size: 9,
  spread_angle: 0.05,
  reload: 0.9,
  speed: 6,
  time: 1.5,
};

make_shoot.enemy_streets_easy_back = {
  parent: ["enemy"],
  size: 5,
  spread_angle: 0.1,
  reload: 0.25,
  speed: 6,
  time: 0.25,
};

make_shoot.enemy_streets_easy_2 = {
  parent: ["enemy"],
  make: "bullet_triangle",
  size: 10,
  spread_angle: 0.04,
  angular_speed: 0.05,
  reload: 0.85,
  speed: 5.5,
  time: 2,
};

make_shoot.enemy_streets_turret_1 = {
  parent: ["enemy"],
  make: "bullet_triangle",
  size: 12,
  spread_angle: 0.02,
  angular_speed: 0.3,
  reload: 0.75,
  speed: 6.5,
  time: 2,
};

make_shoot.enemy_streets_turret_spam = {
  parent: ["enemy"],
  make: "bullet_triangle",
  size: 10,
  random_angular_speed: 0.2,
  reload: 0.7,
  speed: 4,
  time: 2,
};

};