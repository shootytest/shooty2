export const make_areas = {
// todo
};
;
export const make_rooms = {
    ["default"]: {
        theme: "default",
    },
    ["home"]: {
        theme: "home",
    },
    ["home main"]: {
        theme: "home",
        always_load: true,
    },
    ["home inventory"]: {
        theme: "home",
        always_load: true,
    },
    ["home shapestore"]: {
        theme: "home",
        always_load: true,
    },
    ["station"]: {
        theme: "train",
    },
    ["station tutorial"]: {
        theme: "tutorial",
        theme_mix: "train",
        theme_mix_strength: 0.2,
    },
    ["station streets"]: {
        theme: "streets",
        theme_mix: "train",
        theme_mix_strength: 0.2,
    },
    ["station home"]: {
        theme: "home",
        theme_mix: "train",
        theme_mix_strength: 0.2,
    },
    ["tutorial room 1"]: {
        theme: "tutorial",
    },
    ["tutorial room 2"]: {
        theme: "tutorial",
    },
    ["tutorial room 3"]: {
        theme: "tutorial",
    },
    ["tutorial room 4"]: {
        theme: "tutorial",
    },
    ["tutorial room 5"]: {
        theme: "tutorial",
    },
    ["streets room 1"]: {
        theme: "streets",
    },
    ["streets room 2"]: {
        theme: "streets",
    },
    ["streets room 3"]: {
        theme: "streets",
    },
    ["streets room 3.1"]: {
        theme: "streets",
    },
    ["streets room 4"]: {
        theme: "streets",
    },
    ["streets room 5"]: {
        theme: "streets",
    },
    ["streets side room 1"]: {
        theme: "streets",
        theme_mix: "tutorial",
        theme_mix_strength: 0.2,
    },
};
export const always_loaded_rooms = [];
for (const [r_id, room] of Object.entries(make_rooms)) {
    if (room.always_load)
        always_loaded_rooms.push(r_id);
}
