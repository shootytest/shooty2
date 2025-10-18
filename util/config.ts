const SECONDS = 10000; // how much is 1 second?

export const config = {
  seconds: SECONDS,
  timescale: 1,
  game: {
    version: "0.1.0",
    invincibility_time: 1.5 * SECONDS,
    autosave_interval: 1 * SECONDS, // second
    level_1_xp: 1000,
  },
  physics: {
    wall_width: 8,
    player_speed: 10,
    force_factor: 0.0005,
    recoil_factor: 10,
    velocity_shoot_boost: 0.3,
  },
  graphics: {
    shape_cull_padding: 100, // 16 should be ok, 100 is just to be safe
    linewidth_mult: 8,
    shadowblur: 75,
    xp_display_smoothness: 0.08,
    xp_display_time: 2 * SECONDS,
    health_display_smoothness: 0.07,
    health_rotate_speed: 0.8,
    blink_time: 0.15 * SECONDS,
    camera_smoothness: 0.2,
    camera_target_smoothness: 0.1,
    camera_mouse_look_factor: 0.075,
    pause_opacity: 0.25,
  },
};