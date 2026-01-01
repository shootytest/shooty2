import { maketype_wave } from "../game/make.js";



export const make_waves = {

  ["streets side room 1 test"]: {
    rounds: [{
      enemies: [
        {
          type: "enemy_streets_camera_small",
          repeat: 3,
          repeat_delay: 1,
          spawner: 0,
        },
      ],
    }, {
      enemies: [
        {
          type: "enemy_streets_camera_small",
          repeat: 3,
          repeat_delay: 1,
          spawner: 0,
        },
        {
          type: "enemy_streets_rocky_small",
          repeat: 2,
          repeat_delay: 1,
          spawner: 1,
        },
      ],
    }],
  },
  ["streets room 7 waves"]: {
    global_delay: 1.2,
    global_make: { enemy_detect_range: 1000, },
    rounds: [{
      enemies: [
        { type: "enemy_streets_easy_1", spawner: [0, 1, 2], },
      ],
    }, {
      enemies: [
        { type: "enemy_streets_ram_1", spawner: [0, 1, 2], },
      ],
    }, {
      enemies: [
        { type: "enemy_streets_ram_1", spawner: [0, 1, 2], },
        { type: "enemy_streets_ram_1", spawner: [0, 1, 2], delay: 1, },
      ],
    }, {
      delay: 0.3,
      enemies: [
        { type: "enemy_streets_easy_1", spawner: 0, },
        { type: "enemy_streets_ram_1", spawner: [1, 2], },
      ],
    }, {
      enemies: [
        { type: "enemy_streets_rocky", },
      ],
    }],
  },

} as { [key: string]: maketype_wave };