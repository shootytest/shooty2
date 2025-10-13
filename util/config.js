export const config = {
    game: {
        version: "0.1.0",
        invincibility_time: 90,
        autosave_interval: 60,
        level_1_xp: 1000,
    },
    physics: {
        wall_width: 3,
        player_speed: 10,
        force_factor: 0.0005,
        recoil_factor: 10,
        velocity_shoot_boost: 0.3,
    },
    graphics: {
        shape_cull_padding: 100,
        linewidth_mult: 8,
        shadowblur: 75,
        xp_display_smoothness: 0.07,
        xp_display_time: 120,
        health_display_smoothness: 0.07,
        health_rotate_speed: 0.1,
        camera_mouse_look_factor: 0.075,
        pause_opacity: 0.25,
    },
};
