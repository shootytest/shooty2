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

  // floor options
  safe_floor?: boolean; // save player position when on this floor

  // map options
  is_map?: boolean;
  force_above?: boolean;
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
export const TEST_MAP: map_type = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢44u´y´¢1HW}÷¨options¨{¨style¨ß2¨contains¨|¨home main¨¨home inventory¨¨home shapestore¨÷¨room_id¨´´}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ßB¨room_connections¨|¨tutorial room 1¨÷¨is_room¨»ßA´´}}{ß1¨station¨ß3|{´x´¢1RC´y´¢1NU}÷ß4{ßC|¨station tutorial¨¨station streets¨¨tutorial room 5¨¨streets side room 1¨¨station home¨÷ß6|¨train¨ßG¨station tracks¨ßH¨station tracks particle¨¨station map train¨¨station map tracks 1¨¨station map tracks 2¨¨station map tracks 3¨¨station map tracks 4¨ßK÷ßA´´ßE»}}{ß1¨streets¨ß3|{´x´¢1f4´y´¢-D4}÷ß4{ßA´´ß6|¨streets room 1¨ßJ¨streets room 2¨÷}´z´£0.-84}{ß1¨tutorial¨ß3|{´x´¢-WG´y´º8}÷ß4{ß6|ßD¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨ßI÷ßA´´}}{ß1ß8ß3|{´x´¢3kk´y´¢HQ}÷ß4{ß5ß2ßA´´ßE»¨parent¨ß2ßC|ß7÷ß6|¨home inventory wall¨÷}}{ß1ß7ß3|{´x´¢3uQ´y´¢mE}÷ß4{ß5ß2ßA´´ßE»ßaß2ßC|ß8ßKß9÷ß6|¨home floor¨÷}}{ß1ß9ß3|{´x´¢4Ja´y´¢FA}÷ß4{ß5ß2ßA´´ßE»ßaß2ßC|ß7÷ß6|¨home shapestore wall¨÷}}{ß1ßKß3|{´x´¢3Zc´y´¢1BY}÷ß4{ßaßFßAßFßE»ßC|ßFßHß7÷ß6|¨station home wall 2¨¨station home wall 1¨¨station home floor¨÷}}{ß1ßPß3|¦´x´´y´‡¢T2¢12WºH¢13K¢mOºJºKºI—÷ß4{ßaßFßAßF¨is_map¨»¨make_id¨¨map_shape¨}}{ß1ßQß3|¦´x´´y´‡ºKºIºKºJ¢1L4ºJºLºI—÷ß4{ßaßFßAßFßh»ßißj}}{ß1ßRß3|¦´x´´y´‡ºLºIºLºJ¢1vMºJºMºI—÷ß4{ßaßFßAßFßh»ßißj}}{ß1ßSß3|¦´x´´y´‡ºMºIºMºJ¢29sºJºNºI—÷ß4{ßaßFßAßFßh»ßißj}}{ß1ßOß3|¦´x´´y´‡¢Qc¢10uºO¢14w¢YgºQºRºP—÷ß4{ßaßFßAßFßh»ßißj¨force_above¨»}}{ß1ßHß3|{´x´¢1dc´y´¢12g}÷ß4{ßaßFß6|¨station streets rock 1¨¨station streets rock 2¨¨station streets rock 3¨¨station streets sensor start¨¨station streets rock 0¨¨station streets sensor end¨¨station streets rock block¨¨station streets rock 4¨¨station streets rock 5¨¨station streets rock 6¨¨station streets rock 7¨¨station streets rock 8¨¨station streets floor 1¨¨station streets floor 1.5¨¨station streets floor 2¨¨station streets floor 2.5¨¨station streets floor 3¨¨station streets floor 3.5¨¨station streets wall 1¨¨station streets wall 2¨¨station streets wall 3¨¨station streets floor 0¨¨station streets floor 4¨¨station streets floor 5¨¨station streets floor 4.5¨¨station streets wall 5¨¨station streets wall 6¨¨station streets wall 7¨¨station streets wall 8¨¨station streets wall 9¨¨station streets wall 10¨¨station streets wall 11¨¨station streets wall 13¨¨station streets rocky 1¨¨station streets wall fake 1¨¨station streets wall 14¨¨station streets floor 4.1¨¨station streets wall 12¨¨station streets breakables 1¨¨station streets breakables 2¨¨station streets breakables 2.5¨¨station streets map shape 1¨¨station streets map shape 2¨¨station streets map shape 3¨¨station streets map shape 4¨¨station streets map shape 5¨¨station streets map shape 6¨¨station streets map shape 7¨÷ßAßFßE»ßC|ßFßUßJßGßK÷}´z´£0.-3E}{ß1ßMß3|¦´x´´y´‡ºHºI¢3U8ºIºUºJºHºJ—÷ß4{ßaßFßi¨floor_train_track¨ßAßF¨sensor_dont_set_room¨»}}{ß1ßNß3|¦´x´´y´‡ºHºIºHºJ—÷ß4{ßaßFßiß1XßAßFß1Y»}}{ß1ßGß3|{´x´¢VS´y´¢yA}÷ß4{ßaßFß6|¨station tutorial floor¨¨station tutorial sensor start¨¨station tutorial wall 1¨¨station tutorial wall 2¨¨station tutorial rock 1¨¨station tutorial rock 2¨¨station tutorial rock 3¨¨tutorial floor low¨¨station tutorial sensor end¨¨station tutorial map shape 1¨¨station tutorial map shape 2¨¨station tutorial map shape 3¨÷ßAßFßE»ßC|ßIßFßH÷}}{ß1ßUß3|{´x´¢1zO´y´¢rO}÷ß4{ßaßTßA´´ßE»ßC|ßHßV÷ß6|¨streets room 1 wall 2¨¨streets room 1 wall 1¨¨streets room 1 camera 1¨¨streets room 1 sensor start¨¨streets room 1 camera 2¨¨streets room 1 camera 0¨¨streets room 1 floor¨¨streets room 1 sensor end¨¨streets room 1 camera 3¨¨streets room 1 map shape 1¨÷}´z´Ý0}{ß1ßVß3|{´x´¢1w0´y´¢f8}÷ß4{ßaßTßA´´ßE»ßC|ßU÷ß6|¨streets room 2 rock¨¨streets room 2 sensor start¨¨streets room 2 floor¨¨home wow test wow¨¨streets room 2 map shape 1¨÷}´z´Ý0}{ß1ßJß3|{´x´¢1wo´y´¢1C2}÷ß4{ßaßTßA´´ßE»ßC|ßHßF÷ß6|¨streets side room 1 floor¨¨streets side room 1 wall 1¨¨streets side room 1 wall 2¨¨streets side room 1 wall fake 1¨¨streets side room 1 test¨¨streets side room 1 window 1¨¨streets side room 1 map shape 1¨¨streets side room 1 map shape 2¨¨streets side room 1 map shape 3¨÷}´z´£0.-6S}{ß1ßLß3|¦´x´´y´‡ºOºP¢TRºP—{´x´ºd´y´ºP´z´£0.4q}{´x´¢Vr´y´ºP´z´Ý3}{´x´ºe´y´ºP}{´x´ºR´y´ºP}{´x´ºR´y´ºP´z´£0.84}{´x´ºO´y´ºP´z´Ý4}÷ß4{ßaßFßi¨wall_train¨ß6|¨train floor broken¨¨train wall 1¨¨train wall 2¨¨train wall 3¨¨train ceiling¨¨train sensor¨¨train door right¨¨train door right path¨¨train door left¨¨train door left path¨¨train floor¨¨train floor broken top¨¨train floor broken bottom¨¨train floor broken middle¨÷¨seethrough¨»ßAßF}}{ß1ßDß3|{´x´¢-68´y´¢-50}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨¨tutorial room 1 floor¨¨tutorial room 1 map shape 1¨¨tutorial room 1 map shape 2¨¨tutorial room 1 map shape 3¨÷ßaßWßE»ßC|ßXßZßBßY÷ßA´´}}{ß1ßXß3|{´x´¢OW´y´¢-DO}÷ß4{ßaßWß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨tutorial room 2 floor¨¨tutorial room 2 floor platform¨¨tutorial room 2 map shape 1¨¨tutorial room 2 map shape 2¨¨tutorial room 2 map shape 3¨¨tutorial room 2 map shape 4¨¨tutorial room 2 map shape 5¨¨tutorial room 2 map shape 6¨¨tutorial room 2 map shape 7¨÷ßE»ßC|ßIßDßY÷ßA´´}}{ß1ßYß3|{´x´¢-JM´y´¢-Tg}÷ß4{ßaßWß6|¨tutorial window 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨¨tutorial room 3 floor¨¨tutorial room 3 enemy 1¨¨tutorial room 3 map shape 1¨¨tutorial room 3 map shape 2¨¨tutorial room 3 map shape 3¨¨tutorial room 3 map shape 4¨¨tutorial room 3 map shape 5¨÷ßE»ßC|ßYßZßXßD÷ßA´´}}{ß1ßZß3|{´x´¢-Z0´y´¢-Gc}÷ß4{ßaßWß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨¨tutorial room 4 floor¨¨tutorial room 4 map shape 1¨÷ßE»ßC|ßYßD÷ßA´´}}{ß1ßIß3|{´x´¢9t´y´¢GK}÷ß4{ßaßWß6|¨tutorial room 5 sensor boss¨¨tutorial room 5 door start¨¨tutorial room 5 sensor boss start¨¨tutorial room 5 boss¨¨tutorial room 5 floor¨¨tutorial room 5 door end¨¨tutorial wall 15¨¨tutorial wall 16¨¨tutorial rock 23¨¨tutorial room 5 enemy¨¨tutorial rock 24¨¨tutorial rock 25¨¨tutorial rock 26¨¨tutorial rock 27¨¨tutorial room 5 switch path¨¨tutorial room 5 sensor middle¨¨tutorial room 5 sensor boss end¨¨tutorial wall 14¨¨tutorial room 5 rocky 3¨¨tutorial fake wall 5¨¨tutorial room 5 map shape 1¨¨tutorial room 5 map shape 2¨¨tutorial room 5 map shape 3¨¨tutorial room 5 map shape 4¨¨tutorial room 5 map shape 5¨¨tutorial room 5 map shape 6¨¨tutorial room 5 map shape 7¨¨tutorial room 5 map shape 8¨÷ßE»ßC|ßXßGßF÷ßA´´}}{ß1ßcß3|¦´x´´y´‡¢4S8¢9M¢4FE¢-U¢3tS¢-2Q¢3e8¢3Y¢3Te¢Eq¢3QQ¤RaºU¤gu¢3jm¤oK¢438¤pw¢4Q2¤hs¢4XI¤OM—÷ß4{ßaß7ßi¨floor¨ßAß7}}{ß1ßbß3|¦´x´´y´‡¢3tI¤H6¢3sK¤DE¢3oI¤AU¢3jI¤9q¢3ec¤Bm¢3cW¤Gc¢3dA¤Lc¢3hqºh¢3ne¤OM¢3rg¤Lmº14¤H6—÷ß4{ßaß8ßi¨wall¨ßAß8¨open_loop¨»}}{ß1ßdß3|¦´x´´y´‡¢4Tuºyºpºq¢4NI¤5e¢4GC¤5y¢4B2ºq¢488¤F0¢49a¤KU¢4Eu¤OC¢4M0¤Og¢4Ro¤Lcº1Eºy—÷ß4{ßaß9ßiß3xßAß9ß3y»}}{ß1ß1yß3|{´x´¢28G´y´¤Qw}÷ß4{ßaßV¨spawn_enemy¨¨checkpoint¨¨is_spawner¨»¨spawn_repeat¨ÊßAßV}´z´Ý0}{ß1ßgß3|¦´x´´y´‡¢3no¤uS¢3Qu¤uS¢3Pc¤yUº1Q¢17M¢3p6º1Rº1S¤yU—÷ß4{ßaßKßiß3wßAßK}}{ß1ßfß3|¦´x´´y´‡¢3h2¤yUº1P¤yUº1P¢106—÷ß4{ßaßKßiß3xßAßKß3y»}}{ß1ßeß3|¦´x´´y´‡º1P¢15kº1Pº1Rº1Tº1R—÷ß4{ßaßKßiß3xßAßKß3y»}}{ß1ß1Nß3|¦´x´´y´‡¢1Viºc¢1VE¢14c¢1RMº1Rº1Z¤wY¢1cA¤sC¢1aE¤xM¢1VY¤yK¢1ZG¢114—÷ß4{ßaßHß3z¨enemy_streets_bit¨ß42¤Kß41»ßAßH}´z´£0.-1c}{ß1ß1Oß3|{´x´¢1jG´y´¤vu´z´Ý1}{´x´¢1bM´y´¤ws}{´x´¢1co´y´¤s2}÷ß4{ßaßHß3zß43ß42Íß41»ßAßH}´z´Ý1}{ß1ß1Pß3|{´x´¢1fi´y´¢1CM´z´Ý1}{´x´¢1aO´y´¢1Cg}{´x´ºS´y´¢15a´z´Ý1}{´x´¢1bg´y´¢10k}{´x´¢1ic´y´¤zS}÷ß4{ßaßHß3zß43ß42Ðß41»ßAßH}´z´Ý1}{ß1ß16ß3|¦´x´´y´‡¢1Qi¤vuº1q¢1Aa¢1RWº1rº1s¤vu—÷ß4{ßaßHßiß3wßAßH}´z´Ý5}{ß1ßxß3|¦´x´´y´‡¢1Qs¤wOº1t¢18y¢1Uk¢1Fk¢1dI¤pc—÷ß4{ßaßHßiß3wßAßH¨safe_floor¨»ß5¨wall_floor¨}´z´Ý5}{ß1ßyß3|¦´x´´y´‡º1x¤pcº1vº1w—{´x´º1v´y´º1w´z´Ý1}{´x´º1x´y´¤pc´z´Ý1}÷ß4{ßaßHßiß45ßAßH}´z´Ý5}{ß1ßzß3|¦´x´´y´‡º1x¤pcº1vº1w¢1fOº1w¢1ks¤pc—÷ß4{ßaßHßiß3wßAßHß44»ß5ß45}´z´Ý1}{ß1ß10ß3|¦´x´´y´‡º1z¤pcº1yº1w—{´x´º1y´y´º1w´z´£0.-4q}{´x´º1z´y´¤pc´z´Ý6}÷ß4{ßaßHßiß45ßAßH}´z´Ý1}{ß1ß11ß3|¦´x´´y´‡º1z¤pcº1yº1w¢1xI¢1DK¢1us¤ri—÷ß4{ßaßHßiß3wßAßHß44»ß5ß45}´z´Ý6}{ß1ß12ß3|¦´x´´y´‡º22¤riº20º21—{´x´º20´y´º21´z´Ý2}{´x´º22´y´¤ri´z´Ý2}÷ß4{ßaßHßiß45ßAßH}´z´Ý6}{ß1ß17ß3|¦´x´´y´‡º22¤riº20º21—{´x´¢20g´y´¢1Ak´z´Ý2}{´x´¢21o´y´º1r´z´Ý2}{´x´¢202´y´¢1DU}{´x´¢27S´y´¢1De´z´Ý2}{´x´¢23u´y´¤uw}÷ß4{ßaßHßiß3wßAßHß44»}´z´Ý2}{ß1ß1Lß3|{´x´º2A´y´¤uw´z´Ý2}{´x´º28´y´º29}÷ß4{ßaßHßi¨wall_floor_halfwidth¨ßAßH}´z´Ý2}{ß1ß19ß3|¦´x´´y´‡º2A¤uwº28º29—{´x´º28´y´º29´z´Ý0}{´x´º2A´y´¤uw´z´Ý0}÷ß4{ßaßHßiß45ßAßH}´z´Ý2}{ß1ß18ß3|{´x´º2A´y´¤uw´z´Ý0}{´x´º28´y´º29}{´x´¢2LA´y´¢12v´z´Ý0}{´x´¢294´y´¤uw}÷ß4{ßaßHßiß3wßAßHß44»}´z´Ý0}{ß1ß1Qß3|¦´x´´y´‡º1qº1uº1cº21¢1ce¤rYº1q¤wO—÷ß4{ßaßHßAßHßh»ßißjß6|¨station streets map rock 1¨¨station streets map rock 2¨÷}}{ß1ß1Rß3|¦´x´´y´‡º1cº21¢1g2º1l¢1ja¤vkº2E¤rY—÷ß4{ßaßHßAßHßh»ßißjß6|¨station streets map rock 3¨¨station streets map rock 4¨¨station streets map line 1¨÷}}{ß1ß1Sß3|¦´x´´y´‡º2Fº1l¢1oQ¢1Au¢1wyº1rºM¤w4¢1pi¤tUº2G¤vk—÷ß4{ßaßHßAßHßh»ßißjß6|¨station streets map rock 5¨¨station streets map rock 6¨¨station streets map rock 7¨¨station streets map line 2¨÷}}{ß1ß1Tß3|¦´x´´y´‡º2Jº1r¢26o¢1AGº2A¤uwºM¤w4—÷ß4{ßaßHßAßHßh»ßißjß6|¨station streets map rock 8¨¨station streets map rock 9¨¨station streets map line 3¨÷}}{ß1ß1Uß3|¦´x´´y´‡º2Lº2MºN¢19mºN¤zI¢2D6º1oº2O¤zIºN¤w4º2D¤uwº28¤um¢25q¤umº2A¤uw—÷ß4{ßaßHßAßHßh»ßißjß6|¨station streets map line 4¨÷}}{ß1ß1Vß3|¦´x´´y´‡ºNº2Nº2O¢16Yº2O¢156ºNº2Q—÷ß4{ßaßHßAßHßh»ßißj}}{ß1ß1Wß3|¦´x´´y´‡¢1ys¢10L¢21e¤yW¢1xy¤xw—÷ß4{ßaßHßAßHßh»ßißjßk»}}{ß1ßpß3|¦´x´´y´‡¢1Uu¢15Qº1X¢19S¢1SU¢172—÷ß4{ßaßHßi¨rock¨ßAßH}´z´Ý5}{ß1ßlß3|¦´x´´y´‡¢1ZQ¤xq¢1YSº1U—{´x´¢1WM´y´¤yU´z´Ý5}÷ß4{ßaßHßiß4KßAßH}´z´Ý5}{ß1ßmß3|¦´x´´y´‡¢1d8º1m¢1b2º2N—{´x´¢1Ym´y´¢15G´z´Ý1}÷ß4{ßaßHßiß4KßAßH}´z´Ý1}{ß1ßnß3|¦´x´´y´‡¢1fY¤zm¢1cK¢10GºS¤xW—÷ß4{ßaßHßiß4KßAßH}´z´Ý1}{ß1ßsß3|¦´x´´y´‡¢1nI¢16s¢1im¢19cº1zº2X—÷ß4{ßaßHßiß4KßAßH}´z´Ý6}{ß1ßtß3|¦´x´´y´‡¢1scº1oº2l¢10Q¢1qW¤w4—÷ß4{ßaßHßiß4KßAßH}´z´Ý6}{ß1ßuß3|¦´x´´y´‡¢1uEº2X¢1tQ¢16iº2pº2h—÷ß4{ßaßHßiß4KßAßH}´z´Ý6}{ß1ßvß3|¦´x´´y´‡¢244¢1A6¢1yuº2Y¢22Iº2X—÷ß4{ßaßHßiß4KßAßH}´z´Ý2}{ß1ßwß3|{´x´¢1xw´y´¤xq}{´x´º25´y´¤yU´z´Ý2}{´x´º2x´y´º2q}÷ß4{ßaßHßiß4KßAßHß3y»}´z´Ý2}{ß1ßrß3|¦´x´´y´‡¢2Hwº2CºNº2QºN¤zI—÷ß4{ßaßHßiß4KßAßH}´z´Ý0}{ß1ß1Iß3|{´x´¢2CN´y´¢169}÷ß4{ßaßHß3z¨enemy_streets_rocky_small¨ß41»ß42ÊßAßH¨spawn_permanent¨»}´z´Ý0}{ß1ßqß3|¦´x´´y´‡¢2Ei¤vGº33¢1CC¢1mUº34º35¤vG—÷ß4{ßaßHßi¨sensor¨ßAßH}´z´Ý0}{ß1ßoß3|¦´x´´y´‡¢1Ty¤v5¢1UGº21º1qº34º1t¤vG—÷ß4{ßaßHßiß4NßAßH}}{ß1ß13ß3|¦´x´´y´‡º2A¤uwºM¤w4—÷ß4{ß3y»ßaßHßiß3xßAßH}´z´Ý2}{ß1ß14ß3|{´x´º2E´y´¤rY}{´x´º1q´y´¤wO´z´Ý5}{´x´º1q´y´ºP}÷ß4{ß3y»ßaßHßiß3xßAßH}´z´Ý5}{ß1ß15ß3|¦´x´´y´‡º2G¤vkº2E¤rY—÷ß4{ß3y»ßaßHßiß3xßAßH}´z´Ý1}{ß1ß1Aß3|¦´x´´y´‡º1cº21º1qº1u—{´x´º1q´y´ºQ´z´Ý5}÷ß4{ß3y»ßaßHßiß3xßAßH}´z´Ý5}{ß1ß1Bß3|¦´x´´y´‡º2Fº1lº1cº21—÷ß4{ß3y»ßaßHßiß3xßAßH}´z´Ý1}{ß1ß1Cß3|{´x´º2J´y´º1r´z´Ý6}{´x´º2H´y´º2I}{´x´º2F´y´º1l}÷ß4{ß3y»ßaßHßiß3xßAßH}´z´Ý6}{ß1ß1Dß3|¦´x´´y´‡ºM¤w4º2K¤tUº2G¤vk—÷ß4{ß3y»ßaßHßiß3xßAßH}´z´Ý6}{ß1ß1Eß3|¦´x´´y´‡º1qºQº1qº1u—÷ß4{ß3y»ßaßHßiß3xßAßH}´z´Ý0}{ß1ß1Fß3|{´x´º1q´y´¤wO´z´Ý0}{´x´º1q´y´ºP}÷ß4{ß3y»ßaßHßiß3xßAßH}´z´Ý0}{ß1ß1Gß3|¦´x´´y´´z´‡º2Lº2MÝ2º25¢1AQÝ2¢1ya¢1FQÝ2—÷ß4{ß3y»ßaßHßiß3xßAßH}´z´Ý2}{ß1ß1Mß3|¦´x´´y´‡¢1weº3A¢1zsº2Iº2Jº1r—÷ß4{ß3y»ßaßHßiß3xßAßH}´z´Ý2}{ß1ß1Hß3|¦´x´´y´‡º2Oº2Rº2Oº2QºNº2Nº2Lº2M—÷ß4{ß3y»ßaßHßiß3xßAßH}´z´Ý0}{ß1ß1Kß3|¦´x´´y´‡º28¤umº2D¤uwºN¤w4—{´x´º2O´y´¤zI´z´Ý0}{´x´º2O´y´º1o}÷ß4{ß3y»ßaßHßiß3xßAßH}´z´Ý0}{ß1ß1Jß3|{´x´º2z´y´¤xq}{´x´º2x´y´º2q´z´Ý2}÷ß4{ßaßHßi¨wall_streets_fake¨ß3y»ß4M»ßAßH}´z´Ý2}{ß1ß1Zß3|¦´x´´y´‡¤am¤w4¤YM¤o0¤X4¤o0¤Y2¤rE¤Fo¤s2¤Gw¤yy¤Gwº1RºVº1RºV¢18e¤X4º3D¤X4º1R¤amº1R¤am¢130—÷ß4{ßaßGßiß3wß44»ßAßG}}{ß1ß1iß3|¦´x´´y´‡¤ZU¤w4¤RG¤w4¤Gw¤yy¤Gwº1R¤ZUº1R—÷ß4{ßaßGßAßGßh»ßißj}}{ß1ß1jß3|¦´x´´y´‡¤ZYº1V¤ZUº1V¤ZUº1U¤ZYº1U¤ZY¤w4¤am¤w4¤amº1R¤ZYº1R—÷ß4{ßaßGßAßGßh»ßißj}}{ß1ß1kß3|¦´x´´y´‡ºV¢17QºVº3D¤X4º3D¤X4º3F—÷ß4{ßaßGßAßGßh»ßißj}}{ß1ß1dß3|¦´x´´y´‡¢14S¤tAº2a¤uw¢17g¤y0º2Rº2q¢11s¤zmº2k¤xC¢11O¤uI—÷ß4{ßaßGßiß4KßAßG}´z´Ý0}{ß1ß1eß3|¦´x´´y´‡¢1Emº2X¢1GO¢164¢1Giº3Hº1w¢19I¢1Dy¢198¢1Cqº3Hº21º3M—÷ß4{ßaßGßiß4KßAßG}´z´Ý0}{ß1ß1fß3|¦´x´´y´‡¢1K6¤xM¢1LE¤xq¢1LY¤yy¢1Kkº2q¢1J8º1U¢1IK¤yo¢1Iy¤xg—÷ß4{ßaßGßiß4KßAßG}´z´Ý0}{ß1ß1hß3|¦´x´´y´‡º5¤vGº5º34¢1PQº34º3Z¤vG—÷ß4{ßaßGßiß4NßAßG}}{ß1ß1aß3|¦´x´´y´‡ºH¤wY¤KK¤yy¤KKº2kºHº2k¤Ue¤zm¤WGº2k¤ZU¤wY—÷ß4{ßaßGßiß4N¨sensor_fov_mult¨ÊßAßG}}{ß1ß1bß3|¦´x´´y´‡¤RG¤w4¤Op¤wi—÷ß4{ß3y»ßaßGßiß3xßAßG}}{ß1ß1cß3|¦´x´´y´‡¤Mk¤xM¤Gw¤yy¤Gwº1R¤ZUº1R¤ZUº1V—÷ß4{ß3y»ßaßGßiß3xßAßG}}{ß1ß1qß3|{´x´¢2CI´y´¤zS}÷ß4{ßaßUß3z¨enemy_streets_camera_small¨ß41»ß42ÊßAßU}´z´Ý0}{ß1ß1nß3|{´x´¢24O´y´¤to}÷ß4{ßaßUß3zß4Qß41»ß42ÊßAßU}´z´Ý0}{ß1ß1pß3|{´x´¢27I´y´ºC}÷ß4{ßaßUß3zß4Qß41»ß42ÊßAßU}´z´Ý0}{ß1ß1tß3|{´x´¢252´y´¤fw}÷ß4{ßaßUß3zß4Qß41»ß42ÊßAßU}´z´Ý0}{ß1ß1rß3|¦´x´´y´‡º2A¤uw¢29O¤v6—{´x´º28´y´¤nC´z´Ý0}{´x´¢2A2´y´¤iM}{´x´¢25C´y´¤iM}{´x´º2y´y´¤nC}÷ß4{ßaßUßiß3wßAßUß44»}´z´Ý0}{ß1ß1uß3|¦´x´´y´‡º2P¤umº28¤um¢28u¤uSº28¤nCº3f¤iMº1N¤eK¢23Q¤eKº3g¤iMº2y¤nC¢23k¤uS—÷ß4{ßaßUßAßUßh»ßißj}}{ß1ß1sß3|{´x´¢22w´y´¤fS}{´x´º3k´y´¤ee´z´Ý0}{´x´º3e´y´¤ee´z´Ý0}{´x´º3e´y´¤fS}÷ß4{ßaßUßiß4NßAßUß4P£0.Cu}´z´Ý0}{ß1ß1oß3|{´x´º3i´y´¤te}{´x´º3i´y´¤sq´z´Ý0}{´x´ºN´y´¤sq´z´Ý0}{´x´ºN´y´¤te}÷ß4{ßaßUßiß4NßAßUß4PÝ7}´z´Ý0}{ß1ß1mß3|¦´x´´y´‡º1N¤Hkº39¤Wkº3i¤eK—{´x´º3g´y´¤iM´z´Ý0}{´x´º2y´y´¤nC}{´x´º2A´y´¤uw}{´x´º2P´y´¤um´z´Ý0}{´x´º3j´y´¤uS}÷ß4{ß3y»ßaßUßiß3xßAßU}´z´Ý0}{ß1ß1lß3|¦´x´´y´‡º1N¤Hkº30¤Wkº1N¤eKº3f¤iMº28¤nCº3h¤uSº28¤um—÷ß4{ß3y»ßaßUßiß3xßAßU}´z´Ý0}{ß1ß1xß3|¦´x´´y´´z´‡¢1s8¤gkÝ0º3g¤iMÝ0—{´x´º3f´y´¤iM}{´x´¢2OO´y´¤gk}{´x´º1N´y´¤Hk}÷ß4{ßaßVßiß3wßAßVß44»}´z´Ý0}{ß1ß1zß3|¦´x´´y´‡º1N¤eKº3i¤eKº39¤Wkº1N¤Hkº30¤Wk—÷ß4{ßaßVßAßVßh»ßißjß6|¨streets room 2 map rock 1¨÷}}{ß1ß1vß3|¦´x´´y´‡¢2B0¤X4º2A¤X4—{´x´º2P´y´¤b6´z´Ý0}÷ß4{ßaßVßiß4KßAßV}´z´Ý0}{ß1ß1wß3|{´x´¢1xm´y´¤X4}{´x´º3o´y´¤WG´z´Ý0}{´x´¢2Ik´y´¤WG´z´Ý0}{´x´º3p´y´¤X4}÷ß4{ßaßVßiß4NßAßVß4P£1.1c}´z´Ý0}{ß1ß20ß3|{´x´º3C´y´º2I}{´x´º25´y´º38´z´Ý2}{´x´º28´y´º29´z´Ý2}{´x´º3h´y´¢1FG}{´x´º3h´y´¢1T8´z´Ý2}{´x´º3B´y´º3r}{´x´º3B´y´º3A}÷ß4{ßaßJßiß3wßAßJß44»}´z´Ý2}{ß1ß26ß3|¦´x´´y´‡º3Cº2Iº3Bº3Aº39º3Aº25º38º2Jº1r—÷ß4{ßaßJßAßJßh»ßißj}}{ß1ß27ß3|¦´x´´y´‡¢21Aº1qº1Nº1qº1Nº3Lº39º3Aº3Bº3A—÷ß4{ßaßJßAßJßh»ßißj}}{ß1ß28ß3|¦´x´´y´‡¢210º29¢22Sº24¢26eº1r¢27cº3A¢26K¢1F6º2Pº3R¢22c¢1DAº3v¢1Faº3v¢1GEº3d¢1G4—÷ß4{ßaßJßAßJßh»ßißj}}{ß1ß24ß3|{´x´¢20M´y´º3W´z´Ý2}÷ß4{ßaßJßAßJß41»ß6|¨streets side room 1 test 0¨¨streets side room 1 test 1¨÷}´z´Ý2}{ß1ß21ß3|¦´x´´y´‡º3sº1qº3Bº3A—÷ß4{ß3y»ßaßJßiß3xßAßJ}´z´Ý2}{ß1ß22ß3|¦´x´´y´´z´‡º39º3AÝ2º3dº43Ý2—{´x´º3t´y´º29}{´x´º3u´y´º24}{´x´º3v´y´º1r}{´x´º3w´y´º3A}{´x´º3x´y´º3y}{´x´º2P´y´º3R}{´x´º3z´y´º40´z´Ý2}{´x´º3v´y´º41}{´x´º3v´y´º42}{´x´º1N´y´º3L}÷ß4{ß3y»ßaßJßiß3xßAßJ}´z´Ý2}{ß1ß23ß3|{´x´º3d´y´º43}{´x´º3v´y´º42´z´Ý2}÷ß4{ßaßJßiß4Oß3y»ß4M»ßAßJ}´z´Ý2}{ß1ß25ß3|¦´x´´y´´z´‡º3s¢1LsÝ2º39º3AÝ2—÷ß4{ß3y»ßaßJßi¨wall_window¨ßAßJ}´z´Ý2}{ß1ß2Eß3|¦´x´´y´‡ºRºPºOºPºOºQºRºQ—÷ß4{ßaßLßiß29ß3w»ßAßFß1Y»}´z´Ý4}{ß1ß2Iß3|¦´x´´y´‡¤SEºPºdºP—{´x´ºd´y´ºP´z´Ý3}{´x´¤SE´y´ºP´z´Ý3}÷ß4{ßaßLßiß29ßAßF}}{ß1ß2Jß3|¦´x´´y´‡ºdºP¤UeºP—÷ß4{ßaßLßi¨sensor_path¨ßAßF}}{ß1ß2Gß3|¦´x´´y´‡ºeºP¤X4ºP—{´x´¤X4´y´ºP´z´Ý3}{´x´ºe´y´ºP´z´Ý3}÷ß4{ßaßLßiß29ßAßF}}{ß1ß2Hß3|¦´x´´y´‡ºeºP¤UeºP—÷ß4{ßaßLßiß4VßAßF}}{ß1ß2Kß3|¦´x´´y´‡ºRºPºOºPºOºQºRºQ—÷ß4{ßaßLßi¨floor_train¨ßAßFß1Y»}}{ß1ß2Aß3|¦´x´´y´‡ºRºP¤SEºP¤Ru¢122¤SE¢13U¤SEºQºRºQ—÷ß4{ßaßLßiß4WßAßFß1Y»}}{ß1ß2Mß3|¦´x´´y´‡ºOºQ¤SEºQ¤SEº47ºO¢13A—÷ß4{ßaßLßiß4WßAßFß1Y»}}{ß1ß2Nß3|¦´x´´y´‡ºOº48¤SEº47¤Ruº46ºOºI—÷ß4{ßaßLßiß4WßAßFß1Y»}}{ß1ß2Lß3|¦´x´´y´‡ºOºI¤Ruº46¤SEºPºOºP—÷ß4{ßaßLßiß4WßAßFß1Y»}}{ß1ß2Fß3|¦´x´´y´‡¤Qmº1e¤Qm¢14m¤YWº49¤YWº1e—÷ß4{ßaßLßiß4NßAßFß1Y»}}{ß1ß2Bß3|{´x´ºR´y´ºP}{´x´ºR´y´ºP´z´Ý4}{´x´ºR´y´ºQ´z´Ý4}{´x´ºR´y´ºQ}÷ß4{ßaßLßiß29ßAßF}}{ß1ß2Cß3|{´x´ºO´y´ºP}{´x´ºO´y´ºP´z´Ý4}{´x´ºO´y´ºQ´z´Ý4}{´x´ºO´y´ºQ}÷ß4{ßaßLßiß29ßAßF}}{ß1ß2Dß3|¦´x´´y´‡ºOºQºRºQ—{´x´ºR´y´ºQ´z´Ý4}{´x´ºO´y´ºQ´z´Ý4}÷ß4{ßaßLßiß29ßAßF}}{ß1ß2kß3|¦´x´´y´‡¤Lm¤4q¤Ky¤84—÷ß4{ßaßXßi¨wall_tutorial_fake¨ß3y»ß4M»ßAßX}}{ß1ß3Rß3|¦´x´´y´‡¢-MQ¤-e¢-NY¤K—÷ß4{ßaßZßiß4Xß3y»ß4M»ßAßZ}}{ß1ß3nß3|¦´x´´y´‡¤AA¤g6¤By¤i0—÷ß4{ßaßIßiß4Xß3y»ß4M»ßAßI}}{ß1ß1gß3|{´x´º1q´y´¤wO´z´Ý0}{´x´º1q´y´º1u}{´x´¤ye´y´¢1Ec}{´x´¤yU´y´¤qQ}÷ß4{ßaßGßiß3wßAßG}´z´Ý0}{ß1ß3cß3|¦´x´´y´‡¤CQ¤ga¤DE¤gQ¤EM¤gu¤EW¤hs¤E2¤iM¤DO¤iW¤Ck¤iC—÷ß4{ßaßIßiß4Kß3y»ßAßI}}{ß1ß3eß3|¦´x´´y´‡¤SO¤oe¤TC¤pSºH¤qa¤S4¤qu¤Qw¤qaºO¤pS¤RG¤oU—÷ß4{ßaßIßiß4KßAßI}}{ß1ß3fß3|¦´x´´y´‡¤SiºYºH¤sM¤SY¤tA¤Ra¤tK¤Qw¤sg¤Qw¤ri¤Rk¤rE—÷ß4{ßaßIßiß4KßAßI}}{ß1ß3gß3|¦´x´´y´‡¤Ss¤tU¤Tq¤uS¤Tg¤vk¤Si¤wY¤Rk¤wE¤R6¤v6¤Ra¤ty—÷ß4{ßaßIßiß4KßAßI}}{ß1ß3hß3|¦´x´´y´‡¤OC¤vQ¤Og¤wE¤OM¤x2¤NO¤xM¤Ma¤ws¤MQ¤vu¤NE¤vG—÷ß4{ßaßIßiß4KßAßI}}{ß1ß2Rß3|{´x´ºu´y´º3}÷ß4{ßaßDß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷ßAßD}}{ß1ß2Tß3|¦´x´´y´‡¤6w¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßaßDß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßiß4Nß4P£0.EWßAßD}}{ß1ß2Xß3|¦´x´´y´‡¤D4¤-A¤C6¢-42¤5eºuº2ºg¢-6Iº2¢-6m¤42¢-9q¤50¢-Bm¤84¢-Bc¤BI¢-7Q¤D4¢-3Y¤B8¢-26¤84¤4C¤6w¤6c¤1S—÷ß4{ßaßDßiß3wß44»ßAßD}}{ß1ß2Yß3|¦´x´´y´‡¤5eºuº2ºgº4Gº2º4H¤42º4N¤84¤4C¤6w¤6c¤1S—÷ß4{ßaßDßAßDßh»ßißjß6|¨tutorial room 1 map rock 1¨¨tutorial room 1 map rock 2¨¨tutorial room 1 map rock 3¨¨tutorial room 1 map rock 4¨÷}}{ß1ß2Zß3|¦´x´´y´‡¤C6º4F¤5eºu¤6c¤1S¤D4¤-A—÷ß4{ßaßDßAßDßh»ßißj}}{ß1ß2aß3|¦´x´´y´‡¢-2v¤7M¢-47¤6K¢-4C¤6P¢-6u¤44º4I¤50º4J¤84º4K¤BIº4L¤D4º4M¤B8—÷ß4{ßaßDßAßDßh»ßißjß6|¨tutorial room 1 map rock 5¨¨tutorial room 1 map rock 6¨÷}}{ß1ß2Pß3|{´x´ºg´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß4o÷ßaßDßAßD}}{ß1ß2Sß3|¦´x´´y´‡¤5eºuº2ºgº4Gº2º4H¤42º4N¤84¤4C¤6w¤6c¤1S—÷ß4{ßaßDßiß4Nß4PÊßAßD}}{ß1ß2Vß3|{´x´¢-BI´y´¤4q}÷ß4{ß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßaßDßAßD}}{ß1ß2gß3|¦´x´´y´‡¤5e¢-CG¤4g¢-8O¤8Yº4L¤9Wº4T¤F9¢-HE¤9W¢-BS—÷ß4{ßaßXßiß4Nß4PÝ9ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷ßAßX}}{ß1ß2pß3|¦´x´´y´‡¤Gw¢-Ky¤EC¢-Lc¤BS¢-KU¤4M¢-Ca¤3O¢-8i¤C6º4F¤D4¤-A¤Bm¤8s¤E2¤G8¤H6¤GI¤Keºq¤WG¤84¤Wu¤2G¤Uy¢-Ay—÷ß4{ßaßXßiß3wß44»ßAßX}}{ß1ß2qß3|¦´x´´y´‡¤Wuº4Q¤Waº4L—{´x´¤Vw´y´¢-5o´z´£0.3E}÷ß4{ßaßXßiß3wßAßX}´z´ÝA}{ß1ß2rß3|¦´x´´y´‡¤Wk¤2G¤Uyº4d¤NOº4J¤Lw¢-H6¤Gm¢-Is¤Bw¢-FU¤BS¢-Ao¤Aoº4d¤9q¢-76¤C6º4F¤D4¤-A¤Ck¤26¤M8¤3G¤WQ¤4C¤WV¤3k¤NO¤2u¤MG¤26¤N4¤eºh¤U¤Po¤18¤Py¤2Q¤Pe¤3EºO¤3E¤QI¤2Q¤QS¤18¤R6¤o¤S4¤18¤SO¤1w¤S4¤3O¤UAºw¤Ss¤1w¤Si¤e¤TM¤-K¤UU¤-o¤Vm¤-K¤Vw¤18¤WG¤42¤WQ¤4C—÷ß4{ßaßXßAßXßh»ßißjß6|¨tutorial room 2 map rock 1¨¨tutorial room 2 map rock 2¨¨tutorial room 2 map rock 3¨¨tutorial room 2 map rock 4¨¨tutorial room 2 map rock 5¨¨tutorial room 2 map rock 6¨¨tutorial room 2 map rock 7¨¨tutorial room 2 map rock 8¨¨tutorial room 2 map rock 9¨¨tutorial room 2 map rock 10¨¨tutorial room 2 map rock 11¨÷}}{ß1ß2sß3|¦´x´´y´‡¤Gc¢-7a¤Gg¢-7e¤GN¢-92¤H8¢-AF¤IW¢-A6¤JR¢-9B¤J8¢-7T¤Hk¢-6r¤Hkº4H—÷ß4{ßaßXßAßXßh»ßißjßk»}}{ß1ß2tß3|¦´x´´y´‡¤Cu¢-G8¤Cq¢-GD¤Bq¢-FW¤AA¢-GS¤A0¢-IY¤Bcº4a¤E2¢-LS¤Gc¢-Ko¤Gm¢-Ix¤Do¢-Gs¤Ds¢-Gm—÷ß4{ßaßXßAßXßh»ßißj}}{ß1ß2uß3|¦´x´´y´‡¤3Oº4c¤4Mº4b¤Aoº4d¤9qº4j—÷ß4{ßaßXßAßXßh»ßißj}}{ß1ß2vß3|¦´x´´y´‡¤Ky¤84¤Lk¤4q¤WG¤4q¤WG¤84—÷ß4{ßaßXßAßXßh»ßißj}}{ß1ß2wß3|¦´x´´y´‡¤EW¤C1¤Ha¤CG¤H6¤GI¤E2¤G8—÷ß4{ßaßXßAßXßh»ßißj}}{ß1ß2xß3|¦´x´´y´‡¤M8¤3G¤Keºq¤Ha¤CG¤EW¤C1¤Bm¤8s¤Ck¤26—÷ß4{ßaßXßAßXßh»ßißj}}{ß1ß2cß3|{´x´¤G8´y´º4M}÷ß4{ßaßXß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷ßAßX}}{ß1ß2fß3|{´x´¤KA´y´¢-5A}÷ß4{ßaßXß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷ßAßX}}{ß1ß2lß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßaßXßiß4NßAßX}}{ß1ß2dß3|{´x´¤Ss´y´¤-y}÷ß4{ßaßXß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ßAßX}}{ß1ß2eß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßaßXßiß4Vß6|¨tutorial room 2 switch¨÷ßAßX}}{ß1ß2hß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGºu—÷ß4{ßaßXßi¨icon¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷ßAßX}´z´£0.1c}{ß1ß2jß3|{´x´¤AU´y´¢-K0}÷ß4{ßaßXß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷ßAßX}}{ß1ß2mß3|¦´x´´y´‡¤CQ¤y¤Ds¤FUºA¤FU¤FU¤y—÷ß4{ßaßXßiß4Nß4PÝ9ßAßX}}{ß1ß2zß3|¦´x´´y´‡¢-Lmº4w¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßaßYßiß4Nß4P£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷ßAßY}}{ß1ß37ß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FKº4d¢-Ds¢-8s¢-Fe¢-8Yº5G¢-A0º57¢-DY¢-Ke—÷ß4{ßaßYßiß4NßAßY}}{ß1ß3Aß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßaßYß3z¨enemy_tutorial_easy¨ß41»ß42ÊßAßY}}{ß1ß30ß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßaßYß3zß5kß41»ß42ÊßAßY}}{ß1ß39ß3|¦´x´´y´‡¤3Oº4c¤4Mº4b¤e¢-GI¢-4Mº4a¢-84¢-Oq¢-EC¢-PAº58¢-I4¢-OMº4hº4Aº5Oº4T¢-9Cº4Nº4j—÷ß4{ßaßYßiß3wß44»ßAßY}}{ß1ß3Bß3|¦´x´´y´‡º4Nº4j¢-5e¢-B8º53º5H¤eº5U¤4Mº4b¤3Oº4c—÷ß4{ßaßYßAßYßh»ßißjß6|¨tutorial room 3 map rock 1¨÷}}{ß1ß3Cß3|¦´x´´y´‡º4S¢-Cuº56¢-Cr¤A¢-DU¤1O¢-Ch¤1i¢-BA¤J¢-9v¢-1P¢-9k¢-21¢-B7º4Nº5e—÷ß4{ßaßYßAßYßh»ßißjßk»}}{ß1ß3Dß3|¦´x´´y´‡º4Tº5c¢-HG¢-CQ¢-Jqº4sº58º5a¢-J2¢-JWº5Yº5Zº5Wº5Xº5Vº4aº53º5Hº5dº5e—÷ß4{ßaßYßAßYßh»ßißjß6|¨tutorial room 3 map rock 2¨÷}}{ß1ß3Eß3|¦´x´´y´‡¢-Fu¢-IN¢-F6¢-FE¢-Az¢-Do¢-8m¢-Fh¢-8T¢-IM¢-A2¢-K7º5O¢-Kj—÷ß4{ßaßYßAßYßißjßh»ßk»}}{ß1ß3Fß3|¦´x´´y´‡º4Aº5Oº5rº4sº58º5aº5bº4h—÷ß4{ßaßYßAßYßh»ßißj}}{ß1ß34ß3|¦´x´´y´‡º4Gº5W¤2F¢-5T¤4qº5I¢-3F¢-Hl—÷ß4{ßaßYßiß4Nß4PÝCß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷ßAßY}}{ß1ß3Kß3|{´x´¢-L4´y´¤49}÷ß4{ßaßZß3z¨enemy_tutorial_rock_room4¨ß41»ß42ÊßAßZ}}{ß1ß3Sß3|¦´x´´y´‡º4Aº5Oº5bº4h¢-W6¢-Ck¢-Ygº52ºk¤Uº4B¤Kº4B¤7Gº4g¤7Gº4g¤34º4A¤-eº5s¢-3Oº5Gº4c—÷ß4{ßaßZßiß3wß44»ßAßZ}}{ß1ß3Hß3|{´x´¢-QI´y´¢-7G}÷ß4{ßaßZß3z¨collect_gun_basic¨ß41»ß42Êß4M»ßAßZ}}{ß1ß3Iß3|{´x´º6F´y´º6G}÷ß4{ßaßZß3z¨deco_gun_basic¨ß41»ß42ÊßAßZ}}{ß1ß3Tß3|¦´x´´y´‡º6Bº6Cº6Dº52ºk¤Uº4B¤Kº5sº6Eº5Gº4cº4Aº5Oº5bº4h—÷ß4{ßaßZßAßZßißjßh»ß6|¨tutorial room 4 map rock 1¨¨tutorial room 4 map rock 2¨¨tutorial room 4 map rock 3¨÷}}{ß1ß3Oß3|¦´x´´y´‡¢-Kz¢-6wº66¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßaßZßiß5aßAßZ}}{ß1ß3Jß3|{´x´¢-Ue´y´¢-C6}÷ß4{ßaßZß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷ßAßZ}}{ß1ß3Mß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßaßZß3z¨enemy_tutorial_rocky¨ß41»ß42Êß4M»ßAßZ}}{ß1ß3Nß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßaßZß3zß5yß41»ß42Êß4M»ßAßZ}}{ß1ß3Gß3|¦´x´´y´‡¢-OK¢-Fkº8º5f¢-Yqº52¢-Tq¤e¢-NO¤Uº4g¢-3E¢-IEº5K—÷ß4{ßaßZßiß4Nß4P£1.4qßAßZ}}{ß1ß3Lß3|{´x´¢-Ic´y´¤16}÷ß4{ßaßZß3z¨switch¨ß41»ß42ÊßAßZ}}{ß1ß3Xß3|{´x´¤Fy´y´¤TW}÷ß4{ßaßIß3z¨enemy_tutorial_boss¨ß41»ß42ÊßAßIß4M»}}{ß1ß3Zß3|¦´x´´y´‡¤Pe¤fS¤Lw¤fc—÷ß4{ß3y»ßaßIß6|¨tutorial room 5 door end path¨÷ßAßIßi¨wall_door¨}}{ß1ß3Vß3|¦´x´´y´‡¤KU¤GSºA¤GI—÷ß4{ß3y»ßaßIß6|¨tutorial room 5 door start path¨÷ßAßIßiß62}}{ß1ß3dß3|{´x´¤Tx´y´¤gx}÷ß4{ßaßIß3z¨enemy_tutorial_easy_static¨ß41»ß42ÊßAßI}}{ß1ß3Yß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºH¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fw¤Ue¤fw¤Vc¤jA¤Wu¤jA¤XO¤km¤W6¤km¤Y2¤rE¤Fo¤s2¤F0¤nC¤92¤h4ºq¤gG¤AA¤g6¤1w¤X4¤4q¤M6—÷ß4{ßaßIßiß3wß44»ßAßI}}{ß1ß3oß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºH¤Vw¤Lz¤fY¤Hu¤fi¤Hu¤fm¤EC¤fw¤EC¤fs¤A6¤g2¤26¤X4¤4q¤M6—÷ß4{ßaßIßAßIßh»ßißj}}{ß1ß3pß3|¦´x´´y´‡¤EC¤fw¤Hu¤fm¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤RG¤w4ºO¤wE¤P1¤oQ¤SN¤o5¤RV¤l9¤GA¤mJ¤AI¤g6—÷ß4{ßaßIßAßIßh»ßißjß6|¨tutorial room 5 map rock 1¨¨tutorial room 5 map rock 2¨¨tutorial room 5 map rock 3¨¨tutorial room 5 map rock 4¨÷}}{ß1ß3qß3|¦´x´´y´‡¤Ck¤iC¤Co¤i9¤DO¤iS¤E0¤iI¤ER¤hr¤EI¤gx¤DD¤gU¤CU¤gd¤CQ¤ga¤CG¤hY—÷ß4{ßaßIßAßIßh»ßißjßk»}}{ß1ß3rß3|¦´x´´y´‡¤X8¤o0¤YM¤o0¤am¤w4¤ZY¤w4—÷ß4{ßaßIßAßIßh»ßißjß6|¨tutorial room 5 map shape 4.1¨÷}}{ß1ß3sß3|¦´x´´y´‡¤T6¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fs¤Uc¤ft¤Ps¤gL—÷ß4{ßaßIßAßIßh»ßißj}}{ß1ß3tß3|¦´x´´y´‡ºO¤wE¤Qa¤w9¤Oo¤wd¤On¤wl¤Mj¤xL¤Mh¤xH¤Gu¤yu¤FK¤p8¤Gw¤p8¤Gy¤pF¤P1¤oQ—÷ß4{ßaßIßAßIßh»ßißj}}{ß1ß3uß3|¦´x´´y´‡¤Gw¤p8¤G8ºK¤By¤i0¤C3¤hx¤AI¤g6ºq¤gG¤92¤h4¤F0¤nC¤FK¤p8—÷ß4{ßaßIßAßIßh»ßißj}}{ß1ß3vß3|¦´x´´y´‡¤G8ºK¤Gw¤p8¤SE¤o0¤RQ¤lG—÷ß4{ßaßIßAßIßh»ßißj}}{ß1ß3mß3|{´x´¤WV´y´¤jy}÷ß4{ßaßIß3z¨enemy_tutorial_rocky_small¨ß41»ß42ÊßAßIß4M»}}{ß1ß3Uß3|¦´x´´y´‡¤1w¤Ko¤1w¤cEºH¤bQ¤TM¤LI—÷ß4{ßaßIßiß4NßAßI}}{ß1ß3kß3|¦´x´´y´‡¤8s¤eK¤9g¤fI¤MG¤eo¤N4¤dq—÷ß4{ßaßIßiß4Nß4PÝDßAßI}}{ß1ß3Wß3|¦´x´´y´‡¤DE¤Gm¤CGºA¤JC¤Hk¤IE¤H6—÷ß4{ßaßIßiß4Nß4PÝDßAßI}}{ß1ß3jß3|¦´x´´y´‡¤DE¤g6¤Eg¤gu¤Kr¤ga¤V1¤fk¤ZU¤um¤Gc¤um¤H6¤ye¤Qw¤vu¤aI¤vW¤VI¤fI—÷ß4{ßaßIßiß4Nß4PÊßAßI}}{ß1ß3iß3|¦´x´´y´‡¤NE¤vG¤MkºY—÷ß4{ßaßIßiß4VßAßI}}{ß1ß31ß3|¦´x´´y´‡º6Vº5cº7¢-9gº4Jº5e—÷ß4{ßaßYßi¨spike¨ßAßY}}{ß1ß32ß3|¦´x´´y´‡º4g¢-EWº5tº4hº5pº4s—÷ß4{ßaßYßiß6BßAßY}}{ß1ß33ß3|¦´x´´y´‡¢-Af¢-PH¢-Bw¢-PKº4Tº6e—÷ß4{ßaßYßiß6BßAßY}}{ß1ß3Pß3|¦´x´´y´‡¢-Iu¤5Sº4g¤34º4A¤-eº5sº6Eº5Gº4cº4Aº5O—÷ß4{ßaßZßiß3xß3y»ßAßZ}}{ß1ß2Qß3|¦´x´´y´‡¢-38¤7Aº4N¤84¤4C¤6w¤6c¤1S¤D4¤-A—÷ß4{ß3y»ßaßDßiß3xßAßD}}{ß1ß2Uß3|¦´x´´y´‡¢-6e¤2Yº4H¤42—÷ß4{ßaßDßiß3xß3y»ßAßD}}{ß1ß2bß3|¦´x´´y´‡¤Po¤gQºH¤Vw¤RG¤MG¤H6¤GI¤Ha¤CG¤Keºq¤Ky¤84¤WG¤84¤WG¤4q¤Lm¤4q¤M8¤3G¤WQ¤4C¤Wk¤2G¤Uyº4d¤NOº4J¤Lwº4f¤Gmº4g¤Dsº51—÷ß4{ß3y»ßaßXßiß3xßAßX}}{ß1ß2nß3|¦´x´´y´‡¤3Oº4c¤9qº4j¤C6º4F—÷ß4{ßaßXßiß3xß3y»ßAßX}}{ß1ß3Qß3|¦´x´´y´‡º4B¤6Iº4B¤Kºk¤Uº6Dº52º6Bº6Cº5bº4h—÷ß4{ßaßZßiß3xß3y»ßAßZ}}{ß1ß2iß3|¦´x´´y´‡¤Cuº4s¤Bwº4h¤BSº4i¤4Mº4b—÷ß4{ß3y»ßaßXßiß3xßAßX}}{ß1ß2Wß3|¦´x´´y´‡¤C6º4F¤5eºuº2ºgº4Gº2¢-6T¤U—÷ß4{ßaßDßiß3xß3y»ßAßD}}{ß1ß2oß3|¦´x´´y´‡¤D4¤-A¤Bm¤8s¤EW¤C1¤E2¤G8¤4q¤M6¤26¤X4¤AA¤g6¤EC¤fw—÷ß4{ß3y»ßaßXßiß3xßAßX}}{ß1ß36ß3|¦´x´´y´‡º4Aº5Oº5rº4sº5pº5qº4Tº5cº5dº5eº4Nº4j¤3Oº4c—÷ß4{ßaßYßiß3xß3y»ßAßY}}{ß1ß35ß3|¦´x´´y´‡º5bº4hº58º5aº5sº5tº5Yº5Zº5Wº5Xº5Vº4aº53º5H¤eº5U¤4Mº4b—÷ß4{ßaßYßiß3xß3y»ßAßY}}{ß1ß3lß3|¦´x´´y´‡¤Hu¤fm¤Lw¤fcºH¤Vw—÷ß4{ß3y»ßaßIßiß3xßAßI}}{ß1ß3aß3|¦´x´´y´‡¤By¤i0¤G8ºK¤RQ¤lG¤SE¤o0¤Gw¤p8—÷ß4{ß3y»ßaßIßiß3xßAßI}}{ß1ß3bß3|¦´x´´y´‡¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤ZUº1U—÷ß4{ß3y»ßaßIßiß3xßAßI}}{ß1ß2yß3|¦´x´´y´‡¢-FAº6sº4dº5Cº4cº5Lº4Vº5Gº5N¢-KAº5Oº4yº5Aº5Gº6sº6s—÷ß4{ßaßYßiß4Uß3y»ßAßY}}{ß1ß38ß3|¦´x´´y´‡º6sº6sº4dº5Cº4cº5Lº4Vº5Gº5Nº6tº5Oº4yº5Aº5Gº6sº6s—÷ß4{ßaßYßiß4UßAßY}}{ß1ß4Bß3|¦´x´´y´‡º1cº21º2E¤rY—÷ß4{ßaß1RßAßHßh»ßi¨map_line¨¨map_parent¨ß1R}}{ß1ß4Fß3|¦´x´´y´‡º2Fº1lº2G¤vk—÷ß4{ßaß1SßAßHßh»ßiß6Cß6Dß1S}}{ß1ß4Iß3|¦´x´´y´‡º2Jº1rºM¤w4—÷ß4{ßaß1TßAßHßh»ßiß6Cß6Dß1T}}{ß1ß4Jß3|¦´x´´y´‡º2Lº2Mº2A¤uw—÷ß4{ßaß1UßAßHßh»ßiß6Cß6Dß1U}}{ß1ß47ß3|¦´x´´y´‡º2b¤xqº2d¤yUº2cº1U—÷ß4{ßaß1QßAßHßi¨map_inverse¨ßh»ß6Dß1Q}}{ß1ß48ß3|¦´x´´y´‡º2Wº2Xº2Zº2aº1Xº2Y—÷ß4{ßaß1QßAßHßiß6Eßh»ß6Dß1Q}}{ß1ß49ß3|¦´x´´y´‡ºS¤xWº2jº2kº2i¤zm—÷ß4{ßaß1RßAßHßiß6Eßh»ß6Dß1R}}{ß1ß4Aß3|¦´x´´y´‡º2gº2hº2fº2Nº2eº1m—÷ß4{ßaß1RßAßHßiß6Eßh»ß6Dß1R}}{ß1ß4Cß3|¦´x´´y´‡º2r¤w4º2lº2qº2pº1o—÷ß4{ßaß1SßAßHßiß6Eßh»ß6Dß1S}}{ß1ß4Dß3|¦´x´´y´‡º1zº2Xº2nº2oº2lº2m—÷ß4{ßaß1SßAßHßiß6Eßh»ß6Dß1S}}{ß1ß4Eß3|¦´x´´y´‡º2pº2hº2tº2uº2sº2X—÷ß4{ßaß1SßAßHßiß6Eßh»ß6Dß1S}}{ß1ß4Gß3|¦´x´´y´‡º2z¤xqº2xº2qº25¤yU—÷ß4{ßaß1TßAßHßiß6Eßh»ß6Dß1T}}{ß1ß4Hß3|¦´x´´y´‡º2yº2Xº2xº2Yº2vº2w—÷ß4{ßaß1TßAßHßiß6Eßh»ß6Dß1T}}{ß1ß4Rß3|¦´x´´y´‡º2P¤b6º2A¤X4º3n¤X4—÷ß4{ßaß1zßAßVßiß6Eßh»ß6Dß1z}}{ß1ß4Sß3|¦´x´´y´´z´‡¢28D¢1HSÝ2º6u¢1LUÝ2—{´x´¢24B´y´º6w}{´x´º6x´y´º6v´z´Ý2}÷ß4{ßaß24ßAßJß41»}´z´Ý2}{ß1ß4Tß3|¦´x´´y´´z´‡¢21s¢1NpÝ2º6y¢1RrÝ2¢1xqº70Ý2º71º6zÝ2—÷ß4{ßaß24ßAßJß41»}´z´Ý2}{ß1ß5oß3|¦´x´´y´‡º4Sº5fº4Nº5e—÷ß4{ßaß34ßiß4Xß3y»ß4M»ßAßY}}{ß1ß5Sß3|¦´x´´y´‡¤Hkº4H¤Gcº4k—÷ß4{ßaß2fßiß4Xß3y»ß4M»ßAßX}}{ß1ß4kß3|¦´x´´y´‡¤-Kº6E¤Aº4E¤xº4M¤1I¢-2u¤yºu¤K¢-2G¤-K¢-2a—÷ß4{ßaß2Pßiß4KßAßD}}{ß1ß4lß3|¦´x´´y´‡¤2G¤5A¤2a¤4W¤3O¤4C¤42¤4q¤42¤5o¤3E¤68¤2Q¤5y—÷ß4{ßaß2Pßiß4KßAßD}}{ß1ß4mß3|¦´x´´y´‡º4e¢-18º5dº2¢-4q¢-1wº5V¢-1Sº5V¤-oºgºs¢-5U¤-e—÷ß4{ßaß2Pßiß4KßAßD}}{ß1ß4nß3|¦´x´´y´‡º4E¤5K¢-34¤50º73¤50¢-1m¤5eº77¤6cºu¤5y¢-4B¤6G—÷ß4{ßaß2Pßiß4KßAßD}}{ß1ß4oß3|¦´x´´y´‡º6r¤Uº6q¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßaß2Pßi¨wall_tutorial_rock_breakable¨ßAßD}}{ß1ß5Eß3|¦´x´´y´‡¤Muº6f¤P0º6E¤Pyº4Q¤PUºf¤OCº54¤N4ºf¤MQºg—÷ß4{ßaß2fßiß4KßAßX}}{ß1ß5Fß3|¦´x´´y´‡¤Caº4F¤Dsº4M¤Egº4Q¤Eg¢-5K¤ECºf¤Ckºf¤C6ºg—÷ß4{ßaß2fßiß4KßAßX}}{ß1ß5Gß3|¦´x´´y´‡ºEº4F¤Gm¢-3s¤Hkº5V¤Huº5d¤Gwº54¤FUºf¤F0º52—÷ß4{ßaß2fßiß4KßAßX}}{ß1ß5Hß3|¦´x´´y´‡¤J2º7G¤Kyº4M¤Lwº76¤Lmºf¤K0º4H¤Iiºf¤IOº76—÷ß4{ßaß2fßiß4KßAßX}}{ß1ß5Iß3|¦´x´´y´‡¤Hkº4H¤JCº4L¤JWº5c¤IY¢-AA¤H6¢-AK¤GIº4m¤Gcº4k—÷ß4{ßaß2fßiß4Kß3y»ßAßX}}{ß1ß5Jß3|¦´x´´y´‡¤DEº5L¤Dsº4h¤ECº5F¤EMº4v¤Dsº51¤D8¢-Gn¤Cuº4s—÷ß4{ßaß2fßiß4KßAßX}}{ß1ß5Kß3|¦´x´´y´‡¤KUº5A¤Kyº5F¤Lcº5A¤Lmº4v¤LS¢-Gw¤Koº4f¤KKºm—÷ß4{ßaß2fßiß4KßAßX}}{ß1ß5nß3|¦´x´´y´‡º4Nº5eº78º6i¤Kº4I¤1mº5e¤1Sº6C¤Aº5Oº4Sº5f—÷ß4{ßaß34ßiß4Kß3y»ßAßY}}{ß1ß5vß3|¦´x´´y´‡¢-VIº6V¢-V8º4b¢-UKº5fº6dº5qº6dº4J¢-UUº4X¢-Uyº4K—÷ß4{ßaß3Jßiß4KßAßZ}}{ß1ß5wß3|¦´x´´y´‡¢-OWº77¢-O2º74¢-NEº4D¢-Maº73¢-Mkº4Sº4B¤-yº5bº75—÷ß4{ßaß3Jßiß4KßAßZ}}{ß1ß5xß3|¦´x´´y´‡¢-TMº4S¢-T2º77¢-SEº73¢-RQº7B¢-RG¤-y¢-Ru¤-Kº7Wºs—÷ß4{ßaß3Jßiß4KßAßZ}}{ß1ß5Lß3|¦´x´´y´‡¤Fe¤1m¤Gc¤1w¤HG¤1S¤H6¤U¤GS¤-A¤FK¤-A¤F0¤o—÷ß4{ßaß2fßiß4KßAßX}}{ß1ß5Mß3|¦´x´´y´‡¤I4¤1m¤J2¤1m¤JM¤18¤JC¤K¤IY¤-A¤Hk¤A¤Ha¤18—÷ß4{ßaß2fßiß4KßAßX}}{ß1ß5Nß3|¦´x´´y´‡¤Jq¤1m¤Ko¤2a¤Lm¤26¤MG¤e¤LS¤A¤KA¤A¤Jg¤e—÷ß4{ßaß2fßiß4KßAßX}}{ß1ß5Pß3|¦´x´´y´‡¤MG¤26¤NO¤2u¤P0¤34¤Py¤2Q¤Po¤18ºh¤U¤N4¤e—÷ß4{ßaß2fßiß4KßAßX}}{ß1ß5Qß3|¦´x´´y´‡¤QI¤2Q¤R6¤2k¤Ru¤2k¤SO¤1w¤S4¤18¤R6¤o¤QS¤18—÷ß4{ßaß2fßiß4KßAßX}}{ß1ß5Rß3|¦´x´´y´‡¤Ss¤1w¤Ue¤2G¤Vw¤18¤Vm¤-K¤UU¤-o¤TM¤-K¤Si¤e—÷ß4{ßaß2fßiß4KßAßX}}{ß1ß4Yß3|¦´x´´y´‡¤4X¤-T¤50¤-K¤4jÎ¤50¤-K¤3OÒ—÷ß4{ßaß2Rßiß5aß3y»ßAßD}´z´ÝB}{ß1ß4Zß3|¦´x´´y´‡º4F¤-yº4Fº74º78º53ºsº4Qºsº77¤1N¢-2L¤1Sº4M¤5Kº73—÷ß4{ßaß2Rß3z¨enemy_tutorial_bit¨ß41»ß42ÎßAßD}}{ß1ß4aß3|¦´x´´y´‡¢-4W¤5eº4G¤3sºf¤-yº7F¤-Aº7G¤-yº5V¤3Eº6f¤4g—÷ß4{ßaß2Rß3zß6Gß41»ß42ÎßAßD}}{ß1ß4bß3|¦´x´´y´‡ºqº4S¤9s¤m—÷ß4{ß3y»ßaß2TßAßDßiß62}}{ß1ß4cß3|¦´x´´y´‡ºqº4S¤8q¢-3M—÷ß4{ßaß2Tß3y»ßAßDßiß62}}{ß1ß4dß3|¦´x´´y´‡¤8Eº7A¤9C¤o¤AU¤U¤9Wº6E—÷ß4{ßaß2Tßi¨deco¨ß5¨tutorial_door_floor¨ßAßD}}{ß1ß4eß3|¦´x´´y´‡¤yº4M¤Aº4E¤-Kº6E¤-Kº74¤Kº73¤yºu¤1Iº72—÷ß4{ßaß2YßAßDßiß6Eßh»ß6Dß2Y}}{ß1ß4fß3|¦´x´´y´‡º5Vº78º76º77º5dº2º4eº75º79¤-eºgºsº5V¤-o—÷ß4{ßaß2YßAßDßh»ßiß6Eß6Dß2Y}}{ß1ß4gß3|¦´x´´y´‡º7B¤5eº73¤50º7A¤50º4E¤5K¢-3a¤6Aº72¤6cº77¤6c—÷ß4{ßaß2YßAßDßh»ßiß6Eß6Dß2Y}}{ß1ß4hß3|¦´x´´y´‡¤42¤5o¤42¤4q¤3O¤4C¤2a¤4W¤2G¤5A¤2Q¤5y¤3E¤68—÷ß4{ßaß2YßAßDßh»ßiß6Eß6Dß2Y}}{ß1ß4iß3|¦´x´´y´‡º4E¤5Kº7C¤6Gº4P¤6Kº7e¤6A—÷ß4{ßaß2aßAßDßh»ßiß6Eß6Dß2a}}{ß1ß4jß3|¦´x´´y´‡º7e¤6Aº72¤6cº77¤6cºu¤5y—÷ß4{ßaß2aßAßDßh»ßißjß6Dß2a}}{ß1ß4qß3|{´x´º52´y´¤AA}÷ß4{ßaß2Vß3zß5yß41»ß42ÊßAßD}}{ß1ß4rß3|{´x´¢-9M´y´¤6w}÷ß4{ßaß2Vß3zß5yß41»ß42Êß4M»ßAßD}}{ß1ß4sß3|{´x´º6i´y´¤AA}÷ß4{ßaß2Vß3zß5yß41»ß42Êß4M»ßAßD}}{ß1ß4wß3|¦´x´´y´‡¤A6¢-9m¤9g¢-9Q¤A5¢-93¤9gº7h¤BM¢-9O—÷ß4{ßaß2gßiß5aß3y»ßAßX}´z´ÝB}{ß1ß4xß3|¦´x´´y´‡¤ER¢-5Z¤E8¢-56¤Dnº7k¤E8º7l¤E8º6q—÷ß4{ßaß2gßi¨icon_tutorial¨ß3y»ßAßX}´z´ÝB}{ß1ß4yß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßaß2gßiß6Jß3y»ßAßX}´z´ÝB}{ß1ß5Oß3|{´x´¤Dz´y´¤Y}÷ß4{ßaß2fß3z¨enemy_tutorial_block¨ß41»ß42Êß4M»ßAßX}}{ß1ß5Tß3|¦´x´´y´‡¤Maº6f¤Lwº6f¤LIº6E¤M4¢-4c¤M5º7l¤M1¢-6A¤KKº4H¤NOº4H¤Mgº4G¤M8º7l¤M7º7m—÷ß4{ßaß2dß3zß6Gß41»ß42ÎßAßX}}{ß1ß5Uß3|¦´x´´y´‡ºHºs¤SO¤y¤RG¤U¤Py¤o¤SYº4S¤V8º4D¤Vcº4S—÷ß4{ßaß2dß3zß6Gß42Îß41»ßAßX}}{ß1ß5Vß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßaß2dß3zß6Gß41»ß42ÎßAßX}}{ß1ß5Xß3|¦´x´´y´‡¤Ha¤Bm¤EW¤Bc¤C6¤8s¤D4¤1S¤GS¤2QºA¤1w¤JW¤26¤Ko¤2u¤Lw¤2Q¤K0¤9W—÷ß4{ßaß2dß3zß6Gß42¤Cß41»ßAßX}}{ß1ß4uß3|¦´x´´y´‡¤76º4I¤6a¢-7m—÷ß4{ß3y»ßaß2gßAßXßiß62}}{ß1ß4vß3|¦´x´´y´‡¤76º4I¤7c¢-Bu—÷ß4{ß3y»ßaß2gßAßXßiß62}}{ß1ß4tß3|¦´x´´y´‡¤6wº6m¤5yº5W¤7G¢-7k¤8Eº4K—÷ß4{ßaß2gßiß6Hß5ß6IßAßX}}{ß1ß5Wß3|{´x´¤Hb´y´¢-C3}÷ß4{ßaß2dß3z¨enemy_tutorial_4way¨ß41»ß42ÊßAßX}}{ß1ß5Yß3|{´x´¤R6´y´¤5o}÷ß4{ßaß2dß3z¨enemy_tutorial_down¨ß41»ß42ÊßAßX}}{ß1ß4zß3|¦´x´´y´‡¤ECºf¤Ckºf¤C6ºg¤Caº4F¤Dsº4M¤Egº4Q¤Egº7F—÷ß4{ßaß2rßAßXßiß6Eßh»ß6Dß2r}}{ß1ß50ß3|¦´x´´y´‡¤Gwº54¤FUºf¤F0º52ºEº4F¤Gmº7G¤Hkº5V¤Huº5d—÷ß4{ßaß2rßAßXßiß6Eßh»ß6Dß2r}}{ß1ß51ß3|¦´x´´y´‡¤K0º4H¤Iiºf¤IOº76¤J2º7G¤Kyº4M¤Lwº76¤Lmºf—÷ß4{ßaß2rßAßXßiß6Eßh»ß6Dß2r}}{ß1ß52ß3|¦´x´´y´‡¤OCº54¤N4ºf¤MQºg¤Muº6f¤P0º6E¤Pyº4Q¤PUºf—÷ß4{ßaß2rßAßXßiß6Eßh»ß6Dß2r}}{ß1ß53ß3|¦´x´´y´‡¤GS¤-A¤FK¤-A¤F0¤o¤Fe¤1m¤Gc¤1w¤HG¤1S¤H6¤U—÷ß4{ßaß2rßAßXßiß6Eßh»ß6Dß2r}}{ß1ß54ß3|¦´x´´y´‡¤IY¤-A¤Hk¤A¤Ha¤18¤I4¤1m¤J2¤1m¤JM¤18¤JC¤K—÷ß4{ßaß2rßAßXßiß6Eßh»ß6Dß2r}}{ß1ß55ß3|¦´x´´y´‡¤KA¤A¤Jg¤e¤Jq¤1m¤Ko¤2a¤Lm¤26¤MG¤e¤LS¤A—÷ß4{ßaß2rßAßXßiß6Eßh»ß6Dß2r}}{ß1ß56ß3|¦´x´´y´‡¤H6º7I¤GIº4m¤Gcº4k¤Hkº4H¤JCº4L¤JWº5c¤IYº7H—÷ß4{ßaß2rßAßXßiß6Eßh»ß6Dß2r}}{ß1ß57ß3|¦´x´´y´‡¤D8º7J¤Cuº4s¤DEº5L¤Dsº4h¤ECº5F¤EMº4v¤Dsº51—÷ß4{ßaß2rßAßXßiß6Eßh»ß6Dß2r}}{ß1ß58ß3|¦´x´´y´‡¤Koº4f¤KKºm¤KUº5A¤Kyº5F¤Lcº5A¤Lmº4v¤LSº7K—÷ß4{ßaß2rßAßXßiß6Eßh»ß6Dß2r}}{ß1ß59ß3|¦´x´´y´‡¤EW¤-A¤Di¤-G¤DC¤M¤DL¤17¤E2¤1S¤Ei¤15¤Eu¤U—÷ß4{ßaß2rßAßXßiß6Eßh»ß6Dß2r¨map_hide_when¨ß2x}}{ß1ß5Zß3|{´x´¤FM´y´¢-7V}÷ß4{ßaß2eß3zß5zß41»ß42ÊßAßX}}{ß1ß5bß3|¦´x´´y´‡¤E6¢-1h¤EBº5n—÷ß4{ßaß2hßiß5aß3y»ßAßX}´z´ÝB}{ß1ß5cß3|¦´x´´y´‡¤E4¢-1X¤E4º80—÷ß4{ßaß2hßiß5aß3y»ßAßX}´z´ÝB}{ß1ß5dß3|{´x´¤Eg´y´º5r}÷ß4{ßaß2jß3zß5yß41»ß42Êß4M»ßAßX}}{ß1ß5hß3|{´x´¤Bw´y´º5G}÷ß4{ßaß2jß3zß5yß41»ß42Êß4M»ßAßX}}{ß1ß5eß3|¦´x´´y´‡¤Bcº4h¤Gw¢-JC¤Gm¢-L8¤E2º58¤BSº5P¤9g¢-Ii¤9qº5U—÷ß4{ßaß2jßiß4Nß4P£0.BIßAßX}}{ß1ß5fß3|¦´x´´y´‡¤D8º7J¤EC¢-FN—÷ß4{ßaß2jßiß4VßAßX}}{ß1ß5iß3|¦´x´´y´‡º4Y¢-Egº7Sº7K—÷ß4{ß3y»ßaß2zßAßYßiß62}}{ß1ß5jß3|¦´x´´y´‡¢-LIº6jº4yº5H¢-Muº4fº6eºm—÷ß4{ßaß2zßiß6Hß5ß6IßAßY}}{ß1ß5lß3|¦´x´´y´‡º4Sº5fº4Nº5eº78º6i¤Kº4I¤1mº5e¤1Sº6C¤Aº5O—÷ß4{ßaß3BßAßYßiß6Eßh»ß6Dß3B}}{ß1ß5mß3|¦´x´´y´‡º5Aº5Gº6sº6sº4dº5Cº4cº5Lº4Vº5Gº5Nº6tº5Oº4y—÷ß4{ßaß3DßAßYßiß6Eßh»ß6Dß3D}}{ß1ß5sß3|¦´x´´y´‡º7Lº6Vº7Mº4bº7Nº5fº6dº5qº6dº4Jº7Oº4Xº7Pº4K—÷ß4{ßaß3Tßiß6EßAßZß6Dß3Tßh»}}{ß1ß5tß3|¦´x´´y´‡º7Vº4Sº7Wº77º7Xº73º7Yº7Bº7Z¤-yº7a¤-Kº7Wºs—÷ß4{ßaß3Tßiß6EßAßZß6Dß3Tßh»}}{ß1ß5uß3|¦´x´´y´‡º7Qº77º7Rº74º7Sº4Dº7Tº73º7Uº4Sº4B¤-yº5bº75—÷ß4{ßaß3Tßiß6EßAßZß6Dß3Tßh»}}{ß1ß61ß3|¦´x´´y´‡¤Lw¤fc¤EC¤fw—÷ß4{ßaß3Zßiß4VßAßI}}{ß1ß63ß3|¦´x´´y´‡ºA¤GI¤E2¤G8—÷ß4{ßaß3Vßiß4VßAßI}}{ß1ß65ß3|¦´x´´y´‡¤DE¤gQ¤CQ¤ga¤CG¤hY¤Ck¤iC¤DO¤iW¤E2¤iM¤EW¤hs¤EM¤gu—÷ß4{ßaß3pßAßIßiß6Eßh»ß6Dß3p}}{ß1ß66ß3|¦´x´´y´‡¤RG¤oUºO¤pS¤Qw¤qa¤S4¤quºH¤qa¤TC¤pS¤SO¤oe—÷ß4{ßaß3pßAßIßiß6Eßh»ß6Dß3p}}{ß1ß67ß3|¦´x´´y´‡¤Rk¤rE¤Qw¤ri¤Qw¤sg¤Ra¤tK¤SY¤tAºH¤sM¤SiºY—÷ß4{ßaß3pßAßIßiß6Eßh»ß6Dß3p}}{ß1ß68ß3|¦´x´´y´‡¤Ss¤tU¤Ra¤ty¤R6¤v6¤Rk¤wE¤Si¤wY¤Tg¤vk¤Tq¤uS—÷ß4{ßaß3pßAßIßiß6Eßh»ß6Dß3p}}{ß1ß69ß3|¦´x´´y´‡¤Vg¤jA¤Wu¤jA¤XO¤km¤WA¤km—÷ß4{ßaß3rßAßIßh»ßißjß6Dß3r}}{ß1ß5Aß3|¦´x´´y´‡¤Gh¢-43¤G8ºu¤FPº4Q—÷ß4{ßaß2cßiß6BßAßX}}{ß1ß5Bß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Keº2—÷ß4{ßaß2cßiß6BßAßX}}{ß1ß5Cß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Oj¢-5p¤P3¢-5i¤Td¢-67¤PE¢-4S¤OX¢-3f¤OCº4S¤N9º4M—÷ß4{ßaß2cßiß6BßAßX}}{ß1ß5Dß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßaß2cßiß6BßAßX}}{ß1ß4pß3|¦´x´´y´‡º7C¤6Gº4H¤42º4I¤50º8I¤83º4K¤BIº4L¤D4º4M¤B8º6p¤7A—÷ß4{ß3y»ßaß2Vßiß3xßAßD}}{ß1ß5gß3|¦´x´´y´‡¤Gmº4g¤Gcº4y¤E2º4x¤Bcº4a¤A0º4w¤AAº4v¤Bwº4h—÷ß4{ß3y»ßaß2jßiß3xßAßX}}÷¨icons¨|÷}");
