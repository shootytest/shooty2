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
export const TEST_MAP: map_type = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢44u´y´¢1HW}÷¨options¨{¨style¨ß2¨contains¨|¨home main¨¨home inventory¨÷¨room_id¨´´¨is_room¨»}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ßB¨room_connections¨|¨tutorial room 1¨÷ßA»ß9´´}}{ß1¨station¨ß3|{´x´¢1RC´y´¢1NU}÷ß4{ßC|¨station tutorial¨¨station streets¨¨tutorial room 5¨¨streets side room 1¨¨station home¨÷ß6|¨train¨ßF¨station tracks¨ßG¨station tracks particle¨¨station map train¨¨station map tracks 1¨¨station map tracks 2¨¨station map tracks 3¨¨station map tracks 4¨ßJ÷ß9´´ßA»}}{ß1¨streets¨ß3|{´x´¢1f4´y´¢-D4}÷ß4{ß9´´ß6|¨streets room 1¨ßI¨streets room 2¨÷}´z´£0.-84}{ß1¨tutorial¨ß3|{´x´¢-WG´y´º8}÷ß4{ß6|ßD¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨ßH÷ß9´´}}{ß1ß8ß3|{´x´¢3kk´y´¢HQ}÷ß4{ß5ß2ß9ß2ßA»¨parent¨ß2ßC|ß7÷ß6|¨home inventory wall¨÷}}{ß1ß7ß3|{´x´¢3uQ´y´¢mE}÷ß4{ß5ß2ß9ß2ßA»ßZß2ßC|ß8ßJ÷ß6|¨home floor¨÷}}{ß1ßJß3|{´x´¢3Zc´y´¢1BY}÷ß4{ßZßEß9ßEßA»ßC|ßEßGß7÷ß6|¨station home wall 2¨¨station home wall 1¨¨station home floor¨÷}}{ß1ßOß3|¦´x´´y´‡¢T2¢12WºF¢13K¢mOºHºIºG—÷ß4{ßZßEß9ßE¨is_map¨»¨make_id¨¨map_shape¨}}{ß1ßPß3|¦´x´´y´‡ºIºGºIºH¢1L4ºHºJºG—÷ß4{ßZßEß9ßEßf»ßgßh}}{ß1ßQß3|¦´x´´y´‡ºJºGºJºH¢1vMºHºKºG—÷ß4{ßZßEß9ßEßf»ßgßh}}{ß1ßRß3|¦´x´´y´‡ºKºGºKºH¢29sºHºLºG—÷ß4{ßZßEß9ßEßf»ßgßh}}{ß1ßNß3|¦´x´´y´‡¢Qc¢10uºM¢14w¢YgºOºPºN—÷ß4{ßZßEß9ßEßf»ßgßh¨force_above¨»}}{ß1ßGß3|{´x´¢1dc´y´¢12g}÷ß4{ßZßEß6|¨station streets rock 1¨¨station streets rock 2¨¨station streets rock 3¨¨station streets sensor start¨¨station streets rock 0¨¨station streets sensor end¨¨station streets rock block¨¨station streets rock 4¨¨station streets rock 5¨¨station streets rock 6¨¨station streets rock 7¨¨station streets rock 8¨¨station streets floor 1¨¨station streets floor 1.5¨¨station streets floor 2¨¨station streets floor 2.5¨¨station streets floor 3¨¨station streets floor 3.5¨¨station streets wall 1¨¨station streets wall 2¨¨station streets wall 3¨¨station streets floor 0¨¨station streets floor 4¨¨station streets floor 5¨¨station streets floor 4.5¨¨station streets wall 5¨¨station streets wall 6¨¨station streets wall 7¨¨station streets wall 8¨¨station streets wall 9¨¨station streets wall 10¨¨station streets wall 11¨¨station streets wall 13¨¨station streets rocky 1¨¨station streets wall fake 1¨¨station streets wall 14¨¨station streets floor 4.1¨¨station streets wall 12¨¨station streets breakables 1¨¨station streets breakables 2¨¨station streets breakables 2.5¨¨station streets map shape 1¨¨station streets map shape 2¨¨station streets map shape 3¨¨station streets map shape 4¨¨station streets map shape 5¨¨station streets map shape 6¨¨station streets map shape 7¨÷ß9ßEßA»ßC|ßEßTßIßFßJ÷}´z´£0.-3E}{ß1ßLß3|¦´x´´y´‡ºFºG¢3U8ºGºSºHºFºH—÷ß4{ßZßEßg¨floor_train_track¨ß9ßE¨sensor_dont_set_room¨»}}{ß1ßMß3|¦´x´´y´‡ºFºGºFºH—÷ß4{ßZßEßgß1Vß9ßEß1W»}}{ß1ßFß3|{´x´¢VS´y´¢yA}÷ß4{ßZßEß6|¨station tutorial floor¨¨station tutorial sensor start¨¨station tutorial wall 1¨¨station tutorial wall 2¨¨station tutorial rock 1¨¨station tutorial rock 2¨¨station tutorial rock 3¨¨tutorial floor low¨¨station tutorial sensor end¨¨station tutorial map shape 1¨¨station tutorial map shape 2¨¨station tutorial map shape 3¨÷ß9ßEßA»ßC|ßHßEßG÷}}{ß1ßTß3|{´x´¢1zO´y´¢rO}÷ß4{ßZßSß9´´ßA»ßC|ßGßU÷ß6|¨streets room 1 wall 2¨¨streets room 1 wall 1¨¨streets room 1 camera 1¨¨streets room 1 sensor start¨¨streets room 1 camera 2¨¨streets room 1 camera 0¨¨streets room 1 floor¨¨streets room 1 sensor end¨¨streets room 1 camera 3¨¨streets room 1 map shape 1¨÷}´z´Ý0}{ß1ßUß3|{´x´¢1w0´y´¢f8}÷ß4{ßZßSß9´´ßA»ßC|ßT÷ß6|¨streets room 2 rock¨¨streets room 2 sensor start¨¨streets room 2 floor¨¨home wow test wow¨¨streets room 2 map shape 1¨÷}´z´Ý0}{ß1ßIß3|{´x´¢1wo´y´¢1C2}÷ß4{ßZßSß9´´ßA»ßC|ßGßE÷ß6|¨streets side room 1 floor¨¨streets side room 1 wall 1¨¨streets side room 1 wall 2¨¨streets side room 1 wall fake 1¨¨streets side room 1 test¨¨streets side room 1 window 1¨¨streets side room 1 map shape 1¨¨streets side room 1 map shape 2¨¨streets side room 1 map shape 3¨÷}´z´£0.-6S}{ß1ßKß3|¦´x´´y´‡ºMºN¢TRºN—{´x´ºb´y´ºN´z´£0.4q}{´x´¢Vr´y´ºN´z´Ý3}{´x´ºc´y´ºN}{´x´ºP´y´ºN}{´x´ºP´y´ºN´z´£0.84}{´x´ºM´y´ºN´z´Ý4}÷ß4{ßZßEßg¨wall_train¨ß6|¨train floor broken¨¨train wall 1¨¨train wall 2¨¨train wall 3¨¨train ceiling¨¨train sensor¨¨train door right¨¨train door right path¨¨train door left¨¨train door left path¨¨train floor¨¨train floor broken top¨¨train floor broken bottom¨¨train floor broken middle¨÷¨seethrough¨»ß9ßE}}{ß1ßDß3|{´x´¢-68´y´¢-50}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨¨tutorial room 1 floor¨¨tutorial room 1 map shape 1¨¨tutorial room 1 map shape 2¨¨tutorial room 1 map shape 3¨÷ßZßVßA»ßC|ßWßYßBßX÷ß9´´}}{ß1ßWß3|{´x´¢OW´y´¢-DO}÷ß4{ßZßVß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨tutorial room 2 floor¨¨tutorial room 2 floor platform¨¨tutorial room 2 map shape 1¨¨tutorial room 2 map shape 2¨¨tutorial room 2 map shape 3¨¨tutorial room 2 map shape 4¨¨tutorial room 2 map shape 5¨¨tutorial room 2 map shape 6¨¨tutorial room 2 map shape 7¨÷ßA»ßC|ßHßDßX÷ß9´´}}{ß1ßXß3|{´x´¢-JM´y´¢-Tg}÷ß4{ßZßVß6|¨tutorial window 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨¨tutorial room 3 floor¨¨tutorial room 3 enemy 1¨¨tutorial room 3 map shape 1¨¨tutorial room 3 map shape 2¨¨tutorial room 3 map shape 3¨¨tutorial room 3 map shape 4¨¨tutorial room 3 map shape 5¨÷ßA»ßC|ßXßYßWßD÷ß9´´}}{ß1ßYß3|{´x´¢-Z0´y´¢-Gc}÷ß4{ßZßVß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨¨tutorial room 4 floor¨¨tutorial room 4 map shape 1¨÷ßA»ßC|ßXßD÷ß9´´}}{ß1ßHß3|{´x´¢9t´y´¢GK}÷ß4{ßZßVß6|¨tutorial room 5 sensor boss¨¨tutorial room 5 door start¨¨tutorial room 5 sensor boss start¨¨tutorial room 5 boss¨¨tutorial room 5 floor¨¨tutorial room 5 door end¨¨tutorial wall 15¨¨tutorial wall 16¨¨tutorial rock 23¨¨tutorial room 5 enemy¨¨tutorial rock 24¨¨tutorial rock 25¨¨tutorial rock 26¨¨tutorial rock 27¨¨tutorial room 5 switch path¨¨tutorial room 5 sensor middle¨¨tutorial room 5 sensor boss end¨¨tutorial wall 14¨¨tutorial room 5 rocky 3¨¨tutorial fake wall 5¨¨tutorial room 5 map shape 1¨¨tutorial room 5 map shape 2¨¨tutorial room 5 map shape 3¨¨tutorial room 5 map shape 4¨¨tutorial room 5 map shape 5¨¨tutorial room 5 map shape 6¨¨tutorial room 5 map shape 7¨¨tutorial room 5 map shape 8¨÷ßA»ßC|ßWßFßE÷ß9´´}}{ß1ßbß3|¦´x´´y´‡¢4Q2¢Bw¢4CA¤y¢3tc¤y¢3eS¢4W¢3Te¢Eq¢3QQ¢RaºS¢gu¢3jm¢oK¢438¤pwºn¤hs¢4UO¤RQ—÷ß4{ßZß7ßg¨floor¨ß9ß7}}{ß1ßaß3|¦´x´´y´‡¢3tI¤H6¢3sK¤DE¢3oI¤AU¢3jI¤9q¢3ec¤Bm¢3cW¤Gc¢3dA¤Lc¢3hqºf¢3ne¤OM¢3rg¤Lmº12¤H6—÷ß4{ßZß8ßg¨wall¨ß9ß8¨open_loop¨»}}{ß1ß1wß3|{´x´¢28G´y´¤Qw}÷ß4{ßZßU¨spawn_enemy¨¨checkpoint¨¨is_spawner¨»¨spawn_repeat¨Êß9ßU}´z´Ý0}{ß1ßeß3|¦´x´´y´‡¢3no¤uS¢3Qu¤uS¢3Pc¤yUº1F¢17M¢3p6º1Gº1H¤yU—÷ß4{ßZßJßgß3uß9ßJ}}{ß1ßdß3|¦´x´´y´‡¢3h2¤yUº1E¤yUº1E¢106—÷ß4{ßZßJßgß3vß9ßJß3w»}}{ß1ßcß3|¦´x´´y´‡º1E¢15kº1Eº1Gº1Iº1G—÷ß4{ßZßJßgß3vß9ßJß3w»}}{ß1ß1Lß3|¦´x´´y´‡¢1Viºa¢1VE¢14c¢1RMº1Gº1O¤wY¢1cA¤sC¢1aE¤xM¢1VY¤yK¢1ZG¢114—÷ß4{ßZßGß3x¨enemy_streets_bit¨ß40¤Kß3z»ß9ßG}´z´£0.-1c}{ß1ß1Mß3|{´x´¢1jG´y´¤vu´z´Ý1}{´x´¢1bM´y´¤ws}{´x´¢1co´y´¤s2}÷ß4{ßZßGß3xß41ß40Íß3z»ß9ßG}´z´Ý1}{ß1ß1Nß3|{´x´¢1fi´y´¢1CM´z´Ý1}{´x´¢1aO´y´¢1Cg}{´x´ºQ´y´¢15a´z´Ý1}{´x´¢1bg´y´¢10k}{´x´¢1ic´y´¤zS}÷ß4{ßZßGß3xß41ß40Ðß3z»ß9ßG}´z´Ý1}{ß1ß14ß3|¦´x´´y´‡¢1Qi¤vuº1f¢1Aa¢1RWº1gº1h¤vu—÷ß4{ßZßGßgß3uß9ßG}´z´Ý5}{ß1ßvß3|¦´x´´y´‡¢1Qs¤wOº1i¢18y¢1Uk¢1Fk¢1dI¤pc—÷ß4{ßZßGßgß3uß9ßG¨safe_floor¨»ß5¨wall_floor¨}´z´Ý5}{ß1ßwß3|¦´x´´y´‡º1m¤pcº1kº1l—{´x´º1k´y´º1l´z´Ý1}{´x´º1m´y´¤pc´z´Ý1}÷ß4{ßZßGßgß43ß9ßG}´z´Ý5}{ß1ßxß3|¦´x´´y´‡º1m¤pcº1kº1l¢1fOº1l¢1ks¤pc—÷ß4{ßZßGßgß3uß9ßGß42»ß5ß43}´z´Ý1}{ß1ßyß3|¦´x´´y´‡º1o¤pcº1nº1l—{´x´º1n´y´º1l´z´£0.-4q}{´x´º1o´y´¤pc´z´Ý6}÷ß4{ßZßGßgß43ß9ßG}´z´Ý1}{ß1ßzß3|¦´x´´y´‡º1o¤pcº1nº1l¢1xI¢1DK¢1us¤ri—÷ß4{ßZßGßgß3uß9ßGß42»ß5ß43}´z´Ý6}{ß1ß10ß3|¦´x´´y´‡º1r¤riº1pº1q—{´x´º1p´y´º1q´z´Ý2}{´x´º1r´y´¤ri´z´Ý2}÷ß4{ßZßGßgß43ß9ßG}´z´Ý6}{ß1ß15ß3|¦´x´´y´‡º1r¤riº1pº1q—{´x´¢20g´y´¢1Ak´z´Ý2}{´x´¢21o´y´º1g´z´Ý2}{´x´¢202´y´¢1DU}{´x´¢27S´y´¢1De´z´Ý2}{´x´¢23u´y´¤uw}÷ß4{ßZßGßgß3uß9ßGß42»}´z´Ý2}{ß1ß1Jß3|{´x´º1z´y´¤uw´z´Ý2}{´x´º1x´y´º1y}÷ß4{ßZßGßg¨wall_floor_halfwidth¨ß9ßG}´z´Ý2}{ß1ß17ß3|¦´x´´y´‡º1z¤uwº1xº1y—{´x´º1x´y´º1y´z´Ý0}{´x´º1z´y´¤uw´z´Ý0}÷ß4{ßZßGßgß43ß9ßG}´z´Ý2}{ß1ß16ß3|{´x´º1z´y´¤uw´z´Ý0}{´x´º1x´y´º1y}{´x´¢2LA´y´¢12v´z´Ý0}{´x´¢294´y´¤uw}÷ß4{ßZßGßgß3uß9ßGß42»}´z´Ý0}{ß1ß1Oß3|¦´x´´y´‡º1fº1jº1Rº1q¢1ce¤rYº1f¤wO—÷ß4{ßZßGß9ßGßf»ßgßhß6|¨station streets map rock 1¨¨station streets map rock 2¨÷}}{ß1ß1Pß3|¦´x´´y´‡º1Rº1q¢1g2º1a¢1ja¤vkº23¤rY—÷ß4{ßZßGß9ßGßf»ßgßhß6|¨station streets map rock 3¨¨station streets map rock 4¨÷}}{ß1ß1Qß3|¦´x´´y´‡º24º1a¢1oQ¢1Au¢1wyº1gºK¤w4¢1pi¤tUº25¤vk—÷ß4{ßZßGß9ßGßf»ßgßhß6|¨station streets map rock 5¨¨station streets map rock 6¨¨station streets map rock 7¨÷}}{ß1ß1Rß3|¦´x´´y´‡º28º1g¢26o¢1AGº1z¤uwºK¤w4—÷ß4{ßZßGß9ßGßf»ßgßhß6|¨station streets map rock 8¨¨station streets map rock 9¨÷}}{ß1ß1Sß3|¦´x´´y´‡º2Aº2BºL¢19mºL¤zI¢2D6º1dº2D¤zIºL¤w4º22¤uwº1x¤um¢25q¤umº1z¤uw—÷ß4{ßZßGß9ßGßf»ßgßh}}{ß1ß1Tß3|¦´x´´y´‡ºLº2Cº2D¢16Yº2D¢156ºLº2F—÷ß4{ßZßGß9ßGßf»ßgßh}}{ß1ß1Uß3|¦´x´´y´‡¢1ys¢10L¢21e¤yW¢1xy¤xw—÷ß4{ßZßGß9ßGßf»ßgßhßi»}}{ß1ßnß3|¦´x´´y´‡¢1Uu¢15Qº1M¢19S¢1SU¢172—÷ß4{ßZßGßg¨rock¨ß9ßG}´z´Ý5}{ß1ßjß3|¦´x´´y´‡¢1ZQ¤xq¢1YSº1J—{´x´¢1WM´y´¤yU´z´Ý5}÷ß4{ßZßGßgß4Eß9ßG}´z´Ý5}{ß1ßkß3|¦´x´´y´‡¢1d8º1b¢1b2º2C—{´x´¢1Ym´y´¢15G´z´Ý1}÷ß4{ßZßGßgß4Eß9ßG}´z´Ý1}{ß1ßlß3|¦´x´´y´‡¢1fY¤zm¢1cK¢10GºQ¤xW—÷ß4{ßZßGßgß4Eß9ßG}´z´Ý1}{ß1ßqß3|¦´x´´y´‡¢1nI¢16s¢1im¢19cº1oº2M—÷ß4{ßZßGßgß4Eß9ßG}´z´Ý6}{ß1ßrß3|¦´x´´y´‡¢1scº1dº2a¢10Q¢1qW¤w4—÷ß4{ßZßGßgß4Eß9ßG}´z´Ý6}{ß1ßsß3|¦´x´´y´‡¢1uEº2M¢1tQ¢16iº2eº2W—÷ß4{ßZßGßgß4Eß9ßG}´z´Ý6}{ß1ßtß3|¦´x´´y´‡¢244¢1A6¢1yuº2N¢22Iº2M—÷ß4{ßZßGßgß4Eß9ßG}´z´Ý2}{ß1ßuß3|{´x´¢1xw´y´¤xq}{´x´º1u´y´¤yU´z´Ý2}{´x´º2m´y´º2f}÷ß4{ßZßGßgß4Eß9ßGß3w»}´z´Ý2}{ß1ßpß3|¦´x´´y´‡¢2Hwº21ºLº2FºL¤zI—÷ß4{ßZßGßgß4Eß9ßG}´z´Ý0}{ß1ß1Gß3|{´x´¢2CN´y´¢169}÷ß4{ßZßGß3x¨enemy_streets_rocky_small¨ß3z»ß40Êß9ßG¨spawn_permanent¨»}´z´Ý0}{ß1ßoß3|¦´x´´y´‡¢2Ei¤vGº2s¢1CC¢1mUº2tº2u¤vG—÷ß4{ßZßGßg¨sensor¨ß9ßG}´z´Ý0}{ß1ßmß3|¦´x´´y´‡¢1Ty¤v5¢1UGº1qº1fº2tº1i¤vG—÷ß4{ßZßGßgß4Hß9ßG}}{ß1ß11ß3|¦´x´´y´‡º1z¤uwºK¤w4—÷ß4{ß3w»ßZßGßgß3vß9ßG}´z´Ý2}{ß1ß12ß3|{´x´º23´y´¤rY}{´x´º1f´y´¤wO´z´Ý5}{´x´º1f´y´ºN}÷ß4{ß3w»ßZßGßgß3vß9ßG}´z´Ý5}{ß1ß13ß3|¦´x´´y´‡º25¤vkº23¤rY—÷ß4{ß3w»ßZßGßgß3vß9ßG}´z´Ý1}{ß1ß18ß3|¦´x´´y´‡º1Rº1qº1fº1j—{´x´º1f´y´ºO´z´Ý5}÷ß4{ß3w»ßZßGßgß3vß9ßG}´z´Ý5}{ß1ß19ß3|¦´x´´y´‡º24º1aº1Rº1q—÷ß4{ß3w»ßZßGßgß3vß9ßG}´z´Ý1}{ß1ß1Aß3|{´x´º28´y´º1g´z´Ý6}{´x´º26´y´º27}{´x´º24´y´º1a}÷ß4{ß3w»ßZßGßgß3vß9ßG}´z´Ý6}{ß1ß1Bß3|¦´x´´y´‡ºK¤w4º29¤tUº25¤vk—÷ß4{ß3w»ßZßGßgß3vß9ßG}´z´Ý6}{ß1ß1Cß3|¦´x´´y´‡º1fºOº1fº1j—÷ß4{ß3w»ßZßGßgß3vß9ßG}´z´Ý0}{ß1ß1Dß3|{´x´º1f´y´¤wO´z´Ý0}{´x´º1f´y´ºN}÷ß4{ß3w»ßZßGßgß3vß9ßG}´z´Ý0}{ß1ß1Eß3|¦´x´´y´´z´‡º2Aº2BÝ2º1u¢1AQÝ2¢1ya¢1FQÝ2—÷ß4{ß3w»ßZßGßgß3vß9ßG}´z´Ý2}{ß1ß1Kß3|¦´x´´y´‡¢1weº2z¢1zsº27º28º1g—÷ß4{ß3w»ßZßGßgß3vß9ßG}´z´Ý2}{ß1ß1Fß3|¦´x´´y´‡º2Dº2Gº2Dº2FºLº2Cº2Aº2B—÷ß4{ß3w»ßZßGßgß3vß9ßG}´z´Ý0}{ß1ß1Iß3|¦´x´´y´‡º1x¤umº22¤uwºL¤w4—{´x´º2D´y´¤zI´z´Ý0}{´x´º2D´y´º1d}÷ß4{ß3w»ßZßGßgß3vß9ßG}´z´Ý0}{ß1ß1Hß3|{´x´º2o´y´¤xq}{´x´º2m´y´º2f´z´Ý2}÷ß4{ßZßGßg¨wall_streets_fake¨ß3w»ß4G»ß9ßG}´z´Ý2}{ß1ß1Xß3|¦´x´´y´‡¤am¤w4¤YM¤o0¤X4¤o0¤Y2¤rE¤Fo¤s2¤Gw¤yy¤Gwº1GºTº1GºT¢18e¤X4º32¤X4º1G¤amº1G¤am¢130—÷ß4{ßZßFßgß3uß42»ß9ßF}}{ß1ß1gß3|¦´x´´y´‡¤ZU¤w4¤RG¤w4¤Gw¤yy¤Gwº1G¤ZUº1G—÷ß4{ßZßFß9ßFßf»ßgßh}}{ß1ß1hß3|¦´x´´y´‡¤ZYº1K¤ZUº1K¤ZUº1J¤ZYº1J¤ZY¤w4¤am¤w4¤amº1G¤ZYº1G—÷ß4{ßZßFß9ßFßf»ßgßh}}{ß1ß1iß3|¦´x´´y´‡ºT¢17QºTº32¤X4º32¤X4º34—÷ß4{ßZßFß9ßFßf»ßgßh}}{ß1ß1bß3|¦´x´´y´‡¢14S¤tAº2P¤uw¢17g¤y0º2Gº2f¢11s¤zmº2Z¤xC¢11O¤uI—÷ß4{ßZßFßgß4Eß9ßF}´z´Ý0}{ß1ß1cß3|¦´x´´y´‡¢1Emº2M¢1GO¢164¢1Giº36º1l¢19I¢1Dy¢198¢1Cqº36º1qº3B—÷ß4{ßZßFßgß4Eß9ßF}´z´Ý0}{ß1ß1dß3|¦´x´´y´‡¢1K6¤xM¢1LE¤xq¢1LY¤yy¢1Kkº2f¢1J8º1J¢1IK¤yo¢1Iy¤xg—÷ß4{ßZßFßgß4Eß9ßF}´z´Ý0}{ß1ß1fß3|¦´x´´y´‡º5¤vGº5º2t¢1PQº2tº3O¤vG—÷ß4{ßZßFßgß4Hß9ßF}}{ß1ß1Yß3|¦´x´´y´‡ºF¤wY¤KK¤yy¤KKº2ZºFº2Z¤Ue¤zm¤WGº2Z¤ZU¤wY—÷ß4{ßZßFßgß4H¨sensor_fov_mult¨Êß9ßF}}{ß1ß1Zß3|¦´x´´y´‡¤RG¤w4¤Op¤wi—÷ß4{ß3w»ßZßFßgß3vß9ßF}}{ß1ß1aß3|¦´x´´y´‡¤Mk¤xM¤Gw¤yy¤Gwº1G¤ZUº1G¤ZUº1K—÷ß4{ß3w»ßZßFßgß3vß9ßF}}{ß1ß1oß3|{´x´¢2CI´y´¤zS}÷ß4{ßZßTß3x¨enemy_streets_camera_small¨ß3z»ß40Êß9ßT}´z´Ý0}{ß1ß1lß3|{´x´¢24O´y´¤to}÷ß4{ßZßTß3xß4Kß3z»ß40Êß9ßT}´z´Ý0}{ß1ß1nß3|{´x´¢27I´y´ºC}÷ß4{ßZßTß3xß4Kß3z»ß40Êß9ßT}´z´Ý0}{ß1ß1rß3|{´x´¢252´y´¤fw}÷ß4{ßZßTß3xß4Kß3z»ß40Êß9ßT}´z´Ý0}{ß1ß1pß3|¦´x´´y´‡º1z¤uw¢29O¤v6—{´x´º1x´y´¤nC´z´Ý0}{´x´¢2A2´y´¤iM}{´x´¢25C´y´¤iM}{´x´º2n´y´¤nC}÷ß4{ßZßTßgß3uß9ßTß42»}´z´Ý0}{ß1ß1sß3|¦´x´´y´‡º2E¤umº1x¤um¢28u¤uSº1x¤nCº3U¤iMº1C¤eK¢23Q¤eKº3V¤iMº2n¤nC¢23k¤uS—÷ß4{ßZßTß9ßTßf»ßgßh}}{ß1ß1qß3|{´x´¢22w´y´¤fS}{´x´º3Z´y´¤ee´z´Ý0}{´x´º3T´y´¤ee´z´Ý0}{´x´º3T´y´¤fS}÷ß4{ßZßTßgß4Hß9ßTß4J£0.Cu}´z´Ý0}{ß1ß1mß3|{´x´º3X´y´¤te}{´x´º3X´y´¤sq´z´Ý0}{´x´ºL´y´¤sq´z´Ý0}{´x´ºL´y´¤te}÷ß4{ßZßTßgß4Hß9ßTß4JÝ7}´z´Ý0}{ß1ß1kß3|¦´x´´y´‡º1C¤Hkº2y¤Wkº3X¤eK—{´x´º3V´y´¤iM´z´Ý0}{´x´º2n´y´¤nC}{´x´º1z´y´¤uw}{´x´º2E´y´¤um´z´Ý0}{´x´º3Y´y´¤uS}÷ß4{ß3w»ßZßTßgß3vß9ßT}´z´Ý0}{ß1ß1jß3|¦´x´´y´‡º1C¤Hkº2p¤Wkº1C¤eKº3U¤iMº1x¤nCº3W¤uSº1x¤um—÷ß4{ß3w»ßZßTßgß3vß9ßT}´z´Ý0}{ß1ß1vß3|¦´x´´y´´z´‡¢1s8¤gkÝ0º3V¤iMÝ0—{´x´º3U´y´¤iM}{´x´¢2OO´y´¤gk}{´x´º1C´y´¤Hk}÷ß4{ßZßUßgß3uß9ßUß42»}´z´Ý0}{ß1ß1xß3|¦´x´´y´‡º1C¤eKº3X¤eKº2y¤Wkº1C¤Hkº2p¤Wk—÷ß4{ßZßUß9ßUßf»ßgßhß6|¨streets room 2 map rock 1¨÷}}{ß1ß1tß3|¦´x´´y´‡¢2B0¤X4º1z¤X4—{´x´º2E´y´¤b6´z´Ý0}÷ß4{ßZßUßgß4Eß9ßU}´z´Ý0}{ß1ß1uß3|{´x´¢1xm´y´¤X4}{´x´º3d´y´¤WG´z´Ý0}{´x´¢2Ik´y´¤WG´z´Ý0}{´x´º3e´y´¤X4}÷ß4{ßZßUßgß4Hß9ßUß4J£1.1c}´z´Ý0}{ß1ß1yß3|{´x´º31´y´º27}{´x´º1u´y´º2x´z´Ý2}{´x´º1x´y´º1y´z´Ý2}{´x´º3W´y´¢1FG}{´x´º3W´y´¢1T8´z´Ý2}{´x´º30´y´º3g}{´x´º30´y´º2z}÷ß4{ßZßIßgß3uß9ßIß42»}´z´Ý2}{ß1ß24ß3|¦´x´´y´‡º31º27º30º2zº2yº2zº1uº2xº28º1g—÷ß4{ßZßIß9ßIßf»ßgßh}}{ß1ß25ß3|¦´x´´y´‡¢21Aº1fº1Cº1fº1Cº3Aº2yº2zº30º2z—÷ß4{ßZßIß9ßIßf»ßgßh}}{ß1ß26ß3|¦´x´´y´‡¢210º1y¢22Sº1t¢26eº1g¢27cº2z¢26K¢1F6º2Eº3G¢22c¢1DAº3k¢1Faº3k¢1GEº3S¢1G4—÷ß4{ßZßIß9ßIßf»ßgßh}}{ß1ß22ß3|{´x´¢20M´y´º3L´z´Ý2}÷ß4{ßZßIß9ßIß3z»ß6|¨streets side room 1 test 0¨¨streets side room 1 test 1¨÷}´z´Ý2}{ß1ß1zß3|¦´x´´y´‡º3hº1fº30º2z—÷ß4{ß3w»ßZßIßgß3vß9ßI}´z´Ý2}{ß1ß20ß3|¦´x´´y´´z´‡º2yº2zÝ2º3Sº3sÝ2—{´x´º3i´y´º1y}{´x´º3j´y´º1t}{´x´º3k´y´º1g}{´x´º3l´y´º2z}{´x´º3m´y´º3n}{´x´º2E´y´º3G}{´x´º3o´y´º3p´z´Ý2}{´x´º3k´y´º3q}{´x´º3k´y´º3r}{´x´º1C´y´º3A}÷ß4{ß3w»ßZßIßgß3vß9ßI}´z´Ý2}{ß1ß21ß3|{´x´º3S´y´º3s}{´x´º3k´y´º3r´z´Ý2}÷ß4{ßZßIßgß4Iß3w»ß4G»ß9ßI}´z´Ý2}{ß1ß23ß3|¦´x´´y´´z´‡º3h¢1LsÝ2º2yº2zÝ2—÷ß4{ß3w»ßZßIßg¨wall_window¨ß9ßI}´z´Ý2}{ß1ß2Cß3|¦´x´´y´‡ºPºNºMºNºMºOºPºO—÷ß4{ßZßKßgß27ß3u»ß9ßEß1W»}´z´Ý4}{ß1ß2Gß3|¦´x´´y´‡¤SEºNºbºN—{´x´ºb´y´ºN´z´Ý3}{´x´¤SE´y´ºN´z´Ý3}÷ß4{ßZßKßgß27ß9ßE}}{ß1ß2Hß3|¦´x´´y´‡ºbºN¤UeºN—÷ß4{ßZßKßg¨sensor_path¨ß9ßE}}{ß1ß2Eß3|¦´x´´y´‡ºcºN¤X4ºN—{´x´¤X4´y´ºN´z´Ý3}{´x´ºc´y´ºN´z´Ý3}÷ß4{ßZßKßgß27ß9ßE}}{ß1ß2Fß3|¦´x´´y´‡ºcºN¤UeºN—÷ß4{ßZßKßgß4Pß9ßE}}{ß1ß2Iß3|¦´x´´y´‡ºPºNºMºNºMºOºPºO—÷ß4{ßZßKßg¨floor_train¨ß9ßEß1W»}}{ß1ß28ß3|¦´x´´y´‡ºPºN¤SEºN¤Ru¢122¤SE¢13U¤SEºOºPºO—÷ß4{ßZßKßgß4Qß9ßEß1W»}}{ß1ß2Kß3|¦´x´´y´‡ºMºO¤SEºO¤SEº3wºM¢13A—÷ß4{ßZßKßgß4Qß9ßEß1W»}}{ß1ß2Lß3|¦´x´´y´‡ºMº3x¤SEº3w¤Ruº3vºMºG—÷ß4{ßZßKßgß4Qß9ßEß1W»}}{ß1ß2Jß3|¦´x´´y´‡ºMºG¤Ruº3v¤SEºNºMºN—÷ß4{ßZßKßgß4Qß9ßEß1W»}}{ß1ß2Dß3|¦´x´´y´‡¤Qmº1T¤Qm¢14m¤YWº3y¤YWº1T—÷ß4{ßZßKßgß4Hß9ßEß1W»}}{ß1ß29ß3|{´x´ºP´y´ºN}{´x´ºP´y´ºN´z´Ý4}{´x´ºP´y´ºO´z´Ý4}{´x´ºP´y´ºO}÷ß4{ßZßKßgß27ß9ßE}}{ß1ß2Aß3|{´x´ºM´y´ºN}{´x´ºM´y´ºN´z´Ý4}{´x´ºM´y´ºO´z´Ý4}{´x´ºM´y´ºO}÷ß4{ßZßKßgß27ß9ßE}}{ß1ß2Bß3|¦´x´´y´‡ºMºOºPºO—{´x´ºP´y´ºO´z´Ý4}{´x´ºM´y´ºO´z´Ý4}÷ß4{ßZßKßgß27ß9ßE}}{ß1ß2iß3|¦´x´´y´‡¤Lm¤4q¤Ky¤84—÷ß4{ßZßWßg¨wall_tutorial_fake¨ß3w»ß4G»ß9ßW}}{ß1ß3Pß3|¦´x´´y´‡¢-MQ¤-e¢-NY¤K—÷ß4{ßZßYßgß4Rß3w»ß4G»ß9ßY}}{ß1ß3lß3|¦´x´´y´‡¤AA¤g6¤By¤i0—÷ß4{ßZßHßgß4Rß3w»ß4G»ß9ßH}}{ß1ß1eß3|{´x´º1f´y´¤wO´z´Ý0}{´x´º1f´y´º1j}{´x´¤ye´y´¢1Ec}{´x´¤yU´y´¤qQ}÷ß4{ßZßFßgß3uß9ßF}´z´Ý0}{ß1ß3aß3|¦´x´´y´‡¤CQ¤ga¤DE¤gQ¤EMºx¤EW¤hs¤E2¤iM¤DO¤iW¤Ck¤iC—÷ß4{ßZßHßgß4Eß3w»ß9ßH}}{ß1ß3cß3|¦´x´´y´‡¤SO¤oe¤TC¤pSºF¤qa¤S4¤qu¤Qw¤qaºM¤pS¤RG¤oU—÷ß4{ßZßHßgß4Eß9ßH}}{ß1ß3dß3|¦´x´´y´‡¤SiºWºF¤sM¤SY¤tAºw¤tK¤Qw¤sg¤Qw¤ri¤Rk¤rE—÷ß4{ßZßHßgß4Eß9ßH}}{ß1ß3eß3|¦´x´´y´‡¤Ss¤tU¤Tq¤uS¤Tg¤vk¤Si¤wY¤Rk¤wE¤R6¤v6ºw¤ty—÷ß4{ßZßHßgß4Eß9ßH}}{ß1ß3fß3|¦´x´´y´‡¤OC¤vQ¤Og¤wE¤OM¤x2¤NO¤xM¤Ma¤ws¤MQ¤vu¤NE¤vG—÷ß4{ßZßHßgß4Eß9ßH}}{ß1ß2Pß3|{´x´¢-2Q´y´º3}÷ß4{ßZßDß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷ß9ßD}}{ß1ß2Rß3|¦´x´´y´‡¤6w¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßZßDß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßgß4Hß4J£0.EWß9ßD}}{ß1ß2Vß3|¦´x´´y´‡¤D4¤-A¤C6¢-42¤5eº42º2ºe¢-6Iº2¢-6m¤42¢-9q¤50¢-Bm¤84¢-Bc¤BI¢-7Q¤D4¢-3Y¤B8¢-26¤84¤4C¤6w¤6c¤1S—÷ß4{ßZßDßgß3uß42»ß9ßD}}{ß1ß2Wß3|¦´x´´y´‡¤5eº42º2ºeº46º2º47¤42º4D¤84¤4C¤6w¤6c¤1S—÷ß4{ßZßDß9ßDßf»ßgßhß6|¨tutorial room 1 map rock 1¨¨tutorial room 1 map rock 2¨¨tutorial room 1 map rock 3¨¨tutorial room 1 map rock 4¨÷}}{ß1ß2Xß3|¦´x´´y´‡¤C6º45¤5eº42¤6c¤1S¤D4¤-A—÷ß4{ßZßDß9ßDßf»ßgßh}}{ß1ß2Yß3|¦´x´´y´‡¢-2v¤7M¢-47¤6K¢-4C¤6P¢-6u¤44º48¤50º49¤84º4A¤BIº4B¤D4º4C¤B8—÷ß4{ßZßDß9ßDßf»ßgßhß6|¨tutorial room 1 map rock 5¨¨tutorial room 1 map rock 6¨÷}}{ß1ß2Nß3|{´x´ºe´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß4i÷ßZßDß9ßD}}{ß1ß2Qß3|¦´x´´y´‡¤5eº42º2ºeº46º2º47¤42º4D¤84¤4C¤6w¤6c¤1S—÷ß4{ßZßDßgß4Hß4JÊß9ßD}}{ß1ß2Tß3|{´x´¢-BI´y´¤4q}÷ß4{ß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßZßDß9ßD}}{ß1ß2eß3|¦´x´´y´‡¤5e¢-CG¤4g¢-8O¤8Yº4B¤9Wº4J¤F9¢-HE¤9W¢-BS—÷ß4{ßZßWßgß4Hß4JÝ9ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷ß9ßW}}{ß1ß2nß3|¦´x´´y´‡¤Gw¢-Ky¤EC¢-Lc¤BS¢-KU¤4M¢-Ca¤3O¢-8i¤C6º45¤D4¤-A¤Bm¤8s¤E2¤G8¤H6¤GI¤Ke¤9M¤WG¤84¤Wu¤2G¤Uy¢-Ay—÷ß4{ßZßWßgß3uß42»ß9ßW}}{ß1ß2oß3|¦´x´´y´‡¤Wuº4G¤Waº4B—{´x´¤Vw´y´¢-5o´z´£0.3E}÷ß4{ßZßWßgß3uß9ßW}´z´ÝA}{ß1ß2pß3|¦´x´´y´‡¤Wk¤2G¤Uyº4T¤NOº49¤Lw¢-H6¤Gm¢-Isºo¢-FU¤BS¢-Ao¤Aoº4T¤9q¢-76¤C6º45¤D4¤-A¤Ck¤26¤M8¤3G¤WQ¤4C¤WV¤3k¤NO¤2u¤MG¤26¤N4¤eºf¤U¤Po¤18¤Py¤2Q¤Pe¤3EºM¤3E¤QI¤2Q¤QS¤18¤R6¤o¤S4¤18¤SO¤1w¤S4¤3O¤UA¤3Y¤Ss¤1w¤Si¤e¤TM¤-K¤UU¤-o¤Vm¤-K¤Vw¤18¤WG¤42¤WQ¤4C—÷ß4{ßZßWß9ßWßf»ßgßhß6|¨tutorial room 2 map rock 1¨¨tutorial room 2 map rock 2¨¨tutorial room 2 map rock 3¨¨tutorial room 2 map rock 4¨¨tutorial room 2 map rock 5¨¨tutorial room 2 map rock 6¨¨tutorial room 2 map rock 7¨¨tutorial room 2 map rock 8¨¨tutorial room 2 map rock 9¨¨tutorial room 2 map rock 10¨¨tutorial room 2 map rock 11¨÷}}{ß1ß2qß3|¦´x´´y´‡¤Gc¢-7a¤Gg¢-7e¤GN¢-92¤H8¢-AF¤IW¢-A6¤JR¢-9B¤J8¢-7T¤Hk¢-6r¤Hkº47—÷ß4{ßZßWß9ßWßf»ßgßhßi»}}{ß1ß2rß3|¦´x´´y´‡¤Cu¢-G8¤Cq¢-GD¤Bq¢-FW¤AA¢-GS¤A0¢-IY¤Bcº4Q¤E2¢-LS¤Gc¢-Ko¤Gm¢-Ix¤Do¢-Gs¤Ds¢-Gm—÷ß4{ßZßWß9ßWßf»ßgßh}}{ß1ß2sß3|¦´x´´y´‡¤3Oº4S¤4Mº4R¤Aoº4T¤9qº4Z—÷ß4{ßZßWß9ßWßf»ßgßh}}{ß1ß2tß3|¦´x´´y´‡¤Ky¤84¤Lk¤4q¤WG¤4q¤WG¤84—÷ß4{ßZßWß9ßWßf»ßgßh}}{ß1ß2uß3|¦´x´´y´‡¤EW¤C1¤Ha¤CG¤H6¤GI¤E2¤G8—÷ß4{ßZßWß9ßWßf»ßgßh}}{ß1ß2vß3|¦´x´´y´‡¤M8¤3G¤Ke¤9M¤Ha¤CG¤EW¤C1¤Bm¤8s¤Ck¤26—÷ß4{ßZßWß9ßWßf»ßgßh}}{ß1ß2aß3|{´x´¤G8´y´º4C}÷ß4{ßZßWß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷ß9ßW}}{ß1ß2dß3|{´x´¤KA´y´¢-5A}÷ß4{ßZßWß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷ß9ßW}}{ß1ß2jß3|¦´x´´y´‡¤Lcºs¤Ke¤8O¤L8¤8O¤M6ºs—÷ß4{ßZßWßgß4Hß9ßW}}{ß1ß2bß3|{´x´¤Ss´y´¤-y}÷ß4{ßZßWß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ß9ßW}}{ß1ß2cß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßZßWßgß4Pß6|¨tutorial room 2 switch¨÷ß9ßW}}{ß1ß2fß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGº42—÷ß4{ßZßWßg¨icon¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷ß9ßW}´z´£0.1c}{ß1ß2hß3|{´x´¤AU´y´¢-K0}÷ß4{ßZßWß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷ß9ßW}}{ß1ß2kß3|¦´x´´y´‡¤CQ¤y¤Ds¤FUºA¤FU¤FU¤y—÷ß4{ßZßWßgß4Hß4JÝ9ß9ßW}}{ß1ß2xß3|¦´x´´y´‡¢-Lmº4m¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßZßXßgß4Hß4J£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷ß9ßX}}{ß1ß35ß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FKº4T¢-Ds¢-8s¢-Fe¢-8Yº56¢-A0º4x¢-DY¢-Ke—÷ß4{ßZßXßgß4Hß9ßX}}{ß1ß38ß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßZßXß3x¨enemy_tutorial_easy¨ß3z»ß40Êß9ßX}}{ß1ß2yß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßZßXß3xß5eß3z»ß40Êß9ßX}}{ß1ß37ß3|¦´x´´y´‡¤3Oº4S¤4Mº4R¤e¢-GI¢-4Mº4Q¢-84¢-Oq¢-EC¢-PAº4y¢-I4¢-OMº4Xº3zº5Eº4J¢-9Cº4Dº4Z—÷ß4{ßZßXßgß3uß42»ß9ßX}}{ß1ß39ß3|¦´x´´y´‡º4Dº4Z¢-5e¢-B8º4tº57¤eº5K¤4Mº4R¤3Oº4S—÷ß4{ßZßXß9ßXßf»ßgßhß6|¨tutorial room 3 map rock 1¨÷}}{ß1ß3Aß3|¦´x´´y´‡º4I¢-Cuº4w¢-Cr¤A¢-DU¤1O¢-Ch¤1i¢-BA¤J¢-9v¢-1P¢-9k¢-21¢-B7º4Dº5U—÷ß4{ßZßXß9ßXßf»ßgßhßi»}}{ß1ß3Bß3|¦´x´´y´‡º4Jº5S¢-HG¢-CQ¢-Jqº4iº4yº5Q¢-J2¢-JWº5Oº5Pº5Mº5Nº5Lº4Qº4tº57º5Tº5U—÷ß4{ßZßXß9ßXßf»ßgßhß6|¨tutorial room 3 map rock 2¨÷}}{ß1ß3Cß3|¦´x´´y´‡¢-Fu¢-IN¢-F6¢-FE¢-Az¢-Do¢-8m¢-Fh¢-8T¢-IM¢-A2¢-K7º5E¢-Kj—÷ß4{ßZßXß9ßXßgßhßf»ßi»}}{ß1ß3Dß3|¦´x´´y´‡º3zº5Eº5hº4iº4yº5Qº5Rº4X—÷ß4{ßZßXß9ßXßf»ßgßh}}{ß1ß32ß3|¦´x´´y´‡º46º5M¤2F¢-5T¤4qº58¢-3F¢-Hl—÷ß4{ßZßXßgß4Hß4JÝCß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷ß9ßX}}{ß1ß3Iß3|{´x´¢-L4´y´¤49}÷ß4{ßZßYß3x¨enemy_tutorial_rock_room4¨ß3z»ß40Êß9ßY}}{ß1ß3Qß3|¦´x´´y´‡º3zº5Eº5Rº4X¢-W6¢-Ck¢-Ygº4sºi¤Uº40¤Kº40¤7Gº4W¤7Gº4W¤34º3z¤-eº5i¢-3Oº56º4S—÷ß4{ßZßYßgß3uß42»ß9ßY}}{ß1ß3Fß3|{´x´¢-QI´y´¢-7G}÷ß4{ßZßYß3x¨collect_gun_basic¨ß3z»ß40Êß4G»ß9ßY}}{ß1ß3Gß3|{´x´º65´y´º66}÷ß4{ßZßYß3x¨deco_gun_basic¨ß3z»ß40Êß9ßY}}{ß1ß3Rß3|¦´x´´y´‡º61º62º63º4sºi¤Uº40¤Kº5iº64º56º4Sº3zº5Eº5Rº4X—÷ß4{ßZßYß9ßYßgßhßf»ß6|¨tutorial room 4 map rock 1¨¨tutorial room 4 map rock 2¨¨tutorial room 4 map rock 3¨÷}}{ß1ß3Mß3|¦´x´´y´‡¢-Kz¢-6wº5w¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßZßYßgß5Uß9ßY}}{ß1ß3Hß3|{´x´¢-Ue´y´¢-C6}÷ß4{ßZßYß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷ß9ßY}}{ß1ß3Kß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßZßYß3x¨enemy_tutorial_rocky¨ß3z»ß40Êß4G»ß9ßY}}{ß1ß3Lß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßZßYß3xß5sß3z»ß40Êß4G»ß9ßY}}{ß1ß3Eß3|¦´x´´y´‡¢-OK¢-Fkº8º5V¢-Yqº4s¢-Tq¤e¢-NO¤Uº4W¢-3E¢-IEº5A—÷ß4{ßZßYßgß4Hß4J£1.4qß9ßY}}{ß1ß3Jß3|{´x´¢-Ic´y´¤16}÷ß4{ßZßYß3x¨switch¨ß3z»ß40Êß9ßY}}{ß1ß3Vß3|{´x´¤Fy´y´¤TW}÷ß4{ßZßHß3x¨enemy_tutorial_boss¨ß3z»ß40Êß9ßHß4G»}}{ß1ß3Xß3|¦´x´´y´‡¤Pe¤fS¤Lw¤fc—÷ß4{ß3w»ß5¨tutorial_door¨ßZßHß6|¨tutorial room 5 door end path¨÷ß9ßH}}{ß1ß3Tß3|¦´x´´y´‡¤KU¤GSºA¤GI—÷ß4{ß3w»ß5ß5vßZßHß6|¨tutorial room 5 door start path¨÷ß9ßH}}{ß1ß3bß3|{´x´¤Tx´y´¤gx}÷ß4{ßZßHß3x¨enemy_tutorial_easy_static¨ß3z»ß40Êß9ßH}}{ß1ß3Wß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºF¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fw¤Ue¤fw¤Vc¤jA¤Wu¤jA¤XO¤km¤W6¤km¤Y2¤rE¤Fo¤s2¤F0¤nC¤92¤h4¤9M¤gG¤AA¤g6¤1w¤X4¤4q¤M6—÷ß4{ßZßHßgß3uß42»ß9ßH}}{ß1ß3mß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºF¤Vw¤Lz¤fY¤Hu¤fi¤Hu¤fm¤EC¤fw¤EC¤fs¤A6¤g2¤26¤X4¤4q¤M6—÷ß4{ßZßHß9ßHßf»ßgßh}}{ß1ß3nß3|¦´x´´y´‡¤EC¤fw¤Hu¤fm¤Lw¤fc¤Kyºx¤Ue¤fw¤ZU¤w4¤RG¤w4ºM¤wE¤P0ºz¤SE¤o0¤RQ¤lG¤G8ºI¤AA¤g6—÷ß4{ßZßHß9ßHßf»ßgßhß6|¨tutorial room 5 map rock 1¨¨tutorial room 5 map rock 2¨¨tutorial room 5 map rock 3¨¨tutorial room 5 map rock 4¨÷}}{ß1ß3oß3|¦´x´´y´‡¤Ck¤iC¤Co¤i9¤DO¤iS¤E0¤iI¤ER¤hr¤EI¤gx¤DD¤gU¤CU¤gd¤CQ¤ga¤CG¤hY—÷ß4{ßZßHß9ßHßf»ßgßhßi»}}{ß1ß3pß3|¦´x´´y´‡¤X8¤o0¤YM¤o0¤am¤w4¤ZY¤w4—÷ß4{ßZßHß9ßHßf»ßgßhß6|¨tutorial room 5 map shape 4.1¨÷}}{ß1ß3qß3|¦´x´´y´‡¤T6¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fs¤Uc¤ft¤Ps¤gL—÷ß4{ßZßHß9ßHßf»ßgßh}}{ß1ß3rß3|¦´x´´y´‡ºM¤wE¤Gw¤yy¤FK¤p8¤Gw¤p8¤P0ºz—÷ß4{ßZßHß9ßHßf»ßgßh}}{ß1ß3sß3|¦´x´´y´‡¤Gw¤p8¤G8ºI¤AA¤g6¤9M¤gG¤92¤h4¤F0¤nC¤FK¤p8—÷ß4{ßZßHß9ßHßf»ßgßh}}{ß1ß3tß3|¦´x´´y´‡¤G8ºI¤Gw¤p8¤SE¤o0¤RQ¤lG—÷ß4{ßZßHß9ßHßf»ßgßh}}{ß1ß3kß3|{´x´¤WV´y´¤jy}÷ß4{ßZßHß3x¨enemy_tutorial_rocky_small¨ß3z»ß40Êß9ßHß4G»}}{ß1ß3Sß3|¦´x´´y´‡¤1w¤Ko¤1w¤cEºF¤bQ¤TM¤LI—÷ß4{ßZßHßgß4Hß9ßH}}{ß1ß3iß3|¦´x´´y´‡¤8s¤eK¤9g¤fI¤MG¤eo¤N4¤dq—÷ß4{ßZßHßgß4Hß4JÝDß9ßH}}{ß1ß3Uß3|¦´x´´y´‡¤DE¤Gm¤CGºA¤JC¤Hk¤IE¤H6—÷ß4{ßZßHßgß4Hß4JÝDß9ßH}}{ß1ß3hß3|¦´x´´y´‡¤DE¤g6¤Egºx¤Kr¤ga¤V1¤fk¤ZU¤um¤Gc¤um¤H6¤ye¤Qw¤vu¤aI¤vW¤VI¤fI—÷ß4{ßZßHßgß4Hß4JÊß9ßH}}{ß1ß3gß3|¦´x´´y´‡¤NE¤vG¤MkºW—÷ß4{ßZßHßgß4Pß9ßH}}{ß1ß2zß3|¦´x´´y´‡º6Lº5Sº7¢-9gº49º5U—÷ß4{ßZßXßg¨spike¨ß9ßX}}{ß1ß30ß3|¦´x´´y´‡º4W¢-EWº5jº4Xº5fº4i—÷ß4{ßZßXßgß65ß9ßX}}{ß1ß31ß3|¦´x´´y´‡¢-Af¢-PH¢-Bw¢-PKº4Jº6U—÷ß4{ßZßXßgß65ß9ßX}}{ß1ß3Nß3|¦´x´´y´‡¢-Iu¤5Sº4W¤34º3z¤-eº5iº64º56º4Sº3zº5E—÷ß4{ßZßYßgß3vß3w»ß9ßY}}{ß1ß2Oß3|¦´x´´y´‡¢-38¤7Aº4D¤84¤4C¤6w¤6c¤1S¤D4¤-A—÷ß4{ß3w»ßZßDßgß3vß9ßD}}{ß1ß2Sß3|¦´x´´y´‡¢-6e¤2Yº47¤42—÷ß4{ßZßDßgß3vß3w»ß9ßD}}{ß1ß2Zß3|¦´x´´y´‡¤Po¤gQºF¤Vw¤RG¤MG¤H6¤GI¤Ha¤CG¤Ke¤9M¤Ky¤84¤WG¤84¤WG¤4q¤Lm¤4q¤M8¤3G¤WQ¤4C¤Wk¤2G¤Uyº4T¤NOº49¤Lwº4V¤Gmº4W¤Dsº4r—÷ß4{ß3w»ßZßWßgß3vß9ßW}}{ß1ß2lß3|¦´x´´y´‡¤3Oº4S¤9qº4Z¤C6º45—÷ß4{ßZßWßgß3vß3w»ß9ßW}}{ß1ß3Oß3|¦´x´´y´‡º40¤6Iº40¤Kºi¤Uº63º4sº61º62º5Rº4X—÷ß4{ßZßYßgß3vß3w»ß9ßY}}{ß1ß2gß3|¦´x´´y´‡¤Cuº4iºoº4X¤BSº4Y¤4Mº4R—÷ß4{ß3w»ßZßWßgß3vß9ßW}}{ß1ß2Uß3|¦´x´´y´‡¤C6º45¤5eº42º2ºeº46º2¢-6T¤U—÷ß4{ßZßDßgß3vß3w»ß9ßD}}{ß1ß2mß3|¦´x´´y´‡¤D4¤-A¤Bm¤8s¤EW¤C1¤E2¤G8¤4q¤M6¤26¤X4¤AA¤g6¤EC¤fw—÷ß4{ß3w»ßZßWßgß3vß9ßW}}{ß1ß34ß3|¦´x´´y´‡º3zº5Eº5hº4iº5fº5gº4Jº5Sº5Tº5Uº4Dº4Z¤3Oº4S—÷ß4{ßZßXßgß3vß3w»ß9ßX}}{ß1ß33ß3|¦´x´´y´‡º5Rº4Xº4yº5Qº5iº5jº5Oº5Pº5Mº5Nº5Lº4Qº4tº57¤eº5K¤4Mº4R—÷ß4{ßZßXßgß3vß3w»ß9ßX}}{ß1ß3jß3|¦´x´´y´‡¤Hu¤fm¤Lw¤fcºF¤Vw—÷ß4{ß3w»ßZßHßgß3vß9ßH}}{ß1ß3Yß3|¦´x´´y´‡¤By¤i0¤G8ºI¤RQ¤lG¤SE¤o0¤Gw¤p8—÷ß4{ß3w»ßZßHßgß3vß9ßH}}{ß1ß3Zß3|¦´x´´y´‡¤Lw¤fc¤Kyºx¤Ue¤fw¤ZU¤w4¤ZUº1J—÷ß4{ß3w»ßZßHßgß3vß9ßH}}{ß1ß2wß3|¦´x´´y´‡¢-FAº6iº4Tº52º4Sº5Bº4Lº56º5D¢-KAº5Eº4oº50º56º6iº6i—÷ß4{ßZßXßgß4Oß3w»ß9ßX}}{ß1ß36ß3|¦´x´´y´‡º6iº6iº4Tº52º4Sº5Bº4Lº56º5Dº6jº5Eº4oº50º56º6iº6i—÷ß4{ßZßXßgß4Oß9ßX}}{ß1ß45ß3|¦´x´´y´‡º2Q¤xqº2S¤yUº2Rº1J—÷ß4{ßZß1Oß9ßGßg¨map_inverse¨ßf»¨map_parent¨ß1O}}{ß1ß46ß3|¦´x´´y´‡º2Lº2Mº2Oº2Pº1Mº2N—÷ß4{ßZß1Oß9ßGßgß66ßf»ß67ß1O}}{ß1ß47ß3|¦´x´´y´‡ºQ¤xWº2Yº2Zº2X¤zm—÷ß4{ßZß1Pß9ßGßgß66ßf»ß67ß1P}}{ß1ß48ß3|¦´x´´y´‡º2Vº2Wº2Uº2Cº2Tº1b—÷ß4{ßZß1Pß9ßGßgß66ßf»ß67ß1P}}{ß1ß49ß3|¦´x´´y´‡º2g¤w4º2aº2fº2eº1d—÷ß4{ßZß1Qß9ßGßgß66ßf»ß67ß1Q}}{ß1ß4Aß3|¦´x´´y´‡º1oº2Mº2cº2dº2aº2b—÷ß4{ßZß1Qß9ßGßgß66ßf»ß67ß1Q}}{ß1ß4Bß3|¦´x´´y´‡º2eº2Wº2iº2jº2hº2M—÷ß4{ßZß1Qß9ßGßgß66ßf»ß67ß1Q}}{ß1ß4Cß3|¦´x´´y´‡º2o¤xqº2mº2fº1u¤yU—÷ß4{ßZß1Rß9ßGßgß66ßf»ß67ß1R}}{ß1ß4Dß3|¦´x´´y´‡º2nº2Mº2mº2Nº2kº2l—÷ß4{ßZß1Rß9ßGßgß66ßf»ß67ß1R}}{ß1ß4Lß3|¦´x´´y´‡º2E¤b6º1z¤X4º3c¤X4—÷ß4{ßZß1xß9ßUßgß66ßf»ß67ß1x}}{ß1ß4Mß3|¦´x´´y´´z´‡¢28D¢1HSÝ2º6k¢1LUÝ2—{´x´¢24B´y´º6m}{´x´º6n´y´º6l´z´Ý2}÷ß4{ßZß22ß9ßIß3z»}´z´Ý2}{ß1ß4Nß3|¦´x´´y´´z´‡¢21s¢1NpÝ2º6o¢1RrÝ2¢1xqº6qÝ2º6rº6pÝ2—÷ß4{ßZß22ß9ßIß3z»}´z´Ý2}{ß1ß5iß3|¦´x´´y´‡º4Iº5Vº4Dº5U—÷ß4{ßZß32ßgß4Rß3w»ß4G»ß9ßX}}{ß1ß5Mß3|¦´x´´y´‡¤Hkº47¤Gcº4a—÷ß4{ßZß2dßgß4Rß3w»ß4G»ß9ßW}}{ß1ß4eß3|¦´x´´y´‡¤-Kº64¤Aº44¤xº4C¤1I¢-2u¤yº42¤K¢-2G¤-K¢-2a—÷ß4{ßZß2Nßgß4Eß9ßD}}{ß1ß4fß3|¦´x´´y´‡¤2G¤5A¤2aºs¤3O¤4C¤42¤4q¤42¤5o¤3E¤68¤2Q¤5y—÷ß4{ßZß2Nßgß4Eß9ßD}}{ß1ß4gß3|¦´x´´y´‡º4U¢-18º5Tº2¢-4q¢-1wº5L¢-1Sº5L¤-oºe¤-U¢-5U¤-e—÷ß4{ßZß2Nßgß4Eß9ßD}}{ß1ß4hß3|¦´x´´y´‡º44¤5K¢-34¤50º6t¤50¢-1m¤5eº6x¤6cº42¤5y¢-4B¤6G—÷ß4{ßZß2Nßgß4Eß9ßD}}{ß1ß4iß3|¦´x´´y´‡º6h¤Uº6g¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßZß2Nßg¨wall_tutorial_rock_breakable¨ß9ßD}}{ß1ß58ß3|¦´x´´y´‡¤Muº6V¤P0º64¤Pyº4G¤PUºd¤OCº4u¤N4ºd¤MQºe—÷ß4{ßZß2dßgß4Eß9ßW}}{ß1ß59ß3|¦´x´´y´‡¤Caº45¤Dsº4C¤Egº4G¤Eg¢-5K¤ECºd¤Ckºd¤C6ºe—÷ß4{ßZß2dßgß4Eß9ßW}}{ß1ß5Aß3|¦´x´´y´‡¤FAº45¤Gm¢-3s¤Hkº5L¤Huº5T¤Gwº4u¤FUºd¤F0º4s—÷ß4{ßZß2dßgß4Eß9ßW}}{ß1ß5Bß3|¦´x´´y´‡¤J2º76¤Kyº4C¤Lwº6w¤Lmºd¤K0º47¤Iiºd¤IOº6w—÷ß4{ßZß2dßgß4Eß9ßW}}{ß1ß5Cß3|¦´x´´y´‡¤Hkº47¤JCº4B¤JWº5S¤IY¢-AA¤H6¢-AK¤GIº4c¤Gcº4a—÷ß4{ßZß2dßgß4Eß3w»ß9ßW}}{ß1ß5Dß3|¦´x´´y´‡¤DEº5B¤Dsº4X¤ECº55¤EMº4l¤Dsº4r¤D8¢-Gn¤Cuº4i—÷ß4{ßZß2dßgß4Eß9ßW}}{ß1ß5Eß3|¦´x´´y´‡¤KUº50¤Kyº55¤Lcº50¤Lmº4l¤LS¢-Gw¤Koº4V¤KKºk—÷ß4{ßZß2dßgß4Eß9ßW}}{ß1ß5hß3|¦´x´´y´‡º4Dº5Uº6yº6Y¤Kº48¤1mº5U¤1Sº62¤Aº5Eº4Iº5V—÷ß4{ßZß32ßgß4Eß3w»ß9ßX}}{ß1ß5pß3|¦´x´´y´‡¢-VIº6L¢-V8º4R¢-UKº5Vº6Tº5gº6Tº49¢-UUº4N¢-Uyº4A—÷ß4{ßZß3Hßgß4Eß9ßY}}{ß1ß5qß3|¦´x´´y´‡¢-OWº6x¢-O2º6u¢-NEº43¢-Maº6t¢-Mkº4Iº40¤-yº5Rº6v—÷ß4{ßZß3Hßgß4Eß9ßY}}{ß1ß5rß3|¦´x´´y´‡¢-TMº4I¢-T2º6x¢-SEº6t¢-RQº71¢-RG¤-y¢-Ru¤-Kº7M¤-U—÷ß4{ßZß3Hßgß4Eß9ßY}}{ß1ß5Fß3|¦´x´´y´‡¤Fe¤1m¤Gc¤1w¤HG¤1S¤H6¤U¤GS¤-A¤FK¤-A¤F0¤o—÷ß4{ßZß2dßgß4Eß9ßW}}{ß1ß5Gß3|¦´x´´y´‡¤I4¤1m¤J2¤1m¤JM¤18¤JC¤K¤IY¤-A¤Hk¤A¤Ha¤18—÷ß4{ßZß2dßgß4Eß9ßW}}{ß1ß5Hß3|¦´x´´y´‡¤Jq¤1m¤Ko¤2a¤Lm¤26¤MG¤e¤LS¤A¤KA¤A¤Jg¤e—÷ß4{ßZß2dßgß4Eß9ßW}}{ß1ß5Jß3|¦´x´´y´‡¤MG¤26¤NO¤2u¤P0¤34¤Py¤2Q¤Po¤18ºf¤U¤N4¤e—÷ß4{ßZß2dßgß4Eß9ßW}}{ß1ß5Kß3|¦´x´´y´‡¤QI¤2Q¤R6¤2k¤Ru¤2k¤SO¤1w¤S4¤18¤R6¤o¤QS¤18—÷ß4{ßZß2dßgß4Eß9ßW}}{ß1ß5Lß3|¦´x´´y´‡¤Ss¤1w¤Ue¤2G¤Vw¤18¤Vm¤-K¤UU¤-o¤TM¤-K¤Si¤e—÷ß4{ßZß2dßgß4Eß9ßW}}{ß1ß4Sß3|¦´x´´y´‡¤4X¤-T¤50¤-K¤4jÎ¤50¤-K¤3OÒ—÷ß4{ßZß2Pßgß5Uß3w»ß9ßD}´z´ÝB}{ß1ß4Tß3|¦´x´´y´‡º45¤-yº45º6uº6yº4t¤-Uº4G¤-Uº6x¤1N¢-2L¤1Sº4C¤5Kº6t—÷ß4{ßZß2Pß3x¨enemy_tutorial_bit¨ß3z»ß40Îß9ßD}}{ß1ß4Uß3|¦´x´´y´‡¢-4W¤5eº46¤3sºd¤-yº75¤-Aº76¤-yº5L¤3Eº6V¤4g—÷ß4{ßZß2Pß3xß69ß3z»ß40Îß9ßD}}{ß1ß4Vß3|¦´x´´y´‡¤9Mº4I¤9s¤m—÷ß4{ß3w»ß5ß5vßZß2Rß9ßD}}{ß1ß4Wß3|¦´x´´y´‡¤9Mº4I¤8q¢-3M—÷ß4{ß5ß5vßZß2Rß3w»ß9ßD}}{ß1ß4Xß3|¦´x´´y´‡¤8Eº70¤9C¤o¤AU¤U¤9Wº64—÷ß4{ßZß2Rßg¨deco¨ß5¨tutorial_door_floor¨ß9ßD}}{ß1ß4Yß3|¦´x´´y´‡¤yº4C¤Aº44¤-Kº64¤-Kº6u¤Kº6t¤yº42¤1Iº6s—÷ß4{ßZß2Wß9ßDßgß66ßf»ß67ß2W}}{ß1ß4Zß3|¦´x´´y´‡º5Lº6yº6wº6xº5Tº2º4Uº6vº6z¤-eºe¤-Uº5L¤-o—÷ß4{ßZß2Wß9ßDßf»ßgß66ß67ß2W}}{ß1ß4aß3|¦´x´´y´‡º71¤5eº6t¤50º70¤50º44¤5K¢-3a¤6Aº6s¤6cº6x¤6c—÷ß4{ßZß2Wß9ßDßf»ßgß66ß67ß2W}}{ß1ß4bß3|¦´x´´y´‡¤42¤5o¤42¤4q¤3O¤4C¤2aºs¤2G¤5A¤2Q¤5y¤3E¤68—÷ß4{ßZß2Wß9ßDßf»ßgß66ß67ß2W}}{ß1ß4cß3|¦´x´´y´‡º44¤5Kº72¤6Gº4F¤6Kº7U¤6A—÷ß4{ßZß2Yß9ßDßf»ßgß66ß67ß2Y}}{ß1ß4dß3|¦´x´´y´‡º7U¤6Aº6s¤6cº6x¤6cº42¤5y—÷ß4{ßZß2Yß9ßDßf»ßgßhß67ß2Y}}{ß1ß4kß3|{´x´º4s´y´¤AA}÷ß4{ßZß2Tß3xß5sß3z»ß40Êß9ßD}}{ß1ß4lß3|{´x´¢-9M´y´¤6w}÷ß4{ßZß2Tß3xß5sß3z»ß40Êß4G»ß9ßD}}{ß1ß4mß3|{´x´º6Y´y´¤AA}÷ß4{ßZß2Tß3xß5sß3z»ß40Êß4G»ß9ßD}}{ß1ß4qß3|¦´x´´y´‡¤A6¢-9m¤9g¢-9Q¤A5¢-93¤9gº7X¤BM¢-9O—÷ß4{ßZß2eßgß5Uß3w»ß9ßW}´z´ÝB}{ß1ß4rß3|¦´x´´y´‡¤ER¢-5Z¤E8¢-56¤Dnº7a¤E8º7b¤E8º6g—÷ß4{ßZß2eßg¨icon_tutorial¨ß3w»ß9ßW}´z´ÝB}{ß1ß4sß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßZß2eßgß6Cß3w»ß9ßW}´z´ÝB}{ß1ß5Iß3|{´x´¤Dz´y´¤Y}÷ß4{ßZß2dß3x¨enemy_tutorial_block¨ß3z»ß40Êß4G»ß9ßW}}{ß1ß5Nß3|¦´x´´y´‡¤Maº6V¤Lwº6V¤LIº64¤M4¢-4c¤M5º7b¤M1¢-6A¤KKº47¤NOº47¤Mgº46¤M8º7b¤M7º7c—÷ß4{ßZß2bß3xß69ß3z»ß40Îß9ßW}}{ß1ß5Oß3|¦´x´´y´‡ºF¤-U¤SO¤y¤RG¤U¤Py¤o¤SYº4I¤V8º43¤Vcº4I—÷ß4{ßZß2bß3xß69ß40Îß3z»ß9ßW}}{ß1ß5Pß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßZß2bß3xß69ß3z»ß40Îß9ßW}}{ß1ß5Rß3|¦´x´´y´‡¤Ha¤Bm¤EW¤Bc¤C6¤8s¤D4¤1S¤GS¤2QºA¤1w¤JW¤26¤Ko¤2u¤Lw¤2Q¤K0¤9W—÷ß4{ßZß2bß3xß69ß40¤Cß3z»ß9ßW}}{ß1ß4oß3|¦´x´´y´‡¤76º48¤6a¢-7m—÷ß4{ß3w»ß5ß5vßZß2eß9ßW}}{ß1ß4pß3|¦´x´´y´‡¤76º48¤7c¢-Bu—÷ß4{ß3w»ß5ß5vßZß2eß9ßW}}{ß1ß4nß3|¦´x´´y´‡¤6wº6c¤5yº5M¤7G¢-7k¤8Eº4A—÷ß4{ßZß2eßgß6Aß5ß6Bß9ßW}}{ß1ß5Qß3|{´x´¤Hb´y´¢-C3}÷ß4{ßZß2bß3x¨enemy_tutorial_4way¨ß3z»ß40Êß9ßW}}{ß1ß5Sß3|{´x´¤R6´y´¤5o}÷ß4{ßZß2bß3x¨enemy_tutorial_down¨ß3z»ß40Êß9ßW}}{ß1ß4tß3|¦´x´´y´‡¤ECºd¤Ckºd¤C6ºe¤Caº45¤Dsº4C¤Egº4G¤Egº75—÷ß4{ßZß2pß9ßWßgß66ßf»ß67ß2p}}{ß1ß4uß3|¦´x´´y´‡¤Gwº4u¤FUºd¤F0º4s¤FAº45¤Gmº76¤Hkº5L¤Huº5T—÷ß4{ßZß2pß9ßWßgß66ßf»ß67ß2p}}{ß1ß4vß3|¦´x´´y´‡¤K0º47¤Iiºd¤IOº6w¤J2º76¤Kyº4C¤Lwº6w¤Lmºd—÷ß4{ßZß2pß9ßWßgß66ßf»ß67ß2p}}{ß1ß4wß3|¦´x´´y´‡¤OCº4u¤N4ºd¤MQºe¤Muº6V¤P0º64¤Pyº4G¤PUºd—÷ß4{ßZß2pß9ßWßgß66ßf»ß67ß2p}}{ß1ß4xß3|¦´x´´y´‡¤GS¤-A¤FK¤-A¤F0¤o¤Fe¤1m¤Gc¤1w¤HG¤1S¤H6¤U—÷ß4{ßZß2pß9ßWßgß66ßf»ß67ß2p}}{ß1ß4yß3|¦´x´´y´‡¤IY¤-A¤Hk¤A¤Ha¤18¤I4¤1m¤J2¤1m¤JM¤18¤JC¤K—÷ß4{ßZß2pß9ßWßgß66ßf»ß67ß2p}}{ß1ß4zß3|¦´x´´y´‡¤KA¤A¤Jg¤e¤Jq¤1m¤Ko¤2a¤Lm¤26¤MG¤e¤LS¤A—÷ß4{ßZß2pß9ßWßgß66ßf»ß67ß2p}}{ß1ß50ß3|¦´x´´y´‡¤H6º78¤GIº4c¤Gcº4a¤Hkº47¤JCº4B¤JWº5S¤IYº77—÷ß4{ßZß2pß9ßWßgß66ßf»ß67ß2p}}{ß1ß51ß3|¦´x´´y´‡¤D8º79¤Cuº4i¤DEº5B¤Dsº4X¤ECº55¤EMº4l¤Dsº4r—÷ß4{ßZß2pß9ßWßgß66ßf»ß67ß2p}}{ß1ß52ß3|¦´x´´y´‡¤Koº4V¤KKºk¤KUº50¤Kyº55¤Lcº50¤Lmº4l¤LSº7A—÷ß4{ßZß2pß9ßWßgß66ßf»ß67ß2p}}{ß1ß53ß3|¦´x´´y´‡¤EW¤-A¤Di¤-G¤DC¤M¤DL¤17¤E2¤1S¤Ei¤15¤Eu¤U—÷ß4{ßZß2pß9ßWßgß66ßf»ß67ß2p¨map_hide_when¨ß2v}}{ß1ß5Tß3|{´x´¤FM´y´¢-7V}÷ß4{ßZß2cß3xß5tß3z»ß40Êß9ßW}}{ß1ß5Vß3|¦´x´´y´‡¤E6¢-1h¤EBº5d—÷ß4{ßZß2fßgß5Uß3w»ß9ßW}´z´ÝB}{ß1ß5Wß3|¦´x´´y´‡¤E4¢-1X¤E4º7q—÷ß4{ßZß2fßgß5Uß3w»ß9ßW}´z´ÝB}{ß1ß5Xß3|{´x´¤Eg´y´º5h}÷ß4{ßZß2hß3xß5sß3z»ß40Êß4G»ß9ßW}}{ß1ß5bß3|{´x´ºo´y´º56}÷ß4{ßZß2hß3xß5sß3z»ß40Êß4G»ß9ßW}}{ß1ß5Yß3|¦´x´´y´‡¤Bcº4X¤Gw¢-JC¤Gm¢-L8¤E2º4y¤BSº5F¤9g¢-Ii¤9qº5K—÷ß4{ßZß2hßgß4Hß4J£0.BIß9ßW}}{ß1ß5Zß3|¦´x´´y´‡¤D8º79¤EC¢-FN—÷ß4{ßZß2hßgß4Pß9ßW}}{ß1ß5cß3|¦´x´´y´‡º4O¢-Egº7Iº7A—÷ß4{ß3w»ß5ß5vßZß2xß9ßX}}{ß1ß5dß3|¦´x´´y´‡¢-LIº6Zº4oº57¢-Muº4Vº6Uºk—÷ß4{ßZß2xßgß6Aß5ß6Bß9ßX}}{ß1ß5fß3|¦´x´´y´‡º4Iº5Vº4Dº5Uº6yº6Y¤Kº48¤1mº5U¤1Sº62¤Aº5E—÷ß4{ßZß39ß9ßXßgß66ßf»ß67ß39}}{ß1ß5gß3|¦´x´´y´‡º50º56º6iº6iº4Tº52º4Sº5Bº4Lº56º5Dº6jº5Eº4o—÷ß4{ßZß3Bß9ßXßgß66ßf»ß67ß3B}}{ß1ß5mß3|¦´x´´y´‡º7Bº6Lº7Cº4Rº7Dº5Vº6Tº5gº6Tº49º7Eº4Nº7Fº4A—÷ß4{ßZß3Rßgß66ß9ßYß67ß3Rßf»}}{ß1ß5nß3|¦´x´´y´‡º7Lº4Iº7Mº6xº7Nº6tº7Oº71º7P¤-yº7Q¤-Kº7M¤-U—÷ß4{ßZß3Rßgß66ß9ßYß67ß3Rßf»}}{ß1ß5oß3|¦´x´´y´‡º7Gº6xº7Hº6uº7Iº43º7Jº6tº7Kº4Iº40¤-yº5Rº6v—÷ß4{ßZß3Rßgß66ß9ßYß67ß3Rßf»}}{ß1ß5wß3|¦´x´´y´‡¤Lw¤fc¤EC¤fw—÷ß4{ßZß3Xßgß4Pß9ßH}}{ß1ß5xß3|¦´x´´y´‡ºA¤GI¤E2¤G8—÷ß4{ßZß3Tßgß4Pß9ßH}}{ß1ß5zß3|¦´x´´y´‡¤DE¤gQ¤CQ¤ga¤CG¤hY¤Ck¤iC¤DO¤iW¤E2¤iM¤EW¤hs¤EMºx—÷ß4{ßZß3nß9ßHßgß66ßf»ß67ß3n}}{ß1ß60ß3|¦´x´´y´‡¤RG¤oUºM¤pS¤Qw¤qa¤S4¤quºF¤qa¤TC¤pS¤SO¤oe—÷ß4{ßZß3nß9ßHßgß66ßf»ß67ß3n}}{ß1ß61ß3|¦´x´´y´‡¤Rk¤rE¤Qw¤ri¤Qw¤sgºw¤tK¤SY¤tAºF¤sM¤SiºW—÷ß4{ßZß3nß9ßHßgß66ßf»ß67ß3n}}{ß1ß62ß3|¦´x´´y´‡¤Ss¤tUºw¤ty¤R6¤v6¤Rk¤wE¤Si¤wY¤Tg¤vk¤Tq¤uS—÷ß4{ßZß3nß9ßHßgß66ßf»ß67ß3n}}{ß1ß63ß3|¦´x´´y´‡¤Vg¤jA¤Wu¤jA¤XO¤km¤WA¤km—÷ß4{ßZß3pß9ßHßf»ßgßhß67ß3p}}{ß1ß54ß3|¦´x´´y´‡¤Gh¢-43¤G8º42¤FPº4G—÷ß4{ßZß2aßgß65ß9ßW}}{ß1ß55ß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Keº2—÷ß4{ßZß2aßgß65ß9ßW}}{ß1ß56ß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Oj¢-5p¤P3¢-5i¤Td¢-67¤PE¢-4S¤OX¢-3f¤OCº4I¤N9º4C—÷ß4{ßZß2aßgß65ß9ßW}}{ß1ß57ß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßZß2aßgß65ß9ßW}}{ß1ß4jß3|¦´x´´y´‡º72¤6Gº47¤42º48¤50º88¤83º4A¤BIº4B¤D4º4C¤B8º6f¤7A—÷ß4{ß3w»ßZß2Tßgß3vß9ßD}}{ß1ß5aß3|¦´x´´y´‡¤Gmº4W¤Gcº4o¤E2º4n¤Bcº4Q¤A0º4m¤AAº4lºoº4X—÷ß4{ß3w»ßZß2hßgß3vß9ßW}}÷¨icons¨|÷}");
