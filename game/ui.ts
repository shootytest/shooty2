import { mouse } from "../util/key.js";
import { player } from "./player.js";

export const ui = {

  time: 0,

  click: {
    new_fns: [() => {}, () => {}, () => {}] as (() => void)[],
    new_fns_exist: [false, false, false] as boolean[],
    new: function(fn: () => void, button: 0 | 1 | 2 = 0, overwrite = true) {
      if (mouse.down_buttons[button]) {
        if (overwrite || !ui.click.new_fns_exist[button]) {
          ui.click.new_fns[button] = fn;
          ui.click.new_fns_exist[button] = true;
        }
      }
    },
    tick: function() {
      for (let button = 0; button < 3; button++) {
        ui.click.new_fns[button]();
      }
      ui.click.new_fns_exist = [false, false, false];
    },
  },

  init: function() {

  },

  tick: function() {

  },

  draw: function() {
    ui.draw_health();
  },

  draw_health: () => {
    const health_value = player.health?.value;
    const health_ratio = player.health?.display_ratio;
    
  },

};