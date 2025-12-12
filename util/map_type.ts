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
  spawn_angle?: number;
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
export const TEST_MAP: map_type = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢44u´y´¢1HW}÷¨options¨{¨style¨ß2¨contains¨|¨home main¨¨home inventory¨¨home shapestore¨÷¨room_id¨´´}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ßB¨room_connections¨|¨tutorial room 1¨÷¨is_room¨»ßA´´}}{ß1¨station¨ß3|{´x´¢1RC´y´¢1NU}÷ß4{ßC|¨station tutorial¨¨station streets¨¨tutorial room 5¨¨streets side room 1¨¨station home¨÷ß6|¨train¨ßG¨station tracks¨ßH¨station tracks particle¨¨station map train¨¨station map tracks 1¨¨station map tracks 2¨¨station map tracks 3¨¨station map tracks 4¨ßK÷ßA´´ßE»}}{ß1¨streets¨ß3|{´x´¢1ya´y´¢-xC}÷ß4{ßA´´ß6|¨streets room 1¨ßJ¨streets room 2¨¨streets room 3¨¨streets room 4¨¨streets room 5¨¨streets room 3.1¨÷}´z´£0.-84}{ß1¨tutorial¨ß3|{´x´¢-WG´y´º8}÷ß4{ß6|ßD¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨ßI÷ßA´´}}{ß1ß8ß3|{´x´¢3kk´y´¢HQ}÷ß4{ß5ß2ßA´´ßE»¨parent¨ß2ßC|ß7÷ß6|¨home inventory wall¨÷}}{ß1ß7ß3|{´x´¢3uQ´y´¢mE}÷ß4{ß5ß2ßA´´ßE»ßeß2ßC|ß8ßKß9÷ß6|¨home floor¨÷}}{ß1ß9ß3|{´x´¢4Ja´y´¢FA}÷ß4{ß5ß2ßA´´ßE»ßeß2ßC|ß7÷ß6|¨home shapestore wall¨¨home shapestore window¨÷}}{ß1ßKß3|{´x´¢3Zc´y´¢1BY}÷ß4{ßeßFßAßFßE»ßC|ßFßHß7÷ß6|¨station home wall 2¨¨station home wall 1¨¨station home floor¨÷}}{ß1ßPß3|¦´x´´y´‡¢T2¢12WºH¢13K¢mOºJºKºI—÷ß4{ßeßFßAßF¨is_map¨»¨make_id¨¨map_shape¨}}{ß1ßQß3|¦´x´´y´‡ºKºIºKºJ¢1L4ºJºLºI—÷ß4{ßeßFßAßFßm»ßnßo}}{ß1ßRß3|¦´x´´y´‡ºLºIºLºJ¢1vMºJºMºI—÷ß4{ßeßFßAßFßm»ßnßo}}{ß1ßSß3|¦´x´´y´‡ºMºIºMºJ¢29sºJºNºI—÷ß4{ßeßFßAßFßm»ßnßo}}{ß1ßOß3|¦´x´´y´‡¢Qc¢10uºO¢14w¢YgºQºRºP—÷ß4{ßeßFßAßFßm»ßnßo}}{ß1ßHß3|{´x´¢1dc´y´¢12g}÷ß4{ßeßFß6|¨station streets rock 1¨¨station streets rock 2¨¨station streets rock 3¨¨station streets sensor start¨¨station streets rock 0¨¨station streets sensor end¨¨station streets rock block¨¨station streets rock 4¨¨station streets rock 5¨¨station streets rock 6¨¨station streets rock 7¨¨station streets rock 8¨¨station streets floor 1¨¨station streets floor 1.5¨¨station streets floor 2¨¨station streets floor 2.5¨¨station streets floor 3¨¨station streets floor 3.5¨¨station streets wall 1¨¨station streets wall 2¨¨station streets wall 3¨¨station streets floor 0¨¨station streets floor 4¨¨station streets floor 5¨¨station streets floor 4.5¨¨station streets wall 5¨¨station streets wall 6¨¨station streets wall 7¨¨station streets wall 8¨¨station streets wall 9¨¨station streets wall 10¨¨station streets wall 11¨¨station streets wall 13¨¨station streets rocky 1¨¨station streets wall fake 1¨¨station streets wall 14¨¨station streets floor 4.1¨¨station streets wall 12¨¨station streets breakables 1¨¨station streets breakables 2¨¨station streets breakables 2.5¨¨station streets map shape 1¨¨station streets map shape 2¨¨station streets map shape 3¨¨station streets map shape 4¨¨station streets map shape 5¨¨station streets map shape 6¨¨station streets map shape 7¨¨station streets egg 1¨÷ßAßFßE»ßC|ßFßUßJßGßK÷}´z´£0.-3E}{ß1ßMß3|¦´x´´y´‡ºHºI¢3U8ºIºUºJºHºJ—÷ß4{ßeßFßn¨floor_train_track¨ßAßF¨sensor_dont_set_room¨»}}{ß1ßNß3|¦´x´´y´‡ºHºIºHºJ—÷ß4{ßeßFßnß1cßAßFß1d»}}{ß1ßGß3|{´x´¢VS´y´¢yA}÷ß4{ßeßFß6|¨station tutorial floor¨¨station tutorial sensor start¨¨station tutorial wall 1¨¨station tutorial wall 2¨¨station tutorial rock 1¨¨station tutorial rock 2¨¨station tutorial rock 3¨¨tutorial floor low¨¨station tutorial sensor end¨¨station tutorial map shape 1¨¨station tutorial map shape 2¨¨station tutorial map shape 3¨÷ßAßFßE»ßC|ßIßFßH÷}}{ß1ßUß3|{´x´¢1zO´y´¢rO}÷ß4{ßeßTßA´´ßE»ßC|ßHßV÷ß6|¨streets room 1 camera 1¨¨streets room 1 sensor start¨¨streets room 1 camera 2¨¨streets room 1 camera 0¨¨streets room 1 floor¨¨streets room 1 sensor end¨¨streets room 1 camera 3¨¨streets room 1 map shape 1¨¨streets room 1 wall 1¨¨streets room 1 wall 2¨÷}´z´Ý0}{ß1ßVß3|{´x´¢26U´y´ºR}÷ß4{ßeßTßA´´ßE»ßC|ßUßWßXßZ÷ß6|¨streets room 2 rock 1¨¨streets room 2 sensor start 1¨¨streets room 2 floor¨¨streets room 2 checkpoint¨¨streets room 2 map shape 1¨¨streets room 2 rock 2¨¨streets room 2 rock 3¨¨streets room 2 door 1¨¨streets room 2 door 2¨¨streets room 2 door 3¨¨streets room 2 wall 1¨¨streets room 2 wall 2¨¨streets room 2 door 4¨¨streets room 2 wall 3¨¨streets room 2 camera 1¨¨streets room 2 camera 2¨¨streets room 2 sensor start 2¨¨streets room 2 sensor start 3¨¨streets room 2 camera 3¨¨streets room 2 camera 4¨¨streets room 2 map shape 2¨¨streets room 2 map shape 3¨¨streets room 2 map shape 4¨¨streets room 2 map shape 5¨¨streets room 2 map shape 6¨¨streets room 2 switch¨÷}´z´Ý0}{ß1ßWß3|{´x´¢1tk´y´¢Po}÷ß4{ßeßTßA´´ßE»ßC|ßVßYßZ÷ß6|¨streets room 3 floor¨¨streets room 3 sensor 1¨¨streets room 3 wall 1¨¨streets room 3 enemy 1¨¨streets room 3 rock 1¨¨streets room 3 rock 2¨¨streets room 3 wall 2¨¨streets room 3 enemy turret¨¨streets room 3 enemy 3¨¨streets room 3 wall 3¨¨streets room 3 door 1¨¨streets room 3 rocky 1¨¨streets room 3 enemy 2¨¨streets room 3 enemy 4¨¨streets room 3 rocky 2¨¨streets room 3 rock 3¨¨streets room 3 floor tip¨¨streets room 3 rocky 3¨¨streets room 3 wall 4¨¨streets room 3 camera 1¨¨streets room 3 camera 2¨¨streets room 3 map shape 1¨¨streets room 3 map shape 2¨¨streets room 3 shapey¨÷}´z´Ý0}{ß1ßZß3|{´x´¢1kE´y´¢WG}÷ß4{ßeßTßA´´ßE»ßC|ßWßV÷ß6|¨streets room 3.1 floor 1¨÷}´z´Ý0}{ß1ßXß3|{´x´¢2NQ´y´¢OM}÷ß4{ßeßTßA´´ßE»ßC|ßV÷ß6|¨streets room 4 floor¨¨streets room 4 wall 1¨¨streets room 4 enemy 1¨¨streets room 4 wall 2¨¨streets room 4 wall fake 1¨¨streets room 4 camera 1¨÷}´z´Ý0}{ß1ßYß3|{´x´¢1ok´y´º3}÷ß4{ßeßTßA´´ßE»ßC|ßW÷ß6|¨streets room 5 floor¨¨streets room 5 wall 1¨¨streets room 5 window 1¨¨streets room 5 window 2¨¨streets room 5 camera 1¨¨streets room 5 wall 2¨¨streets room 5 map shape 1¨÷}´z´Ý0}{ß1ßJß3|{´x´¢1wo´y´¢1C2}÷ß4{ßeßTßA´´ßE»ßC|ßHßF÷ß6|¨streets side room 1 floor¨¨streets side room 1 wall 1¨¨streets side room 1 wall 2¨¨streets side room 1 wall fake 1¨¨streets side room 1 test¨¨streets side room 1 window 1¨¨streets side room 1 map shape 1¨¨streets side room 1 map shape 2¨¨streets side room 1 map shape 3¨÷}´z´£0.-6S}{ß1ßLß3|¦´x´´y´‡ºOºP¢TRºP—{´x´ºj´y´ºP´z´£0.4q}{´x´¢Vr´y´ºP´z´Ý3}{´x´ºk´y´ºP}{´x´ºR´y´ºP}{´x´ºR´y´ºP´z´£0.84}{´x´ºO´y´ºP´z´Ý4}÷ß4{ßeßFßn¨wall_train¨ß6|¨train floor broken¨¨train wall 1¨¨train wall 2¨¨train wall 3¨¨train ceiling¨¨train sensor¨¨train door right¨¨train door right path¨¨train door left¨¨train door left path¨¨train floor¨¨train floor broken top¨¨train floor broken bottom¨¨train floor broken middle¨÷¨seethrough¨»ßAßF}}{ß1ßDß3|{´x´¢-68´y´¢-50}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨¨tutorial room 1 floor¨¨tutorial room 1 map shape 1¨¨tutorial room 1 map shape 2¨¨tutorial room 1 map shape 3¨÷ßeßaßE»ßC|ßbßdßBßc÷ßA´´}}{ß1ßbß3|{´x´¢OW´y´¢-DO}÷ß4{ßeßaß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨tutorial room 2 floor¨¨tutorial room 2 floor platform¨¨tutorial room 2 map shape 1¨¨tutorial room 2 map shape 2¨¨tutorial room 2 map shape 3¨¨tutorial room 2 map shape 4¨¨tutorial room 2 map shape 5¨¨tutorial room 2 map shape 6¨¨tutorial room 2 map shape 7¨÷ßE»ßC|ßIßDßc÷ßA´´}}{ß1ßcß3|{´x´¢-JM´y´¢-Tg}÷ß4{ßeßaß6|¨tutorial window 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨¨tutorial room 3 floor¨¨tutorial room 3 enemy 1¨¨tutorial room 3 map shape 1¨¨tutorial room 3 map shape 2¨¨tutorial room 3 map shape 3¨¨tutorial room 3 map shape 4¨¨tutorial room 3 map shape 5¨÷ßE»ßC|ßcßdßbßD÷ßA´´}}{ß1ßdß3|{´x´¢-Z0´y´¢-Gc}÷ß4{ßeßaß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨¨tutorial room 4 floor¨¨tutorial room 4 map shape 1¨÷ßE»ßC|ßcßD÷ßA´´}}{ß1ßIß3|{´x´¢9t´y´¢GK}÷ß4{ßeßaß6|¨tutorial room 5 sensor boss¨¨tutorial room 5 door start¨¨tutorial room 5 sensor boss start¨¨tutorial room 5 boss¨¨tutorial room 5 floor¨¨tutorial room 5 door end¨¨tutorial wall 15¨¨tutorial wall 16¨¨tutorial rock 23¨¨tutorial room 5 enemy¨¨tutorial rock 24¨¨tutorial rock 25¨¨tutorial rock 26¨¨tutorial rock 27¨¨tutorial room 5 switch path¨¨tutorial room 5 sensor middle¨¨tutorial room 5 sensor boss end¨¨tutorial wall 14¨¨tutorial room 5 rocky 3¨¨tutorial fake wall 5¨¨tutorial room 5 map shape 1¨¨tutorial room 5 map shape 2¨¨tutorial room 5 map shape 3¨¨tutorial room 5 map shape 4¨¨tutorial room 5 map shape 5¨¨tutorial room 5 map shape 6¨¨tutorial room 5 map shape 7¨¨tutorial room 5 map shape 8¨÷ßE»ßC|ßbßGßF÷ßA´´}}{ß1ßgß3|¦´x´´y´‡¢4S8¢9M¢4FE¢-U¢3tS¢-2Q¢3e8¤3Y¢3Te¤Eq¢3QQ¤RaºU¤gu¢3jm¤oK¢438¤pw¢4Q2¤hs¢4XIºf—÷ß4{ßeß7ßn¨floor¨ßAß7}}{ß1ßfß3|¦´x´´y´‡¢3tI¤H6¢3sK¤DE¢3oI¤AU¢3jI¤9q¢3ec¤Bm¢3cW¤Gc¢3dA¤Lc¢3hqºn¢3neºf¢3rg¤Lmº18¤H6—÷ß4{ßeß8ßn¨wall¨ßAß8¨open_loop¨»}}{ß1ßhß3|¦´x´´y´‡¢4Tu¤Eqºvºw¢4NI¤5e¢4GC¤5y¢4B2ºw¢488¤F0¢49a¤KU¢4Eu¤OC¢4M0¤Og¢4Ro¤Lcº1I¤Eq—÷ß4{ßeß9ßnß4zßAß9ß50»}}{ß1ßiß3|¦´x´´y´‡¢4Ac¤AA¢4HA¤Cu¢4My¤CQ¢4SI¤9qºvºwº1J¤5eº1K¤5yº1Lºwº1R¤AA—÷ß4{ßeß9ßn¨wall_window¨ßAß9ß50»}}{ß1ßlß3|¦´x´´y´‡¢3no¤uS¢3Qu¤uS¢3Pc¤yUº1X¢17M¢3p6º1Yº1Z¤yU—÷ß4{ßeßKßnß4yßAßK}}{ß1ßkß3|¦´x´´y´‡¢3h2¤yUº1W¤yUº1W¢106—÷ß4{ßeßKßnß4zßAßKß50»}}{ß1ßjß3|¦´x´´y´‡º1W¢15kº1Wº1Yº1aº1Y—÷ß4{ßeßKßnß4zßAßKß50»}}{ß1ß1Rß3|¦´x´´y´‡¢1Viºi¢1VE¢14c¢1RMº1Yº1g¤wY¢1cA¤sC¢1aE¤xM¢1VY¤yK¢1ZG¢114—÷ß4{ßeßH¨spawn_enemy¨¨enemy_streets_bit¨¨spawn_repeat¨¤K¨is_spawner¨»ßAßH}´z´£0.-1c}{ß1ß1Sß3|{´x´¢1jG´y´¤vu´z´Ý1}{´x´¢1bM´y´¤ws}{´x´¢1co´y´¤s2}÷ß4{ßeßHß52ß53ß54Íß55»ßAßH}´z´Ý1}{ß1ß1Tß3|{´x´¢1fi´y´¢1CM´z´Ý1}{´x´¢1aO´y´¢1Cg}{´x´ºS´y´¢15a´z´Ý1}{´x´¢1bg´y´¢10k}{´x´¢1ic´y´¤zS}÷ß4{ßeßHß52ß53ß54Ðß55»ßAßH}´z´Ý1}{ß1ß1bß3|{´x´ºX´y´¤yy}÷ß4{ßeßHß52¨collect_egg_1¨ß55»¨spawn_permanent¨»ßAßH}´z´Ý2}{ß1ß1Aß3|¦´x´´y´‡¢1Qi¤vuº1x¢1Aa¢1RWº1yº1z¤vu—÷ß4{ßeßHßnß4yßAßH}´z´Ý5}{ß1ß11ß3|¦´x´´y´‡¢1Qs¤wOº20¢18y¢1Uk¢1Fk¢1dI¤pc—÷ß4{ßeßHßnß4yßAßH¨safe_floor¨»ß5¨wall_floor¨}´z´Ý5}{ß1ß12ß3|¦´x´´y´‡º24¤pcº22º23—{´x´º22´y´º23´z´Ý1}{´x´º24´y´¤pc´z´Ý1}÷ß4{ßeßHßnß59ßAßH}´z´Ý5}{ß1ß13ß3|¦´x´´y´‡º24¤pcº22º23¢1fOº23¢1ks¤pc—÷ß4{ßeßHßnß4yßAßHß58»ß5ß59}´z´Ý1}{ß1ß14ß3|¦´x´´y´‡º26¤pcº25º23—{´x´º25´y´º23´z´£0.-4q}{´x´º26´y´¤pc´z´Ý6}÷ß4{ßeßHßnß59ßAßH}´z´Ý1}{ß1ß15ß3|¦´x´´y´‡º26¤pcº25º23¢1xI¢1DK¢1us¤ri—÷ß4{ßeßHßnß4yßAßHß58»ß5ß59}´z´Ý6}{ß1ß16ß3|¦´x´´y´‡º29¤riº27º28—{´x´º27´y´º28´z´Ý2}{´x´º29´y´¤ri´z´Ý2}÷ß4{ßeßHßnß59ßAßH}´z´Ý6}{ß1ß1Bß3|¦´x´´y´‡º29¤riº27º28—{´x´¢20g´y´¢1Ak´z´Ý2}{´x´¢21o´y´º1y´z´Ý2}{´x´¢202´y´¢1DU}{´x´¢27S´y´¢1De´z´Ý2}{´x´¢23u´y´¤uw}÷ß4{ßeßHßnß4yßAßHß58»}´z´Ý2}{ß1ß1Pß3|{´x´º2H´y´¤uw´z´Ý2}{´x´º2F´y´º2G}÷ß4{ßeßHßn¨wall_floor_halfwidth¨ßAßH}´z´Ý2}{ß1ß1Dß3|¦´x´´y´‡º2H¤uwº2Fº2G—{´x´º2F´y´º2G´z´Ý0}{´x´º2H´y´¤uw´z´Ý0}÷ß4{ßeßHßnß59ßAßH}´z´Ý2}{ß1ß1Cß3|{´x´º2H´y´¤uw´z´Ý0}{´x´º2F´y´º2G}{´x´¢2LA´y´¢12v´z´Ý0}{´x´¢294´y´¤uw}÷ß4{ßeßHßnß4yßAßHß58»}´z´Ý0}{ß1ß1Uß3|¦´x´´y´‡º1xº21º1jº28¢1ce¤rYº1x¤wO—÷ß4{ßeßHßAßHßm»ßnßoß6|¨station streets map rock 1¨¨station streets map rock 2¨÷}}{ß1ß1Vß3|¦´x´´y´‡º1jº28¢1g2º1s¢1ja¤vkº2L¤rY—÷ß4{ßeßHßAßHßm»ßnßoß6|¨station streets map rock 3¨¨station streets map rock 4¨¨station streets map line 1¨÷}}{ß1ß1Wß3|¦´x´´y´‡º2Mº1s¢1oQ¢1Au¢1wyº1yºM¤w4¢1pi¤tUº2N¤vk—÷ß4{ßeßHßAßHßm»ßnßoß6|¨station streets map rock 5¨¨station streets map rock 6¨¨station streets map rock 7¨¨station streets map line 2¨÷}}{ß1ß1Xß3|¦´x´´y´‡º2Qº1y¢26o¢1AGº2H¤uwºM¤w4—÷ß4{ßeßHßAßHßm»ßnßoß6|¨station streets map rock 8¨¨station streets map rock 9¨¨station streets map line 3¨÷}}{ß1ß1Yß3|¦´x´´y´‡º2Sº2TºN¢19mºN¤zI¢2D6º1vº2V¤zIºN¤w4º2K¤uwº2F¤um¢25q¤umº2H¤uw—÷ß4{ßeßHßAßHßm»ßnßoß6|¨station streets map line 4¨÷}}{ß1ß1Zß3|¦´x´´y´‡ºNº2Uº2V¢16Yº2V¢156ºNº2X—÷ß4{ßeßHßAßHßm»ßnßo}}{ß1ß1aß3|¦´x´´y´‡¢1ys¢10L¢21e¤yW¢1xy¤xw—÷ß4{ßeßHßAßHßm»ßnßo¨force_layer¨Ê}}{ß1ßtß3|¦´x´´y´‡¢1Uu¢15Qº1e¢19S¢1SU¢172—÷ß4{ßeßHßn¨rock¨ßAßH}´z´Ý5}{ß1ßpß3|¦´x´´y´‡¢1ZQ¤xq¢1YSº1b—{´x´¢1WM´y´¤yU´z´Ý5}÷ß4{ßeßHßnß5PßAßH}´z´Ý5}{ß1ßqß3|¦´x´´y´‡¢1d8º1t¢1b2º2U—{´x´¢1Ym´y´¢15G´z´Ý1}÷ß4{ßeßHßnß5PßAßH}´z´Ý1}{ß1ßrß3|¦´x´´y´‡¢1fY¤zm¢1cK¢10GºS¤xW—÷ß4{ßeßHßnß5PßAßH}´z´Ý1}{ß1ßwß3|¦´x´´y´‡¢1nI¢16s¢1im¢19cº26º2e—÷ß4{ßeßHßnß5PßAßH}´z´Ý6}{ß1ßxß3|¦´x´´y´‡¢1scº1vº2s¢10Q¢1qW¤w4—÷ß4{ßeßHßnß5PßAßH}´z´Ý6}{ß1ßyß3|¦´x´´y´‡¢1uEº2e¢1tQ¢16iº2wº2o—÷ß4{ßeßHßnß5PßAßH}´z´Ý6}{ß1ßzß3|¦´x´´y´‡¢244¢1A6¢1yuº2f¢22Iº2e—÷ß4{ßeßHßnß5PßAßH}´z´Ý2}{ß1ß10ß3|{´x´¢1xw´y´¤xq}{´x´º2C´y´¤yU´z´Ý2}{´x´º34´y´º2x}÷ß4{ßeßHßnß5PßAßHß50»}´z´Ý2}{ß1ßvß3|¦´x´´y´‡¢2Hwº2JºNº2XºN¤zI—÷ß4{ßeßHßnß5PßAßH}´z´Ý0}{ß1ß1Mß3|{´x´¢2CN´y´¢169}÷ß4{ßeßHß52¨enemy_streets_rocky_small¨ß55»ßAßHß57»}´z´Ý0}{ß1ßuß3|¦´x´´y´‡¢2Ei¤vGº3A¢1CC¢1mUº3Bº3C¤vG—÷ß4{ßeßHßn¨sensor¨ßAßH}´z´Ý0}{ß1ßsß3|¦´x´´y´‡¢1Ty¤v5¢1UGº28º1xº3Bº20¤vG—÷ß4{ßeßHßnß5RßAßH}}{ß1ß17ß3|¦´x´´y´‡º2H¤uwºM¤w4—÷ß4{ß50»ßeßHßnß4zßAßH}´z´Ý2}{ß1ß18ß3|{´x´º2L´y´¤rY}{´x´º1x´y´¤wO´z´Ý5}{´x´º1x´y´ºP}÷ß4{ß50»ßeßHßnß4zßAßH}´z´Ý5}{ß1ß19ß3|¦´x´´y´‡º2N¤vkº2L¤rY—÷ß4{ß50»ßeßHßnß4zßAßH}´z´Ý1}{ß1ß1Eß3|¦´x´´y´‡º1jº28º1xº21—{´x´º1x´y´ºQ´z´Ý5}÷ß4{ß50»ßeßHßnß4zßAßH}´z´Ý5}{ß1ß1Fß3|¦´x´´y´‡º2Mº1sº1jº28—÷ß4{ß50»ßeßHßnß4zßAßH}´z´Ý1}{ß1ß1Gß3|{´x´º2Q´y´º1y´z´Ý6}{´x´º2O´y´º2P}{´x´º2M´y´º1s}÷ß4{ß50»ßeßHßnß4zßAßH}´z´Ý6}{ß1ß1Hß3|¦´x´´y´‡ºM¤w4º2R¤tUº2N¤vk—÷ß4{ß50»ßeßHßnß4zßAßH}´z´Ý6}{ß1ß1Iß3|¦´x´´y´‡º1xºQº1xº21—÷ß4{ß50»ßeßHßnß4zßAßH}´z´Ý0}{ß1ß1Jß3|{´x´º1x´y´¤wO´z´Ý0}{´x´º1x´y´ºP}÷ß4{ß50»ßeßHßnß4zßAßH}´z´Ý0}{ß1ß1Kß3|¦´x´´y´´z´‡º2Sº2TÝ2º2C¢1AQÝ2º6¢1FQÝ2—÷ß4{ß50»ßeßHßnß4zßAßH}´z´Ý2}{ß1ß1Qß3|¦´x´´y´‡¢1weº3G¢1zsº2Pº2Qº1y—÷ß4{ß50»ßeßHßnß4zßAßH}´z´Ý2}{ß1ß1Lß3|¦´x´´y´‡º2Vº2Yº2Vº2XºNº2Uº2Sº2T—÷ß4{ß50»ßeßHßnß4zßAßH}´z´Ý0}{ß1ß1Oß3|¦´x´´y´‡º2F¤umº2K¤uwºN¤w4—{´x´º2V´y´¤zI´z´Ý0}{´x´º2V´y´º1v}÷ß4{ß50»ßeßHßnß4zßAßH}´z´Ý0}{ß1ß1Nß3|{´x´º36´y´¤xq}{´x´º34´y´º2x´z´Ý2}÷ß4{ßeßHßn¨wall_streets_fake¨ß50»ß57»ßAßH}´z´Ý2}{ß1ß1eß3|¦´x´´y´‡¤am¤w4¤YM¤o0¤X4¤o0¤Y2¤rE¤Fo¤s2¤Gw¤yy¤Gwº1YºVº1YºV¢18e¤X4º3J¤X4º1Y¤amº1Y¤am¢130—÷ß4{ßeßGßnß4yß58»ßAßG}}{ß1ß1nß3|¦´x´´y´‡¤ZU¤w4¤RG¤w4¤Gw¤yy¤Gwº1Y¤ZUº1Y—÷ß4{ßeßGßAßGßm»ßnßo}}{ß1ß1oß3|¦´x´´y´‡¤ZYº1c¤ZUº1c¤ZUº1b¤ZYº1b¤ZY¤w4¤am¤w4¤amº1Y¤ZYº1Y—÷ß4{ßeßGßAßGßm»ßnßo}}{ß1ß1pß3|¦´x´´y´‡ºV¢17QºVº3J¤X4º3J¤X4º3L—÷ß4{ßeßGßAßGßm»ßnßo}}{ß1ß1iß3|¦´x´´y´‡¢14S¤tAº2h¤uw¢17g¤y0º2Yº2x¢11s¤zmº2r¤xC¢11O¤uI—÷ß4{ßeßGßnß5PßAßG}´z´Ý0}{ß1ß1jß3|¦´x´´y´‡¢1Emº2e¢1GO¢164¢1Giº3Nº23¢19I¢1Dy¢198¢1Cqº3Nº28º3S—÷ß4{ßeßGßnß5PßAßG}´z´Ý0}{ß1ß1kß3|¦´x´´y´‡¢1K6¤xM¢1LE¤xq¢1LY¤yy¢1Kkº2x¢1J8º1b¢1IK¤yo¢1Iy¤xg—÷ß4{ßeßGßnß5PßAßG}´z´Ý0}{ß1ß1mß3|¦´x´´y´‡º5¤vGº5º3B¢1PQº3Bº3f¤vG—÷ß4{ßeßGßnß5RßAßG}}{ß1ß1fß3|¦´x´´y´‡ºH¤wY¤KK¤yy¤KKº2rºHº2r¤Ue¤zmºdº2r¤ZU¤wY—÷ß4{ßeßGßnß5R¨sensor_fov_mult¨ÊßAßG}}{ß1ß1gß3|¦´x´´y´‡¤RG¤w4¤Op¤wi—÷ß4{ß50»ßeßGßnß4zßAßG}}{ß1ß1hß3|¦´x´´y´‡¤Mk¤xM¤Gw¤yy¤Gwº1Y¤ZUº1Y¤ZUº1c—÷ß4{ß50»ßeßGßnß4zßAßG}}{ß1ß1tß3|{´x´¢2CI´y´¤zS}÷ß4{ßeßUß52¨enemy_streets_camera_small¨ß55»ßAßU}´z´Ý0}{ß1ß1qß3|{´x´¢24O´y´¤to}÷ß4{ßeßUß52ß5Uß55»ßAßU}´z´Ý0}{ß1ß1sß3|{´x´¢27I´y´ºC}÷ß4{ßeßUß52ß5Uß55»ßAßU}´z´Ý0}{ß1ß1wß3|{´x´¢252´y´¤fw}÷ß4{ßeßUß52ß5Uß55»ßAßU}´z´Ý0}{ß1ß1uß3|¦´x´´y´‡º2H¤uw¢29O¤v6—{´x´º2F´y´¤nC´z´Ý0}{´x´¢2A2´y´¤iM}{´x´¢25C´y´¤iM}{´x´º35´y´¤nC}÷ß4{ßeßUßnß4yßAßUß58»}´z´Ý0}{ß1ß1xß3|¦´x´´y´‡º2W¤umº2F¤um¢28u¤uSº2F¤nCº3l¤iM¢28G¤eK¢23Q¤eKº3m¤iMº35¤nC¢23k¤uS—÷ß4{ßeßUßAßUßm»ßnßo}}{ß1ß1vß3|{´x´¢22w´y´¤fS}{´x´º3r´y´¤ee´z´Ý0}{´x´º3k´y´¤ee´z´Ý0}{´x´º3k´y´¤fS}÷ß4{ßeßUßnß5RßAßUß5T£0.Cu}´z´Ý0}{ß1ß1rß3|{´x´º3p´y´¤te}{´x´º3p´y´¤sq´z´Ý0}{´x´ºN´y´¤sq´z´Ý0}{´x´ºN´y´¤te}÷ß4{ßeßUßnß5RßAßUß5TÝ7}´z´Ý0}{ß1ß1yß3|{´x´º3p´y´¤eK}{´x´º3m´y´¤iM´z´Ý0}{´x´º35´y´¤nC}{´x´º2H´y´¤uw}{´x´º2W´y´¤um´z´Ý0}{´x´º3q´y´¤uS}÷ß4{ß50»ßeßUßnß4zßAßU}´z´Ý0}{ß1ß1zß3|¦´x´´y´‡º3o¤eKº3l¤iMº2F¤nCº3n¤uSº2F¤um—÷ß4{ß50»ßeßUßnß4zßAßU}´z´Ý0}{ß1ß2Eß3|{´x´¢2DG´y´¤Jq}÷ß4{ßeßVß52ß5Uß55»ßAßV}´z´Ý0}{ß1ß2Fß3|{´x´º2b´y´¤Jg}÷ß4{ßeßVß52ß5Uß55»ßAßV}´z´Ý0}{ß1ß2Iß3|{´x´¢2Ge´y´¤Wk}÷ß4{ßeßVß52ß5Uß55»ß54ÊßAßV}´z´Ý0}{ß1ß2Jß3|{´x´¢2Ia´y´¤LI}÷ß4{ßeßVß52ß5Uß55»ßAßV}´z´Ý0}{ß1ß23ß3|{´x´º3o´y´¤Qw}÷ß4{ßeßVß52¨checkpoint_streets_room_2¨ß55»ßAßV}´z´Ý0}{ß1ß27ß3|¦´x´´y´‡¢210ºHº6¤Wk—÷ß4{ß50»ßeßVßn¨wall_door¨ßAßV}´z´Ý0}{ß1ß28ß3|¦´x´´y´´z´‡º3j¤MkÝ0º3o¤HkÝ0—÷ß4{ß50»ßeßVßnß5WßAßV}´z´Ý0}{ß1ß29ß3|{´x´¢2FW´y´ºH}{´x´º37´y´¤Wk´z´Ý0}÷ß4{ß50»ßeßVßnß5WßAßV}´z´Ý0}{ß1ß2Cß3|¦´x´´y´´z´‡¢29i¤K0Ý0º3o¤HkÝ0—÷ß4{ß50»ßeßVßnß5WßAßV}´z´Ý0}{ß1ß22ß3|¦´x´´y´´z´‡¢1s8¤gkÝ0º3m¤iMÝ0—{´x´º3l´y´¤iM}{´x´¢2OO´y´¤gk}{´x´º3o´y´¤Hk´z´Ý0}÷ß4{ßeßVßnß4yßAßVß58»}´z´Ý0}{ß1ß24ß3|¦´x´´y´‡º3o¤eKº3p¤eKº6¤Wkº3o¤Hkº37¤Wk—÷ß4{ßeßVßAßVßm»ßnßoß6|¨streets room 2 map rock 1¨¨streets room 2 map checkpoint¨÷}}{ß1ß2Kß3|¦´x´´y´‡º3wºHº37¤Kyº2I¤Kyº37¤Wk—÷ß4{ßeßVßAßVßm»ßnßo}}{ß1ß2Lß3|¦´x´´y´‡º6¤NOº3H¤K0º3o¤Hkº3j¤Mk—÷ß4{ßeßVßAßVßm»ßnßo}}{ß1ß2Mß3|¦´x´´y´‡º6¤Wk¢1uY¤NOº6¤NOº3vºH—÷ß4{ßeßVßAßVßm»ßnßo}}{ß1ß2Nß3|¦´x´´y´‡º6¤NOº40¤NO¢1ou¤KAº2y¤Gmº3H¤K0—÷ß4{ßeßVßAßVßm»ßnßo}}{ß1ß2Oß3|¦´x´´y´‡¢2I0¤Wq¢2LF¤Kyºe¤Ky¢2Jk¤ZY—÷ß4{ßeßVßAßVßm»ßnßo}}{ß1ß20ß3|¦´x´´y´‡¢2B0¤X4º2H¤X4—{´x´º2W´y´¤b6´z´Ý0}÷ß4{ßeßVßnß5PßAßV}´z´Ý0}{ß1ß25ß3|{´x´º3j´y´¤Mk}{´x´º6´y´¤NO´z´Ý0}{´x´º3v´y´ºH´z´Ý0}÷ß4{ßeßVßnß5PßAßV}´z´Ý0}{ß1ß26ß3|¦´x´´y´´z´‡º3wºHÝ0º37¤KyÝ0º3x¤K0Ý0—÷ß4{ßeßVßnß5PßAßV}´z´Ý0}{ß1ß21ß3|{´x´¢1xm´y´¤X4}{´x´º46´y´ºd´z´Ý0}{´x´¢2Ik´y´ºd´z´Ý0}{´x´º47´y´¤X4}÷ß4{ßeßVßnß5RßAßVß5T£1.1c}´z´Ý0}{ß1ß2Gß3|¦´x´´y´´z´‡º6ºdÝ0º46ºdÝ0º2W¤HkÝ0—{´x´¢26e´y´¤Hk}÷ß4{ßeßVßnß5RßAßVß5TÝ8}´z´Ý0}{ß1ß2Hß3|¦´x´´y´´z´‡º47¤X4Ý0º37¤X4Ý0¢27w¤HaÝ0—{´x´¢28k´y´¤Ha}÷ß4{ßeßVßnß5RßAßVß5TÝ8}´z´Ý0}{ß1ß2Pß3|{´x´¢2Hc´y´¤KA}÷ß4{ßeßVß52¨switch¨ß55»ßAßV}´z´Ý0}{ß1ß2Aß3|¦´x´´y´‡¢1gg¤X4¢1mK¤OCº41¤KA—{´x´º40´y´¤NO´z´Ý0}{´x´º6´y´¤Wk}{´x´º3p´y´¤eK}÷ß4{ß50»ßeßVßnß4zßAßV}´z´Ý0}{ß1ß2Bß3|¦´x´´y´‡º2I¤Kyº37¤Wkº3o¤eK—÷ß4{ß50»ßeßVßnß4zßAßV}´z´Ý0}{ß1ß2Dß3|{´x´¢2Iu´y´¤EC´z´Ý0}{´x´¢2Fg´y´¤IY}{´x´º3o´y´¤Hk}{´x´º3H´y´¤K0´z´Ý0}{´x´º2y´y´¤Gm´z´Ý0}{´x´º2z´y´¤BI´z´Ý0}{´x´º6´y´¤4q}÷ß4{ß50»ßeßVßnß4zßAßV}´z´Ý0}{ß1ß2jß3|{´x´¢1XA´y´¤Ma}÷ß4{ßeßWß52ß5Uß55»ßAßW}´z´Ý0}{ß1ß2kß3|{´x´¢1So´y´¤4q}÷ß4{ßeßWß52ß5Uß55»ßAßW}´z´Ý0}{ß1ß2aß3|{´x´¢1SS´y´¤6S´z´Ý0}{´x´¢1RO´y´¤7u}÷ß4{ß50»ßeßWßnß5WßAßW}´z´Ý0}{ß1ß2Tß3|{´x´¢1r0´y´¤8O}÷ß4{ßeßWß52¨enemy_streets_easy_1¨ß55»ßAßW}´z´Ý0}{ß1ß2cß3|{´x´¢1gW´y´¤Lw}÷ß4{ßeßWß52ß5aß55»ßAßW}´z´Ý0}{ß1ß2Yß3|{´x´¢1hy´y´¤84}÷ß4{ßeßWß52¨enemy_streets_easy_2¨ß55»ßAßW}´z´Ý0}{ß1ß2dß3|{´x´º2M´y´¤Uo}÷ß4{ßeßWß52ß5bß55»ßAßW}´z´Ý0}{ß1ß2Xß3|{´x´¢1YI´y´¤Bm}÷ß4{ßeßWß52¨enemy_streets_turret_1¨ß55»ßAßW}´z´Ý0}{ß1ß2Qß3|¦´x´´y´‡º6¤Wu¢28Q¤Ha—{´x´º2y´y´¤Gm´z´Ý0}{´x´º6´y´¤4q}{´x´¢1U6´y´¤4C}{´x´¢1Pk´y´¤AA}{´x´ºS´y´¤bu}{´x´º41´y´¤KA}÷ß4{ßeßWßnß4yßAßWß58»}´z´Ý0}{ß1ß2gß3|{´x´¢1Mg´y´¤42´z´Ý0}{´x´º4Q´y´¤AA}{´x´º4P´y´¤4C}÷ß4{ßeßWßnß4yßAßW}´z´Ý0}{ß1ß2lß3|¦´x´´y´‡ºS¤buº4Q¤AAº4P¤4Cº6¤4qº2y¤Gmº41¤KA—÷ß4{ßeßWßAßWßm»ßnßoß6|¨streets room 3 map rock 1¨¨streets room 3 map rock 2¨¨streets room 3 map rock 3¨÷}}{ß1ß2mß3|¦´x´´y´‡¢1U0¤4C¢1SO¤6Oº4I¤6Sº4J¤7u¢1RK¤7q¢1Pg¤A3º4R¤42—÷ß4{ßeßWßAßWßm»ßnßo}}{ß1ß2Uß3|¦´x´´y´´z´‡¢1n8¤FUÝ0¢1juºEÝ0¢1lW¤I4Ý0—÷ß4{ßeßWßnß5PßAßW}´z´Ý0}{ß1ß2Vß3|¦´x´´y´´z´‡¢1p4¤6SÝ0ºc¤76Ý0º4W¤AUÝ0—÷ß4{ßeßWßnß5PßAßW}´z´Ý0}{ß1ß2fß3|¦´x´´y´´z´‡¢1gC¤R6Ý0¢1bq¤RQÝ0¢1e6¤V8Ý0—÷ß4{ßeßWßnß5PßAßW}´z´Ý0}{ß1ß2bß3|{´x´º2Q´y´¤5e}÷ß4{ßeßWß52ß5Qß55»ßAßWß57»¨spawn_angle¨¤1S}´z´Ý0}{ß1ß2eß3|{´x´¢1dh´y´¤aH}÷ß4{ßeßWß52ß5Qß55»ß54ÊßAßWß57»ß5g¤1S}´z´Ý0}{ß1ß2hß3|{´x´¢1No´y´¤4g}÷ß4{ßeßWß52ß5Qß55»ßAßWß5g¤1S}´z´Ý0}{ß1ß2Rß3|{´x´º41´y´¤Ky}{´x´º2R´y´¤Ky´z´Ý0}{´x´¢1ry´y´¤Gw´z´Ý0}{´x´¢1rA´y´¤Gw}÷ß4{ßeßWßnß5RßAßWß5TÊ}´z´Ý0}{ß1ß2nß3|{´x´¢1QE´y´¤68}÷ß4{ßeßWß52¨collect_shapey_triangle_speed¨ß55»ßAßWß5g¤5Kß57»}´z´Ý0}{ß1ß2Sß3|{´x´¢1bC´y´¤X4}{´x´ºS´y´¤bu´z´Ý0}{´x´º2p´y´¤Yq}÷ß4{ß50»ßeßWßnß4zßAßW}´z´Ý0}{ß1ß2Wß3|¦´x´´y´‡º2n¤SEº4Q¤AA—{´x´º4J´y´¤7u´z´Ý0}÷ß4{ß50»ßeßWßnß4zßAßW}´z´Ý0}{ß1ß2Zß3|{´x´º4I´y´¤6S}{´x´º4P´y´¤4C´z´Ý0}{´x´º2p´y´¤4R´z´Ý0}{´x´¢1k4´y´¢-8s´z´Ý0}{´x´¢1wK´y´¢-9W´z´Ý0}{´x´¢1x8´y´¢-Ck}÷ß4{ß50»ßeßWßnß4zßAßW}´z´Ý0}{ß1ß2iß3|{´x´º40´y´º10}{´x´ºM´y´¢-5e´z´Ý0}{´x´¢1nm´y´¢-5A}{´x´º26´y´¤4Y}{´x´¢1qq´y´¤4g´z´Ý0}{´x´º6´y´¤4q}÷ß4{ß50»ßeßWßnß4zßAßW}´z´Ý0}{ß1ß2oß3|{´x´º4C´y´¤X4´z´Ý0}{´x´º2p´y´¤Yq}{´x´º4C´y´¤ZU}{´x´¢1ho´y´¤Xi}÷ß4{ßeßZßnß4yßAßZ}´z´Ý0}{ß1ß2uß3|{´x´¢2RI´y´ºA}÷ß4{ßeßXß52ß5Uß55»ßAßX}´z´Ý0}{ß1ß2rß3|{´x´¢2KW´y´¤Ru}÷ß4{ßeßXß52ß5aß55»ßAßX}´z´Ý0}{ß1ß2pß3|{´x´º37´y´¤Wu´z´Ý0}{´x´¢2Ji´y´¤Ze}{´x´ºe´y´¤Ky´z´Ý0}{´x´¢2OE´y´¤Hu}{´x´¢2UC´y´¤IO}{´x´¢2UW´y´¤Fo´z´Ý0}{´x´¢2Js´y´¤8i}{´x´¢286´y´¤Ha}÷ß4{ßeßXßnß4yßAßXß58»}´z´Ý0}{ß1ß2qß3|{´x´º37´y´¤Ky}{´x´¢2N6´y´¤F0´z´Ý0}{´x´º4z´y´¤Fo´z´Ý0}{´x´º4y´y´¤IO}÷ß4{ß50»ßeßXßnß4zßAßX}´z´Ý0}{ß1ß2sß3|{´x´ºe´y´¤Ky}{´x´º4x´y´¤Hu´z´Ý0}{´x´º4y´y´¤IO}÷ß4{ß50»ßeßXßnß4zßAßX}´z´Ý0}{ß1ß2tß3|¦´x´´y´‡º2I¤Kyºe¤Ky—÷ß4{ßeßXßnß5Sß50»ß57»ßAßX}´z´Ý0}{ß1ß2zß3|{´x´¢1ki´y´¢-84}÷ß4{ßeßYß52ß5Uß55»ßAßY}´z´Ý0}{ß1ß2vß3|¦´x´´y´‡¢1ku¤4a¢1fW¤4Tº4jº4kº4lº4mº4nº4oº4w¢-76¢2H8¤3Eº40º10ºMº4pº4qº4r—÷ß4{ßeßYßnß4yßAßYß58»}´z´Ý0}{ß1ß31ß3|¦´x´´y´‡º2p¤4Rº4jº4kº4lº4mºMº4pº4qº4rº26¤4Y—÷ß4{ßeßYßAßYßm»ßnßo}}{ß1ß2wß3|¦´x´´y´‡º58¤3Eº37Éº3zº3—÷ß4{ß50»ßeßYßnß4zßAßY}´z´Ý0}{ß1ß30ß3|¦´x´´y´‡º4wº57º4E¢-3s—{´x´¢2PM´y´¢-2G´z´Ý0}÷ß4{ß50»ßeßYßnß4zßAßY}´z´Ý0}{ß1ß2xß3|{´x´ºM´y´º4p´z´Ý0}{´x´º37´y´É}÷ß4{ß50»ßeßYßnß51ßAßY}´z´Ý0}{ß1ß2yß3|{´x´º4l´y´º4m´z´Ý0}{´x´º4E´y´º59}÷ß4{ß50»ßeßYßnß51ßAßY}´z´Ý0}{ß1ß32ß3|{´x´º3I´y´º2P}{´x´º2C´y´º3F´z´Ý2}{´x´º2F´y´º2G´z´Ý2}{´x´º3n´y´¢1FG}{´x´º3n´y´¢1T8´z´Ý2}{´x´º3H´y´º5D}{´x´º3H´y´º3G}÷ß4{ßeßJßnß4yßAßJß58»}´z´Ý2}{ß1ß38ß3|¦´x´´y´‡º3Iº2Pº3Hº3Gº6º3Gº2Cº3Fº2Qº1y—÷ß4{ßeßJßAßJßm»ßnßo}}{ß1ß39ß3|¦´x´´y´‡¢21Aº1xº3oº1xº3oº3Rº6º3Gº3Hº3G—÷ß4{ßeßJßAßJßm»ßnßo}}{ß1ß3Aß3|¦´x´´y´‡º3vº2G¢22Sº2Bº48º1y¢27cº3G¢26K¢1F6º2Wº3X¢22c¢1DAº48¢1Faº48¢1GEº3j¢1G4—÷ß4{ßeßJßAßJßm»ßnßo}}{ß1ß36ß3|{´x´¢20M´y´º3c´z´Ý2}÷ß4{ßeßJßAßJß55»ß6|¨streets side room 1 test 0¨¨streets side room 1 test 1¨÷}´z´Ý2}{ß1ß33ß3|¦´x´´y´‡º5Eº1xº3Hº3G—÷ß4{ß50»ßeßJßnß4zßAßJ}´z´Ý2}{ß1ß34ß3|¦´x´´y´´z´‡º6º3GÝ2º3jº5NÝ2—{´x´º3v´y´º2G}{´x´º5F´y´º2B}{´x´º48´y´º1y}{´x´º5G´y´º3G}{´x´º5H´y´º5I}{´x´º2W´y´º3X}{´x´º5J´y´º5K´z´Ý2}{´x´º48´y´º5L}{´x´º48´y´º5M}{´x´º3o´y´º3R}÷ß4{ß50»ßeßJßnß4zßAßJ}´z´Ý2}{ß1ß35ß3|{´x´º3j´y´º5N}{´x´º48´y´º5M´z´Ý2}÷ß4{ßeßJßnß5Sß50»ß57»ßAßJ}´z´Ý2}{ß1ß37ß3|¦´x´´y´´z´‡º5E¢1LsÝ2º6º3GÝ2—÷ß4{ß50»ßeßJßnß51ßAßJ}´z´Ý2}{ß1ß3Gß3|¦´x´´y´‡ºRºPºOºPºOºQºRºQ—÷ß4{ßeßLßnß3Bß4y»ßAßFß1d»}´z´Ý4}{ß1ß3Kß3|¦´x´´y´‡¤SEºPºjºP—{´x´ºj´y´ºP´z´Ý3}{´x´¤SE´y´ºP´z´Ý3}÷ß4{ßeßLßnß3BßAßF}}{ß1ß3Lß3|¦´x´´y´‡ºjºP¤UeºP—÷ß4{ßeßLßn¨sensor_path¨ßAßF}}{ß1ß3Iß3|¦´x´´y´‡ºkºP¤X4ºP—{´x´¤X4´y´ºP´z´Ý3}{´x´ºk´y´ºP´z´Ý3}÷ß4{ßeßLßnß3BßAßF}}{ß1ß3Jß3|¦´x´´y´‡ºkºP¤UeºP—÷ß4{ßeßLßnß5kßAßF}}{ß1ß3Mß3|¦´x´´y´‡ºRºPºOºPºOºQºRºQ—÷ß4{ßeßLßn¨floor_train¨ßAßFß1d»}}{ß1ß3Cß3|¦´x´´y´‡ºRºP¤SEºP¤Ru¢122¤SE¢13U¤SEºQºRºQ—÷ß4{ßeßLßnß5lßAßFß1d»}}{ß1ß3Oß3|¦´x´´y´‡ºOºQ¤SEºQ¤SEº5RºO¢13A—÷ß4{ßeßLßnß5lßAßFß1d»}}{ß1ß3Pß3|¦´x´´y´‡ºOº5S¤SEº5R¤Ruº5QºOºI—÷ß4{ßeßLßnß5lßAßFß1d»}}{ß1ß3Nß3|¦´x´´y´‡ºOºI¤Ruº5Q¤SEºPºOºP—÷ß4{ßeßLßnß5lßAßFß1d»}}{ß1ß3Hß3|¦´x´´y´‡¤Qmº1l¤Qm¢14m¤YWº5T¤YWº1l—÷ß4{ßeßLßnß5RßAßFß1d»}}{ß1ß3Dß3|{´x´ºR´y´ºP}{´x´ºR´y´ºP´z´Ý4}{´x´ºR´y´ºQ´z´Ý4}{´x´ºR´y´ºQ}÷ß4{ßeßLßnß3BßAßF}}{ß1ß3Eß3|{´x´ºO´y´ºP}{´x´ºO´y´ºP´z´Ý4}{´x´ºO´y´ºQ´z´Ý4}{´x´ºO´y´ºQ}÷ß4{ßeßLßnß3BßAßF}}{ß1ß3Fß3|¦´x´´y´‡ºOºQºRºQ—{´x´ºR´y´ºQ´z´Ý4}{´x´ºO´y´ºQ´z´Ý4}÷ß4{ßeßLßnß3BßAßF}}{ß1ß3mß3|¦´x´´y´‡¤Lm¤4q¤Ky¤84—÷ß4{ßeßbßn¨wall_tutorial_fake¨ß50»ß57»ßAßb}}{ß1ß4Tß3|¦´x´´y´‡¢-MQ¤-e¢-NY¤K—÷ß4{ßeßdßnß5mß50»ß57»ßAßd}}{ß1ß4pß3|¦´x´´y´‡¤AA¤g6¤By¤i0—÷ß4{ßeßIßnß5mß50»ß57»ßAßI}}{ß1ß1lß3|{´x´º1x´y´¤wO´z´Ý0}{´x´º1x´y´º21}{´x´¤ye´y´¢1Ec}{´x´¤yU´y´¤qQ}÷ß4{ßeßGßnß4yßAßG}´z´Ý0}{ß1ß4eß3|¦´x´´y´‡¤CQ¤ga¤DE¤gQ¤EM¤gu¤EW¤hs¤E2¤iM¤DO¤iW¤Ck¤iC—÷ß4{ßeßIßnß5Pß50»ßAßI}}{ß1ß4gß3|¦´x´´y´‡¤SO¤oe¤TC¤pSºH¤qa¤S4¤qu¤Qw¤qaºO¤pS¤RG¤oU—÷ß4{ßeßIßnß5PßAßI}}{ß1ß4hß3|¦´x´´y´‡¤SiºYºH¤sM¤SY¤tA¤Ra¤tK¤Qw¤sg¤Qw¤ri¤Rk¤rE—÷ß4{ßeßIßnß5PßAßI}}{ß1ß4iß3|¦´x´´y´‡¤Ss¤tU¤Tq¤uS¤Tg¤vk¤Si¤wY¤Rk¤wE¤R6¤v6¤Ra¤ty—÷ß4{ßeßIßnß5PßAßI}}{ß1ß4jß3|¦´x´´y´‡¤OC¤vQ¤Og¤wEºf¤x2¤NO¤xM¤Ma¤ws¤MQ¤vu¤NE¤vG—÷ß4{ßeßIßnß5PßAßI}}{ß1ß3Tß3|{´x´º10´y´º3}÷ß4{ßeßDß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷ßAßD}}{ß1ß3Vß3|¦´x´´y´‡¤6w¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßeßDß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßnß5Rß5T£0.EWßAßD}}{ß1ß3Zß3|¦´x´´y´‡¤D4¤-A¤C6¢-42¤5eº10º2ºm¢-6Iº2¢-6m¤42¢-9q¤50¢-Bm¤84¢-Bc¤BI¢-7Q¤D4¢-3Y¤B8¢-26¤84¤4C¤6w¤6c¤1S—÷ß4{ßeßDßnß4yß58»ßAßD}}{ß1ß3aß3|¦´x´´y´‡¤5eº10º2ºmº5aº2º5b¤42º5h¤84¤4C¤6w¤6c¤1S—÷ß4{ßeßDßAßDßm»ßnßoß6|¨tutorial room 1 map rock 1¨¨tutorial room 1 map rock 2¨¨tutorial room 1 map rock 3¨¨tutorial room 1 map rock 4¨÷}}{ß1ß3bß3|¦´x´´y´‡¤C6º5Z¤5eº10¤6c¤1S¤D4¤-A—÷ß4{ßeßDßAßDßm»ßnßo}}{ß1ß3cß3|¦´x´´y´‡¢-2v¤7M¢-47¤6K¢-4C¤6P¢-6u¤44º5c¤50º5d¤84º5e¤BIº5f¤D4º5g¤B8—÷ß4{ßeßDßAßDßm»ßnßoß6|¨tutorial room 1 map rock 5¨¨tutorial room 1 map rock 6¨÷}}{ß1ß3Rß3|{´x´ºm´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß63÷ßeßDßAßD}}{ß1ß3Uß3|¦´x´´y´‡¤5eº10º2ºmº5aº2º5b¤42º5h¤84¤4C¤6w¤6c¤1S—÷ß4{ßeßDßnß5Rß5TÊßAßD}}{ß1ß3Xß3|{´x´¢-BI´y´¤4q}÷ß4{ß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßeßDßAßD}}{ß1ß3iß3|¦´x´´y´‡¤5e¢-CG¤4g¢-8O¤8Yº5f¤9Wº5n¤F9¢-HE¤9W¢-BS—÷ß4{ßeßbßnß5Rß5TÝ9ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷ßAßb}}{ß1ß3rß3|¦´x´´y´‡¤Gw¢-Ky¤EC¢-Lc¤BS¢-KU¤4M¢-Ca¤3O¢-8i¤C6º5Z¤D4¤-A¤Bm¤8s¤E2¤G8¤H6¤GI¤Keºwºd¤84¤Wu¤2G¤Uy¢-Ay—÷ß4{ßeßbßnß4yß58»ßAßb}}{ß1ß3sß3|¦´x´´y´‡¤Wuº5k¤Waº5f—{´x´¤Vw´y´¢-5o´z´£0.3E}÷ß4{ßeßbßnß4yßAßb}´z´ÝA}{ß1ß3tß3|¦´x´´y´‡¤Wk¤2G¤Uyº5x¤NOº5d¤Lw¢-H6¤Gm¢-Is¤Bw¢-FU¤BS¢-Ao¤Aoº5x¤9qº57¤C6º5Z¤D4¤-A¤Ck¤26¤M8¤3G¤WQ¤4C¤WV¤3k¤NO¤2u¤MG¤26¤N4¤eºn¤Uºb¤18¤Py¤2Q¤Pe¤3EºO¤3E¤QI¤2Q¤QS¤18¤R6¤o¤S4¤18¤SO¤1w¤S4¤3O¤UA¤3Y¤Ss¤1w¤Si¤e¤TM¤-K¤UU¤-o¤Vm¤-K¤Vw¤18ºd¤42¤WQ¤4C—÷ß4{ßeßbßAßbßm»ßnßoß6|¨tutorial room 2 map rock 1¨¨tutorial room 2 map rock 2¨¨tutorial room 2 map rock 3¨¨tutorial room 2 map rock 4¨¨tutorial room 2 map rock 5¨¨tutorial room 2 map rock 6¨¨tutorial room 2 map rock 7¨¨tutorial room 2 map rock 8¨¨tutorial room 2 map rock 9¨¨tutorial room 2 map rock 10¨¨tutorial room 2 map rock 11¨÷}}{ß1ß3uß3|¦´x´´y´‡¤Gc¢-7a¤Gg¢-7e¤GN¢-92¤H8¢-AF¤IW¢-A6¤JR¢-9B¤J8¢-7T¤Hk¢-6r¤Hkº5b—÷ß4{ßeßbßAßbßm»ßnßoß5OÊ}}{ß1ß3vß3|¦´x´´y´‡¤Cu¢-G8¤Cq¢-GD¤Bq¢-FW¤AA¢-GS¤A0¢-IY¤Bcº5u¤E2¢-LS¤Gc¢-Ko¤Gm¢-Ix¤Do¢-Gs¤Ds¢-Gm—÷ß4{ßeßbßAßbßm»ßnßo}}{ß1ß3wß3|¦´x´´y´‡¤3Oº5w¤4Mº5v¤Aoº5x¤9qº57—÷ß4{ßeßbßAßbßm»ßnßo}}{ß1ß3xß3|¦´x´´y´‡¤Ky¤84¤Lk¤4qºd¤4qºd¤84—÷ß4{ßeßbßAßbßm»ßnßo}}{ß1ß3yß3|¦´x´´y´‡¤EW¤C1¤Ha¤CG¤H6¤GI¤E2¤G8—÷ß4{ßeßbßAßbßm»ßnßo}}{ß1ß3zß3|¦´x´´y´‡¤M8¤3G¤Keºw¤Ha¤CG¤EW¤C1¤Bm¤8s¤Ck¤26—÷ß4{ßeßbßAßbßm»ßnßo}}{ß1ß3eß3|{´x´¤G8´y´º5g}÷ß4{ßeßbß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷ßAßb}}{ß1ß3hß3|{´x´¤KA´y´º4r}÷ß4{ßeßbß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷ßAßb}}{ß1ß3nß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßeßbßnß5RßAßb}}{ß1ß3fß3|{´x´¤Ss´y´¤-y}÷ß4{ßeßbß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ßAßb}}{ß1ß3gß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßeßbßnß5kß6|¨tutorial room 2 switch¨÷ßAßb}}{ß1ß3jß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGº10—÷ß4{ßeßbßn¨icon¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷ßAßb}´z´£0.1c}{ß1ß3lß3|{´x´¤AU´y´¢-K0}÷ß4{ßeßbß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷ßAßb}}{ß1ß3oß3|¦´x´´y´‡¤CQ¤y¤Ds¤FUºA¤FU¤FU¤y—÷ß4{ßeßbßnß5Rß5TÝ9ßAßb}}{ß1ß41ß3|¦´x´´y´‡¢-Lmº6F¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßeßcßnß5Rß5T£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷ßAßc}}{ß1ß49ß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FKº5x¢-Dsº4k¢-Fe¢-8Yº6Y¢-A0º6P¢-DY¢-Ke—÷ß4{ßeßcßnß5RßAßc}}{ß1ß4Cß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßeßcß52¨enemy_tutorial_easy¨ß55»ßAßc}}{ß1ß42ß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßeßcß52ß6zß55»ßAßc}}{ß1ß4Bß3|¦´x´´y´‡¤3Oº5w¤4Mº5v¤e¢-GI¢-4Mº5uº54¢-Oq¢-EC¢-PAº6Q¢-I4¢-OMº61º5Uº6fº5n¢-9Cº5hº57—÷ß4{ßeßcßnß4yß58»ßAßc}}{ß1ß4Dß3|¦´x´´y´‡º5hº57º4p¢-B8º6Lº6Z¤eº6l¤4Mº5v¤3Oº5w—÷ß4{ßeßcßAßcßm»ßnßoß6|¨tutorial room 3 map rock 1¨÷}}{ß1ß4Eß3|¦´x´´y´‡º5m¢-Cuº6O¢-Cr¤A¢-DU¤1O¢-Ch¤1i¢-BA¤J¢-9v¢-1P¢-9k¢-21¢-B7º5hº6t—÷ß4{ßeßcßAßcßm»ßnßoß5OÊ}}{ß1ß4Fß3|¦´x´´y´‡º5nº6s¢-HG¢-CQ¢-Jqº6Bº6Qº6q¢-J2¢-JWº6oº6pº54º6nº6mº5uº6Lº6Zº4pº6t—÷ß4{ßeßcßAßcßm»ßnßoß6|¨tutorial room 3 map rock 2¨÷}}{ß1ß4Gß3|¦´x´´y´‡¢-Fu¢-IN¢-F6¢-FE¢-Az¢-Do¢-8m¢-Fh¢-8T¢-IM¢-A2¢-K7º6f¢-Kj—÷ß4{ßeßcßAßcßnßoßm»ß5OÊ}}{ß1ß4Hß3|¦´x´´y´‡º5Uº6fº76º6Bº6Qº6qº6rº61—÷ß4{ßeßcßAßcßm»ßnßo}}{ß1ß46ß3|¦´x´´y´‡º5aº54¤2F¢-5T¤4qº6a¢-3F¢-Hl—÷ß4{ßeßcßnß5Rß5TÝCß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷ßAßc}}{ß1ß4Mß3|{´x´¢-L4´y´¤49}÷ß4{ßeßdß52¨enemy_tutorial_rock_room4¨ß55»ßAßd}}{ß1ß4Uß3|¦´x´´y´‡º5Uº6fº6rº61¢-W6º4o¢-Ygº4rºq¤Uº5V¤Kº5V¤7Gº60¤7Gº60¤34º5U¤-eº77¢-3Oº6Yº5w—÷ß4{ßeßdßnß4yß58»ßAßd}}{ß1ß4Jß3|{´x´¢-QI´y´¢-7G}÷ß4{ßeßdß52¨collect_gun_basic¨ß55»ß57»ßAßd}}{ß1ß4Kß3|{´x´º7T´y´º7U}÷ß4{ßeßdß52¨deco_gun_basic¨ß55»ßAßd}}{ß1ß4Vß3|¦´x´´y´‡º7Qº4oº7Rº4rºq¤Uº5V¤Kº77º7Sº6Yº5wº5Uº6fº6rº61—÷ß4{ßeßdßAßdßnßoßm»ß6|¨tutorial room 4 map rock 1¨¨tutorial room 4 map rock 2¨¨tutorial room 4 map rock 3¨÷}}{ß1ß4Qß3|¦´x´´y´‡¢-Kz¢-6wº7L¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßeßdßnß6pßAßd}}{ß1ß4Lß3|{´x´¢-Ue´y´¢-C6}÷ß4{ßeßdß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷ßAßd}}{ß1ß4Oß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßeßdß52¨enemy_tutorial_rocky¨ß55»ß57»ßAßd}}{ß1ß4Pß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßeßdß52ß7Dß55»ß57»ßAßd}}{ß1ß4Iß3|¦´x´´y´‡¢-OK¢-Fkº8º6u¢-Yqº4r¢-Tq¤e¢-NO¤Uº60¢-3E¢-IEº4k—÷ß4{ßeßdßnß5Rß5T£1.4qßAßd}}{ß1ß4Nß3|{´x´¢-Ic´y´¤16}÷ß4{ßeßdß52ß5Zß55»ßAßd}}{ß1ß4Zß3|{´x´¤Fy´y´¤TW}÷ß4{ßeßIß52¨enemy_tutorial_boss¨ß55»ßAßIß57»}}{ß1ß4bß3|¦´x´´y´‡¤Pe¤fS¤Lw¤fc—÷ß4{ß50»ßeßIß6|¨tutorial room 5 door end path¨÷ßAßIßnß5W}}{ß1ß4Xß3|¦´x´´y´‡¤KU¤GSºA¤GI—÷ß4{ß50»ßeßIß6|¨tutorial room 5 door start path¨÷ßAßIßnß5W}}{ß1ß4fß3|{´x´¤Tx´y´¤gx}÷ß4{ßeßIß52¨enemy_tutorial_easy_static¨ß55»ßAßI}}{ß1ß4aß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºH¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fw¤Ue¤fw¤Vc¤jA¤Wu¤jA¤XO¤km¤W6¤km¤Y2¤rE¤Fo¤s2¤F0¤nC¤92¤h4ºw¤gG¤AA¤g6¤1w¤X4¤4q¤M6—÷ß4{ßeßIßnß4yß58»ßAßI}}{ß1ß4qß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºH¤Vw¤Lz¤fY¤Hu¤fi¤Hu¤fm¤EC¤fw¤EC¤fs¤A6¤g2¤26¤X4¤4q¤M6—÷ß4{ßeßIßAßIßm»ßnßo}}{ß1ß4rß3|¦´x´´y´‡¤EC¤fw¤Hu¤fm¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤RG¤w4ºO¤wE¤P1¤oQ¤SN¤o5¤RV¤l9¤GA¤mJ¤AI¤g6—÷ß4{ßeßIßAßIßm»ßnßoß6|¨tutorial room 5 map rock 1¨¨tutorial room 5 map rock 2¨¨tutorial room 5 map rock 3¨¨tutorial room 5 map rock 4¨÷}}{ß1ß4sß3|¦´x´´y´‡¤Ck¤iC¤Co¤i9¤DO¤iS¤E0¤iI¤ER¤hr¤EI¤gx¤DD¤gU¤CU¤gd¤CQ¤ga¤CG¤hY—÷ß4{ßeßIßAßIßm»ßnßoß5OÊ}}{ß1ß4tß3|¦´x´´y´‡¤X8¤o0¤YM¤o0¤am¤w4¤ZY¤w4—÷ß4{ßeßIßAßIßm»ßnßoß6|¨tutorial room 5 map shape 4.1¨÷}}{ß1ß4uß3|¦´x´´y´‡¤T6¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fs¤Uc¤ft¤Ps¤gL—÷ß4{ßeßIßAßIßm»ßnßo}}{ß1ß4vß3|¦´x´´y´‡ºO¤wE¤Qa¤w9¤Oo¤wd¤On¤wl¤Mj¤xL¤Mh¤xH¤Gu¤yu¤FK¤p8¤Gw¤p8¤Gy¤pF¤P1¤oQ—÷ß4{ßeßIßAßIßm»ßnßo}}{ß1ß4wß3|¦´x´´y´‡¤Gw¤p8¤G8ºK¤By¤i0¤C3¤hx¤AI¤g6ºw¤gG¤92¤h4¤F0¤nC¤FK¤p8—÷ß4{ßeßIßAßIßm»ßnßo}}{ß1ß4xß3|¦´x´´y´‡¤G8ºK¤Gw¤p8¤SE¤o0¤RQ¤lG—÷ß4{ßeßIßAßIßm»ßnßo}}{ß1ß4oß3|{´x´¤WV´y´¤jy}÷ß4{ßeßIß52¨enemy_tutorial_rocky_small¨ß55»ßAßIß57»}}{ß1ß4Wß3|¦´x´´y´‡¤1w¤Ko¤1w¤cEºH¤bQ¤TM¤LI—÷ß4{ßeßIßnß5RßAßI}}{ß1ß4mß3|¦´x´´y´‡¤8s¤eK¤9g¤fI¤MG¤eo¤N4¤dq—÷ß4{ßeßIßnß5Rß5TÝDßAßI}}{ß1ß4Yß3|¦´x´´y´‡¤DE¤Gm¤CGºA¤JC¤Hk¤IE¤H6—÷ß4{ßeßIßnß5Rß5TÝDßAßI}}{ß1ß4lß3|¦´x´´y´‡¤DE¤g6¤Eg¤gu¤Kr¤ga¤V1¤fk¤ZU¤um¤Gc¤um¤H6¤ye¤Qw¤vu¤aI¤vW¤VI¤fI—÷ß4{ßeßIßnß5Rß5TÊßAßI}}{ß1ß4kß3|¦´x´´y´‡¤NE¤vG¤MkºY—÷ß4{ßeßIßnß5kßAßI}}{ß1ß43ß3|¦´x´´y´‡º7jº6s¢-D4¢-9gº5dº6t—÷ß4{ßeßcßn¨spike¨ßAßc}}{ß1ß44ß3|¦´x´´y´‡º60¢-EWº78º61º74º6B—÷ß4{ßeßcßnß7OßAßc}}{ß1ß45ß3|¦´x´´y´‡¢-Af¢-PH¢-Bw¢-PKº5nº7s—÷ß4{ßeßcßnß7OßAßc}}{ß1ß4Rß3|¦´x´´y´‡¢-Iu¤5Sº60¤34º5U¤-eº77º7Sº6Yº5wº5Uº6f—÷ß4{ßeßdßnß4zß50»ßAßd}}{ß1ß3Sß3|¦´x´´y´‡¢-38¤7Aº5h¤84¤4C¤6w¤6c¤1S¤D4¤-A—÷ß4{ß50»ßeßDßnß4zßAßD}}{ß1ß3Wß3|¦´x´´y´‡¢-6e¤2Yº5b¤42—÷ß4{ßeßDßnß4zß50»ßAßD}}{ß1ß3dß3|¦´x´´y´‡ºb¤gQºH¤Vw¤RG¤MG¤H6¤GI¤Ha¤CG¤Keºw¤Ky¤84ºd¤84ºd¤4q¤Lm¤4q¤M8¤3G¤WQ¤4C¤Wk¤2G¤Uyº5x¤NOº5d¤Lwº5z¤Gmº60¤Dsº6K—÷ß4{ß50»ßeßbßnß4zßAßb}}{ß1ß3pß3|¦´x´´y´‡¤3Oº5w¤9qº57¤C6º5Z—÷ß4{ßeßbßnß4zß50»ßAßb}}{ß1ß4Sß3|¦´x´´y´‡º5V¤6Iº5V¤Kºq¤Uº7Rº4rº7Qº4oº6rº61—÷ß4{ßeßdßnß4zß50»ßAßd}}{ß1ß3kß3|¦´x´´y´‡¤Cuº6B¤Bwº61¤BSº62¤4Mº5v—÷ß4{ß50»ßeßbßnß4zßAßb}}{ß1ß3Yß3|¦´x´´y´‡¤C6º5Z¤5eº10º2ºmº5aº2¢-6T¤U—÷ß4{ßeßDßnß4zß50»ßAßD}}{ß1ß3qß3|¦´x´´y´‡¤D4¤-A¤Bm¤8s¤EW¤C1¤E2¤G8¤4q¤M6¤26¤X4¤AA¤g6¤EC¤fw—÷ß4{ß50»ßeßbßnß4zßAßb}}{ß1ß48ß3|¦´x´´y´‡º5Uº6fº76º6Bº74º75º5nº6sº4pº6tº5hº57¤3Oº5w—÷ß4{ßeßcßnß4zß50»ßAßc}}{ß1ß47ß3|¦´x´´y´‡º6rº61º6Qº6qº77º78º6oº6pº54º6nº6mº5uº6Lº6Z¤eº6l¤4Mº5v—÷ß4{ßeßcßnß4zß50»ßAßc}}{ß1ß4nß3|¦´x´´y´‡¤Hu¤fm¤Lw¤fcºH¤Vw—÷ß4{ß50»ßeßIßnß4zßAßI}}{ß1ß4cß3|¦´x´´y´‡¤By¤i0¤G8ºK¤RQ¤lG¤SE¤o0¤Gw¤p8—÷ß4{ß50»ßeßIßnß4zßAßI}}{ß1ß4dß3|¦´x´´y´‡¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤ZUº1b—÷ß4{ß50»ßeßIßnß4zßAßI}}{ß1ß40ß3|¦´x´´y´‡¢-FAº87º5xº6Uº5wº6cº5pº6Yº6e¢-KAº6fº6Hº6Sº6Yº87º87—÷ß4{ßeßcßnß51ß50»ßAßc}}{ß1ß4Aß3|¦´x´´y´‡º87º87º5xº6Uº5wº6cº5pº6Yº6eº88º6fº6Hº6Sº6Yº87º87—÷ß4{ßeßcßnß51ßAßc}}{ß1ß5Fß3|¦´x´´y´‡º1jº28º2L¤rY—÷ß4{ßeß1VßAßHßm»ßn¨map_line¨¨map_parent¨ß1V}}{ß1ß5Jß3|¦´x´´y´‡º2Mº1sº2N¤vk—÷ß4{ßeß1WßAßHßm»ßnß7Pß7Qß1W}}{ß1ß5Mß3|¦´x´´y´‡º2Qº1yºM¤w4—÷ß4{ßeß1XßAßHßm»ßnß7Pß7Qß1X}}{ß1ß5Nß3|¦´x´´y´‡º2Sº2Tº2H¤uw—÷ß4{ßeß1YßAßHßm»ßnß7Pß7Qß1Y}}{ß1ß5Bß3|¦´x´´y´‡º2i¤xqº2k¤yUº2jº1b—÷ß4{ßeß1UßAßHßn¨map_inverse¨ßm»ß7Qß1U}}{ß1ß5Cß3|¦´x´´y´‡º2dº2eº2gº2hº1eº2f—÷ß4{ßeß1UßAßHßnß7Rßm»ß7Qß1U}}{ß1ß5Dß3|¦´x´´y´‡ºS¤xWº2qº2rº2p¤zm—÷ß4{ßeß1VßAßHßnß7Rßm»ß7Qß1V}}{ß1ß5Eß3|¦´x´´y´‡º2nº2oº2mº2Uº2lº1t—÷ß4{ßeß1VßAßHßnß7Rßm»ß7Qß1V}}{ß1ß5Gß3|¦´x´´y´‡º2y¤w4º2sº2xº2wº1v—÷ß4{ßeß1WßAßHßnß7Rßm»ß7Qß1W}}{ß1ß5Hß3|¦´x´´y´‡º26º2eº2uº2vº2sº2t—÷ß4{ßeß1WßAßHßnß7Rßm»ß7Qß1W}}{ß1ß5Iß3|¦´x´´y´‡º2wº2oº30º31º2zº2e—÷ß4{ßeß1WßAßHßnß7Rßm»ß7Qß1W}}{ß1ß5Kß3|¦´x´´y´‡º36¤xqº34º2xº2C¤yU—÷ß4{ßeß1XßAßHßnß7Rßm»ß7Qß1X}}{ß1ß5Lß3|¦´x´´y´‡º35º2eº34º2fº32º33—÷ß4{ßeß1XßAßHßnß7Rßm»ß7Qß1X}}{ß1ß5Yß3|{´x´º3o´y´¤Qw}÷ß4{ßeß24ß52¨checkpoint_map_streets_room_2¨ß55»ß54ÊßAßVßm»ß7Qß24}}{ß1ß5Xß3|¦´x´´y´‡º2W¤b6º2H¤X4º45¤X4—÷ß4{ßeß24ßAßVßnß7Rßm»ß7Qß24}}{ß1ß5dß3|¦´x´´y´‡º4Y¤I4º4XºEº4W¤FU—÷ß4{ßeß2lßAßWßnß7Rßm»ß7Qß2l}}{ß1ß5eß3|¦´x´´y´‡º4W¤AUºc¤76º4Z¤6S—÷ß4{ßeß2lßAßWßnß7Rßm»ß7Qß2l}}{ß1ß5fß3|¦´x´´y´‡º4c¤V8º4b¤RQº4a¤R6—÷ß4{ßeß2lßAßWßnß7Rßm»ß7Qß2l}}{ß1ß5iß3|¦´x´´y´´z´‡¢28D¢1HSÝ2º89¢1LUÝ2—{´x´¢24B´y´º8B}{´x´º8C´y´º8A´z´Ý2}÷ß4{ßeß36ßAßJß55»}´z´Ý2}{ß1ß5jß3|¦´x´´y´´z´‡¢21s¢1NpÝ2º8D¢1RrÝ2¢1xqº8FÝ2º8Gº8EÝ2—÷ß4{ßeß36ßAßJß55»}´z´Ý2}{ß1ß73ß3|¦´x´´y´‡º5mº6uº5hº6t—÷ß4{ßeß46ßnß5mß50»ß57»ßAßc}}{ß1ß6hß3|¦´x´´y´‡¤Hkº5b¤Gcº63—÷ß4{ßeß3hßnß5mß50»ß57»ßAßb}}{ß1ß5zß3|¦´x´´y´‡¤-Kº7S¤Aº5Y¤xº5g¤1I¢-2u¤yº10¤Kº5B¤-K¢-2a—÷ß4{ßeß3Rßnß5PßAßD}}{ß1ß60ß3|¦´x´´y´‡¤2G¤5A¤2a¤4W¤3O¤4C¤42¤4q¤42¤5o¤3E¤68¤2Q¤5y—÷ß4{ßeß3Rßnß5PßAßD}}{ß1ß61ß3|¦´x´´y´‡º5y¢-18º4pº2¢-4q¢-1wº6m¢-1Sº6m¤-oºmºy¢-5U¤-e—÷ß4{ßeß3Rßnß5PßAßD}}{ß1ß62ß3|¦´x´´y´‡º5Y¤5K¢-34¤50º5B¤50¢-1m¤5eº8L¤6cº10¤5y¢-4B¤6G—÷ß4{ßeß3Rßnß5PßAßD}}{ß1ß63ß3|¦´x´´y´‡º86¤Uº85¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßeß3Rßn¨wall_tutorial_rock_breakable¨ßAßD}}{ß1ß6Tß3|¦´x´´y´‡¤Muº7t¤P0º7S¤Pyº5k¤PUºl¤OCº6M¤N4ºl¤MQºm—÷ß4{ßeß3hßnß5PßAßb}}{ß1ß6Uß3|¦´x´´y´‡¤Caº5Z¤Dsº5g¤Egº5k¤Eg¢-5K¤ECºl¤Ckºl¤C6ºm—÷ß4{ßeß3hßnß5PßAßb}}{ß1ß6Vß3|¦´x´´y´‡ºEº5Z¤Gmº59¤Hkº6m¤Huº4p¤Gwº6M¤FUºl¤F0º4r—÷ß4{ßeß3hßnß5PßAßb}}{ß1ß6Wß3|¦´x´´y´‡¤J2º59¤Kyº5g¤Lwº8K¤Lmºl¤K0º5b¤Iiºl¤IOº8K—÷ß4{ßeß3hßnß5PßAßb}}{ß1ß6Xß3|¦´x´´y´‡¤Hkº5b¤JCº5f¤JWº6s¤IY¢-AA¤H6¢-AK¤GIº65¤Gcº63—÷ß4{ßeß3hßnß5Pß50»ßAßb}}{ß1ß6Yß3|¦´x´´y´‡¤DEº6c¤Dsº61¤ECº6X¤EMº6E¤Dsº6K¤D8¢-Gn¤Cuº6B—÷ß4{ßeß3hßnß5PßAßb}}{ß1ß6Zß3|¦´x´´y´‡¤KUº6S¤Kyº6X¤Lcº6S¤Lmº6E¤LS¢-Gw¤Koº5z¤KKºs—÷ß4{ßeß3hßnß5PßAßb}}{ß1ß72ß3|¦´x´´y´‡º5hº6tº8Mº7x¤Kº5c¤1mº6t¤1Sº4o¤Aº6fº5mº6u—÷ß4{ßeß46ßnß5Pß50»ßAßc}}{ß1ß7Aß3|¦´x´´y´‡¢-VIº7j¢-V8º5v¢-UKº6uº7rº75º7rº5d¢-UUº5r¢-Uyº5e—÷ß4{ßeß4Lßnß5PßAßd}}{ß1ß7Bß3|¦´x´´y´‡¢-OWº8L¢-O2º8I¢-NEº5X¢-Maº5B¢-Mkº5mº5V¤-yº6rº8J—÷ß4{ßeß4Lßnß5PßAßd}}{ß1ß7Cß3|¦´x´´y´‡¢-TMº5m¢-T2º8L¢-SEº5B¢-RQº8P¢-RG¤-y¢-Ru¤-Kº8jºy—÷ß4{ßeß4Lßnß5PßAßd}}{ß1ß6aß3|¦´x´´y´‡¤Fe¤1m¤Gc¤1w¤HG¤1S¤H6¤U¤GS¤-A¤FK¤-A¤F0¤o—÷ß4{ßeß3hßnß5PßAßb}}{ß1ß6bß3|¦´x´´y´‡¤I4¤1m¤J2¤1m¤JM¤18¤JC¤K¤IY¤-A¤Hk¤A¤Ha¤18—÷ß4{ßeß3hßnß5PßAßb}}{ß1ß6cß3|¦´x´´y´‡¤Jq¤1m¤Ko¤2a¤Lm¤26¤MG¤e¤LS¤A¤KA¤A¤Jg¤e—÷ß4{ßeß3hßnß5PßAßb}}{ß1ß6eß3|¦´x´´y´‡¤MG¤26¤NO¤2u¤P0¤34¤Py¤2Qºb¤18ºn¤U¤N4¤e—÷ß4{ßeß3hßnß5PßAßb}}{ß1ß6fß3|¦´x´´y´‡¤QI¤2Q¤R6¤2k¤Ru¤2k¤SO¤1w¤S4¤18¤R6¤o¤QS¤18—÷ß4{ßeß3hßnß5PßAßb}}{ß1ß6gß3|¦´x´´y´‡¤Ss¤1w¤Ue¤2G¤Vw¤18¤Vm¤-K¤UU¤-o¤TM¤-K¤Si¤e—÷ß4{ßeß3hßnß5PßAßb}}{ß1ß5nß3|¦´x´´y´‡¤4X¤-T¤50¤-K¤4jÎ¤50¤-K¤3OÒ—÷ß4{ßeß3Tßnß6pß50»ßAßD}´z´ÝB}{ß1ß5oß3|¦´x´´y´‡º5Z¤-yº5Zº8Iº8Mº6Lºyº5kºyº8L¤1N¢-2L¤1Sº5g¤5Kº5B—÷ß4{ßeß3Tß52¨enemy_tutorial_bit¨ß55»ß54ÎßAßD}}{ß1ß5pß3|¦´x´´y´‡¢-4W¤5eº5a¤3sºl¤-yº8T¤-Aº59¤-yº6m¤3Eº7t¤4g—÷ß4{ßeß3Tß52ß7Uß55»ß54ÎßAßD}}{ß1ß5qß3|¦´x´´y´‡ºwº5m¤9s¤m—÷ß4{ß50»ßeß3VßAßDßnß5W}}{ß1ß5rß3|¦´x´´y´‡ºwº5m¤8q¢-3M—÷ß4{ßeß3Vß50»ßAßDßnß5W}}{ß1ß5sß3|¦´x´´y´‡¤8Eº8O¤9C¤o¤AU¤U¤9Wº7S—÷ß4{ßeß3Vßn¨deco¨ß5¨tutorial_door_floor¨ßAßD}}{ß1ß5tß3|¦´x´´y´‡¤yº5g¤Aº5Y¤-Kº7S¤-Kº8I¤Kº5B¤yº10¤1Iº8H—÷ß4{ßeß3aßAßDßnß7Rßm»ß7Qß3a}}{ß1ß5uß3|¦´x´´y´‡º6mº8Mº8Kº8Lº4pº2º5yº8Jº8N¤-eºmºyº6m¤-o—÷ß4{ßeß3aßAßDßm»ßnß7Rß7Qß3a}}{ß1ß5vß3|¦´x´´y´‡º8P¤5eº5B¤50º8O¤50º5Y¤5K¢-3a¤6Aº8H¤6cº8L¤6c—÷ß4{ßeß3aßAßDßm»ßnß7Rß7Qß3a}}{ß1ß5wß3|¦´x´´y´‡¤42¤5o¤42¤4q¤3O¤4C¤2a¤4W¤2G¤5A¤2Q¤5y¤3E¤68—÷ß4{ßeß3aßAßDßm»ßnß7Rß7Qß3a}}{ß1ß5xß3|¦´x´´y´‡º5Y¤5Kº8Q¤6Gº5j¤6Kº8r¤6A—÷ß4{ßeß3cßAßDßm»ßnß7Rß7Qß3c}}{ß1ß5yß3|¦´x´´y´‡º8r¤6Aº8H¤6cº8L¤6cº10¤5y—÷ß4{ßeß3cßAßDßm»ßnßoß7Qß3c}}{ß1ß65ß3|{´x´º4r´y´¤AA}÷ß4{ßeß3Xß52ß7Dß55»ßAßD}}{ß1ß66ß3|{´x´¢-9M´y´¤6w}÷ß4{ßeß3Xß52ß7Dß55»ß57»ßAßD}}{ß1ß67ß3|{´x´º7x´y´¤AA}÷ß4{ßeß3Xß52ß7Dß55»ß57»ßAßD}}{ß1ß6Bß3|¦´x´´y´‡¤A6¢-9m¤9g¢-9Q¤A5¢-93¤9gº8u¤BM¢-9O—÷ß4{ßeß3ißnß6pß50»ßAßb}´z´ÝB}{ß1ß6Cß3|¦´x´´y´‡¤ER¢-5Z¤E8¢-56¤Dnº8x¤E8º8y¤E8º85—÷ß4{ßeß3ißn¨icon_tutorial¨ß50»ßAßb}´z´ÝB}{ß1ß6Dß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßeß3ißnß7Xß50»ßAßb}´z´ÝB}{ß1ß6dß3|{´x´¤Dz´y´¤Y}÷ß4{ßeß3hß52¨enemy_tutorial_block¨ß55»ß57»ßAßbß5g¤5o}}{ß1ß6iß3|¦´x´´y´‡¤Maº7t¤Lwº7t¤LIº7S¤M4¢-4c¤M5º8y¤M1¢-6A¤KKº5b¤NOº5b¤Mgº5a¤M8º8y¤M7º8z—÷ß4{ßeß3fß52ß7Uß55»ß54ÎßAßb}}{ß1ß6jß3|¦´x´´y´‡ºHºy¤SO¤y¤RG¤U¤Py¤o¤SYº5m¤V8º5X¤Vcº5m—÷ß4{ßeß3fß52ß7Uß54Îß55»ßAßb}}{ß1ß6kß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßeß3fß52ß7Uß55»ß54ÎßAßb}}{ß1ß6mß3|¦´x´´y´‡¤Ha¤Bm¤EW¤Bc¤C6¤8s¤D4¤1S¤GS¤2QºA¤1w¤JW¤26¤Ko¤2u¤Lw¤2Q¤K0¤9W—÷ß4{ßeß3fß52ß7Uß54¤Cß55»ßAßb}}{ß1ß69ß3|¦´x´´y´‡¤76º5c¤6a¢-7m—÷ß4{ß50»ßeß3ißAßbßnß5W}}{ß1ß6Aß3|¦´x´´y´‡¤76º5c¤7c¢-Bu—÷ß4{ß50»ßeß3ißAßbßnß5W}}{ß1ß68ß3|¦´x´´y´‡¤6wº81¤5yº54¤7G¢-7k¤8Eº5e—÷ß4{ßeß3ißnß7Vß5ß7WßAßb}}{ß1ß6lß3|{´x´¤Hb´y´¢-C3}÷ß4{ßeß3fß52¨enemy_tutorial_4way¨ß55»ßAßb}}{ß1ß6nß3|{´x´¤R6´y´¤5o}÷ß4{ßeß3fß52¨enemy_tutorial_down¨ß55»ßAßb}}{ß1ß6Eß3|¦´x´´y´‡¤ECºl¤Ckºl¤C6ºm¤Caº5Z¤Dsº5g¤Egº5k¤Egº8T—÷ß4{ßeß3tßAßbßnß7Rßm»ß7Qß3t}}{ß1ß6Fß3|¦´x´´y´‡¤Gwº6M¤FUºl¤F0º4rºEº5Z¤Gmº59¤Hkº6m¤Huº4p—÷ß4{ßeß3tßAßbßnß7Rßm»ß7Qß3t}}{ß1ß6Gß3|¦´x´´y´‡¤K0º5b¤Iiºl¤IOº8K¤J2º59¤Kyº5g¤Lwº8K¤Lmºl—÷ß4{ßeß3tßAßbßnß7Rßm»ß7Qß3t}}{ß1ß6Hß3|¦´x´´y´‡¤OCº6M¤N4ºl¤MQºm¤Muº7t¤P0º7S¤Pyº5k¤PUºl—÷ß4{ßeß3tßAßbßnß7Rßm»ß7Qß3t}}{ß1ß6Iß3|¦´x´´y´‡¤GS¤-A¤FK¤-A¤F0¤o¤Fe¤1m¤Gc¤1w¤HG¤1S¤H6¤U—÷ß4{ßeß3tßAßbßnß7Rßm»ß7Qß3t}}{ß1ß6Jß3|¦´x´´y´‡¤IY¤-A¤Hk¤A¤Ha¤18¤I4¤1m¤J2¤1m¤JM¤18¤JC¤K—÷ß4{ßeß3tßAßbßnß7Rßm»ß7Qß3t}}{ß1ß6Kß3|¦´x´´y´‡¤KA¤A¤Jg¤e¤Jq¤1m¤Ko¤2a¤Lm¤26¤MG¤e¤LS¤A—÷ß4{ßeß3tßAßbßnß7Rßm»ß7Qß3t}}{ß1ß6Lß3|¦´x´´y´‡¤H6º8V¤GIº65¤Gcº63¤Hkº5b¤JCº5f¤JWº6s¤IYº8U—÷ß4{ßeß3tßAßbßnß7Rßm»ß7Qß3t}}{ß1ß6Mß3|¦´x´´y´‡¤D8º8W¤Cuº6B¤DEº6c¤Dsº61¤ECº6X¤EMº6E¤Dsº6K—÷ß4{ßeß3tßAßbßnß7Rßm»ß7Qß3t}}{ß1ß6Nß3|¦´x´´y´‡¤Koº5z¤KKºs¤KUº6S¤Kyº6X¤Lcº6S¤Lmº6E¤LSº8X—÷ß4{ßeß3tßAßbßnß7Rßm»ß7Qß3t}}{ß1ß6Oß3|¦´x´´y´‡¤EVÄ¤Do¤-G¤DG¤C¤DF¤u¤Do¤1L¤EV¤1B¤En¤Y—÷ß4{ßeß3tßAßbßnß7Rßm»ß7Qß3t¨map_hide_when¨ß3z}}{ß1ß6oß3|{´x´¤FM´y´¢-7V}÷ß4{ßeß3gß52ß5Zß55»ßAßb}}{ß1ß6qß3|¦´x´´y´‡¤E6¢-1h¤EBº72—÷ß4{ßeß3jßnß6pß50»ßAßb}´z´ÝB}{ß1ß6rß3|¦´x´´y´‡¤E4¢-1X¤E4º9D—÷ß4{ßeß3jßnß6pß50»ßAßb}´z´ÝB}{ß1ß6sß3|{´x´¤Eg´y´º76}÷ß4{ßeß3lß52ß7Dß55»ß57»ßAßb}}{ß1ß6wß3|{´x´¤Bw´y´º6Y}÷ß4{ßeß3lß52ß7Dß55»ß57»ßAßb}}{ß1ß6tß3|¦´x´´y´‡¤Bcº61¤Gw¢-JC¤Gm¢-L8¤E2º6Q¤BSº6g¤9g¢-Ii¤9qº6l—÷ß4{ßeß3lßnß5Rß5T£0.BIßAßb}}{ß1ß6uß3|¦´x´´y´‡¤D8º8W¤EC¢-FN—÷ß4{ßeß3lßnß5kßAßb}}{ß1ß6xß3|¦´x´´y´‡º5s¢-Egº8fº8X—÷ß4{ß50»ßeß41ßAßcßnß5W}}{ß1ß6yß3|¦´x´´y´‡¢-LIº7yº6Hº6Z¢-Muº5zº7sºs—÷ß4{ßeß41ßnß7Vß5ß7WßAßc}}{ß1ß70ß3|¦´x´´y´‡º5mº6uº5hº6tº8Mº7x¤Kº5c¤1mº6t¤1Sº4o¤Aº6f—÷ß4{ßeß4DßAßcßnß7Rßm»ß7Qß4D}}{ß1ß71ß3|¦´x´´y´‡º6Sº6Yº87º87º5xº6Uº5wº6cº5pº6Yº6eº88º6fº6H—÷ß4{ßeß4FßAßcßnß7Rßm»ß7Qß4F}}{ß1ß77ß3|¦´x´´y´‡º8Yº7jº8Zº5vº8aº6uº7rº75º7rº5dº8bº5rº8cº5e—÷ß4{ßeß4Vßnß7RßAßdß7Qß4Vßm»}}{ß1ß78ß3|¦´x´´y´‡º8iº5mº8jº8Lº8kº5Bº8lº8Pº8m¤-yº8n¤-Kº8jºy—÷ß4{ßeß4Vßnß7RßAßdß7Qß4Vßm»}}{ß1ß79ß3|¦´x´´y´‡º8dº8Lº8eº8Iº8fº5Xº8gº5Bº8hº5mº5V¤-yº6rº8J—÷ß4{ßeß4Vßnß7RßAßdß7Qß4Vßm»}}{ß1ß7Fß3|¦´x´´y´‡¤Lw¤fc¤EC¤fw—÷ß4{ßeß4bßnß5kßAßI}}{ß1ß7Gß3|¦´x´´y´‡ºA¤GI¤E2¤G8—÷ß4{ßeß4Xßnß5kßAßI}}{ß1ß7Iß3|¦´x´´y´‡¤DE¤gQ¤CQ¤ga¤CG¤hY¤Ck¤iC¤DO¤iW¤E2¤iM¤EW¤hs¤EM¤gu—÷ß4{ßeß4rßAßIßnß7Rßm»ß7Qß4r}}{ß1ß7Jß3|¦´x´´y´‡¤RG¤oUºO¤pS¤Qw¤qa¤S4¤quºH¤qa¤TC¤pS¤SO¤oe—÷ß4{ßeß4rßAßIßnß7Rßm»ß7Qß4r}}{ß1ß7Kß3|¦´x´´y´‡¤Rk¤rE¤Qw¤ri¤Qw¤sg¤Ra¤tK¤SY¤tAºH¤sM¤SiºY—÷ß4{ßeß4rßAßIßnß7Rßm»ß7Qß4r}}{ß1ß7Lß3|¦´x´´y´‡¤Ss¤tU¤Ra¤ty¤R6¤v6¤Rk¤wE¤Si¤wY¤Tg¤vk¤Tq¤uS—÷ß4{ßeß4rßAßIßnß7Rßm»ß7Qß4r}}{ß1ß7Mß3|¦´x´´y´‡¤Vg¤jA¤Wu¤jA¤XO¤km¤WA¤km—÷ß4{ßeß4tßAßIßm»ßnßoß7Qß4t}}{ß1ß6Pß3|¦´x´´y´‡¤Gh¢-43¤G8º10¤FPº5k—÷ß4{ßeß3eßnß7OßAßb}}{ß1ß6Qß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Keº2—÷ß4{ßeß3eßnß7OßAßb}}{ß1ß6Rß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Oj¢-5p¤P3¢-5i¤Td¢-67¤PE¢-4S¤OX¢-3f¤OCº5m¤N9º5g—÷ß4{ßeß3eßnß7OßAßb}}{ß1ß6Sß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßeß3eßnß7OßAßb}}{ß1ß64ß3|¦´x´´y´‡º8Q¤6Gº5b¤42º5c¤50º9V¤83º5e¤BIº5f¤D4º5g¤B8º84¤7A—÷ß4{ß50»ßeß3Xßnß4zßAßD}}{ß1ß6vß3|¦´x´´y´‡¤Gmº60¤Gcº6H¤E2º6G¤Bcº5u¤A0º6F¤AAº6E¤Bwº61—÷ß4{ß50»ßeß3lßnß4zßAßb}}÷¨icons¨|÷}");
