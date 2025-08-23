import { config } from "../util/config.js";
import type { vector } from "../util/vector.js";
import { clone_object } from "./make.js";



export interface save_type {
  version: string;
  player: player_save;
  switches: { [key: string]: number };
  currencies: { [key: string]: number };
};

export interface player_save {
  position?: vector;
  fov_mult?: number;
  shoots?: string[];
};


export const save = {

  save: {
    version: config.game.version,
    player: {},
    switches: {},
    currencies: {},
  } as save_type,

  saves: [] as save_type[],

  get_switch: (id: string): number => {
    return save.save.switches[id] ?? -1;
  },

  check_switch: (id: string): boolean => {
    return save.save.switches[id] > 0;
  },

  set_switch: (id: string, number = 1) => {
    save.save.switches[id] = number;
    save.changed(true);
  },

  get_currency: (name: string) => {
    return save.save.currencies[name] ?? 0;
  },

  add_currency: (name: string, number = 1) => {
    save.save.currencies[name] += number;
    save.changed(true);
  },

  changed: (big = false) => {
    // todo autosave to slot
    if (big) console.log("saving... ", save.save);
  },

  new_save: (): save_type => {
    return {
      version: config.game.version,
      player: {},
      switches: {},
      currencies: {},
    };
  },

  save_to_slot: (slot: number) => {
    while (save.saves.length < slot) {
      save.saves.push(save.new_save());
    }
    save.saves[slot] = clone_object(save.save) as save_type;
  },

};