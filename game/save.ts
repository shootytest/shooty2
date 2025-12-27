import { config } from "../util/config.js";
import { math } from "../util/math.js";
import { vector, vector3 } from "../util/vector.js";
import { clone_object } from "./make.js";
import { player } from "./player.js";
import { Thing } from "./thing.js";



export interface save_type {
  version: string;
  player: player_save;
  map: { [key: string]: number };
  // todo markers:
  shapey: { [key: string]: shapey_save };
  switches: { [key: string]: number };
  currencies: { [key: string]: number };
  achievements: { [key: string]: achievement_save };
};

export interface shapey_save {
  n: number; // amount
  on?: boolean; // activated
  v?: vector; // position
  a?: number; // angle
};

export interface achievement_save {
  n: number; // level
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

export interface settings_save {
  graphics: [ number, number, boolean, boolean, number ];
};



export const save = {

  save: {
    version: config.game.version,
    player: {},
    map: {},
    shapey: {},
    switches: {},
    currencies: {},
    achievements: {},
  } as save_type,
  switch_times: {} as { [key: string]: number },

  saves: [] as save_type[],
  current_slot: 0,

  get_switch: (id: string): number => {
    return save.save.switches[id] ?? -1;
  },

  check_switch: (id: string): boolean => {
    return save.get_switch(id) > 0;
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

  get_map: (id: string): number => {
    return save.save.map[id] ?? -1;
  },

  check_map: (id: string): boolean => {
    return save.get_map(id) > 0;
  },

  visit_map: (id: string) => {
    if (!save.save.map[id]) save.save.map[id] = 0;
    save.save.map[id]++;
    save.changed(true);
  },

  get_shapey: (id: string): number => {
    return save.save.shapey[id]?.n ?? -1;
  },

  is_shapey_on: (id: string): number => {
    const o = save.save.shapey[id];
    return o?.on ? o.n : 0;
  },

  check_shapey: (id: string): boolean => {
    return save.get_shapey(id) > 0;
  },

  check_all_shapey: (): { [key: string]: number } => {
    const result: { [key: string]: number } = {};
    for (const id in save.save.shapey) {
      const n = save.get_shapey(id);
      if (n > 0) result[id] = n;
    }
    for (const id of save.special_shapey_ids) {
      if (result[id]) continue;
      result[id] = 1;
    }
    return result;
  },

  add_shapey: (id: string) => {
    if (!save.save.shapey[id]) save.save.shapey[id] = { n: 0 };
    save.save.shapey[id].n++;
    save.changed(true);
  },

  remove_shapey: (id: string) => { // debuge
    delete save.save.shapey[id];
    save.changed(true);
  },

  save_one_shapey: (thing: Thing) => {
    const id = thing.object.shapey_id as string;
    if (!save.save.shapey[id]) save.save.shapey[id] = { n: 0 };
    const o = save.save.shapey[id];
    o.v = vector.create(Math.floor(thing.position.x), Math.floor(thing.position.y));
    o.a = +(math.mod_angle(thing.angle).toFixed(3));
    save.changed(true);
  },

  special_shapey_ids: ["area_base", "friendly"],
  save_all_shapey: () => {
    for (const t of player.temp_things) {
      const id = t.object.shapey_id as string;
      if (!save.save.shapey[id] && save.special_shapey_ids.includes(id)) {
        save.save.shapey[id] = { n: 1 };
      }
      if (save.save.shapey[id]) {
        const o = save.save.shapey[id];
        o.v = vector.create(Math.floor(t.x), Math.floor(t.y));
        o.a = +(math.mod_angle(t.angle).toFixed(3));
        o.on = Boolean(t.object.inside);
      }
    }
    save.changed(true);
  },

  get_currency: (name: string): number => {
    return save.save.currencies[name] ?? 0;
  },

  add_currency: (name: string, number = 1) => {
    save.save.currencies[name] = (save.save.currencies[name] ?? 0) + number;
    player.stats.currencies_total[name] = (player.stats.currencies_total[name] ?? 0) + number;
    save.changed(true);
  },

  // todo autosave to slot
  changed: (not_autosave = false, force = false) => {
    if (player.enemy_can_see && !force) {
      // player.enemy_can_see = false; // hmmm
      return false;
    }
    // if (not_autosave) console.log("saving... ", save.save);
    if (!save.save.map) save.save.map = {};
    if (!save.save.achievements) save.save.achievements = {};
    if (!save.save.shapey) save.save.shapey = {}; // todo remove
    save.save_to_slot(save.current_slot);
    save.save_to_storage();
    return true;
  },

  new_save: (): save_type => {
    return {
      version: config.game.version,
      player: {},
      map: {},
      shapey: {},
      switches: {},
      currencies: {},
      achievements: {},
    };
  },

  save_to_slot: (slot: number) => {
    while (save.saves.length <= slot) {
      save.saves.push(save.new_save());
    }
    save.saves[slot] = clone_object(save.save) as save_type; // todo is clone really needed here?
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

  save_settings: () => {
    const o: settings_save = {
      graphics: [
        Math.round(config.graphics.fps),
        math.round_to(config.graphics.resolution_mult, 0.1),
        config.graphics.debug_display,
        config.graphics.fullscreen,
        Math.round(config.graphics.particle_setting),
      ],
    };
    localStorage.setItem("settings", zipson.stringify(o));
  },

  load_settings: () => {
    const raw = localStorage.getItem("settings");
    if (!raw) {
      save.save_settings();
      return;
    }
    const o = zipson.parse(raw) as settings_save;
    config.graphics.fps = o.graphics[0] ?? 60;
    config.graphics.resolution_mult = o.graphics[1];
    config.graphics.debug_display = o.graphics[2] ?? false;
    config.graphics.fullscreen = o.graphics[3] ?? false;
    config.graphics.particle_setting = o.graphics[4] ?? 2;
  },

};