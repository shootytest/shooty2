import { clone_object, make, maketype, override_object } from "../game/make.js";
import { vector, vector3, vector3_, AABB, AABB3 } from "./vector.js";

export interface map_shape_type {
  id: string;
  z: number;
  vertices: vector3_[];
  options: map_shape_options_type;
  // computed attributes, not part of definition
  computed?: map_shape_compute_type;
};

export interface map_shape_compute_type {
  aabb: AABB;
  aabb3: AABB3;
  mean: vector3;
  vertices: vector3[];
  screen_vertices?: vector3[];
  shadow_vertices?: vector3[];
  on_screen?: boolean;
  distance2?: number;
  depth?: number;
  options?: map_shape_options_type;
  z_range?: [number, number];
};

export interface map_shape_options_type extends maketype {

  // important options
  parent?: string;
  contains?: string[]; // calculated
  make_id?: string;
  room_id?: string; // calculated

  // actual shape options
  open_loop?: boolean; // is the shape loop not closed? (e.g. this is true if the vertices are actually a list of 1d walls instead of a 2d shape)
  merge?: boolean; // merge shape with its parent? (use the same thing object)

  // sensor options
  sensor_fov_mult?: number;
  sensor_dont_set_room?: boolean;

  // spawner options
  is_spawner?: boolean;
  spawn_enemy?: string;
  spawn_repeat?: number;
  spawn_delay?: number;
  spawn_repeat_delay?: number;
  spawn_permanent?: boolean;

  // room options
  is_room?: boolean;
  room_connections?: string[];

  // map options
  is_map?: boolean;
  map_parent?: string;
  map_hide_when?: string;

};

export interface map_icon_type {
  icon: string;
  color: string;
};

export interface map_computed_type {
  shape_map: { [key: string]: map_shape_type };
  room_map: { [key: string]: string[] };
  shape_room: { [key: string]: string };
};

export interface map_type {

  shapes: map_shape_type[];
  icons?: map_icon_type[];
  computed?: map_computed_type;

};

export interface map_vertex_type {
  // for map maker ui
  shape: map_shape_type;
  vertex: vector3;
  vertex_old: vector3_[];
  id: string;
  index: number;
  new: boolean;
};

export interface style_type {
  stroke?: string;
  fill?: string;
  health?: string;
  width?: number;
  opacity?: number;
  stroke_opacity?: number;
  fill_opacity?: number;
  health_opacity?: number;
};

export const map_serialiser = {

  initial_state: "",
  bytesize: 0,
  undo_states: [] as string[],

  compute: (map: map_type) => {

    map.computed = {
      shape_map: {},
      room_map: {},
      shape_room: {},
    };

    for (const shape of map.shapes ?? []) {
      if (shape.z == undefined) shape.z = 0;
      map.computed.shape_map[shape.id] = shape;
      map.computed.shape_room[shape.id] = "";
      // debug, this shouldn't happen normally i hope
      if (shape.options.contains?.includes(shape.id)) console.error("[map_serialiser/compute] why does '" + shape.id + "' contain itself?");
      if (shape.id === "start") delete shape.options.contains;
      if ((shape.options.contains?.length ?? -1) === 0) {
        console.error("[map_serialiser/compute] deleting empty contains list in '" + shape.id + "'");
        delete shape.options.contains;
      }
      const world_vertices = vector3.create_many(shape.vertices, shape.z);
      shape.computed = {
        aabb: vector.make_aabb(world_vertices),
        aabb3: vector3.make_aabb(world_vertices),
        mean: vector3.mean(world_vertices),
        vertices: world_vertices,
      };
      map_serialiser.compute_options(shape);
    }
    for (const shape of map.shapes ?? []) {
      if (shape.computed == undefined || shape.computed.depth) continue;
      // make room connections 2-way
      for (const c of shape.options.room_connections ?? []) {
        const s = map.computed.shape_map[c];
        if (s.options.room_connections == undefined) s.options.room_connections = [];
        if (!s.options.room_connections.includes(shape.id)) s.options.room_connections.push(shape.id);
      }
      // do parent stuff
      if ((shape.options.parent?.length ?? 0) > 0 && shape.options.parent !== "all") {
        let s = shape;
        let depth = 1;
        let room = "";
        while ((s?.computed?.depth ?? 0) === 0 && (s.options.parent?.length ?? 0) > 0 && s.options.parent !== "all" && depth < 100) {
          const parent_id = s.options.parent!;
          s = map.computed.shape_map[parent_id];
          if (s == undefined) console.error(`[map_serialiser/compute] (${shape.id}) why is '${parent_id}' not in the computed shape map?`);
          if (s.options.is_room) room = s.id;
          depth++;
        }
        if (!room && map.computed.shape_room[s.id]) room = map.computed.shape_room[s.id];
        if (map.computed.room_map[room] == undefined) map.computed.room_map[room] = [];
        map.computed.room_map[room].push(shape.id);
        map.computed.shape_room[shape.id] = room;
        shape.computed.depth = depth + (s.computed?.depth ?? 0);
      } else {
        shape.computed.depth = 1;
      }
    }
    // calculate map_parent
    for (const shape of map.shapes ?? []) {
      if (shape.options.is_map && shape.options.parent) {
        const parent_shape = map.computed?.shape_map[shape.options.parent];
        if (parent_shape?.options?.is_map) {
          shape.options.map_parent = parent_shape.options.map_parent ?? parent_shape.id;
        } else {
          delete shape.options.map_parent;
        }
      } else {
        delete shape.options.map_parent;
      }
    }
    // now sort shapes by depth
    map.shapes.sort((s1, s2) => (s1.computed?.depth ?? 0) - (s2.computed?.depth ?? 0));

    // and add room ids
    for (const shape of map.shapes) {
      const room_id = map.computed?.shape_room[shape.id] ?? "";
      shape.options.room_id = room_id;
    }

  },

  compute_options: (shape: map_shape_type) => {
    if (shape.computed == undefined) return undefined;
    const options: map_shape_options_type = {};
    const make_options = make[shape.options.make_id ?? "default"] ?? make.default;
    if (shape.options.make_id) override_object(options, make_options);
    override_object(options, shape.options);
    shape.computed.options = options;
    // console.log("[map_serializer/compute_options] calculating for " + shape.id, options.sensor);
    return options;
  },

  clone_shape: (shape: map_shape_type) => {
    return {
      id: shape.id,
      z: shape.z,
      vertices: vector3.clone_list_(shape.vertices),
      options: clone_object(shape.options),
    };
  },

  clone_style: (style: style_type): style_type => {
    return clone_object(style);
  },

  stringify_: (map: map_type): object => {
    const m: map_type = {
      shapes: [],
      icons: [],
    };
    for (const s of map.shapes ?? []) {
      if (s.options.parent === "all") delete s.options.parent;
      const o = { id: s.id, vertices: vector3.round_list(s.vertices, 1, 0.1), options: s.options } as any;
      if (s.z !== 0) o.z = s.z;
      m.shapes!.push(o);
    }
    for (const i of map.icons ?? []) {
      m.icons!.push({ icon: i.icon, color: i.color });
    }
    return m;
  },

  stringify: (map: map_type): string => {
    const result = zipson.stringify(map_serialiser.stringify_(map));
    map_serialiser.bytesize = result.length;
    return result;
  },

  parse: (raw_string: string): map_type => {
    const m = zipson.parse(raw_string);
    const map: map_type = {
      shapes: m.shapes ?? [],
      icons: m.icons ?? [],
    };
    map_serialiser.compute(map);
    return map;
  },

  save: (slot: string, map: map_type): string => {
    const raw_string = map_serialiser.stringify(map);
    localStorage.setItem("map_" + slot, raw_string);
    if (slot !== "auto") console.log("saved current map to slot \"" + slot + "\"!");
    return raw_string;
  },

  load: (slot: string): map_type => {
    const raw_string = localStorage.getItem("map_" + slot);
    if (raw_string == null || !raw_string) {
      console.error("map slot \"" + slot + "\" doesn't exist!");
      return { shapes: [] };
    } else {
      console.log("loaded current map from slot \"" + slot + "\"!");
    }
    const map = map_serialiser.parse(raw_string);
    return map;
  },

  delete: (slot: string): map_type => {
    const map = map_serialiser.load(slot);
    localStorage.removeItem("map_" + slot);
    console.log("deleted current map from slot \"" + slot + "\"!");
    return map;
  },

  special_stringify(o: any): string {
    if (typeof o !== "object") {
      return JSON.stringify(o);
    } else if (Array.isArray(o)) {
      if (o.length <= 0) return "[]";
      let s = "[";
      for (const p of o) {
        s += map_serialiser.special_stringify(p) + ",";
      }
      return s.substring(0, s.length - 1) + "]";
    } else {
      const s = Object.keys(o).map(
        key => `${key}:${map_serialiser.special_stringify(o[key])}`
      ).join(",");
      return `{${s}}`;
    }
  },

  copy: (map: map_type): void => {
    const s = `zipson.parse("${map_serialiser.stringify(map)}");`; // map_serialiser.special_stringify(map_serialiser.stringify_(map));
    navigator.clipboard.writeText(s);
  },

  save_undo_state: (raw_string: string) => {
    if (map_serialiser.undo_states.length <= 0) map_serialiser.initial_state = raw_string;
    map_serialiser.undo_states.push(raw_string);
    while (map_serialiser.undo_states.length > 10) map_serialiser.undo_states.shift();
  },

  undo: (): map_type | undefined => {
    if (map_serialiser.undo_states.length <= 1) return undefined;
    map_serialiser.undo_states.pop();
    // if (raw_string === undefined) return undefined;
    return map_serialiser.parse(map_serialiser.undo_states[map_serialiser.undo_states.length - 1]);
  },

};


// just realised it's possible to paste the zipped JSON
export const TEST_MAP: map_type = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢44u´y´¢1HW}÷¨options¨{¨style¨ß2¨contains¨|¨home main¨¨home inventory¨¨home shapestore¨÷¨room_id¨´´}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ßB¨room_connections¨|¨tutorial room 1¨÷¨is_room¨»ßA´´}}{ß1¨station¨ß3|{´x´¢1RC´y´¢1NU}÷ß4{ßC|¨station tutorial¨¨station streets¨¨tutorial room 5¨¨streets side room 1¨¨station home¨÷ß6|¨train¨ßG¨station tracks¨ßH¨station tracks particle¨¨station map train¨¨station map tracks 1¨¨station map tracks 2¨¨station map tracks 3¨¨station map tracks 4¨ßK÷ßA´´ßE»}}{ß1¨streets¨ß3|{´x´¢1f4´y´¢-D4}÷ß4{ßA´´ß6|¨streets room 1¨ßJ¨streets room 2¨¨streets room 3¨¨streets room 4¨÷}´z´£0.-84}{ß1¨tutorial¨ß3|{´x´¢-WG´y´º8}÷ß4{ß6|ßD¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨ßI÷ßA´´}}{ß1ß8ß3|{´x´¢3kk´y´¢HQ}÷ß4{ß5ß2ßA´´ßE»¨parent¨ß2ßC|ß7÷ß6|¨home inventory wall¨÷}}{ß1ß7ß3|{´x´¢3uQ´y´¢mE}÷ß4{ß5ß2ßA´´ßE»ßcß2ßC|ß8ßKß9÷ß6|¨home floor¨÷}}{ß1ß9ß3|{´x´¢4Ja´y´¢FA}÷ß4{ß5ß2ßA´´ßE»ßcß2ßC|ß7÷ß6|¨home shapestore wall¨¨home shapestore window¨÷}}{ß1ßKß3|{´x´¢3Zc´y´¢1BY}÷ß4{ßcßFßAßFßE»ßC|ßFßHß7÷ß6|¨station home wall 2¨¨station home wall 1¨¨station home floor¨÷}}{ß1ßPß3|¦´x´´y´‡¢T2¢12WºH¢13K¢mOºJºKºI—÷ß4{ßcßFßAßF¨is_map¨»¨make_id¨¨map_shape¨}}{ß1ßQß3|¦´x´´y´‡ºKºIºKºJ¢1L4ºJºLºI—÷ß4{ßcßFßAßFßk»ßlßm}}{ß1ßRß3|¦´x´´y´‡ºLºIºLºJ¢1vMºJºMºI—÷ß4{ßcßFßAßFßk»ßlßm}}{ß1ßSß3|¦´x´´y´‡ºMºIºMºJ¢29sºJºNºI—÷ß4{ßcßFßAßFßk»ßlßm}}{ß1ßOß3|¦´x´´y´‡¢Qc¢10uºO¢14w¢YgºQºRºP—÷ß4{ßcßFßAßFßk»ßlßm}}{ß1ßHß3|{´x´¢1dc´y´¢12g}÷ß4{ßcßFß6|¨station streets rock 1¨¨station streets rock 2¨¨station streets rock 3¨¨station streets sensor start¨¨station streets rock 0¨¨station streets sensor end¨¨station streets rock block¨¨station streets rock 4¨¨station streets rock 5¨¨station streets rock 6¨¨station streets rock 7¨¨station streets rock 8¨¨station streets floor 1¨¨station streets floor 1.5¨¨station streets floor 2¨¨station streets floor 2.5¨¨station streets floor 3¨¨station streets floor 3.5¨¨station streets wall 1¨¨station streets wall 2¨¨station streets wall 3¨¨station streets floor 0¨¨station streets floor 4¨¨station streets floor 5¨¨station streets floor 4.5¨¨station streets wall 5¨¨station streets wall 6¨¨station streets wall 7¨¨station streets wall 8¨¨station streets wall 9¨¨station streets wall 10¨¨station streets wall 11¨¨station streets wall 13¨¨station streets rocky 1¨¨station streets wall fake 1¨¨station streets wall 14¨¨station streets floor 4.1¨¨station streets wall 12¨¨station streets breakables 1¨¨station streets breakables 2¨¨station streets breakables 2.5¨¨station streets map shape 1¨¨station streets map shape 2¨¨station streets map shape 3¨¨station streets map shape 4¨¨station streets map shape 5¨¨station streets map shape 6¨¨station streets map shape 7¨÷ßAßFßE»ßC|ßFßUßJßGßK÷}´z´£0.-3E}{ß1ßMß3|¦´x´´y´‡ºHºI¢3U8ºIºUºJºHºJ—÷ß4{ßcßFßl¨floor_train_track¨ßAßF¨sensor_dont_set_room¨»}}{ß1ßNß3|¦´x´´y´‡ºHºIºHºJ—÷ß4{ßcßFßlß1ZßAßFß1a»}}{ß1ßGß3|{´x´¢VS´y´¢yA}÷ß4{ßcßFß6|¨station tutorial floor¨¨station tutorial sensor start¨¨station tutorial wall 1¨¨station tutorial wall 2¨¨station tutorial rock 1¨¨station tutorial rock 2¨¨station tutorial rock 3¨¨tutorial floor low¨¨station tutorial sensor end¨¨station tutorial map shape 1¨¨station tutorial map shape 2¨¨station tutorial map shape 3¨÷ßAßFßE»ßC|ßIßFßH÷}}{ß1ßUß3|{´x´¢1zO´y´¢rO}÷ß4{ßcßTßA´´ßE»ßC|ßHßV÷ß6|¨streets room 1 camera 1¨¨streets room 1 sensor start¨¨streets room 1 camera 2¨¨streets room 1 camera 0¨¨streets room 1 floor¨¨streets room 1 sensor end¨¨streets room 1 camera 3¨¨streets room 1 map shape 1¨¨streets room 1 wall 1¨¨streets room 1 wall 2¨÷}´z´Ý0}{ß1ßVß3|{´x´¢26U´y´ºR}÷ß4{ßcßTßA´´ßE»ßC|ßUßWßX÷ß6|¨streets room 2 rock 1¨¨streets room 2 sensor start 1¨¨streets room 2 floor¨¨streets room 2 checkpoint¨¨streets room 2 map shape 1¨¨streets room 2 rock 2¨¨streets room 2 rock 3¨¨streets room 2 door 1¨¨streets room 2 door 2¨¨streets room 2 door 3¨¨streets room 2 wall 1¨¨streets room 2 wall 2¨¨streets room 2 door 4¨¨streets room 2 wall 3¨¨streets room 2 camera 1¨¨streets room 2 camera 2¨¨streets room 2 sensor start 2¨¨streets room 2 sensor start 3¨¨streets room 2 camera 3¨¨streets room 2 camera 4¨÷}´z´Ý0}{ß1ßWß3|{´x´¢1tk´y´¢Po}÷ß4{ßcßTßA´´ßE»ßC|ßV÷ß6|¨streets room 3 floor¨¨streets room 3 sensor 1¨¨streets room 3 wall 1¨÷}´z´Ý0}{ß1ßXß3|{´x´¢2NQ´y´¢OM}÷ß4{ßcßTßA´´ßE»ßC|ßV÷ß6|¨streets room 4 floor¨¨streets room 4 wall 1¨÷}´z´Ý0}{ß1ßJß3|{´x´¢1wo´y´¢1C2}÷ß4{ßcßTßA´´ßE»ßC|ßHßF÷ß6|¨streets side room 1 floor¨¨streets side room 1 wall 1¨¨streets side room 1 wall 2¨¨streets side room 1 wall fake 1¨¨streets side room 1 test¨¨streets side room 1 window 1¨¨streets side room 1 map shape 1¨¨streets side room 1 map shape 2¨¨streets side room 1 map shape 3¨÷}´z´£0.-6S}{ß1ßLß3|¦´x´´y´‡ºOºP¢TRºP—{´x´ºg´y´ºP´z´£0.4q}{´x´¢Vr´y´ºP´z´Ý3}{´x´ºh´y´ºP}{´x´ºR´y´ºP}{´x´ºR´y´ºP´z´£0.84}{´x´ºO´y´ºP´z´Ý4}÷ß4{ßcßFßl¨wall_train¨ß6|¨train floor broken¨¨train wall 1¨¨train wall 2¨¨train wall 3¨¨train ceiling¨¨train sensor¨¨train door right¨¨train door right path¨¨train door left¨¨train door left path¨¨train floor¨¨train floor broken top¨¨train floor broken bottom¨¨train floor broken middle¨÷¨seethrough¨»ßAßF}}{ß1ßDß3|{´x´¢-68´y´¢-50}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨¨tutorial room 1 floor¨¨tutorial room 1 map shape 1¨¨tutorial room 1 map shape 2¨¨tutorial room 1 map shape 3¨÷ßcßYßE»ßC|ßZßbßBßa÷ßA´´}}{ß1ßZß3|{´x´¢OW´y´¢-DO}÷ß4{ßcßYß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨tutorial room 2 floor¨¨tutorial room 2 floor platform¨¨tutorial room 2 map shape 1¨¨tutorial room 2 map shape 2¨¨tutorial room 2 map shape 3¨¨tutorial room 2 map shape 4¨¨tutorial room 2 map shape 5¨¨tutorial room 2 map shape 6¨¨tutorial room 2 map shape 7¨÷ßE»ßC|ßIßDßa÷ßA´´}}{ß1ßaß3|{´x´¢-JM´y´¢-Tg}÷ß4{ßcßYß6|¨tutorial window 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨¨tutorial room 3 floor¨¨tutorial room 3 enemy 1¨¨tutorial room 3 map shape 1¨¨tutorial room 3 map shape 2¨¨tutorial room 3 map shape 3¨¨tutorial room 3 map shape 4¨¨tutorial room 3 map shape 5¨÷ßE»ßC|ßaßbßZßD÷ßA´´}}{ß1ßbß3|{´x´¢-Z0´y´¢-Gc}÷ß4{ßcßYß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨¨tutorial room 4 floor¨¨tutorial room 4 map shape 1¨÷ßE»ßC|ßaßD÷ßA´´}}{ß1ßIß3|{´x´¢9t´y´¢GK}÷ß4{ßcßYß6|¨tutorial room 5 sensor boss¨¨tutorial room 5 door start¨¨tutorial room 5 sensor boss start¨¨tutorial room 5 boss¨¨tutorial room 5 floor¨¨tutorial room 5 door end¨¨tutorial wall 15¨¨tutorial wall 16¨¨tutorial rock 23¨¨tutorial room 5 enemy¨¨tutorial rock 24¨¨tutorial rock 25¨¨tutorial rock 26¨¨tutorial rock 27¨¨tutorial room 5 switch path¨¨tutorial room 5 sensor middle¨¨tutorial room 5 sensor boss end¨¨tutorial wall 14¨¨tutorial room 5 rocky 3¨¨tutorial fake wall 5¨¨tutorial room 5 map shape 1¨¨tutorial room 5 map shape 2¨¨tutorial room 5 map shape 3¨¨tutorial room 5 map shape 4¨¨tutorial room 5 map shape 5¨¨tutorial room 5 map shape 6¨¨tutorial room 5 map shape 7¨¨tutorial room 5 map shape 8¨÷ßE»ßC|ßZßGßF÷ßA´´}}{ß1ßeß3|¦´x´´y´‡¢4S8¢9M¢4FE¢-U¢3tS¢-2Q¢3e8¢3Y¢3Te¤Eq¢3QQ¤RaºU¤gu¢3jm¤oK¢438¤pw¢4Q2¤hs¢4XIºd—÷ß4{ßcß7ßl¨floor¨ßAß7}}{ß1ßdß3|¦´x´´y´‡¢3tI¤H6¢3sK¤DE¢3oI¤AU¢3jI¤9q¢3ec¤Bm¢3cW¤Gc¢3dA¤Lc¢3hqºk¢3neºd¢3rg¤Lmº16¤H6—÷ß4{ßcß8ßl¨wall¨ßAß8¨open_loop¨»}}{ß1ßfß3|¦´x´´y´‡¢4Tu¤Eqºsºt¢4NI¤5e¢4GC¤5y¢4B2ºt¢488¤F0¢49a¤KU¢4Eu¤OC¢4M0¤Og¢4Ro¤Lcº1G¤Eq—÷ß4{ßcß9ßlß4JßAß9ß4K»}}{ß1ßgß3|¦´x´´y´‡¢4Ac¤AA¢4HA¤Cu¢4My¤CQ¢4SI¤9qºsºtº1H¤5eº1I¤5yº1Jºtº1P¤AA—÷ß4{ßcß9ßl¨wall_window¨ßAß9ß4K»}}{ß1ßjß3|¦´x´´y´‡¢3no¤uS¢3Qu¤uS¢3Pc¤yUº1V¢17M¢3p6º1Wº1X¤yU—÷ß4{ßcßKßlß4IßAßK}}{ß1ßiß3|¦´x´´y´‡¢3h2¤yUº1U¤yUº1U¢106—÷ß4{ßcßKßlß4JßAßKß4K»}}{ß1ßhß3|¦´x´´y´‡º1U¢15kº1Uº1Wº1Yº1W—÷ß4{ßcßKßlß4JßAßKß4K»}}{ß1ß1Pß3|¦´x´´y´‡¢1Viºf¢1VE¢14c¢1RMº1Wº1e¤wY¢1cA¤sC¢1aE¤xM¢1VY¤yK¢1ZG¢114—÷ß4{ßcßH¨spawn_enemy¨¨enemy_streets_bit¨¨spawn_repeat¨¤K¨is_spawner¨»ßAßH}´z´£0.-1c}{ß1ß1Qß3|{´x´¢1jG´y´¤vu´z´Ý1}{´x´¢1bM´y´¤ws}{´x´¢1co´y´¤s2}÷ß4{ßcßHß4Mß4Nß4OÍß4P»ßAßH}´z´Ý1}{ß1ß1Rß3|{´x´¢1fi´y´¢1CM´z´Ý1}{´x´¢1aO´y´¢1Cg}{´x´ºS´y´¢15a´z´Ý1}{´x´¢1bg´y´¢10k}{´x´¢1ic´y´¤zS}÷ß4{ßcßHß4Mß4Nß4OÐß4P»ßAßH}´z´Ý1}{ß1ß18ß3|¦´x´´y´‡¢1Qi¤vuº1v¢1Aa¢1RWº1wº1x¤vu—÷ß4{ßcßHßlß4IßAßH}´z´Ý5}{ß1ßzß3|¦´x´´y´‡¢1Qs¤wOº1y¢18y¢1Uk¢1Fk¢1dI¤pc—÷ß4{ßcßHßlß4IßAßH¨safe_floor¨»ß5¨wall_floor¨}´z´Ý5}{ß1ß10ß3|¦´x´´y´‡º22¤pcº20º21—{´x´º20´y´º21´z´Ý1}{´x´º22´y´¤pc´z´Ý1}÷ß4{ßcßHßlß4RßAßH}´z´Ý5}{ß1ß11ß3|¦´x´´y´‡º22¤pcº20º21¢1fOº21¢1ks¤pc—÷ß4{ßcßHßlß4IßAßHß4Q»ß5ß4R}´z´Ý1}{ß1ß12ß3|¦´x´´y´‡º24¤pcº23º21—{´x´º23´y´º21´z´£0.-4q}{´x´º24´y´¤pc´z´Ý6}÷ß4{ßcßHßlß4RßAßH}´z´Ý1}{ß1ß13ß3|¦´x´´y´‡º24¤pcº23º21¢1xI¢1DK¢1us¤ri—÷ß4{ßcßHßlß4IßAßHß4Q»ß5ß4R}´z´Ý6}{ß1ß14ß3|¦´x´´y´‡º27¤riº25º26—{´x´º25´y´º26´z´Ý2}{´x´º27´y´¤ri´z´Ý2}÷ß4{ßcßHßlß4RßAßH}´z´Ý6}{ß1ß19ß3|¦´x´´y´‡º27¤riº25º26—{´x´¢20g´y´¢1Ak´z´Ý2}{´x´¢21o´y´º1w´z´Ý2}{´x´¢202´y´¢1DU}{´x´¢27S´y´¢1De´z´Ý2}{´x´¢23u´y´¤uw}÷ß4{ßcßHßlß4IßAßHß4Q»}´z´Ý2}{ß1ß1Nß3|{´x´º2F´y´¤uw´z´Ý2}{´x´º2D´y´º2E}÷ß4{ßcßHßl¨wall_floor_halfwidth¨ßAßH}´z´Ý2}{ß1ß1Bß3|¦´x´´y´‡º2F¤uwº2Dº2E—{´x´º2D´y´º2E´z´Ý0}{´x´º2F´y´¤uw´z´Ý0}÷ß4{ßcßHßlß4RßAßH}´z´Ý2}{ß1ß1Aß3|{´x´º2F´y´¤uw´z´Ý0}{´x´º2D´y´º2E}{´x´¢2LA´y´¢12v´z´Ý0}{´x´¢294´y´¤uw}÷ß4{ßcßHßlß4IßAßHß4Q»}´z´Ý0}{ß1ß1Sß3|¦´x´´y´‡º1vº1zº1hº26¢1ce¤rYº1v¤wO—÷ß4{ßcßHßAßHßk»ßlßmß6|¨station streets map rock 1¨¨station streets map rock 2¨÷}}{ß1ß1Tß3|¦´x´´y´‡º1hº26¢1g2º1q¢1ja¤vkº2J¤rY—÷ß4{ßcßHßAßHßk»ßlßmß6|¨station streets map rock 3¨¨station streets map rock 4¨¨station streets map line 1¨÷}}{ß1ß1Uß3|¦´x´´y´‡º2Kº1q¢1oQ¢1Au¢1wyº1wºM¤w4¢1pi¤tUº2L¤vk—÷ß4{ßcßHßAßHßk»ßlßmß6|¨station streets map rock 5¨¨station streets map rock 6¨¨station streets map rock 7¨¨station streets map line 2¨÷}}{ß1ß1Vß3|¦´x´´y´‡º2Oº1w¢26o¢1AGº2F¤uwºM¤w4—÷ß4{ßcßHßAßHßk»ßlßmß6|¨station streets map rock 8¨¨station streets map rock 9¨¨station streets map line 3¨÷}}{ß1ß1Wß3|¦´x´´y´‡º2Qº2RºN¢19mºN¤zI¢2D6º1tº2T¤zIºN¤w4º2I¤uwº2D¤um¢25q¤umº2F¤uw—÷ß4{ßcßHßAßHßk»ßlßmß6|¨station streets map line 4¨÷}}{ß1ß1Xß3|¦´x´´y´‡ºNº2Sº2T¢16Yº2T¢156ºNº2V—÷ß4{ßcßHßAßHßk»ßlßm}}{ß1ß1Yß3|¦´x´´y´‡¢1ys¢10L¢21e¤yW¢1xy¤xw—÷ß4{ßcßHßAßHßk»ßlßm¨force_layer¨Ê}}{ß1ßrß3|¦´x´´y´‡¢1Uu¢15Qº1c¢19S¢1SU¢172—÷ß4{ßcßHßl¨rock¨ßAßH}´z´Ý5}{ß1ßnß3|¦´x´´y´‡¢1ZQ¤xq¢1YSº1Z—{´x´¢1WM´y´¤yU´z´Ý5}÷ß4{ßcßHßlß4hßAßH}´z´Ý5}{ß1ßoß3|¦´x´´y´‡¢1d8º1r¢1b2º2S—{´x´¢1Ym´y´¢15G´z´Ý1}÷ß4{ßcßHßlß4hßAßH}´z´Ý1}{ß1ßpß3|¦´x´´y´‡¢1fY¤zm¢1cK¢10GºS¤xW—÷ß4{ßcßHßlß4hßAßH}´z´Ý1}{ß1ßuß3|¦´x´´y´‡¢1nI¢16s¢1im¢19cº24º2c—÷ß4{ßcßHßlß4hßAßH}´z´Ý6}{ß1ßvß3|¦´x´´y´‡¢1scº1tº2q¢10Q¢1qW¤w4—÷ß4{ßcßHßlß4hßAßH}´z´Ý6}{ß1ßwß3|¦´x´´y´‡¢1uEº2c¢1tQ¢16iº2uº2m—÷ß4{ßcßHßlß4hßAßH}´z´Ý6}{ß1ßxß3|¦´x´´y´‡¢244¢1A6¢1yuº2d¢22Iº2c—÷ß4{ßcßHßlß4hßAßH}´z´Ý2}{ß1ßyß3|{´x´¢1xw´y´¤xq}{´x´º2A´y´¤yU´z´Ý2}{´x´º32´y´º2v}÷ß4{ßcßHßlß4hßAßHß4K»}´z´Ý2}{ß1ßtß3|¦´x´´y´‡¢2Hwº2HºNº2VºN¤zI—÷ß4{ßcßHßlß4hßAßH}´z´Ý0}{ß1ß1Kß3|{´x´¢2CN´y´¢169}÷ß4{ßcßHß4M¨enemy_streets_rocky_small¨ß4P»ß4OÊßAßH¨spawn_permanent¨»}´z´Ý0}{ß1ßsß3|¦´x´´y´‡¢2Ei¤vGº38¢1CC¢1mUº39º3A¤vG—÷ß4{ßcßHßl¨sensor¨ßAßH}´z´Ý0}{ß1ßqß3|¦´x´´y´‡¢1Ty¤v5¢1UGº26º1vº39º1y¤vG—÷ß4{ßcßHßlß4kßAßH}}{ß1ß15ß3|¦´x´´y´‡º2F¤uwºM¤w4—÷ß4{ß4K»ßcßHßlß4JßAßH}´z´Ý2}{ß1ß16ß3|{´x´º2J´y´¤rY}{´x´º1v´y´¤wO´z´Ý5}{´x´º1v´y´ºP}÷ß4{ß4K»ßcßHßlß4JßAßH}´z´Ý5}{ß1ß17ß3|¦´x´´y´‡º2L¤vkº2J¤rY—÷ß4{ß4K»ßcßHßlß4JßAßH}´z´Ý1}{ß1ß1Cß3|¦´x´´y´‡º1hº26º1vº1z—{´x´º1v´y´ºQ´z´Ý5}÷ß4{ß4K»ßcßHßlß4JßAßH}´z´Ý5}{ß1ß1Dß3|¦´x´´y´‡º2Kº1qº1hº26—÷ß4{ß4K»ßcßHßlß4JßAßH}´z´Ý1}{ß1ß1Eß3|{´x´º2O´y´º1w´z´Ý6}{´x´º2M´y´º2N}{´x´º2K´y´º1q}÷ß4{ß4K»ßcßHßlß4JßAßH}´z´Ý6}{ß1ß1Fß3|¦´x´´y´‡ºM¤w4º2P¤tUº2L¤vk—÷ß4{ß4K»ßcßHßlß4JßAßH}´z´Ý6}{ß1ß1Gß3|¦´x´´y´‡º1vºQº1vº1z—÷ß4{ß4K»ßcßHßlß4JßAßH}´z´Ý0}{ß1ß1Hß3|{´x´º1v´y´¤wO´z´Ý0}{´x´º1v´y´ºP}÷ß4{ß4K»ßcßHßlß4JßAßH}´z´Ý0}{ß1ß1Iß3|¦´x´´y´´z´‡º2Qº2RÝ2º2A¢1AQÝ2¢1ya¢1FQÝ2—÷ß4{ß4K»ßcßHßlß4JßAßH}´z´Ý2}{ß1ß1Oß3|¦´x´´y´‡¢1weº3F¢1zsº2Nº2Oº1w—÷ß4{ß4K»ßcßHßlß4JßAßH}´z´Ý2}{ß1ß1Jß3|¦´x´´y´‡º2Tº2Wº2Tº2VºNº2Sº2Qº2R—÷ß4{ß4K»ßcßHßlß4JßAßH}´z´Ý0}{ß1ß1Mß3|¦´x´´y´‡º2D¤umº2I¤uwºN¤w4—{´x´º2T´y´¤zI´z´Ý0}{´x´º2T´y´º1t}÷ß4{ß4K»ßcßHßlß4JßAßH}´z´Ý0}{ß1ß1Lß3|{´x´º34´y´¤xq}{´x´º32´y´º2v´z´Ý2}÷ß4{ßcßHßl¨wall_streets_fake¨ß4K»ß4j»ßAßH}´z´Ý2}{ß1ß1bß3|¦´x´´y´‡¤am¤w4¤YM¤o0¤X4¤o0¤Y2¤rE¤Fo¤s2¤Gw¤yy¤Gwº1WºVº1WºV¢18e¤X4º3I¤X4º1W¤amº1W¤am¢130—÷ß4{ßcßGßlß4Iß4Q»ßAßG}}{ß1ß1kß3|¦´x´´y´‡¤ZU¤w4¤RG¤w4¤Gw¤yy¤Gwº1W¤ZUº1W—÷ß4{ßcßGßAßGßk»ßlßm}}{ß1ß1lß3|¦´x´´y´‡¤ZYº1a¤ZUº1a¤ZUº1Z¤ZYº1Z¤ZY¤w4¤am¤w4¤amº1W¤ZYº1W—÷ß4{ßcßGßAßGßk»ßlßm}}{ß1ß1mß3|¦´x´´y´‡ºV¢17QºVº3I¤X4º3I¤X4º3K—÷ß4{ßcßGßAßGßk»ßlßm}}{ß1ß1fß3|¦´x´´y´‡¢14S¤tAº2f¤uw¢17g¤y0º2Wº2v¢11s¤zmº2p¤xC¢11O¤uI—÷ß4{ßcßGßlß4hßAßG}´z´Ý0}{ß1ß1gß3|¦´x´´y´‡¢1Emº2c¢1GO¢164¢1Giº3Mº21¢19I¢1Dy¢198¢1Cqº3Mº26º3R—÷ß4{ßcßGßlß4hßAßG}´z´Ý0}{ß1ß1hß3|¦´x´´y´‡¢1K6¤xM¢1LE¤xq¢1LY¤yy¢1Kkº2v¢1J8º1Z¢1IK¤yo¢1Iy¤xg—÷ß4{ßcßGßlß4hßAßG}´z´Ý0}{ß1ß1jß3|¦´x´´y´‡º5¤vGº5º39¢1PQº39º3e¤vG—÷ß4{ßcßGßlß4kßAßG}}{ß1ß1cß3|¦´x´´y´‡ºH¤wY¤KK¤yy¤KKº2pºHº2p¤Ue¤zm¤WGº2p¤ZU¤wY—÷ß4{ßcßGßlß4k¨sensor_fov_mult¨ÊßAßG}}{ß1ß1dß3|¦´x´´y´‡¤RG¤w4¤Op¤wi—÷ß4{ß4K»ßcßGßlß4JßAßG}}{ß1ß1eß3|¦´x´´y´‡¤Mk¤xM¤Gw¤yy¤Gwº1W¤ZUº1W¤ZUº1a—÷ß4{ß4K»ßcßGßlß4JßAßG}}{ß1ß1qß3|{´x´¢2CI´y´¤zS}÷ß4{ßcßUß4M¨enemy_streets_camera_small¨ß4P»ß4OÊßAßU}´z´Ý0}{ß1ß1nß3|{´x´¢24O´y´¤to}÷ß4{ßcßUß4Mß4nß4P»ß4OÊßAßU}´z´Ý0}{ß1ß1pß3|{´x´¢27I´y´ºC}÷ß4{ßcßUß4Mß4nß4P»ß4OÊßAßU}´z´Ý0}{ß1ß1tß3|{´x´¢252´y´¤fw}÷ß4{ßcßUß4Mß4nß4P»ß4OÊßAßU}´z´Ý0}{ß1ß1rß3|¦´x´´y´‡º2F¤uw¢29O¤v6—{´x´º2D´y´¤nC´z´Ý0}{´x´¢2A2´y´¤iM}{´x´¢25C´y´¤iM}{´x´º33´y´¤nC}÷ß4{ßcßUßlß4IßAßUß4Q»}´z´Ý0}{ß1ß1uß3|¦´x´´y´‡º2U¤umº2D¤um¢28u¤uSº2D¤nCº3k¤iM¢28G¤eK¢23Q¤eKº3l¤iMº33¤nC¢23k¤uS—÷ß4{ßcßUßAßUßk»ßlßm}}{ß1ß1sß3|{´x´¢22w´y´¤fS}{´x´º3q´y´¤ee´z´Ý0}{´x´º3j´y´¤ee´z´Ý0}{´x´º3j´y´¤fS}÷ß4{ßcßUßlß4kßAßUß4m£0.Cu}´z´Ý0}{ß1ß1oß3|{´x´º3o´y´¤te}{´x´º3o´y´¤sq´z´Ý0}{´x´ºN´y´¤sq´z´Ý0}{´x´ºN´y´¤te}÷ß4{ßcßUßlß4kßAßUß4mÝ7}´z´Ý0}{ß1ß1vß3|{´x´º3o´y´¤eK}{´x´º3l´y´¤iM´z´Ý0}{´x´º33´y´¤nC}{´x´º2F´y´¤uw}{´x´º2U´y´¤um´z´Ý0}{´x´º3p´y´¤uS}÷ß4{ß4K»ßcßUßlß4JßAßU}´z´Ý0}{ß1ß1wß3|¦´x´´y´‡º3n¤eKº3k¤iMº2D¤nCº3m¤uSº2D¤um—÷ß4{ß4K»ßcßUßlß4JßAßU}´z´Ý0}{ß1ß2Bß3|{´x´º2T´y´¤Jg}÷ß4{ßcßVß4Mß4nß4P»ß4OÊßAßV}´z´Ý0}{ß1ß2Cß3|{´x´º2Z´y´¤Jg}÷ß4{ßcßVß4Mß4nß4P»ß4OÊßAßV}´z´Ý0}{ß1ß2Fß3|{´x´¢2HI´y´¤WG}÷ß4{ßcßVß4Mß4nß4P»ß4OÊßAßV}´z´Ý0}{ß1ß2Gß3|{´x´¢2Ia´y´¤LI}÷ß4{ßcßVß4Mß4nß4P»ß4OÊßAßV}´z´Ý0}{ß1ß20ß3|{´x´º3n´y´¤Qw}÷ß4{ßcßVß4M¨checkpoint_streets_room_2¨ß4P»ß4OÊßAßV}´z´Ý0}{ß1ß24ß3|¦´x´´y´‡¢210ºHº3E¤Wk—÷ß4{ß4K»ßcßVßl¨wall_door¨ßAßV}´z´Ý0}{ß1ß25ß3|¦´x´´y´´z´‡º3i¤MkÝ0º3n¤HkÝ0—÷ß4{ß4K»ßcßVßlß4pßAßV}´z´Ý0}{ß1ß26ß3|{´x´¢2FW´y´ºH}{´x´º35´y´¤Wk´z´Ý0}÷ß4{ß4K»ßcßVßlß4pßAßV}´z´Ý0}{ß1ß29ß3|¦´x´´y´´z´‡¢29i¤K0Ý0º3n¤HkÝ0—÷ß4{ß4K»ßcßVßlß4pßAßV}´z´Ý0}{ß1ß1zß3|¦´x´´y´´z´‡¢1s8¤gkÝ0º3l¤iMÝ0—{´x´º3k´y´¤iM}{´x´¢2OO´y´¤gk}{´x´º3n´y´¤Hk´z´Ý0}÷ß4{ßcßVßlß4IßAßVß4Q»}´z´Ý0}{ß1ß21ß3|¦´x´´y´‡º3n¤eKº3o¤eKº3E¤Wkº3n¤Hkº35¤Wk—÷ß4{ßcßVßAßVßk»ßlßmß6|¨streets room 2 map rock 1¨¨streets room 2 map checkpoint¨÷}}{ß1ß1xß3|¦´x´´y´‡¢2B0¤X4º2F¤X4—{´x´º2U´y´¤b6´z´Ý0}÷ß4{ßcßVßlß4hßAßV}´z´Ý0}{ß1ß22ß3|{´x´º3i´y´¤Mk}{´x´º3E´y´¤NO´z´Ý0}{´x´º3t´y´ºH´z´Ý0}÷ß4{ßcßVßlß4hßAßV}´z´Ý0}{ß1ß23ß3|¦´x´´y´´z´‡º3uºHÝ0º35¤KyÝ0º3v¤K0Ý0—÷ß4{ßcßVßlß4hßAßV}´z´Ý0}{ß1ß1yß3|{´x´¢1xm´y´¤X4}{´x´º3z´y´¤WG´z´Ý0}{´x´¢2Ik´y´¤WG´z´Ý0}{´x´º40´y´¤X4}÷ß4{ßcßVßlß4kßAßVß4m£1.1c}´z´Ý0}{ß1ß2Dß3|¦´x´´y´´z´‡º3E¤WGÝ0º3z¤WGÝ0º2U¤HkÝ0—{´x´¢26e´y´¤Hk}÷ß4{ßcßVßlß4kßAßVß4mÝ8}´z´Ý0}{ß1ß2Eß3|¦´x´´y´´z´‡º40¤X4Ý0º35¤X4Ý0¢27w¤HaÝ0—{´x´¢28k´y´¤Ha}÷ß4{ßcßVßlß4kßAßVß4mÝ8}´z´Ý0}{ß1ß27ß3|¦´x´´y´‡¢1mK¤OC¢1ou¤KA—{´x´¢1uY´y´¤NO´z´Ý0}{´x´º3E´y´¤Wk}{´x´º3o´y´¤eK}÷ß4{ß4K»ßcßVßlß4JßAßV}´z´Ý0}{ß1ß28ß3|¦´x´´y´‡º2G¤Kyº35¤Wkº3n¤eK—÷ß4{ß4K»ßcßVßlß4JßAßV}´z´Ý0}{ß1ß2Aß3|{´x´¢2KM´y´¤Ds´z´Ý0}{´x´¢2H8´y´ºA}{´x´º3n´y´¤Hk}{´x´º3G´y´¤K0´z´Ý0}{´x´º2w´y´¤Gm´z´Ý0}{´x´º2x´y´¤BI´z´Ý0}{´x´º3E´y´¤4q}÷ß4{ß4K»ßcßVßlß4JßAßV}´z´Ý0}{ß1ß2Hß3|¦´x´´y´‡º3E¤Wu¢28Q¤Ha—{´x´º2w´y´¤Gm´z´Ý0}{´x´º3E´y´¤4q}{´x´¢1XA´y´¤4q}{´x´º1k´y´ºH}{´x´º45´y´¤KA}÷ß4{ßcßWßlß4IßAßWß4Q»}´z´Ý0}{ß1ß2Iß3|{´x´º45´y´¤Ky}{´x´º2P´y´¤Ky´z´Ý0}{´x´¢1ry´y´¤Gw´z´Ý0}{´x´¢1rA´y´¤Gw}÷ß4{ßcßWßlß4kßAßWß4mÊ}´z´Ý0}{ß1ß2Jß3|¦´x´´y´‡¢1gq¤OCº1kºH¢1lC¤Py—÷ß4{ß4K»ßcßWßlß4JßAßW}´z´Ý0}{ß1ß2Kß3|¦´x´´y´‡º35¤Wu¢2PC¤Eq¢286¤Ha—÷ß4{ßcßXßlß4IßAßXß4Q»}´z´Ý0}{ß1ß2Lß3|¦´x´´y´‡º35¤Ky¢2N6¤F0—÷ß4{ß4K»ßcßXßlß4JßAßX}´z´Ý0}{ß1ß2Mß3|{´x´º3H´y´º2N}{´x´º2A´y´º3D´z´Ý2}{´x´º2D´y´º2E´z´Ý2}{´x´º3m´y´¢1FG}{´x´º3m´y´¢1T8´z´Ý2}{´x´º3G´y´º4J}{´x´º3G´y´º3F}÷ß4{ßcßJßlß4IßAßJß4Q»}´z´Ý2}{ß1ß2Sß3|¦´x´´y´‡º3Hº2Nº3Gº3Fº3Eº3Fº2Aº3Dº2Oº1w—÷ß4{ßcßJßAßJßk»ßlßm}}{ß1ß2Tß3|¦´x´´y´‡¢21Aº1vº3nº1vº3nº3Qº3Eº3Fº3Gº3F—÷ß4{ßcßJßAßJßk»ßlßm}}{ß1ß2Uß3|¦´x´´y´‡º3tº2E¢22Sº29º41º1w¢27cº3F¢26K¢1F6º2Uº3W¢22c¢1DAº41¢1Faº41¢1GEº3i¢1G4—÷ß4{ßcßJßAßJßk»ßlßm}}{ß1ß2Qß3|{´x´¢20M´y´º3b´z´Ý2}÷ß4{ßcßJßAßJß4P»ß6|¨streets side room 1 test 0¨¨streets side room 1 test 1¨÷}´z´Ý2}{ß1ß2Nß3|¦´x´´y´‡º4Kº1vº3Gº3F—÷ß4{ß4K»ßcßJßlß4JßAßJ}´z´Ý2}{ß1ß2Oß3|¦´x´´y´´z´‡º3Eº3FÝ2º3iº4TÝ2—{´x´º3t´y´º2E}{´x´º4L´y´º29}{´x´º41´y´º1w}{´x´º4M´y´º3F}{´x´º4N´y´º4O}{´x´º2U´y´º3W}{´x´º4P´y´º4Q´z´Ý2}{´x´º41´y´º4R}{´x´º41´y´º4S}{´x´º3n´y´º3Q}÷ß4{ß4K»ßcßJßlß4JßAßJ}´z´Ý2}{ß1ß2Pß3|{´x´º3i´y´º4T}{´x´º41´y´º4S´z´Ý2}÷ß4{ßcßJßlß4lß4K»ß4j»ßAßJ}´z´Ý2}{ß1ß2Rß3|¦´x´´y´´z´‡º4K¢1LsÝ2º3Eº3FÝ2—÷ß4{ß4K»ßcßJßlß4LßAßJ}´z´Ý2}{ß1ß2aß3|¦´x´´y´‡ºRºPºOºPºOºQºRºQ—÷ß4{ßcßLßlß2Vß4I»ßAßFß1a»}´z´Ý4}{ß1ß2eß3|¦´x´´y´‡¤SEºPºgºP—{´x´ºg´y´ºP´z´Ý3}{´x´¤SE´y´ºP´z´Ý3}÷ß4{ßcßLßlß2VßAßF}}{ß1ß2fß3|¦´x´´y´‡ºgºP¤UeºP—÷ß4{ßcßLßl¨sensor_path¨ßAßF}}{ß1ß2cß3|¦´x´´y´‡ºhºP¤X4ºP—{´x´¤X4´y´ºP´z´Ý3}{´x´ºh´y´ºP´z´Ý3}÷ß4{ßcßLßlß2VßAßF}}{ß1ß2dß3|¦´x´´y´‡ºhºP¤UeºP—÷ß4{ßcßLßlß4ußAßF}}{ß1ß2gß3|¦´x´´y´‡ºRºPºOºPºOºQºRºQ—÷ß4{ßcßLßl¨floor_train¨ßAßFß1a»}}{ß1ß2Wß3|¦´x´´y´‡ºRºP¤SEºP¤Ru¢122¤SE¢13U¤SEºQºRºQ—÷ß4{ßcßLßlß4vßAßFß1a»}}{ß1ß2iß3|¦´x´´y´‡ºOºQ¤SEºQ¤SEº4XºO¢13A—÷ß4{ßcßLßlß4vßAßFß1a»}}{ß1ß2jß3|¦´x´´y´‡ºOº4Y¤SEº4X¤Ruº4WºOºI—÷ß4{ßcßLßlß4vßAßFß1a»}}{ß1ß2hß3|¦´x´´y´‡ºOºI¤Ruº4W¤SEºPºOºP—÷ß4{ßcßLßlß4vßAßFß1a»}}{ß1ß2bß3|¦´x´´y´‡¤Qmº1j¤Qm¢14m¤YWº4Z¤YWº1j—÷ß4{ßcßLßlß4kßAßFß1a»}}{ß1ß2Xß3|{´x´ºR´y´ºP}{´x´ºR´y´ºP´z´Ý4}{´x´ºR´y´ºQ´z´Ý4}{´x´ºR´y´ºQ}÷ß4{ßcßLßlß2VßAßF}}{ß1ß2Yß3|{´x´ºO´y´ºP}{´x´ºO´y´ºP´z´Ý4}{´x´ºO´y´ºQ´z´Ý4}{´x´ºO´y´ºQ}÷ß4{ßcßLßlß2VßAßF}}{ß1ß2Zß3|¦´x´´y´‡ºOºQºRºQ—{´x´ºR´y´ºQ´z´Ý4}{´x´ºO´y´ºQ´z´Ý4}÷ß4{ßcßLßlß2VßAßF}}{ß1ß36ß3|¦´x´´y´‡¤Lm¤4q¤Ky¤84—÷ß4{ßcßZßl¨wall_tutorial_fake¨ß4K»ß4j»ßAßZ}}{ß1ß3nß3|¦´x´´y´‡¢-MQ¤-e¢-NY¤K—÷ß4{ßcßbßlß4wß4K»ß4j»ßAßb}}{ß1ß49ß3|¦´x´´y´‡¤AA¤g6¤By¤i0—÷ß4{ßcßIßlß4wß4K»ß4j»ßAßI}}{ß1ß1iß3|{´x´º1v´y´¤wO´z´Ý0}{´x´º1v´y´º1z}{´x´¤ye´y´¢1Ec}{´x´¤yU´y´¤qQ}÷ß4{ßcßGßlß4IßAßG}´z´Ý0}{ß1ß3yß3|¦´x´´y´‡¤CQ¤ga¤DE¤gQ¤EM¤gu¤EW¤hs¤E2¤iM¤DO¤iW¤Ck¤iC—÷ß4{ßcßIßlß4hß4K»ßAßI}}{ß1ß40ß3|¦´x´´y´‡¤SO¤oe¤TC¤pSºH¤qa¤S4¤qu¤Qw¤qaºO¤pS¤RG¤oU—÷ß4{ßcßIßlß4hßAßI}}{ß1ß41ß3|¦´x´´y´‡¤SiºYºH¤sM¤SY¤tA¤Ra¤tK¤Qw¤sg¤Qw¤ri¤Rk¤rE—÷ß4{ßcßIßlß4hßAßI}}{ß1ß42ß3|¦´x´´y´‡¤Ss¤tU¤Tq¤uS¤Tg¤vk¤Si¤wY¤Rk¤wE¤R6¤v6¤Ra¤ty—÷ß4{ßcßIßlß4hßAßI}}{ß1ß43ß3|¦´x´´y´‡¤OC¤vQ¤Og¤wEºd¤x2¤NO¤xM¤Ma¤ws¤MQ¤vu¤NE¤vG—÷ß4{ßcßIßlß4hßAßI}}{ß1ß2nß3|{´x´ºx´y´º3}÷ß4{ßcßDß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷ßAßD}}{ß1ß2pß3|¦´x´´y´‡¤6w¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßcßDß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßlß4kß4m£0.EWßAßD}}{ß1ß2tß3|¦´x´´y´‡¤D4¤-A¤C6¢-42¤5eºxº2ºj¢-6Iº2¢-6m¤42¢-9q¤50¢-Bm¤84¢-Bc¤BI¢-7Q¤D4¢-3Y¤B8¢-26¤84¤4C¤6w¤6c¤1S—÷ß4{ßcßDßlß4Iß4Q»ßAßD}}{ß1ß2uß3|¦´x´´y´‡¤5eºxº2ºjº4gº2º4h¤42º4n¤84¤4C¤6w¤6c¤1S—÷ß4{ßcßDßAßDßk»ßlßmß6|¨tutorial room 1 map rock 1¨¨tutorial room 1 map rock 2¨¨tutorial room 1 map rock 3¨¨tutorial room 1 map rock 4¨÷}}{ß1ß2vß3|¦´x´´y´‡¤C6º4f¤5eºx¤6c¤1S¤D4¤-A—÷ß4{ßcßDßAßDßk»ßlßm}}{ß1ß2wß3|¦´x´´y´‡¢-2v¤7M¢-47¤6K¢-4C¤6P¢-6u¤44º4i¤50º4j¤84º4k¤BIº4l¤D4º4m¤B8—÷ß4{ßcßDßAßDßk»ßlßmß6|¨tutorial room 1 map rock 5¨¨tutorial room 1 map rock 6¨÷}}{ß1ß2lß3|{´x´ºj´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß5D÷ßcßDßAßD}}{ß1ß2oß3|¦´x´´y´‡¤5eºxº2ºjº4gº2º4h¤42º4n¤84¤4C¤6w¤6c¤1S—÷ß4{ßcßDßlß4kß4mÊßAßD}}{ß1ß2rß3|{´x´¢-BI´y´¤4q}÷ß4{ß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßcßDßAßD}}{ß1ß32ß3|¦´x´´y´‡¤5e¢-CG¤4g¢-8O¤8Yº4l¤9Wº4t¤F9¢-HE¤9W¢-BS—÷ß4{ßcßZßlß4kß4mÝ9ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷ßAßZ}}{ß1ß3Bß3|¦´x´´y´‡¤Gw¢-Ky¤EC¢-Lc¤BS¢-KU¤4M¢-Ca¤3O¢-8i¤C6º4f¤D4¤-A¤Bm¤8s¤E2¤G8¤H6¤GI¤Keºt¤WG¤84¤Wu¤2G¤Uy¢-Ay—÷ß4{ßcßZßlß4Iß4Q»ßAßZ}}{ß1ß3Cß3|¦´x´´y´‡¤Wuº4q¤Waº4l—{´x´¤Vw´y´¢-5o´z´£0.3E}÷ß4{ßcßZßlß4IßAßZ}´z´ÝA}{ß1ß3Dß3|¦´x´´y´‡¤Wk¤2G¤Uyº53¤NOº4j¤Lw¢-H6¤Gm¢-Is¤Bw¢-FU¤BS¢-Ao¤Aoº53¤9q¢-76¤C6º4f¤D4¤-A¤Ck¤26¤M8¤3G¤WQ¤4C¤WV¤3k¤NO¤2u¤MG¤26¤N4¤eºk¤Uºb¤18¤Py¤2Q¤Pe¤3EºO¤3E¤QI¤2Q¤QS¤18¤R6¤o¤S4¤18¤SO¤1w¤S4¤3O¤UAºz¤Ss¤1w¤Si¤e¤TM¤-K¤UU¤-o¤Vm¤-K¤Vw¤18¤WG¤42¤WQ¤4C—÷ß4{ßcßZßAßZßk»ßlßmß6|¨tutorial room 2 map rock 1¨¨tutorial room 2 map rock 2¨¨tutorial room 2 map rock 3¨¨tutorial room 2 map rock 4¨¨tutorial room 2 map rock 5¨¨tutorial room 2 map rock 6¨¨tutorial room 2 map rock 7¨¨tutorial room 2 map rock 8¨¨tutorial room 2 map rock 9¨¨tutorial room 2 map rock 10¨¨tutorial room 2 map rock 11¨÷}}{ß1ß3Eß3|¦´x´´y´‡¤Gc¢-7a¤Gg¢-7e¤GN¢-92¤H8¢-AF¤IW¢-A6¤JR¢-9B¤J8¢-7T¤Hk¢-6r¤Hkº4h—÷ß4{ßcßZßAßZßk»ßlßmß4gÊ}}{ß1ß3Fß3|¦´x´´y´‡¤Cu¢-G8¤Cq¢-GD¤Bq¢-FW¤AA¢-GS¤A0¢-IY¤Bcº50¤E2¢-LS¤Gc¢-Ko¤Gm¢-Ix¤Do¢-Gs¤Ds¢-Gm—÷ß4{ßcßZßAßZßk»ßlßm}}{ß1ß3Gß3|¦´x´´y´‡¤3Oº52¤4Mº51¤Aoº53¤9qº59—÷ß4{ßcßZßAßZßk»ßlßm}}{ß1ß3Hß3|¦´x´´y´‡¤Ky¤84¤Lk¤4q¤WG¤4q¤WG¤84—÷ß4{ßcßZßAßZßk»ßlßm}}{ß1ß3Iß3|¦´x´´y´‡¤EW¤C1¤Ha¤CG¤H6¤GI¤E2¤G8—÷ß4{ßcßZßAßZßk»ßlßm}}{ß1ß3Jß3|¦´x´´y´‡¤M8¤3G¤Keºt¤Ha¤CG¤EW¤C1¤Bm¤8s¤Ck¤26—÷ß4{ßcßZßAßZßk»ßlßm}}{ß1ß2yß3|{´x´¤G8´y´º4m}÷ß4{ßcßZß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷ßAßZ}}{ß1ß31ß3|{´x´¤KA´y´¢-5A}÷ß4{ßcßZß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷ßAßZ}}{ß1ß37ß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßcßZßlß4kßAßZ}}{ß1ß2zß3|{´x´¤Ss´y´¤-y}÷ß4{ßcßZß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ßAßZ}}{ß1ß30ß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßcßZßlß4uß6|¨tutorial room 2 switch¨÷ßAßZ}}{ß1ß33ß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGºx—÷ß4{ßcßZßl¨icon¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷ßAßZ}´z´£0.1c}{ß1ß35ß3|{´x´¤AU´y´¢-K0}÷ß4{ßcßZß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷ßAßZ}}{ß1ß38ß3|¦´x´´y´‡¤CQ¤y¤Ds¤FUºA¤FU¤FU¤y—÷ß4{ßcßZßlß4kß4mÝ9ßAßZ}}{ß1ß3Lß3|¦´x´´y´‡¢-Lmº5M¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßcßaßlß4kß4m£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷ßAßa}}{ß1ß3Tß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FKº53¢-Ds¢-8s¢-Fe¢-8Yº5g¢-A0º5X¢-DY¢-Ke—÷ß4{ßcßaßlß4kßAßa}}{ß1ß3Wß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßcßaß4M¨enemy_tutorial_easy¨ß4P»ß4OÊßAßa}}{ß1ß3Mß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßcßaß4Mß69ß4P»ß4OÊßAßa}}{ß1ß3Vß3|¦´x´´y´‡¤3Oº52¤4Mº51¤e¢-GI¢-4Mº50¢-84¢-Oq¢-EC¢-PAº5Y¢-I4¢-OMº57º4aº5oº4t¢-9Cº4nº59—÷ß4{ßcßaßlß4Iß4Q»ßAßa}}{ß1ß3Xß3|¦´x´´y´‡º4nº59¢-5e¢-B8º5Tº5h¤eº5u¤4Mº51¤3Oº52—÷ß4{ßcßaßAßaßk»ßlßmß6|¨tutorial room 3 map rock 1¨÷}}{ß1ß3Yß3|¦´x´´y´‡º4s¢-Cuº5W¢-Cr¤A¢-DU¤1O¢-Ch¤1i¢-BA¤J¢-9v¢-1P¢-9k¢-21¢-B7º4nº64—÷ß4{ßcßaßAßaßk»ßlßmß4gÊ}}{ß1ß3Zß3|¦´x´´y´‡º4tº62¢-HG¢-CQ¢-Jqº5Iº5Yº60¢-J2¢-JWº5yº5zº5wº5xº5vº50º5Tº5hº63º64—÷ß4{ßcßaßAßaßk»ßlßmß6|¨tutorial room 3 map rock 2¨÷}}{ß1ß3aß3|¦´x´´y´‡¢-Fu¢-IN¢-F6¢-FE¢-Az¢-Do¢-8m¢-Fh¢-8T¢-IM¢-A2¢-K7º5o¢-Kj—÷ß4{ßcßaßAßaßlßmßk»ß4gÊ}}{ß1ß3bß3|¦´x´´y´‡º4aº5oº6Hº5Iº5Yº60º61º57—÷ß4{ßcßaßAßaßk»ßlßm}}{ß1ß3Qß3|¦´x´´y´‡º4gº5w¤2F¢-5T¤4qº5i¢-3F¢-Hl—÷ß4{ßcßaßlß4kß4mÝCß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷ßAßa}}{ß1ß3gß3|{´x´¢-L4´y´¤49}÷ß4{ßcßbß4M¨enemy_tutorial_rock_room4¨ß4P»ß4OÊßAßb}}{ß1ß3oß3|¦´x´´y´‡º4aº5oº61º57¢-W6¢-Ck¢-Ygº5Sºn¤Uº4b¤Kº4b¤7Gº56¤7Gº56¤34º4a¤-eº6I¢-3Oº5gº52—÷ß4{ßcßbßlß4Iß4Q»ßAßb}}{ß1ß3dß3|{´x´¢-QI´y´¢-7G}÷ß4{ßcßbß4M¨collect_gun_basic¨ß4P»ß4OÊß4j»ßAßb}}{ß1ß3eß3|{´x´º6f´y´º6g}÷ß4{ßcßbß4M¨deco_gun_basic¨ß4P»ß4OÊßAßb}}{ß1ß3pß3|¦´x´´y´‡º6bº6cº6dº5Sºn¤Uº4b¤Kº6Iº6eº5gº52º4aº5oº61º57—÷ß4{ßcßbßAßbßlßmßk»ß6|¨tutorial room 4 map rock 1¨¨tutorial room 4 map rock 2¨¨tutorial room 4 map rock 3¨÷}}{ß1ß3kß3|¦´x´´y´‡¢-Kz¢-6wº6W¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßcßbßlß5zßAßb}}{ß1ß3fß3|{´x´¢-Ue´y´¢-C6}÷ß4{ßcßbß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷ßAßb}}{ß1ß3iß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßcßbß4M¨enemy_tutorial_rocky¨ß4P»ß4OÊß4j»ßAßb}}{ß1ß3jß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßcßbß4Mß6Nß4P»ß4OÊß4j»ßAßb}}{ß1ß3cß3|¦´x´´y´‡¢-OK¢-Fkº8º65¢-Yqº5S¢-Tq¤e¢-NO¤Uº56¢-3E¢-IEº5k—÷ß4{ßcßbßlß4kß4m£1.4qßAßb}}{ß1ß3hß3|{´x´¢-Ic´y´¤16}÷ß4{ßcßbß4M¨switch¨ß4P»ß4OÊßAßb}}{ß1ß3tß3|{´x´¤Fy´y´¤TW}÷ß4{ßcßIß4M¨enemy_tutorial_boss¨ß4P»ß4OÊßAßIß4j»}}{ß1ß3vß3|¦´x´´y´‡¤Pe¤fS¤Lw¤fc—÷ß4{ß4K»ßcßIß6|¨tutorial room 5 door end path¨÷ßAßIßlß4p}}{ß1ß3rß3|¦´x´´y´‡¤KU¤GSºA¤GI—÷ß4{ß4K»ßcßIß6|¨tutorial room 5 door start path¨÷ßAßIßlß4p}}{ß1ß3zß3|{´x´¤Tx´y´¤gx}÷ß4{ßcßIß4M¨enemy_tutorial_easy_static¨ß4P»ß4OÊßAßI}}{ß1ß3uß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºH¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fw¤Ue¤fw¤Vc¤jA¤Wu¤jA¤XO¤km¤W6¤km¤Y2¤rE¤Fo¤s2¤F0¤nC¤92¤h4ºt¤gG¤AA¤g6¤1w¤X4¤4q¤M6—÷ß4{ßcßIßlß4Iß4Q»ßAßI}}{ß1ß4Aß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºH¤Vw¤Lz¤fY¤Hu¤fi¤Hu¤fm¤EC¤fw¤EC¤fs¤A6¤g2¤26¤X4¤4q¤M6—÷ß4{ßcßIßAßIßk»ßlßm}}{ß1ß4Bß3|¦´x´´y´‡¤EC¤fw¤Hu¤fm¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤RG¤w4ºO¤wE¤P1¤oQ¤SN¤o5¤RV¤l9¤GA¤mJ¤AI¤g6—÷ß4{ßcßIßAßIßk»ßlßmß6|¨tutorial room 5 map rock 1¨¨tutorial room 5 map rock 2¨¨tutorial room 5 map rock 3¨¨tutorial room 5 map rock 4¨÷}}{ß1ß4Cß3|¦´x´´y´‡¤Ck¤iC¤Co¤i9¤DO¤iS¤E0¤iI¤ER¤hr¤EI¤gx¤DD¤gU¤CU¤gd¤CQ¤ga¤CG¤hY—÷ß4{ßcßIßAßIßk»ßlßmß4gÊ}}{ß1ß4Dß3|¦´x´´y´‡¤X8¤o0¤YM¤o0¤am¤w4¤ZY¤w4—÷ß4{ßcßIßAßIßk»ßlßmß6|¨tutorial room 5 map shape 4.1¨÷}}{ß1ß4Eß3|¦´x´´y´‡¤T6¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fs¤Uc¤ft¤Ps¤gL—÷ß4{ßcßIßAßIßk»ßlßm}}{ß1ß4Fß3|¦´x´´y´‡ºO¤wE¤Qa¤w9¤Oo¤wd¤On¤wl¤Mj¤xL¤Mh¤xH¤Gu¤yu¤FK¤p8¤Gw¤p8¤Gy¤pF¤P1¤oQ—÷ß4{ßcßIßAßIßk»ßlßm}}{ß1ß4Gß3|¦´x´´y´‡¤Gw¤p8¤G8ºK¤By¤i0¤C3¤hx¤AI¤g6ºt¤gG¤92¤h4¤F0¤nC¤FK¤p8—÷ß4{ßcßIßAßIßk»ßlßm}}{ß1ß4Hß3|¦´x´´y´‡¤G8ºK¤Gw¤p8¤SE¤o0¤RQ¤lG—÷ß4{ßcßIßAßIßk»ßlßm}}{ß1ß48ß3|{´x´¤WV´y´¤jy}÷ß4{ßcßIß4M¨enemy_tutorial_rocky_small¨ß4P»ß4OÊßAßIß4j»}}{ß1ß3qß3|¦´x´´y´‡¤1w¤Ko¤1w¤cEºH¤bQ¤TM¤LI—÷ß4{ßcßIßlß4kßAßI}}{ß1ß46ß3|¦´x´´y´‡¤8s¤eK¤9g¤fI¤MG¤eo¤N4¤dq—÷ß4{ßcßIßlß4kß4mÝDßAßI}}{ß1ß3sß3|¦´x´´y´‡¤DE¤Gm¤CGºA¤JC¤Hk¤IE¤H6—÷ß4{ßcßIßlß4kß4mÝDßAßI}}{ß1ß45ß3|¦´x´´y´‡¤DE¤g6¤Eg¤gu¤Kr¤ga¤V1¤fk¤ZU¤um¤Gc¤um¤H6¤ye¤Qw¤vu¤aI¤vW¤VI¤fI—÷ß4{ßcßIßlß4kß4mÊßAßI}}{ß1ß44ß3|¦´x´´y´‡¤NE¤vG¤MkºY—÷ß4{ßcßIßlß4ußAßI}}{ß1ß3Nß3|¦´x´´y´‡º6vº62º7¢-9gº4jº64—÷ß4{ßcßaßl¨spike¨ßAßa}}{ß1ß3Oß3|¦´x´´y´‡º56¢-EWº6Jº57º6Fº5I—÷ß4{ßcßaßlß6ZßAßa}}{ß1ß3Pß3|¦´x´´y´‡¢-Af¢-PH¢-Bw¢-PKº4tº74—÷ß4{ßcßaßlß6ZßAßa}}{ß1ß3lß3|¦´x´´y´‡¢-Iu¤5Sº56¤34º4a¤-eº6Iº6eº5gº52º4aº5o—÷ß4{ßcßbßlß4Jß4K»ßAßb}}{ß1ß2mß3|¦´x´´y´‡¢-38¤7Aº4n¤84¤4C¤6w¤6c¤1S¤D4¤-A—÷ß4{ß4K»ßcßDßlß4JßAßD}}{ß1ß2qß3|¦´x´´y´‡¢-6e¤2Yº4h¤42—÷ß4{ßcßDßlß4Jß4K»ßAßD}}{ß1ß2xß3|¦´x´´y´‡ºb¤gQºH¤Vw¤RG¤MG¤H6¤GI¤Ha¤CG¤Keºt¤Ky¤84¤WG¤84¤WG¤4q¤Lm¤4q¤M8¤3G¤WQ¤4C¤Wk¤2G¤Uyº53¤NOº4j¤Lwº55¤Gmº56¤Dsº5R—÷ß4{ß4K»ßcßZßlß4JßAßZ}}{ß1ß39ß3|¦´x´´y´‡¤3Oº52¤9qº59¤C6º4f—÷ß4{ßcßZßlß4Jß4K»ßAßZ}}{ß1ß3mß3|¦´x´´y´‡º4b¤6Iº4b¤Kºn¤Uº6dº5Sº6bº6cº61º57—÷ß4{ßcßbßlß4Jß4K»ßAßb}}{ß1ß34ß3|¦´x´´y´‡¤Cuº5I¤Bwº57¤BSº58¤4Mº51—÷ß4{ß4K»ßcßZßlß4JßAßZ}}{ß1ß2sß3|¦´x´´y´‡¤C6º4f¤5eºxº2ºjº4gº2¢-6T¤U—÷ß4{ßcßDßlß4Jß4K»ßAßD}}{ß1ß3Aß3|¦´x´´y´‡¤D4¤-A¤Bm¤8s¤EW¤C1¤E2¤G8¤4q¤M6¤26¤X4¤AA¤g6¤EC¤fw—÷ß4{ß4K»ßcßZßlß4JßAßZ}}{ß1ß3Sß3|¦´x´´y´‡º4aº5oº6Hº5Iº6Fº6Gº4tº62º63º64º4nº59¤3Oº52—÷ß4{ßcßaßlß4Jß4K»ßAßa}}{ß1ß3Rß3|¦´x´´y´‡º61º57º5Yº60º6Iº6Jº5yº5zº5wº5xº5vº50º5Tº5h¤eº5u¤4Mº51—÷ß4{ßcßaßlß4Jß4K»ßAßa}}{ß1ß47ß3|¦´x´´y´‡¤Hu¤fm¤Lw¤fcºH¤Vw—÷ß4{ß4K»ßcßIßlß4JßAßI}}{ß1ß3wß3|¦´x´´y´‡¤By¤i0¤G8ºK¤RQ¤lG¤SE¤o0¤Gw¤p8—÷ß4{ß4K»ßcßIßlß4JßAßI}}{ß1ß3xß3|¦´x´´y´‡¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤ZUº1Z—÷ß4{ß4K»ßcßIßlß4JßAßI}}{ß1ß3Kß3|¦´x´´y´‡¢-FAº7Iº53º5cº52º5lº4vº5gº5n¢-KAº5oº5Oº5aº5gº7Iº7I—÷ß4{ßcßaßlß4Lß4K»ßAßa}}{ß1ß3Uß3|¦´x´´y´‡º7Iº7Iº53º5cº52º5lº4vº5gº5nº7Jº5oº5Oº5aº5gº7Iº7I—÷ß4{ßcßaßlß4LßAßa}}{ß1ß4Xß3|¦´x´´y´‡º1hº26º2J¤rY—÷ß4{ßcß1TßAßHßk»ßl¨map_line¨¨map_parent¨ß1T}}{ß1ß4bß3|¦´x´´y´‡º2Kº1qº2L¤vk—÷ß4{ßcß1UßAßHßk»ßlß6aß6bß1U}}{ß1ß4eß3|¦´x´´y´‡º2Oº1wºM¤w4—÷ß4{ßcß1VßAßHßk»ßlß6aß6bß1V}}{ß1ß4fß3|¦´x´´y´‡º2Qº2Rº2F¤uw—÷ß4{ßcß1WßAßHßk»ßlß6aß6bß1W}}{ß1ß4Tß3|¦´x´´y´‡º2g¤xqº2i¤yUº2hº1Z—÷ß4{ßcß1SßAßHßl¨map_inverse¨ßk»ß6bß1S}}{ß1ß4Uß3|¦´x´´y´‡º2bº2cº2eº2fº1cº2d—÷ß4{ßcß1SßAßHßlß6cßk»ß6bß1S}}{ß1ß4Vß3|¦´x´´y´‡ºS¤xWº2oº2pº2n¤zm—÷ß4{ßcß1TßAßHßlß6cßk»ß6bß1T}}{ß1ß4Wß3|¦´x´´y´‡º2lº2mº2kº2Sº2jº1r—÷ß4{ßcß1TßAßHßlß6cßk»ß6bß1T}}{ß1ß4Yß3|¦´x´´y´‡º2w¤w4º2qº2vº2uº1t—÷ß4{ßcß1UßAßHßlß6cßk»ß6bß1U}}{ß1ß4Zß3|¦´x´´y´‡º24º2cº2sº2tº2qº2r—÷ß4{ßcß1UßAßHßlß6cßk»ß6bß1U}}{ß1ß4aß3|¦´x´´y´‡º2uº2mº2yº2zº2xº2c—÷ß4{ßcß1UßAßHßlß6cßk»ß6bß1U}}{ß1ß4cß3|¦´x´´y´‡º34¤xqº32º2vº2A¤yU—÷ß4{ßcß1VßAßHßlß6cßk»ß6bß1V}}{ß1ß4dß3|¦´x´´y´‡º33º2cº32º2dº30º31—÷ß4{ßcß1VßAßHßlß6cßk»ß6bß1V}}{ß1ß4rß3|{´x´º3n´y´¤Qw}÷ß4{ßcß21ß4M¨checkpoint_map_streets_room_2¨ß4P»ß4OÊßAßVßk»ß6bß21}}{ß1ß4qß3|¦´x´´y´‡º2U¤b6º2F¤X4º3y¤X4—÷ß4{ßcß21ßAßVßlß6cßk»ß6bß21}}{ß1ß4sß3|¦´x´´y´´z´‡¢28D¢1HSÝ2º7K¢1LUÝ2—{´x´¢24B´y´º7M}{´x´º7N´y´º7L´z´Ý2}÷ß4{ßcß2QßAßJß4P»}´z´Ý2}{ß1ß4tß3|¦´x´´y´´z´‡¢21s¢1NpÝ2º7O¢1RrÝ2¢1xqº7QÝ2º7Rº7PÝ2—÷ß4{ßcß2QßAßJß4P»}´z´Ý2}{ß1ß6Dß3|¦´x´´y´‡º4sº65º4nº64—÷ß4{ßcß3Qßlß4wß4K»ß4j»ßAßa}}{ß1ß5rß3|¦´x´´y´‡¤Hkº4h¤Gcº5A—÷ß4{ßcß31ßlß4wß4K»ß4j»ßAßZ}}{ß1ß59ß3|¦´x´´y´‡¤-Kº6e¤Aº4e¤xº4m¤1I¢-2u¤yºx¤K¢-2G¤-K¢-2a—÷ß4{ßcß2lßlß4hßAßD}}{ß1ß5Aß3|¦´x´´y´‡¤2G¤5A¤2a¤4W¤3O¤4C¤42¤4q¤42¤5o¤3E¤68¤2Q¤5y—÷ß4{ßcß2lßlß4hßAßD}}{ß1ß5Bß3|¦´x´´y´‡º54¢-18º63º2¢-4q¢-1wº5v¢-1Sº5v¤-oºjºv¢-5U¤-e—÷ß4{ßcß2lßlß4hßAßD}}{ß1ß5Cß3|¦´x´´y´‡º4e¤5K¢-34¤50º7T¤50¢-1m¤5eº7X¤6cºx¤5y¢-4B¤6G—÷ß4{ßcß2lßlß4hßAßD}}{ß1ß5Dß3|¦´x´´y´‡º7H¤Uº7G¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßcß2lßl¨wall_tutorial_rock_breakable¨ßAßD}}{ß1ß5dß3|¦´x´´y´‡¤Muº75¤P0º6e¤Pyº4q¤PUºi¤OCº5U¤N4ºi¤MQºj—÷ß4{ßcß31ßlß4hßAßZ}}{ß1ß5eß3|¦´x´´y´‡¤Caº4f¤Dsº4m¤Egº4q¤Eg¢-5K¤ECºi¤Ckºi¤C6ºj—÷ß4{ßcß31ßlß4hßAßZ}}{ß1ß5fß3|¦´x´´y´‡ºEº4f¤Gm¢-3s¤Hkº5v¤Huº63¤Gwº5U¤FUºi¤F0º5S—÷ß4{ßcß31ßlß4hßAßZ}}{ß1ß5gß3|¦´x´´y´‡¤J2º7g¤Kyº4m¤Lwº7W¤Lmºi¤K0º4h¤Iiºi¤IOº7W—÷ß4{ßcß31ßlß4hßAßZ}}{ß1ß5hß3|¦´x´´y´‡¤Hkº4h¤JCº4l¤JWº62¤IY¢-AA¤H6¢-AK¤GIº5C¤Gcº5A—÷ß4{ßcß31ßlß4hß4K»ßAßZ}}{ß1ß5iß3|¦´x´´y´‡¤DEº5l¤Dsº57¤ECº5f¤EMº5L¤Dsº5R¤D8¢-Gn¤Cuº5I—÷ß4{ßcß31ßlß4hßAßZ}}{ß1ß5jß3|¦´x´´y´‡¤KUº5a¤Kyº5f¤Lcº5a¤Lmº5L¤LS¢-Gw¤Koº55¤KKºp—÷ß4{ßcß31ßlß4hßAßZ}}{ß1ß6Cß3|¦´x´´y´‡º4nº64º7Yº78¤Kº4i¤1mº64¤1Sº6c¤Aº5oº4sº65—÷ß4{ßcß3Qßlß4hß4K»ßAßa}}{ß1ß6Kß3|¦´x´´y´‡¢-VIº6v¢-V8º51¢-UKº65º73º6Gº73º4j¢-UUº4x¢-Uyº4k—÷ß4{ßcß3fßlß4hßAßb}}{ß1ß6Lß3|¦´x´´y´‡¢-OWº7X¢-O2º7U¢-NEº4d¢-Maº7T¢-Mkº4sº4b¤-yº61º7V—÷ß4{ßcß3fßlß4hßAßb}}{ß1ß6Mß3|¦´x´´y´‡¢-TMº4s¢-T2º7X¢-SEº7T¢-RQº7b¢-RG¤-y¢-Ru¤-Kº7wºv—÷ß4{ßcß3fßlß4hßAßb}}{ß1ß5kß3|¦´x´´y´‡¤Fe¤1m¤Gc¤1w¤HG¤1S¤H6¤U¤GS¤-A¤FK¤-A¤F0¤o—÷ß4{ßcß31ßlß4hßAßZ}}{ß1ß5lß3|¦´x´´y´‡¤I4¤1m¤J2¤1m¤JM¤18¤JC¤K¤IY¤-A¤Hk¤A¤Ha¤18—÷ß4{ßcß31ßlß4hßAßZ}}{ß1ß5mß3|¦´x´´y´‡¤Jq¤1m¤Ko¤2a¤Lm¤26¤MG¤e¤LS¤A¤KA¤A¤Jg¤e—÷ß4{ßcß31ßlß4hßAßZ}}{ß1ß5oß3|¦´x´´y´‡¤MG¤26¤NO¤2u¤P0¤34¤Py¤2Qºb¤18ºk¤U¤N4¤e—÷ß4{ßcß31ßlß4hßAßZ}}{ß1ß5pß3|¦´x´´y´‡¤QI¤2Q¤R6¤2k¤Ru¤2k¤SO¤1w¤S4¤18¤R6¤o¤QS¤18—÷ß4{ßcß31ßlß4hßAßZ}}{ß1ß5qß3|¦´x´´y´‡¤Ss¤1w¤Ue¤2G¤Vw¤18¤Vm¤-K¤UU¤-o¤TM¤-K¤Si¤e—÷ß4{ßcß31ßlß4hßAßZ}}{ß1ß4xß3|¦´x´´y´‡¤4X¤-T¤50¤-K¤4jÎ¤50¤-K¤3OÒ—÷ß4{ßcß2nßlß5zß4K»ßAßD}´z´ÝB}{ß1ß4yß3|¦´x´´y´‡º4f¤-yº4fº7Uº7Yº5Tºvº4qºvº7X¤1N¢-2L¤1Sº4m¤5Kº7T—÷ß4{ßcß2nß4M¨enemy_tutorial_bit¨ß4P»ß4OÎßAßD}}{ß1ß4zß3|¦´x´´y´‡¢-4W¤5eº4g¤3sºi¤-yº7f¤-Aº7g¤-yº5v¤3Eº75¤4g—÷ß4{ßcß2nß4Mß6fß4P»ß4OÎßAßD}}{ß1ß50ß3|¦´x´´y´‡ºtº4s¤9s¤m—÷ß4{ß4K»ßcß2pßAßDßlß4p}}{ß1ß51ß3|¦´x´´y´‡ºtº4s¤8q¢-3M—÷ß4{ßcß2pß4K»ßAßDßlß4p}}{ß1ß52ß3|¦´x´´y´‡¤8Eº7a¤9C¤o¤AU¤U¤9Wº6e—÷ß4{ßcß2pßl¨deco¨ß5¨tutorial_door_floor¨ßAßD}}{ß1ß53ß3|¦´x´´y´‡¤yº4m¤Aº4e¤-Kº6e¤-Kº7U¤Kº7T¤yºx¤1Iº7S—÷ß4{ßcß2ußAßDßlß6cßk»ß6bß2u}}{ß1ß54ß3|¦´x´´y´‡º5vº7Yº7Wº7Xº63º2º54º7Vº7Z¤-eºjºvº5v¤-o—÷ß4{ßcß2ußAßDßk»ßlß6cß6bß2u}}{ß1ß55ß3|¦´x´´y´‡º7b¤5eº7T¤50º7a¤50º4e¤5K¢-3a¤6Aº7S¤6cº7X¤6c—÷ß4{ßcß2ußAßDßk»ßlß6cß6bß2u}}{ß1ß56ß3|¦´x´´y´‡¤42¤5o¤42¤4q¤3O¤4C¤2a¤4W¤2G¤5A¤2Q¤5y¤3E¤68—÷ß4{ßcß2ußAßDßk»ßlß6cß6bß2u}}{ß1ß57ß3|¦´x´´y´‡º4e¤5Kº7c¤6Gº4p¤6Kº84¤6A—÷ß4{ßcß2wßAßDßk»ßlß6cß6bß2w}}{ß1ß58ß3|¦´x´´y´‡º84¤6Aº7S¤6cº7X¤6cºx¤5y—÷ß4{ßcß2wßAßDßk»ßlßmß6bß2w}}{ß1ß5Fß3|{´x´º5S´y´¤AA}÷ß4{ßcß2rß4Mß6Nß4P»ß4OÊßAßD}}{ß1ß5Gß3|{´x´¢-9M´y´¤6w}÷ß4{ßcß2rß4Mß6Nß4P»ß4OÊß4j»ßAßD}}{ß1ß5Hß3|{´x´º78´y´¤AA}÷ß4{ßcß2rß4Mß6Nß4P»ß4OÊß4j»ßAßD}}{ß1ß5Lß3|¦´x´´y´‡¤A6¢-9m¤9g¢-9Q¤A5¢-93¤9gº87¤BM¢-9O—÷ß4{ßcß32ßlß5zß4K»ßAßZ}´z´ÝB}{ß1ß5Mß3|¦´x´´y´‡¤ER¢-5Z¤E8¢-56¤Dnº8A¤E8º8B¤E8º7G—÷ß4{ßcß32ßl¨icon_tutorial¨ß4K»ßAßZ}´z´ÝB}{ß1ß5Nß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßcß32ßlß6iß4K»ßAßZ}´z´ÝB}{ß1ß5nß3|{´x´¤Dz´y´¤Y}÷ß4{ßcß31ß4M¨enemy_tutorial_block¨ß4P»ß4OÊß4j»ßAßZ}}{ß1ß5sß3|¦´x´´y´‡¤Maº75¤Lwº75¤LIº6e¤M4¢-4c¤M5º8B¤M1¢-6A¤KKº4h¤NOº4h¤Mgº4g¤M8º8B¤M7º8C—÷ß4{ßcß2zß4Mß6fß4P»ß4OÎßAßZ}}{ß1ß5tß3|¦´x´´y´‡ºHºv¤SO¤y¤RG¤U¤Py¤o¤SYº4s¤V8º4d¤Vcº4s—÷ß4{ßcß2zß4Mß6fß4OÎß4P»ßAßZ}}{ß1ß5uß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßcß2zß4Mß6fß4P»ß4OÎßAßZ}}{ß1ß5wß3|¦´x´´y´‡¤Ha¤Bm¤EW¤Bc¤C6¤8s¤D4¤1S¤GS¤2QºA¤1w¤JW¤26¤Ko¤2u¤Lw¤2Q¤K0¤9W—÷ß4{ßcß2zß4Mß6fß4O¤Cß4P»ßAßZ}}{ß1ß5Jß3|¦´x´´y´‡¤76º4i¤6a¢-7m—÷ß4{ß4K»ßcß32ßAßZßlß4p}}{ß1ß5Kß3|¦´x´´y´‡¤76º4i¤7c¢-Bu—÷ß4{ß4K»ßcß32ßAßZßlß4p}}{ß1ß5Iß3|¦´x´´y´‡¤6wº7C¤5yº5w¤7G¢-7k¤8Eº4k—÷ß4{ßcß32ßlß6gß5ß6hßAßZ}}{ß1ß5vß3|{´x´¤Hb´y´¢-C3}÷ß4{ßcß2zß4M¨enemy_tutorial_4way¨ß4P»ß4OÊßAßZ}}{ß1ß5xß3|{´x´¤R6´y´¤5o}÷ß4{ßcß2zß4M¨enemy_tutorial_down¨ß4P»ß4OÊßAßZ}}{ß1ß5Oß3|¦´x´´y´‡¤ECºi¤Ckºi¤C6ºj¤Caº4f¤Dsº4m¤Egº4q¤Egº7f—÷ß4{ßcß3DßAßZßlß6cßk»ß6bß3D}}{ß1ß5Pß3|¦´x´´y´‡¤Gwº5U¤FUºi¤F0º5SºEº4f¤Gmº7g¤Hkº5v¤Huº63—÷ß4{ßcß3DßAßZßlß6cßk»ß6bß3D}}{ß1ß5Qß3|¦´x´´y´‡¤K0º4h¤Iiºi¤IOº7W¤J2º7g¤Kyº4m¤Lwº7W¤Lmºi—÷ß4{ßcß3DßAßZßlß6cßk»ß6bß3D}}{ß1ß5Rß3|¦´x´´y´‡¤OCº5U¤N4ºi¤MQºj¤Muº75¤P0º6e¤Pyº4q¤PUºi—÷ß4{ßcß3DßAßZßlß6cßk»ß6bß3D}}{ß1ß5Sß3|¦´x´´y´‡¤GS¤-A¤FK¤-A¤F0¤o¤Fe¤1m¤Gc¤1w¤HG¤1S¤H6¤U—÷ß4{ßcß3DßAßZßlß6cßk»ß6bß3D}}{ß1ß5Tß3|¦´x´´y´‡¤IY¤-A¤Hk¤A¤Ha¤18¤I4¤1m¤J2¤1m¤JM¤18¤JC¤K—÷ß4{ßcß3DßAßZßlß6cßk»ß6bß3D}}{ß1ß5Uß3|¦´x´´y´‡¤KA¤A¤Jg¤e¤Jq¤1m¤Ko¤2a¤Lm¤26¤MG¤e¤LS¤A—÷ß4{ßcß3DßAßZßlß6cßk»ß6bß3D}}{ß1ß5Vß3|¦´x´´y´‡¤H6º7i¤GIº5C¤Gcº5A¤Hkº4h¤JCº4l¤JWº62¤IYº7h—÷ß4{ßcß3DßAßZßlß6cßk»ß6bß3D}}{ß1ß5Wß3|¦´x´´y´‡¤D8º7j¤Cuº5I¤DEº5l¤Dsº57¤ECº5f¤EMº5L¤Dsº5R—÷ß4{ßcß3DßAßZßlß6cßk»ß6bß3D}}{ß1ß5Xß3|¦´x´´y´‡¤Koº55¤KKºp¤KUº5a¤Kyº5f¤Lcº5a¤Lmº5L¤LSº7k—÷ß4{ßcß3DßAßZßlß6cßk»ß6bß3D}}{ß1ß5Yß3|¦´x´´y´‡¤EVÄ¤Do¤-G¤DG¤C¤DF¤u¤Do¤1L¤EV¤1B¤En¤Y—÷ß4{ßcß3DßAßZßlß6cßk»ß6bß3D¨map_hide_when¨ß3J}}{ß1ß5yß3|{´x´¤FM´y´¢-7V}÷ß4{ßcß30ß4Mß6Oß4P»ß4OÊßAßZ}}{ß1ß60ß3|¦´x´´y´‡¤E6¢-1h¤EBº6D—÷ß4{ßcß33ßlß5zß4K»ßAßZ}´z´ÝB}{ß1ß61ß3|¦´x´´y´‡¤E4¢-1X¤E4º8Q—÷ß4{ßcß33ßlß5zß4K»ßAßZ}´z´ÝB}{ß1ß62ß3|{´x´¤Eg´y´º6H}÷ß4{ßcß35ß4Mß6Nß4P»ß4OÊß4j»ßAßZ}}{ß1ß66ß3|{´x´¤Bw´y´º5g}÷ß4{ßcß35ß4Mß6Nß4P»ß4OÊß4j»ßAßZ}}{ß1ß63ß3|¦´x´´y´‡¤Bcº57¤Gw¢-JC¤Gm¢-L8¤E2º5Y¤BSº5p¤9g¢-Ii¤9qº5u—÷ß4{ßcß35ßlß4kß4m£0.BIßAßZ}}{ß1ß64ß3|¦´x´´y´‡¤D8º7j¤EC¢-FN—÷ß4{ßcß35ßlß4ußAßZ}}{ß1ß67ß3|¦´x´´y´‡º4y¢-Egº7sº7k—÷ß4{ß4K»ßcß3LßAßaßlß4p}}{ß1ß68ß3|¦´x´´y´‡¢-LIº79º5Oº5h¢-Muº55º74ºp—÷ß4{ßcß3Lßlß6gß5ß6hßAßa}}{ß1ß6Aß3|¦´x´´y´‡º4sº65º4nº64º7Yº78¤Kº4i¤1mº64¤1Sº6c¤Aº5o—÷ß4{ßcß3XßAßaßlß6cßk»ß6bß3X}}{ß1ß6Bß3|¦´x´´y´‡º5aº5gº7Iº7Iº53º5cº52º5lº4vº5gº5nº7Jº5oº5O—÷ß4{ßcß3ZßAßaßlß6cßk»ß6bß3Z}}{ß1ß6Hß3|¦´x´´y´‡º7lº6vº7mº51º7nº65º73º6Gº73º4jº7oº4xº7pº4k—÷ß4{ßcß3pßlß6cßAßbß6bß3pßk»}}{ß1ß6Iß3|¦´x´´y´‡º7vº4sº7wº7Xº7xº7Tº7yº7bº7z¤-yº80¤-Kº7wºv—÷ß4{ßcß3pßlß6cßAßbß6bß3pßk»}}{ß1ß6Jß3|¦´x´´y´‡º7qº7Xº7rº7Uº7sº4dº7tº7Tº7uº4sº4b¤-yº61º7V—÷ß4{ßcß3pßlß6cßAßbß6bß3pßk»}}{ß1ß6Qß3|¦´x´´y´‡¤Lw¤fc¤EC¤fw—÷ß4{ßcß3vßlß4ußAßI}}{ß1ß6Rß3|¦´x´´y´‡ºA¤GI¤E2¤G8—÷ß4{ßcß3rßlß4ußAßI}}{ß1ß6Tß3|¦´x´´y´‡¤DE¤gQ¤CQ¤ga¤CG¤hY¤Ck¤iC¤DO¤iW¤E2¤iM¤EW¤hs¤EM¤gu—÷ß4{ßcß4BßAßIßlß6cßk»ß6bß4B}}{ß1ß6Uß3|¦´x´´y´‡¤RG¤oUºO¤pS¤Qw¤qa¤S4¤quºH¤qa¤TC¤pS¤SO¤oe—÷ß4{ßcß4BßAßIßlß6cßk»ß6bß4B}}{ß1ß6Vß3|¦´x´´y´‡¤Rk¤rE¤Qw¤ri¤Qw¤sg¤Ra¤tK¤SY¤tAºH¤sM¤SiºY—÷ß4{ßcß4BßAßIßlß6cßk»ß6bß4B}}{ß1ß6Wß3|¦´x´´y´‡¤Ss¤tU¤Ra¤ty¤R6¤v6¤Rk¤wE¤Si¤wY¤Tg¤vk¤Tq¤uS—÷ß4{ßcß4BßAßIßlß6cßk»ß6bß4B}}{ß1ß6Xß3|¦´x´´y´‡¤Vg¤jA¤Wu¤jA¤XO¤km¤WA¤km—÷ß4{ßcß4DßAßIßk»ßlßmß6bß4D}}{ß1ß5Zß3|¦´x´´y´‡¤Gh¢-43¤G8ºx¤FPº4q—÷ß4{ßcß2yßlß6ZßAßZ}}{ß1ß5aß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Keº2—÷ß4{ßcß2yßlß6ZßAßZ}}{ß1ß5bß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Oj¢-5p¤P3¢-5i¤Td¢-67¤PE¢-4S¤OX¢-3f¤OCº4s¤N9º4m—÷ß4{ßcß2yßlß6ZßAßZ}}{ß1ß5cß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßcß2yßlß6ZßAßZ}}{ß1ß5Eß3|¦´x´´y´‡º7c¤6Gº4h¤42º4i¤50º8i¤83º4k¤BIº4l¤D4º4m¤B8º7F¤7A—÷ß4{ß4K»ßcß2rßlß4JßAßD}}{ß1ß65ß3|¦´x´´y´‡¤Gmº56¤Gcº5O¤E2º5N¤Bcº50¤A0º5M¤AAº5L¤Bwº57—÷ß4{ß4K»ßcß35ßlß4JßAßZ}}÷¨icons¨|÷}");
