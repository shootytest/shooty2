import { config } from "../util/config.js";
import type { vector3, vector3_ } from "../util/vector.js";
import { clone_object } from "./make.js";
import { player } from "./player.js";
import { Thing } from "./thing.js";



export interface save_type {
  version: string;
  player: player_save;
  switches: { [key: string]: number };
  currencies: { [key: string]: number };
};

export interface player_save {
  position?: vector3;
  room_id?: string;
  health?: number;
  ability?: number;
  fov_mult?: number;
  xp?: number;
  checkpoint?: vector3;
  checkpoint_room?: string;
  current_gun?: string;
  guns?: string[];
  stats?: player_stats;
};

export interface player_stats {
  game_time: number,
  total_time: number,
  deaths: number;
  pixels_walked: number;
  clicks: [number, number, number];
  enemies_killed: { [key: string]: number }; // todo
  bullets_shot: { [key: string]: number };
  currencies_total: { [key: string]: number };
};


export const save = {

  save: {
    version: config.game.version,
    player: {},
    switches: {},
    currencies: {},
  } as save_type,
  switch_times: {} as { [key: string]: number },

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

  get_switch_time: (id: string) => {
    const time = save.switch_times[id] ?? -1;
    return time === -1 ? -1 : (Thing.time - time);
  },

  set_switch_time: (id: string, time = -1) => {
    save.switch_times[id] = time;
  },

  get_currency: (name: string) => {
    return save.save.currencies[name] ?? 0;
  },

  add_currency: (name: string, number = 1) => {
    save.save.currencies[name] = (save.save.currencies[name] ?? 0) + number;
    player.stats.currencies_total[name] = (player.stats.currencies_total[name] ?? 0) + number;
    save.changed(true);
  },

  changed: (not_autosave = false, force = false) => {
    // todo autosave to slot
    if (player.enemy_can_see && !force) {
      // player.enemy_can_see = false; // hmmm
      return false;
    }
    // if (not_autosave) console.log("saving... ", save.save);
    save.save_to_slot(save.current_slot);
    save.save_to_storage();
    return true;
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
    save.save = s;
    save.current_slot = slot;
    player.load(s.player);
    console.log("loaded game from slot " + slot + "!");
    // console.log(s);
  },

  load_from_storage: () => {
    const raw = localStorage.getItem("saves");
    if (!raw) {
      console.log("new game loaded!");
      player.load({});
      return;
    }
    const o = zipson.parse(raw);
    save.saves = o.saves;
    save.current_slot = o.slot;
    save.load_from_slot();
  },

};