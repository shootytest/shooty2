import { config } from "../util/config.js";
import type { vector } from "../util/vector.js";
import { clone_object } from "./make.js";
import { player } from "./player.js";



export interface save_type {
  version: string;
  player: player_save;
  switches: { [key: string]: number };
  currencies: { [key: string]: number };
};

export interface player_save {
  position?: vector;
  health?: number;
  ability?: number;
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
  current_slot: 0,

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
    save.save_to_slot(save.current_slot);
    save.save_to_storage();
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
    while (save.saves.length <= slot) {
      save.saves.push(save.new_save());
    }
    save.saves[slot] = clone_object(save.save) as save_type;
  },

  save_to_storage: () => {
    const raw = zipson.stringify({
      saves: save.saves,
      slot: save.current_slot,
    });
    localStorage.setItem("saves", raw);
  },

  load_from_slot: (slot?: number) => {
    if (slot === undefined) slot = save.current_slot;
    const s = save.saves[slot];
    player.load(s.player);
    save.save = s;
    save.current_slot = slot;
    console.log("loaded game from slot " + slot + "!");
  },

  load_from_storage: () => {
    const raw = localStorage.getItem("saves");
    if (!raw) {
      console.log("new game loaded!");
      return;
    }
    const o = zipson.parse(raw);
    save.saves = o.saves;
    save.current_slot = o.slot;
    save.load_from_slot();
  },

};