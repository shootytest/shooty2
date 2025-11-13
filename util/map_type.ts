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
export const TEST_MAP: map_type = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢3Ng´y´¢WQ}÷¨options¨{¨style¨ß2¨contains¨|¨home floor¨÷¨room_id¨´´¨is_room¨»}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ßA¨room_connections¨|¨tutorial room 1¨÷ß9»ß8´´}}{ß1¨station¨ß3|{´x´¢1RC´y´¢1NU}÷ß4{ßB|¨station tutorial¨¨station streets¨¨tutorial room 5¨÷ß6|¨train¨ßE¨station tracks¨ßF¨station tracks particle¨÷ß8´´ß9»}}{ß1¨test group¨ß3|{´x´¢6x´y´¢7q}÷ß4{ß6|¨test 1¨÷¨open_loop¨«ß5¨test¨ßB|÷ß9»ß8´´}}{ß1¨tutorial¨ß3|{´x´¢-WG´y´º8}÷ß4{ß5ßOß6|ßC¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨ßG÷ß8´´}}{ß1ß7ß3|¦´x´´y´‡¢3sk¢Bs¢3Xu¢2m¢3FVºC¢30C¢6M¢2pO¢Gd¢2mE¢TN¢2py¢ip¢2zv¢sv—÷ß4{¨parent¨ß2¨make_id¨¨floor¨ß8ß2}}{ß1ßFß3|{´x´¢1cy´y´¢11i}÷ß4{ßSßDß6|¨station streets rock 1¨¨station streets rock 2¨¨station streets rock 3¨¨station streets sensor start¨¨station streets rock 0¨¨station streets sensor fall¨¨station streets rock block¨¨station streets rock 4¨¨station streets rock 5¨¨station streets rock 6¨¨station streets rock 7¨¨station streets rock 8¨¨station streets floor 1¨¨station streets floor 1.5¨¨station streets floor 2¨¨station streets floor 2.5¨¨station streets floor 3¨¨station streets floor 3.5¨¨station streets wall 1¨¨station streets wall 2¨¨station streets wall 3¨¨station streets wall 4¨¨station streets floor 0¨¨station streets floor 4¨¨station streets floor 5¨¨station streets floor 4.5¨¨station streets wall 5¨¨station streets wall 6¨¨station streets wall 7¨¨station streets wall 8¨¨station streets wall 9¨¨station streets wall 10¨¨station streets wall 11¨¨station streets wall 12¨¨station streets wall 13¨¨station streets rocky 1¨¨station streets floor 6¨¨station streets wall fake 1¨÷ß8ßDß9»ßB|ßD÷}}{ß1ßIß3|¦´x´´y´‡¢T2¢12W¢3U8ºRºS¢13KºQºT—÷ß4{ßSßDßT¨floor_train_track¨ß8ßD¨sensor_dont_set_room¨»}}{ß1ßJß3|¦´x´´y´‡ºQºRºQºT—÷ß4{ßSßDßTß17ß8ßDß18»}}{ß1ßEß3|{´x´¢VS´y´¢yA}÷ß4{ßSßDß6|¨station tutorial floor¨¨station tutorial sensor start¨¨station tutorial wall 1¨¨station tutorial wall 2¨¨station tutorial rock 1¨¨station tutorial rock 2¨¨station tutorial rock 3¨¨tutorial floor low¨¨station tutorial sensor end¨÷ß8ßDß9»ßB|ßGßD÷}}{ß1ßLß3|¦´x´´y´‡¢7c¢46¢8u¢88—÷ß4{ßSßKßM»ßT¨wall¨ß5ßNß6|¨test 2¨÷ß8ßK}}{ß1ßHß3|¦´x´´y´‡¢Qc¢10u¢TRºb—{´x´ºc´y´ºb´z´£0.4q}{´x´¢Vr´y´ºb´z´Ý0}{´x´ºd´y´ºb}{´x´¢Yg´y´ºb}{´x´ºe´y´ºb´z´£0.84}{´x´ºa´y´ºb´z´Ý1}÷ß4{ßSßDßT¨wall_train¨ß6|¨train floor broken¨¨train wall 1¨¨train wall 2¨¨train wall 3¨¨train ceiling¨¨train sensor¨¨train door right¨¨train door right path¨¨train door left¨¨train door left path¨¨train floor¨¨train floor broken top¨¨train floor broken bottom¨¨train floor broken middle¨÷¨seethrough¨»ß8ßD}}{ß1ßCß3|{´x´¢-68´y´¢-50}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨¨tutorial room 1 floor¨÷ßSßOß9»ßB|ßPßRßAßQ÷ß8´´}}{ß1ßPß3|{´x´¢OW´y´¢-DO}÷ß4{ßSßOß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨home wow test wow¨¨tutorial room 2 floor¨¨tutorial room 2 floor platform¨÷ß9»ßB|ßGßCßQ÷ß8´´}}{ß1ßQß3|{´x´¢-JM´y´¢-Tg}÷ß4{ßSßOß6|¨tutorial window 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨¨tutorial room 3 floor¨¨tutorial room 3 enemy 3¨÷ß9»ßB|ßQßRßPßC÷ß8´´}}{ß1ßRß3|{´x´¢-Z0´y´¢-Gc}÷ß4{ßSßOß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨¨tutorial room 4 floor¨÷ß9»ßB|ßQßC÷ß8´´}}{ß1ßGß3|{´x´¢9t´y´¢GK}÷ß4{ßSßOß6|¨tutorial room 5 sensor boss¨¨tutorial room 5 door start¨¨tutorial room 5 sensor boss start¨¨tutorial room 5 boss¨¨tutorial room 5 floor¨¨tutorial room 5 door end¨¨tutorial wall 15¨¨tutorial wall 16¨¨tutorial rock 23¨¨tutorial room 5 enemy¨¨tutorial rock 24¨¨tutorial rock 25¨¨tutorial rock 26¨¨tutorial rock 27¨¨tutorial room 5 switch path¨¨tutorial room 5 sensor middle¨¨tutorial room 5 sensor boss end¨¨tutorial wall 14¨¨tutorial room 5 rocky 3¨¨tutorial fake wall 5¨÷ß9»ßB|ßPßEßD÷ß8´´}}{ß1ß1xß3|{´x´¢Ii´y´¢3i}÷ß4{ßSßP¨spawn_enemy¨¨checkpoint¨¨is_spawner¨»¨spawn_repeat¨Êß8ßP}}{ß1ßrß3|¦´x´´y´‡¢1Qi¢vuºr¢1Aa¢1RWºtºuºs—÷ß4{ßSßFßTßUß8ßF}´z´£0.-1c}{ß1ßhß3|¦´x´´y´‡¢1Qs¢wOºv¢18y¢1Uk¢1Fk¢1dI¤pc—÷ß4{ßSßFßTßUß8ßF¨safe_floor¨»ß5¨wall_floor¨}´z´Ý2}{ß1ßiß3|¦´x´´y´‡º10¤pcºyºz—{´x´ºy´y´ºz´z´£0.-3E}{´x´º10´y´¤pc´z´Ý3}÷ß4{ßSßFßTß2pß8ßF}´z´Ý2}{ß1ßjß3|¦´x´´y´‡º10¤pcºyºz¢1fOºz¢1ks¤pc—÷ß4{ßSßFßTßUß8ßFß2o»ß5ß2p}´z´Ý3}{ß1ßkß3|¦´x´´y´‡º12¤pcº11ºz—{´x´º11´y´ºz´z´£0.-4q}{´x´º12´y´¤pc´z´Ý4}÷ß4{ßSßFßTß2pß8ßF}´z´Ý3}{ß1ßlß3|¦´x´´y´‡º12¤pcº11ºz¢1xI¢1DK¢1us¤ri—÷ß4{ßSßFßTßUß8ßFß2o»ß5ß2p}´z´Ý4}{ß1ßmß3|¦´x´´y´‡º15¤riº13º14—{´x´º13´y´º14´z´£0.-6S}{´x´º15´y´¤ri´z´Ý5}÷ß4{ßSßFßTß2pß8ßF}´z´Ý4}{ß1ßsß3|¦´x´´y´‡º15¤riº13º14¢27S¢1De¢23u¤uw—÷ß4{ßSßFßTßUß8ßFß2o»ß5ß2p}´z´Ý5}{ß1ßuß3|¦´x´´y´‡º18¤uwº16º17—{´x´º16´y´º17´z´£0.-84}{´x´º18´y´¤uw´z´Ý6}÷ß4{ßSßFßTß2pß8ßF}´z´Ý5}{ß1ßtß3|{´x´º18´y´¤uw´z´Ý6}{´x´º16´y´º17}{´x´¢2LA´y´¢12v´z´Ý6}{´x´¢294´y´¤uw}÷ß4{ßSßFßTßUß8ßFß2o»ß5ß2p}´z´Ý6}{ß1ß15ß3|¦´x´´y´‡º18¤uw¢29O¤v6¢2A2¤jUº13¤kc—÷ß4{ßSßFßTßUß8ßFß2o»}´z´Ý6}{ß1ßZß3|¦´x´´y´‡¢1Uu¢15Q¢1VE¢19S¢1SU¢172—÷ß4{ßSßFßT¨rock¨ß8ßF}´z´Ý2}{ß1ßVß3|¦´x´´y´‡¢1aE¤xq¢1ZJ¢105¢1XD¤yT—÷ß4{ßSßFßTß2qß8ßF}´z´Ý2}{ß1ßWß3|¦´x´´y´‡¢1d8¢15a¢1b5¢19l¢1Yp¢15F—÷ß4{ßSßFßTß2qß8ßF}´z´Ý3}{ß1ßXß3|¦´x´´y´‡¢1fb¤zl¢1cK¢10G¢1df¤xV—÷ß4{ßSßFßTß2qß8ßF}´z´Ý3}{ß1ßcß3|¦´x´´y´‡¢1nI¢16s¢1im¢19cº12º1F—÷ß4{ßSßFßTß2qß8ßF}´z´Ý4}{ß1ßdß3|¦´x´´y´‡¢1sc¢10kº1Y¢10Q¢1qh¤vx—÷ß4{ßSßFßTß2qß8ßF}´z´Ý4}{ß1ßeß3|¦´x´´y´‡¢1uEº1F¢1tQ¢16iº1c¢15G—÷ß4{ßSßFßTß2qß8ßF}´z´Ý4}{ß1ßfß3|¦´x´´y´‡¢244¢19m¢1yu¢19w¢22Iº1F—÷ß4{ßSßFßTß2qß8ßF}´z´Ý5}{ß1ßgß3|{´x´¢1xw´y´¤xq}{´x´¢21o´y´¤yU´z´Ý5}{´x´º1m´y´º1e}÷ß4{ßSßFßTß2qß8ßFßM»}´z´Ý5}{ß1ßbß3|¦´x´´y´‡¢2Hwº1A¢29s¢16Yº1s¤zI—÷ß4{ßSßFßTß2qß8ßF}´z´Ý6}{ß1ß14ß3|{´x´¢2CS´y´¢164}÷ß4{ßSßFß2k¨enemy_streets_rocky_small¨ß2m»ß2nÊ¨spawn_permanent¨»ß8ßF}´z´Ý6}{ß1ßaß3|¦´x´´y´‡¢2Ei¤uSº1w¢1Do¢1ouº1xº1y¤uS—÷ß4{ßSßFßT¨sensor¨ß8ßF}´z´Ý6}{ß1ßYß3|¦´x´´y´‡¢1Ty¤v5¢1UGº14ºr¢1CCºv¤vG—÷ß4{ßSßFßTß2tß8ßF}}{ß1ßnß3|¦´x´´y´‡º18¤uw¢1vM¤w4—÷ß4{ßM»ßSßFßTß1Iß8ßF}´z´Ý5}{ß1ßoß3|{´x´¢1ce´y´¤rY}{´x´ºr´y´ºw´z´Ý2}{´x´ºr´y´ºb}÷ß4{ßM»ßSßFßTß1Iß8ßF}´z´Ý2}{ß1ßpß3|¦´x´´y´‡¢1ja¤vkº23¤rY—÷ß4{ßM»ßSßFßTß1Iß8ßF}´z´Ý3}{ß1ßqß3|¦´x´´y´‡¢22S¤nCº18¤uw—{´x´¢25q´y´¤uw´z´Ý6}{´x´¢23Q´y´¤te}÷ß4{ßM»ßSßFßTß1Iß8ßF}´z´Ý6}{ß1ßvß3|¦´x´´y´‡¢1VYº14ºrºx—{´x´ºr´y´¢14w´z´Ý2}÷ß4{ßM»ßSßFßTß1Iß8ßF}´z´Ý2}{ß1ßwß3|¦´x´´y´‡¢1g2¢1Cgº28º14—÷ß4{ßM»ßSßFßTß1Iß8ßF}´z´Ý3}{ß1ßxß3|{´x´¢1wy´y´ºt´z´Ý4}{´x´¢1oQ´y´¢1Au}{´x´º2A´y´º2B}÷ß4{ßM»ßSßFßTß1Iß8ßF}´z´Ý4}{ß1ßyß3|¦´x´´y´‡º22¤w4¢1pi¤tUº24¤vk—÷ß4{ßM»ßSßFßTß1Iß8ßF}´z´Ý4}{ß1ßzß3|¦´x´´y´‡ºrº29ºrºx—÷ß4{ßM»ßSßFßTß1Iß8ßF}´z´Ý6}{ß1ß10ß3|{´x´ºr´y´ºw´z´Ý6}{´x´ºr´y´ºb}÷ß4{ßM»ßSßFßTß1Iß8ßF}´z´Ý6}{ß1ß11ß3|{´x´¢26o´y´¢1AG´z´Ý5}{´x´º2C´y´ºt}÷ß4{ßM»ßSßFßTß1Iß8ßF}´z´Ý5}{ß1ß12ß3|¦´x´´y´‡¢278¤nC¢28k¤teº16¤uwº1B¤uwº1s¤w4—{´x´¢2D6´y´¤zI´z´Ý6}{´x´º2K´y´º1d}÷ß4{ßM»ßSßFßTß1Iß8ßF}´z´Ý6}{ß1ß13ß3|¦´x´´y´‡º2K¢156º2Kº1tº1sº1lº2Gº2H—÷ß4{ßM»ßSßFßTß1Iß8ßF}´z´Ý6}{ß1ß16ß3|{´x´º1p´y´¤xq}{´x´º1m´y´º1e´z´Ý5}÷ß4{ßSßFßT¨wall_streets_fake¨ßM»ß2s»ß8ßF}´z´Ý5}{ß1ß19ß3|¦´x´´y´‡¤am¤w4¤ZU¤w4¤RG¤w4¤Gw¤yy¤Gw¢17MºUº2MºU¢18e¤X4º2N¤X4º2M¤amº2M¤am¢130—÷ß4{ßSßEßTßUß2o»ß8ßE}}{ß1ß1Dß3|¦´x´´y´‡¢14S¤tAº1J¤uw¢17g¤y0º2Lº1e¢11s¤zmº1W¤xC¢11O¤uI—÷ß4{ßSßEßTß2qß8ßE}´z´Ý6}{ß1ß1Eß3|¦´x´´y´‡¢1Emº1F¢1GOº1v¢1Giº2Qºz¢19I¢1Dy¢198¢1Cqº2Qº14º1v—÷ß4{ßSßEßTß2qß8ßE}´z´Ý6}{ß1ß1Fß3|¦´x´´y´‡¢1K6¤xM¢1LE¤xq¢1LY¤yy¢1Kkº1e¢1J8¢106¢1IK¤yo¢1Iy¤xg—÷ß4{ßSßEßTß2qß8ßE}´z´Ý6}{ß1ß1Hß3|¦´x´´y´‡º5¤vGº5º21¢1PQº21º2i¤vG—÷ß4{ßSßEßTß2tß8ßE}}{ß1ß1Aß3|¦´x´´y´‡ºQ¤wY¤KK¤yy¤KKº1WºQº1W¤Ue¤zm¤WGº1W¤ZU¤wY—÷ß4{ßSßEßTß2t¨sensor_fov_mult¨Êß8ßE}}{ß1ß1Bß3|¦´x´´y´‡¤RG¤w4¤Op¤wi—÷ß4{ßM»ßSßEßTß1Iß8ßE}}{ß1ß1Cß3|¦´x´´y´‡¤Mk¤xM¤Gw¤yy¤Gwº2M¤ZUº2M¤ZU¢15k—÷ß4{ßM»ßSßEßTß1Iß8ßE}}{ß1ß1Jß3|¦´x´´y´‡¤8w¤4r¤9s¤7u—÷ß4{ßSßLßM»ßTß1Iß5ßNß8ßK}}{ß1ß1Pß3|¦´x´´y´‡ºeºbºaºbºaº29ºeº29—÷ß4{ßSßHßTß1KßU»ß8ßDß18»}´z´Ý1}{ß1ß1Tß3|¦´x´´y´‡¤SEºbºcºb—{´x´ºc´y´ºb´z´Ý0}{´x´¤SE´y´ºb´z´Ý0}÷ß4{ßSßHßTß1Kß8ßD}}{ß1ß1Uß3|¦´x´´y´‡ºcºb¤Ueºb—÷ß4{ßSßHßT¨sensor_path¨ß8ßD}}{ß1ß1Rß3|¦´x´´y´‡ºdºb¤X4ºb—{´x´¤X4´y´ºb´z´Ý0}{´x´ºd´y´ºb´z´Ý0}÷ß4{ßSßHßTß1Kß8ßD}}{ß1ß1Sß3|¦´x´´y´‡ºdºb¤Ueºb—÷ß4{ßSßHßTß2wß8ßD}}{ß1ß1Vß3|¦´x´´y´‡ºeºbºaºbºaº29ºeº29—÷ß4{ßSßHßT¨floor_train¨ß8ßDß18»}}{ß1ß1Lß3|¦´x´´y´‡ºeºb¤SEºb¤Ru¢122¤SE¢13U¤SEº29ºeº29—÷ß4{ßSßHßTß2xß8ßDß18»}}{ß1ß1Xß3|¦´x´´y´‡ºaº29¤SEº29¤SEº2lºa¢13A—÷ß4{ßSßHßTß2xß8ßDß18»}}{ß1ß1Yß3|¦´x´´y´‡ºaº2m¤SEº2l¤Ruº2kºaºR—÷ß4{ßSßHßTß2xß8ßDß18»}}{ß1ß1Wß3|¦´x´´y´‡ºaºR¤Ruº2k¤SEºbºaºb—÷ß4{ßSßHßTß2xß8ßDß18»}}{ß1ß1Qß3|¦´x´´y´‡¤Qm¢114¤Qm¢14m¤YWº2o¤YWº2n—÷ß4{ßSßHßTß2tß8ßDß18»}}{ß1ß1Mß3|{´x´ºe´y´ºb}{´x´ºe´y´ºb´z´Ý1}{´x´ºe´y´º29´z´Ý1}{´x´ºe´y´º29}÷ß4{ßSßHßTß1Kß8ßD}}{ß1ß1Nß3|{´x´ºa´y´ºb}{´x´ºa´y´ºb´z´Ý1}{´x´ºa´y´º29´z´Ý1}{´x´ºa´y´º29}÷ß4{ßSßHßTß1Kß8ßD}}{ß1ß1Oß3|¦´x´´y´‡ºaº29ºeº29—{´x´ºe´y´º29´z´Ý1}{´x´ºa´y´º29´z´Ý1}÷ß4{ßSßHßTß1Kß8ßD}}{ß1ß1sß3|¦´x´´y´‡¤Lm¤4q¤Ky¤84—÷ß4{ßSßPßT¨wall_tutorial_fake¨ßM»ß2s»ß8ßP}}{ß1ß2Oß3|¦´x´´y´‡¢-M6¤-U¢-NY¤K—÷ß4{ßSßRßTß2yßM»ß2s»ß8ßR}}{ß1ß2jß3|¦´x´´y´‡¤AA¤g6¤By¤i0—÷ß4{ßSßGßTß2yßM»ß2s»ß8ßG}}{ß1ß1Gß3|{´x´ºr´y´ºw´z´Ý6}{´x´ºr´y´ºx}{´x´¤ye´y´¢1Ec}{´x´¤yU´y´¤qQ}÷ß4{ßSßEßTßUß8ßE}´z´Ý6}{ß1ß2Yß3|¦´x´´y´‡¤CQ¤ga¤DE¤gQ¤EM¤gu¤EW¤hs¤E2¤iM¤DO¤iW¤Ck¤iC—÷ß4{ßSßGßTß2qßM»ß8ßG}}{ß1ß2aß3|¦´x´´y´‡¤SO¤oe¤TC¤pSºQ¤qa¤S4¤qu¤Qw¤qaºa¤pS¤RG¤oU—÷ß4{ßSßGßTß2qß8ßG}}{ß1ß2bß3|¦´x´´y´‡¤Si¤rOºQ¤sM¤SY¤tA¤Ra¤tK¤Qw¤sg¤Qw¤ri¤Rk¤rE—÷ß4{ßSßGßTß2qß8ßG}}{ß1ß2cß3|¦´x´´y´‡¤Ss¤tU¤Tq¤uS¤Tg¤vk¤Si¤wY¤Rk¤wE¤R6¤v6¤Ra¤ty—÷ß4{ßSßGßTß2qß8ßG}}{ß1ß2dß3|¦´x´´y´‡¤OC¤vQ¤Og¤wE¤OM¤x2¤NO¤xM¤Ma¤ws¤MQºs¤NE¤vG—÷ß4{ßSßGßTß2qß8ßG}}{ß1ß1cß3|{´x´¢-2Q´y´º3}÷ß4{ßSßCß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷ß8ßC}}{ß1ß1eß3|¦´x´´y´‡¤6w¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßSßCß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßTß2tß2v£0.EWß8ßC}}{ß1ß1iß3|¦´x´´y´‡¤D4¤-A¤C6¢-42¤5eº2sº2ºg¢-6Iº2¢-6m¤42¢-9q¤50¢-Bm¤84¢-Bc¤BI¢-7Q¤D4¢-3Y¤B8¢-26¤84¤4C¤6w¤6c¤1S—÷ß4{ßSßCßTßUß2o»ß8ßC}}{ß1ß1aß3|{´x´ºg´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß39÷ßSßCß8ßC}}{ß1ß1dß3|¦´x´´y´‡¤5eº2sº2ºgº2wº2º2x¤42º33¤84¤4C¤6w¤6c¤1S—÷ß4{ßSßCßTß2tß2vÊß8ßC}}{ß1ß1gß3|{´x´¢-BI´y´¤4q}÷ß4{ß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßSßCß8ßC}}{ß1ß1oß3|¦´x´´y´‡¤5e¢-CG¤4g¢-8O¤8Yº31¤9Wº35¤F9¢-HE¤9W¢-BS—÷ß4{ßSßPßTß2tß2vÝ7ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷ß8ßP}}{ß1ß1yß3|¦´x´´y´‡¤Gw¢-Ky¤EC¢-Lc¤BS¢-KU¤4M¢-Ca¤3O¢-8i¤C6º2v¤D4¤-A¤Bm¤8s¤E2¤G8¤H6¤GI¤Ke¤9M¤WG¤84¤Wu¤2G¤Uy¢-Ay—÷ß4{ßSßPßTßUß2o»ß8ßP}}{ß1ß1zß3|¦´x´´y´‡¤Wu¢-4C¤Waº31—{´x´¤Vw´y´¢-5o´z´£0.3E}÷ß4{ßSßPßTßUß8ßP}´z´Ý8}{ß1ß1kß3|{´x´¤G8´y´º32}÷ß4{ßSßPß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷ß8ßP}}{ß1ß1nß3|{´x´¤KA´y´¢-5A}÷ß4{ßSßPß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷ß8ßP}}{ß1ß1tß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßSßPßTß2tß8ßP}}{ß1ß1lß3|{´x´¤Ss´y´¤-y}÷ß4{ßSßPß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ß8ßP}}{ß1ß1mß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßSßPßTß2wß6|¨tutorial room 2 switch¨÷ß8ßP}}{ß1ß1pß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGº2s—÷ß4{ßSßPßT¨icon¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷ß8ßP}´z´£0.1c}{ß1ß1rß3|{´x´¤AU´y´¢-K0}÷ß4{ßSßPß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷ß8ßP}}{ß1ß1uß3|¦´x´´y´‡¤CQ¤y¤Ds¤FU¤HQ¤FU¤FU¤y—÷ß4{ßSßPßTß2tß2vÝ7ß8ßP}}{ß1ß21ß3|¦´x´´y´‡¢-Lm¢-IY¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßSßQßTß2tß2v£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷ß8ßQ}}{ß1ß29ß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FKº3F¢-Ds¢-8s¢-Fe¢-8Yº3X¢-A0º3N¢-DY¢-Ke—÷ß4{ßSßQßTß2tß8ßQ}}{ß1ß22ß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßSßQß2k¨enemy_tutorial_easy¨ß2m»ß2nÊß8ßQ}}{ß1ß2Cß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßSßQß2kß3uß2m»ß2nÊß8ßQ}}{ß1ß2Bß3|¦´x´´y´‡¤3Oº3E¤4Mº3D¤e¢-GI¢-4Mº3C¢-84¢-Oq¢-EC¢-PAº3O¢-I4¢-OM¢-FU¢-MQº3fº35¢-9Cº33¢-76—÷ß4{ßSßQßTßUß2o»ß8ßQ}}{ß1ß26ß3|¦´x´´y´‡º2wº3n¤2F¢-5T¤4qº3Z¢-3F¢-Hl—÷ß4{ßSßQßTß2tß2vÝAß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷ß8ßQ}}{ß1ß2Hß3|{´x´¢-L4´y´¤49}÷ß4{ßSßRß2k¨enemy_tutorial_rock_room4¨ß2m»ß2nÊß8ßR}}{ß1ß2Pß3|¦´x´´y´‡º3uº3fº3sº3t¢-W6¢-Ck¢-Ygº3Iºk¤Uº2q¤Kº2q¤7G¢-Is¤7Gº44¤34º2p¤-U¢-J2¢-3Oº3Xº3E—÷ß4{ßSßRßTßUß2o»ß8ßR}}{ß1ß2Eß3|{´x´¢-QI´y´¢-7G}÷ß4{ßSßRß2k¨collect_gun_basic¨ß2m»ß2nÊß2s»ß8ßR}}{ß1ß2Fß3|{´x´º47´y´º48}÷ß4{ßSßRß2k¨deco_gun_basic¨ß2m»ß2nÊß8ßR}}{ß1ß2Lß3|¦´x´´y´‡¢-Kz¢-6w¢-Kj¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßSßRßTß3kß8ßR}}{ß1ß2Gß3|{´x´¢-Ue´y´¢-C6}÷ß4{ßSßRß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷ß8ßR}}{ß1ß2Jß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßSßRß2k¨enemy_tutorial_rocky¨ß2m»ß2nÊß2s»ß8ßR}}{ß1ß2Kß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßSßRß2kß43ß2m»ß2nÊß2s»ß8ßR}}{ß1ß2Dß3|¦´x´´y´‡¢-OK¢-Fkº8¢-Cu¢-Yqº3I¢-Tq¤e¢-Ma¤Uº44¢-3E¢-IEº3b—÷ß4{ßSßRßTß2tß2v£1.4qß8ßR}}{ß1ß2Iß3|{´x´¢-Ic´y´¤16}÷ß4{ßSßRß2k¨switch¨ß2m»ß2nÊß8ßR}}{ß1ß2Tß3|{´x´¤Fy´y´¤TW}÷ß4{ßSßGß2k¨enemy_tutorial_boss¨ß2m»ß2nÊß8ßG}}{ß1ß2Vß3|¦´x´´y´‡¤Pe¤fS¤Lw¤fc—÷ß4{ßM»ß5¨tutorial_door¨ßSßGß6|¨tutorial room 5 door end path¨÷ß8ßG}}{ß1ß2Rß3|¦´x´´y´‡¤KU¤GS¤HQ¤GI—÷ß4{ßM»ß5ß46ßSßGß6|¨tutorial room 5 door start path¨÷ß8ßG}}{ß1ß2Zß3|{´x´¤Tx´y´¤gx}÷ß4{ßSßGß2k¨enemy_tutorial_easy_static¨ß2m»ß2nÊß8ßG}}{ß1ß2Uß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºQ¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fw¤Ue¤fw¤Vc¤jA¤Wu¤jA¤XO¤km¤W6¤km¤X4¤o0¤YM¤o0¤am¤w4¤ZU¤wE¤RG¤w4¤Gw¤yy¤F0¤nC¤92¤h4¤9M¤gG¤AA¤g6¤1w¤X4¤4q¤M6—÷ß4{ßSßGßTßUß2o»ß8ßG}}{ß1ß2iß3|{´x´¤WV´y´¤jy}÷ß4{ßSßGß2k¨enemy_tutorial_rocky_small¨ß2m»ß2nÊß8ßG}}{ß1ß2Qß3|¦´x´´y´‡¤1w¤Ko¤1w¤cEºQ¤bQ¤TM¤LI—÷ß4{ßSßGßTß2tß8ßG}}{ß1ß2gß3|¦´x´´y´‡¤8s¤eK¤9g¤fI¤MG¤eo¤N4¤dq—÷ß4{ßSßGßTß2tß2vÝBß8ßG}}{ß1ß2Sß3|¦´x´´y´‡¤DE¤Gm¤CG¤HQ¤JC¤Hk¤IE¤H6—÷ß4{ßSßGßTß2tß2vÝBß8ßG}}{ß1ß2fß3|¦´x´´y´‡¤DE¤g6¤Eg¤gu¤Kr¤ga¤V1¤fk¤ZU¤um¤Gc¤um¤H6¤ye¤Qwºs¤aI¤vW¤VI¤fI—÷ß4{ßSßGßTß2tß2vÊß8ßG}}{ß1ß2eß3|¦´x´´y´‡¤NE¤vG¤Mk¤rO—÷ß4{ßSßGßTß2wß8ßG}}{ß1ß23ß3|¦´x´´y´‡º4Oº3v¢-D4¢-9gº2z¢-B8—÷ß4{ßSßQßT¨spike¨ß8ßQ}}{ß1ß24ß3|¦´x´´y´‡º44¢-EW¢-JWº3t¢-HG¢-G8—÷ß4{ßSßQßTß4Bß8ßQ}}{ß1ß25ß3|¦´x´´y´‡¢-Af¢-PH¢-Bw¢-PKº35¢-NO—÷ß4{ßSßQßTß4Bß8ßQ}}{ß1ß2Mß3|¦´x´´y´‡¢-Iu¤5Sº44¤34º2p¤-Uº45º46º3Xº3Eº3uº3f—÷ß4{ßSßRßTß1IßM»ß8ßR}}{ß1ß1bß3|¦´x´´y´‡¢-38¤7Aº33¤84¤4C¤6w¤6c¤1S¤D4¤-A—÷ß4{ßM»ßSßCßTß1Iß8ßC}}{ß1ß1fß3|¦´x´´y´‡¢-6e¤2Yº2x¤42—÷ß4{ßSßCßTß1IßM»ß8ßC}}{ß1ß1jß3|¦´x´´y´‡¤Po¤gQºQ¤Vw¤RG¤MG¤H6¤GI¤Ha¤CG¤Ke¤9M¤Ky¤84¤WG¤84¤WG¤4q¤Lm¤4q¤M8¤3G¤WN¤48¤Wj¤2G¤Ut¢-Ax¤NN¢-Bh¤Ls¢-H8¤Gp¢-Ip¤Dr¢-Gp—÷ß4{ßM»ßSßPßTß1Iß8ßP}}{ß1ß1vß3|¦´x´´y´‡¤3Oº3E¤9qº3w¤C6º2v—÷ß4{ßSßPßTß1IßM»ß8ßP}}{ß1ß2Nß3|¦´x´´y´‡º2q¤6Iº2q¤Kºk¤Uº43º3Iº41º42º3sº3t—÷ß4{ßSßRßTß1IßM»ß8ßR}}{ß1ß1qß3|¦´x´´y´‡¤Cvº3V¤Bt¢-FS¤BS¢-Ao¤4Mº3D—÷ß4{ßM»ßSßPßTß1Iß8ßP}}{ß1ß1hß3|¦´x´´y´‡¤C6º2v¤5eº2sº2ºgº2wº2¢-6T¤U—÷ß4{ßSßCßTß1IßM»ß8ßC}}{ß1ß1wß3|¦´x´´y´‡¤D4¤-A¤Bm¤8s¤EW¤C1¤E2¤G8¤4q¤M6¤26¤X4¤AA¤g6¤EC¤fw—÷ß4{ßM»ßSßPßTß1Iß8ßP}}{ß1ß28ß3|¦´x´´y´‡º3uº3f¢-Jqº4iº4h¢-CQº35º3v¢-5eº4eº33º3w¤3Oº3E—÷ß4{ßSßQßTß1IßM»ß8ßQ}}{ß1ß27ß3|¦´x´´y´‡º3sº3tº3Oº3rº45º4gº3pº3qº3nº3oº3mº3Cº3Jº3Y¤eº3l¤4Mº3D—÷ß4{ßSßQßTß1IßM»ß8ßQ}}{ß1ß2hß3|¦´x´´y´‡¤Hu¤fm¤Lw¤fcºQ¤Vw—÷ß4{ßM»ßSßGßTß1Iß8ßG}}{ß1ß2Wß3|¦´x´´y´‡¤By¤i0¤G8¤mO¤RQ¤lG¤SE¤o0¤Gw¤p8—÷ß4{ßM»ßSßGßTß1Iß8ßG}}{ß1ß2Xß3|¦´x´´y´‡¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤ZUº2f—÷ß4{ßM»ßSßGßTß1Iß8ßG}}{ß1ß20ß3|¦´x´´y´‡¢-FAº52º3Fº3Tº3Eº3cº37º3Xº3e¢-KAº3f¢-Koº3Rº3Xº52º52—÷ß4{ßSßQßT¨wall_tutorial_window¨ßM»ß8ßQ}}{ß1ß2Aß3|¦´x´´y´‡º52º52º3Fº3Tº3Eº3cº37º3Xº3eº53º3fº54º3Rº3Xº52º52—÷ß4{ßSßQßTß4Cß8ßQ}}{ß1ß3wß3|¦´x´´y´‡º34º4Vº33º4e—÷ß4{ßSß26ßTß2yßM»ß2s»ß8ßQ}}{ß1ß3cß3|¦´x´´y´‡¤Hkº2x¤Gc¢-7a—÷ß4{ßSß1nßTß2yßM»ß2s»ß8ßP}}{ß1ß35ß3|¦´x´´y´‡¤-Lº46Òº2u¤xº32¤1H¢-2u¤w¢-2P¤I¢-2F¤-M¢-2Z—÷ß4{ßSß1aßTß2qß8ßC}}{ß1ß36ß3|¦´x´´y´‡¤2F¤5A¤2Z¤4W¤3N¤4C¤41¤4q¤41¤5o¤3D¤68¤2P¤5y—÷ß4{ßSß1aßTß2qß8ßC}}{ß1ß37ß3|¦´x´´y´‡¢-5p¢-18¢-5fº2¢-4r¢-1w¢-4N¢-1Sº5F¤-o¢-51¤-U¢-5V¤-e—÷ß4{ßSß1aßTß2qß8ßC}}{ß1ß38ß3|¦´x´´y´‡¢-3j¤5K¢-35¤50¢-2H¤50¢-1n¤5e¢-1x¤6c¢-2R¤5y¢-4B¤6G—÷ß4{ßSß1aßTß2qß8ßC}}{ß1ß39ß3|¦´x´´y´‡º4y¤Uº4q¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßSß1aßT¨wall_tutorial_rock_breakable¨ß8ßC}}{ß1ß3Oß3|¦´x´´y´‡¤Mn¢-3H¤Oxº46¤Pu¢-4E¤PPºf¤OEº4G¤Mz¢-6F¤MK¢-4z—÷ß4{ßSß1nßTß2qß8ßP}}{ß1ß3Pß3|¦´x´´y´‡¤Cl¢-48¤Doº32¤Ee¢-47¤Ee¢-5F¤E8¢-6A¤Cjº5Z¤C8¢-52—÷ß4{ßSß1nßTß2qß8ßP}}{ß1ß3Qß3|¦´x´´y´‡¤F9¢-41¤Gm¢-3s¤Ho¢-4Q¤Hq¢-5c¤Gh¢-6V¤Fbº5Z¤Ew¢-59—÷ß4{ßSß1nßTß2qß8ßP}}{ß1ß3Rß3|¦´x´´y´‡¤Iw¢-3q¤Kv¢-3W¤Lp¢-4l¤Lk¢-67¤K1¢-6j¤IT¢-6D¤IA¢-4w—÷ß4{ßSß1nßTß2qß8ßP}}{ß1ß3Sß3|¦´x´´y´‡¤Hkº2x¤JCº31¤JVº3v¤IR¢-A3¤H9¢-AJ¤GJ¢-96¤Gcº55—÷ß4{ßSß1nßTß2qßM»ß8ßP}}{ß1ß3Tß3|¦´x´´y´‡¤DD¢-FZ¤Dr¢-Fb¤EB¢-Fs¤EI¢-GO¤Drº4v¤D8¢-Gn¤Cvº3V—÷ß4{ßSß1nßTß2qß8ßP}}{ß1ß3Uß3|¦´x´´y´‡¤KZ¢-G2¤L2¢-Fn¤Lb¢-G0¤Lf¢-GR¤LJ¢-H1¤Km¢-H2¤KQ¢-GX—÷ß4{ßSß1nßTß2qß8ßP}}{ß1ß3vß3|¦´x´´y´‡º33º4eº5Gº4d¤Kº2y¤1mº4e¤1Sº42¤Aº3fº34º4V—÷ß4{ßSß26ßTß2qßM»ß8ßQ}}{ß1ß40ß3|¦´x´´y´‡¢-VIº4O¢-V8º3D¢-UKº4Vº4Xº50º4Xº2z¢-UUº39¢-Uyº30—÷ß4{ßSß2GßTß2qß8ßR}}{ß1ß41ß3|¦´x´´y´‡¢-OWº5E¢-O2¢-2V¢-NJ¢-2fº4Y¢-2G¢-Mkº34º2q¤-yº3sº5B—÷ß4{ßSß2GßTß2qß8ßR}}{ß1ß42ß3|¦´x´´y´‡¢-TMº34¢-T2º5E¢-SEº6D¢-RQ¢-1m¢-RG¤-y¢-Ru¤-Kº6G¤-U—÷ß4{ßSß2GßTß2qß8ßR}}{ß1ß3Vß3|¦´x´´y´‡¤Fd¤1h¤GZ¤1y¤HJ¤1R¤HJ¤R¤GT¤-G¤FH¤-F¤Ew¤m—÷ß4{ßSß1nßTß2qß8ßP}}{ß1ß3Wß3|¦´x´´y´‡¤Hz¤1m¤J3¤1o¤JH¤19¤JA¤N¤IfÁ¤HlÒ¤Hb¤14—÷ß4{ßSß1nßTß2qß8ßP}}{ß1ß3Xß3|¦´x´´y´‡¤Jl¤1o¤Km¤2V¤Lr¤22¤MF¤h¤LQÒ¤K4¤B¤JX¤c—÷ß4{ßSß1nßTß2qß8ßP}}{ß1ß3Zß3|¦´x´´y´‡¤MQ¤2G¤NY¤2z¤PA¤2y¤Py¤2M¤Pw¤1A¤Oa¤R¤My¤V—÷ß4{ßSß1nßTß2qß8ßP}}{ß1ß3aß3|¦´x´´y´‡¤QR¤2D¤R7ºC¤Rw¤2f¤SI¤1u¤S2¤16¤R7¤l¤QW¤18—÷ß4{ßSß1nßTß2qß8ßP}}{ß1ß3bß3|¦´x´´y´‡¤Sn¤1x¤Uf¤2Jºd¤17¤Vo¤-L¤UV¤-k¤TG¤-G¤Sf¤h—÷ß4{ßSß1nßTß2qß8ßP}}{ß1ß2zß3|¦´x´´y´‡¤4X¤-T¤50¤-K¤4jÎ¤50¤-K¤3OÒ—÷ß4{ßSß1cßTß3kßM»ß8ßC}´z´Ý9}{ß1ß30ß3|¦´x´´y´‡º2v¤-yº2v¢-2aº5Gº3J¤-Uº3G¤-Uº5E¤1N¢-2L¤1Sº32¤5Kº6D—÷ß4{ßSß1cß2k¨enemy_tutorial_bit¨ß2m»ß2nÎß8ßC}}{ß1ß31ß3|¦´x´´y´‡¢-4W¤5eº2w¤3sºf¤-y¢-5K¤-Aº5c¤-yº3m¤3Eº4Z¤4g—÷ß4{ßSß1cß2kß4Eß2m»ß2nÎß8ßC}}{ß1ß32ß3|¦´x´´y´‡¤9Mº34¤9s¤m—÷ß4{ßM»ß5ß46ßSß1eß8ßC}}{ß1ß33ß3|¦´x´´y´‡¤9Mº34¤8q¢-3M—÷ß4{ß5ß46ßSß1eßM»ß8ßC}}{ß1ß34ß3|¦´x´´y´‡¤8E¢-34¤9C¤o¤AU¤U¤9Wº46—÷ß4{ßSß1eßT¨deco¨ß5¨tutorial_door_floor¨ß8ßC}}{ß1ß3Bß3|{´x´º3I´y´¤AA}÷ß4{ßSß1gß2kß43ß2m»ß2nÊß8ßC}}{ß1ß3Cß3|{´x´¢-9M´y´¤6w}÷ß4{ßSß1gß2kß43ß2m»ß2nÊß2s»ß8ßC}}{ß1ß3Dß3|{´x´º4d´y´¤AA}÷ß4{ßSß1gß2kß43ß2m»ß2nÊß2s»ß8ßC}}{ß1ß3Hß3|¦´x´´y´‡¤A6¢-9m¤9g¢-9Q¤A5¢-93¤9gº6U¤BM¢-9O—÷ß4{ßSß1oßTß3kßM»ß8ßP}´z´Ý9}{ß1ß3Iß3|¦´x´´y´‡¤ER¢-5Z¤E8¢-56¤Dnº6X¤E8º6Y¤E8º4q—÷ß4{ßSß1oßT¨icon_tutorial¨ßM»ß8ßP}´z´Ý9}{ß1ß3Jß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßSß1oßTß4HßM»ß8ßP}´z´Ý9}{ß1ß3Yß3|{´x´¤Dz´y´¤Y}÷ß4{ßSß1nß2k¨enemy_tutorial_block¨ß2m»ß2nÊß2s»ß8ßP}}{ß1ß3dß3|¦´x´´y´‡¤Maº4Z¤Lwº4Z¤LIº46¤M4¢-4c¤M5º6Y¤M1º5Z¤KKº2x¤NOº2x¤Mgº2w¤M8º6Y¤M7º6Z—÷ß4{ßSß1lß2kß4Eß2m»ß2nÎß8ßP}}{ß1ß3eß3|¦´x´´y´‡ºQ¤-U¤SO¤y¤RG¤U¤Py¤o¤SYº34¤V8º2t¤Vcº34—÷ß4{ßSß1lß2kß4Eß2nÎß2m»ß8ßP}}{ß1ß3fß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßSß1lß2kß4Eß2m»ß2nÎß8ßP}}{ß1ß3hß3|¦´x´´y´‡¤Ha¤Bm¤EW¤Bc¤C6¤8s¤D4¤1S¤GS¤2Q¤HQ¤1w¤JW¤26¤Ko¤2u¤Lw¤2Q¤K0¤9W—÷ß4{ßSß1lß2kß4Eß2n¤Cß2m»ß8ßP}}{ß1ß3Fß3|¦´x´´y´‡¤76º2y¤6a¢-7m—÷ß4{ßM»ß5ß46ßSß1oß8ßP}}{ß1ß3Gß3|¦´x´´y´‡¤76º2yºW¢-Bu—÷ß4{ßM»ß5ß46ßSß1oß8ßP}}{ß1ß3Eß3|¦´x´´y´‡¤6wº4l¤5yº3n¤7G¢-7k¤8Eº30—÷ß4{ßSß1oßTß4Fß5ß4Gß8ßP}}{ß1ß3gß3|{´x´¤Hb´y´¢-C3}÷ß4{ßSß1lß2k¨enemy_tutorial_4way¨ß2m»ß2nÊß8ßP}}{ß1ß3iß3|{´x´¤R6´y´¤5o}÷ß4{ßSß1lß2k¨enemy_tutorial_down¨ß2m»ß2nÊß8ßP}}{ß1ß3jß3|{´x´¤FM´y´¢-7V}÷ß4{ßSß1mß2kß44ß2m»ß2nÊß8ßP}}{ß1ß3lß3|¦´x´´y´‡¤E6¢-1h¤EB¢-21—÷ß4{ßSß1pßTß3kßM»ß8ßP}´z´Ý9}{ß1ß3mß3|¦´x´´y´‡¤E4¢-1X¤E4º6n—÷ß4{ßSß1pßTß3kßM»ß8ßP}´z´Ý9}{ß1ß3nß3|{´x´¤Eg´y´º4z}÷ß4{ßSß1rß2kß43ß2m»ß2nÊß2s»ß8ßP}}{ß1ß3rß3|{´x´¤Bw´y´º3X}÷ß4{ßSß1rß2kß43ß2m»ß2nÊß2s»ß8ßP}}{ß1ß3oß3|¦´x´´y´‡¤Ba¢-FT¤H1¢-JI¤Gl¢-L3¤E4¢-Lp¤BS¢-Ki¤9f¢-Il¤9j¢-GL—÷ß4{ßSß1rßTß2tß2v£0.BIß8ßP}}{ß1ß3pß3|¦´x´´y´‡¤D8º5v¤EC¢-FN—÷ß4{ßSß1rßTß2wß8ßP}}{ß1ß3sß3|¦´x´´y´‡º3A¢-Eg¢-NE¢-Gw—÷ß4{ßM»ß5ß46ßSß21ß8ßQ}}{ß1ß3tß3|¦´x´´y´‡¢-LIº4fº54º3Y¢-Mu¢-H6º4nºm—÷ß4{ßSß21ßTß4Fß5ß4Gß8ßQ}}{ß1ß47ß3|¦´x´´y´‡¤Lw¤fc¤EC¤fw—÷ß4{ßSß2VßTß2wß8ßG}}{ß1ß48ß3|¦´x´´y´‡¤HQ¤GI¤E2¤G8—÷ß4{ßSß2RßTß2wß8ßG}}{ß1ß3Kß3|¦´x´´y´‡¤Gh¢-43¤G8º2s¤FPº3G—÷ß4{ßSß1kßTß4Bß8ßP}}{ß1ß3Lß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Keº2—÷ß4{ßSß1kßTß4Bß8ßP}}{ß1ß3Mß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Ojº5A¤P3¢-5i¤Tdº5k¤PE¢-4S¤OX¢-3f¤OCº34¤N9º32—÷ß4{ßSß1kßTß4Bß8ßP}}{ß1ß3Nß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßSß1kßTß4Bß8ßP}}{ß1ß3Aß3|¦´x´´y´‡º5P¤6Gº2x¤42º2y¤50º7A¤83º30¤BIº31¤D4º32¤B8º4p¤7A—÷ß4{ßM»ßSß1gßTß1Iß8ßC}}{ß1ß3qß3|¦´x´´y´‡¤Gpº4u¤GZº4D¤E4¢-LR¤Bcº4P¤A0º4b¤A3¢-GT¤Btº4w—÷ß4{ßM»ßSß1rßTß1Iß8ßP}}÷¨icons¨|÷}");
