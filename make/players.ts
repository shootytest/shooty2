import { make, make_shapes } from "../game/make.js";
import { vector } from "../util/vector.js";



export default function() {

// @player

make.player = {
  style: "player",
  movable: true,
  seethrough: true,
  damage: 0,
  team: 1,
  friction: 0.2,
  friction_contact: 0,
  restitution: 0.1,
  health: {
    capacity: 500,
    regen: 0,
    regen_time: 0,
  },
};
make_shapes.player = [{
  type: "circle",
  radius: 31,
}];

make_shapes.player_basic = [{
  type: "line",
  v2: vector.createpolar_deg(0, 30),
  shoot: "player_basic",
}];

make_shapes.player_friendly = [{
  type: "arc",
  radius: 15,
  arc_start: -1,
  arc_end: 1,
  style_: {
    fill_opacity: 0,
  },
}, {
  type: "circle",
  radius: 1,
  offset: vector.createpolar_deg(135, 14),
}, {
  type: "circle",
  radius: 1,
  offset: vector.createpolar_deg(225, 14),
}];

};