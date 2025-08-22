import { config } from "../util/config.js";
import { clone_object } from "./make.js";



export interface save_type {
  version: string;
  switches: { [key: string]: number };
  currencies: { [key: string]: number };
};


export const save = {

  save: {
    version: config.game.version,
    switches: {},
    currencies: {},
  } as save_type,

  saves: [] as save_type[],

  check_switch: (id: string) => {
    return save.save.switches[id] >= 0;
  },

  activate_switch: (id: string) => {
    save.save.switches[id] = 1;
  },

  get_currency: (name: string) => {
    return save.save.currencies[name] ?? 0;
  },

  new_save: (): save_type => {
    return {
      version: config.game.version,
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