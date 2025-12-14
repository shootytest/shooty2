import { make, make_shapes } from "../game/make.js";
import { vector } from "../util/vector.js";



export default function() {

make.inventory = {
  seethrough: true,
  movable: true,
  draggable: true,
  keep_bullets: true,
  friction: 0.1,
  team: -1,
  behaviour: {
    idle: {
      face_mode: "spin",
      move_mode: "direct",
      move_speed: 0.1,
      spin_speed: 1,
    }
  },
};

make.inventory_coin_1 = {
  make_parent: ["inventory"],
  style: "collect_coin",
};
make_shapes.inventory_coin_1 = [{
  type: "circle",
  radius: 5,
}];

make.inventory_coin_10 = {
  make_parent: ["inventory"],
  style: "collect_coin",
};
make_shapes.inventory_coin_10 = [{
  type: "circle",
  radius: 8,
  style_: {
    width: 0.6,
    fill_opacity: 0.2,
  },
}];

make.inventory_coin_100 = {
  make_parent: ["inventory"],
  style: "collect_coin",
};
make_shapes.inventory_coin_100 = [{
  type: "circle",
  radius: 13,
  style_: {
    width: 0.8,
    fill_opacity: 0.3,
  },
}];

make.inventory_coin_1000 = {
  make_parent: ["inventory"],
  style: "collect_coin",
};
make_shapes.inventory_coin_1000 = [{
  type: "circle",
  radius: 21,
  style_: {
    width: 1,
    fill_opacity: 0.4,
  },
}];

make.inventory_egg_1 = {
  make_parent: ["inventory"],
  style: "train",
  style_: {
    width: 0.8,
  },
};
make_shapes.inventory_egg_1 = [{
  type: "circle",
  radius: 15,
}, {
  type: "circle",
  radius: 1,
}];

make.inventory_egg_10 = {
  make_parent: ["inventory"],
  style: "train",
  style_: {
    width: 1.2,
  },
};
make_shapes.inventory_egg_10 = [{
  type: "circle",
  radius: 28,
}, {
  type: "circle",
  radius: 1,
}];





// @shapey

make.shapey = {
  seethrough: true,
  shapey: true,
  movable: true,
  draggable: true,
  keep_bullets: true,
  friction: 0.1,
  force_layer: 1,
};

make.shapey_area = {
  seethrough: true,
  movable: true,
  draggable: true,
  density: 999999999,
  keep_bullets: true,
  friction: 1,
};

make.shapey_area_base_1 = {
  make_parent: ["shapey_area"],
  style: "wall_filled",
};
make_shapes.shapey_area_base_1 = [{
  type: "circle",
  radius: 25,
  force_layer: 1,
}, {
  type: "circle",
  radius: 100,
  offset: vector.create(0, 74),
  shapey_area: true,
  style: "shapey_base",
}];


make.shapey_friendly_1 = {
  make_parent: ["shapey"],
  style: "wall_filled",
};
make_shapes.shapey_friendly_1 = [{
  type: "circle",
  radius: 15,
  style_: {
    width: 0.6,
  },
}, {
  type: "arc",
  radius: 7,
  arc_start: -1,
  arc_end: 1,
  style_: {
    fill_opacity: 0,
    width: 0.6,
  },
}, {
  type: "circle",
  radius: 1,
  offset: vector.createpolar_deg(135, 6),
  style_: {
    width: 0.5,
  },
}, {
  type: "circle",
  radius: 1,
  offset: vector.createpolar_deg(225, 6),
  style_: {
    width: 0.5,
  },
}];


make.shapey_triangle_speed_1 = {
  make_parent: ["shapey"],
  style: "collect_streets",
};
make_shapes.shapey_triangle_speed_1 = [{
  type: "polygon",
  sides: 3,
  radius: 35,
}, {
  type: "polygon",
  sides: 3,
  radius: 10,
  offset: vector.create(12, 0),
  style_: { width: 0.5, fill_opacity: 0, },
}, {
  type: "line",
  v1: vector.create(3, 0),
  v2: vector.create(-12, 0),
  style_: { width: 0.5, },
}, {
  type: "line",
  v1: vector.create(3, 4),
  v2: vector.create(-6, 4),
  style_: { width: 0.5, },
}, {
  type: "line",
  v1: vector.create(3, -4),
  v2: vector.create(-9, -4),
  style_: { width: 0.5, },
}];

};