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
export const TEST_MAP: map_type = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢3Ng´y´¢WQ}÷¨options¨{¨style¨ß2¨contains¨|¨home floor¨÷¨room_id¨´´¨is_room¨»}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ßA¨room_connections¨|¨tutorial room 1¨÷ß9»ß8´´}}{ß1¨station¨ß3|{´x´¢1RC´y´¢1NU}÷ß4{ßB|¨station tutorial¨¨station streets¨¨tutorial room 5¨¨streets side room 1¨÷ß6|¨train¨ßE¨station tracks¨ßF¨station tracks particle¨÷ß8´´ß9»}}{ß1¨streets¨ß3|{´x´¢1f4´y´¢-D4}÷ß4{ß8´´ß6|¨streets room 1¨ßH÷}}{ß1¨test group¨ß3|{´x´¢6x´y´¢7q}÷ß4{ß6|¨test 1¨÷¨open_loop¨«ß5¨test¨ßB|÷ß9»ß8´´}}{ß1¨tutorial¨ß3|{´x´¢-WG´y´ºA}÷ß4{ß6|ßC¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨ßG÷ß8´´}}{ß1ß7ß3|¦´x´´y´‡¢3sk¢Bs¢3Xu¢2m¢3FVºE¢30C¢6M¢2pO¢Gd¢2mE¢TN¢2py¢ip¢2zv¢sv—÷ß4{¨parent¨ß2¨make_id¨¨floor¨ß8ß2}}{ß1ßFß3|{´x´¢1cy´y´¢11i}÷ß4{ßVßDß6|¨station streets rock 1¨¨station streets rock 2¨¨station streets rock 3¨¨station streets sensor start¨¨station streets rock 0¨¨station streets sensor end¨¨station streets rock block¨¨station streets rock 4¨¨station streets rock 5¨¨station streets rock 6¨¨station streets rock 7¨¨station streets rock 8¨¨station streets floor 1¨¨station streets floor 1.5¨¨station streets floor 2¨¨station streets floor 2.5¨¨station streets floor 3¨¨station streets floor 3.5¨¨station streets wall 1¨¨station streets wall 2¨¨station streets wall 3¨¨station streets floor 0¨¨station streets floor 4¨¨station streets floor 5¨¨station streets floor 4.5¨¨station streets wall 5¨¨station streets wall 6¨¨station streets wall 7¨¨station streets wall 8¨¨station streets wall 9¨¨station streets wall 10¨¨station streets wall 11¨¨station streets wall 13¨¨station streets rocky 1¨¨station streets wall fake 1¨¨station streets wall 14¨¨station streets floor 4.1¨¨station streets wall 12¨÷ß8ßDß9»ßB|ßDßMßH÷}}{ß1ßJß3|¦´x´´y´‡¢T2¢12W¢3U8ºTºU¢13KºSºV—÷ß4{ßVßDßW¨floor_train_track¨ß8ßD¨sensor_dont_set_room¨»}}{ß1ßKß3|¦´x´´y´‡ºSºTºSºV—÷ß4{ßVßDßWß1Aß8ßDß1B»}}{ß1ßEß3|{´x´¢VS´y´¢yA}÷ß4{ßVßDß6|¨station tutorial floor¨¨station tutorial sensor start¨¨station tutorial wall 1¨¨station tutorial wall 2¨¨station tutorial rock 1¨¨station tutorial rock 2¨¨station tutorial rock 3¨¨tutorial floor low¨¨station tutorial sensor end¨÷ß8ßDß9»ßB|ßGßD÷}}{ß1ßMß3|{´x´¢1zO´y´¢rO}÷ß4{ßVßLß8´´ß9»ßB|ßF÷ß6|¨streets room 1 wall 2¨¨streets room 1 wall 1¨¨streets room 1 camera 1¨¨streets room 1 sensor start¨¨streets room 1 camera 2¨¨streets room 1 camera 0¨¨streets room 1 floor¨÷}´z´£0.-84}{ß1ßHß3|{´x´¢1wo´y´¢1C2}÷ß4{ßVßLß8´´ß9»ßB|ßFßD÷ß6|¨streets side room 1 floor¨¨streets side room 1 wall 1¨¨streets side room 1 wall 2¨¨streets side room 1 wall fake 1¨÷}´z´£0.-6S}{ß1ßOß3|¦´x´´y´‡¢7c¢46¢8u¢88—÷ß4{ßVßNßP»ßW¨wall¨ß5ßQß6|¨test 2¨÷ß8ßN}}{ß1ßIß3|¦´x´´y´‡¢Qc¢10u¢TRºh—{´x´ºi´y´ºh´z´£0.4q}{´x´¢Vr´y´ºh´z´Ý2}{´x´ºj´y´ºh}{´x´¢Yg´y´ºh}{´x´ºk´y´ºh´z´£0.84}{´x´ºg´y´ºh´z´Ý3}÷ß4{ßVßDßW¨wall_train¨ß6|¨train floor broken¨¨train wall 1¨¨train wall 2¨¨train wall 3¨¨train ceiling¨¨train sensor¨¨train door right¨¨train door right path¨¨train door left¨¨train door left path¨¨train floor¨¨train floor broken top¨¨train floor broken bottom¨¨train floor broken middle¨÷¨seethrough¨»ß8ßD}}{ß1ßCß3|{´x´¢-68´y´¢-50}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨¨tutorial room 1 floor¨÷ßVßRß9»ßB|ßSßUßAßT÷ß8´´}}{ß1ßSß3|{´x´¢OW´y´¢-DO}÷ß4{ßVßRß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨home wow test wow¨¨tutorial room 2 floor¨¨tutorial room 2 floor platform¨÷ß9»ßB|ßGßCßT÷ß8´´}}{ß1ßTß3|{´x´¢-JM´y´¢-Tg}÷ß4{ßVßRß6|¨tutorial window 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨¨tutorial room 3 floor¨¨tutorial room 3 enemy 1¨÷ß9»ßB|ßTßUßSßC÷ß8´´}}{ß1ßUß3|{´x´¢-Z0´y´¢-Gc}÷ß4{ßVßRß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨¨tutorial room 4 floor¨÷ß9»ßB|ßTßC÷ß8´´}}{ß1ßGß3|{´x´¢9t´y´¢GK}÷ß4{ßVßRß6|¨tutorial room 5 sensor boss¨¨tutorial room 5 door start¨¨tutorial room 5 sensor boss start¨¨tutorial room 5 boss¨¨tutorial room 5 floor¨¨tutorial room 5 door end¨¨tutorial wall 15¨¨tutorial wall 16¨¨tutorial rock 23¨¨tutorial room 5 enemy¨¨tutorial rock 24¨¨tutorial rock 25¨¨tutorial rock 26¨¨tutorial rock 27¨¨tutorial room 5 switch path¨¨tutorial room 5 sensor middle¨¨tutorial room 5 sensor boss end¨¨tutorial wall 14¨¨tutorial room 5 rocky 3¨¨tutorial fake wall 5¨÷ß9»ßB|ßSßEßD÷ß8´´}}{ß1ß2Bß3|{´x´¢Ii´y´¢3i}÷ß4{ßVßS¨spawn_enemy¨¨checkpoint¨¨is_spawner¨»¨spawn_repeat¨Êß8ßS}}{ß1ßtß3|¦´x´´y´‡¢1Qi¢vuºx¢1Aa¢1RWºzº10ºy—÷ß4{ßVßFßWßXß8ßF}´z´£0.-1c}{ß1ßkß3|¦´x´´y´‡¢1Qs¤wOº11¢18y¢1Uk¢1Fk¢1dI¤pc—÷ß4{ßVßFßWßXß8ßF¨safe_floor¨»ß5¨wall_floor¨}´z´Ý4}{ß1ßlß3|¦´x´´y´‡º15¤pcº13º14—{´x´º13´y´º14´z´£0.-3E}{´x´º15´y´¤pc´z´Ý5}÷ß4{ßVßFßWß33ß8ßF}´z´Ý4}{ß1ßmß3|¦´x´´y´‡º15¤pcº13º14¢1fOº14¢1ks¤pc—÷ß4{ßVßFßWßXß8ßFß32»ß5ß33}´z´Ý5}{ß1ßnß3|¦´x´´y´‡º17¤pcº16º14—{´x´º16´y´º14´z´£0.-4q}{´x´º17´y´¤pc´z´Ý6}÷ß4{ßVßFßWß33ß8ßF}´z´Ý5}{ß1ßoß3|¦´x´´y´‡º17¤pcº16º14¢1xI¢1DK¢1us¤ri—÷ß4{ßVßFßWßXß8ßFß32»ß5ß33}´z´Ý6}{ß1ßpß3|¦´x´´y´‡º1A¤riº18º19—{´x´º18´y´º19´z´Ý1}{´x´º1A´y´¤ri´z´Ý1}÷ß4{ßVßFßWß33ß8ßF}´z´Ý6}{ß1ßuß3|¦´x´´y´‡º1A¤riº18º19—{´x´¢20g´y´¢1Ak´z´Ý1}{´x´¢21o´y´ºz´z´Ý1}{´x´¢202´y´¢1DU}{´x´¢27S´y´¢1De´z´Ý1}{´x´¢23u´y´¤uw}÷ß4{ßVßFßWßXß8ßFß32»}´z´Ý1}{ß1ß18ß3|{´x´º1I´y´¤uw´z´Ý1}{´x´º1G´y´º1H}÷ß4{ßVßFßW¨wall_floor_halfwidth¨ß8ßF}´z´Ý1}{ß1ßwß3|¦´x´´y´‡º1I¤uwº1Gº1H—{´x´º1G´y´º1H´z´Ý0}{´x´º1I´y´¤uw´z´Ý0}÷ß4{ßVßFßWß33ß8ßF}´z´Ý1}{ß1ßvß3|{´x´º1I´y´¤uw´z´Ý0}{´x´º1G´y´º1H}{´x´¢2LA´y´¢12v´z´Ý0}{´x´¢294´y´¤uw}÷ß4{ßVßFßWßXß8ßFß32»}´z´Ý0}{ß1ßcß3|¦´x´´y´‡¢1Uu¢15Q¢1VE¢19S¢1SU¢172—÷ß4{ßVßFßW¨rock¨ß8ßF}´z´Ý4}{ß1ßYß3|¦´x´´y´‡¢1ZQ¤xq¢1YS¢106—{´x´¢1WM´y´¤yU´z´Ý4}÷ß4{ßVßFßWß35ß8ßF}´z´Ý4}{ß1ßZß3|¦´x´´y´‡¢1d8¢15a¢1b5¢19l¢1Yp¢15F—÷ß4{ßVßFßWß35ß8ßF}´z´Ý5}{ß1ßaß3|¦´x´´y´‡¢1fb¤zl¢1cK¢10G¢1df¤xV—÷ß4{ßVßFßWß35ß8ßF}´z´Ý5}{ß1ßfß3|¦´x´´y´‡¢1nI¢16s¢1im¢19cº17º1N—÷ß4{ßVßFßWß35ß8ßF}´z´Ý6}{ß1ßgß3|¦´x´´y´‡¢1sc¢10kº1g¢10Q¢1qh¤vx—÷ß4{ßVßFßWß35ß8ßF}´z´Ý6}{ß1ßhß3|¦´x´´y´‡¢1uEº1N¢1tQ¢16iº1k¢15G—÷ß4{ßVßFßWß35ß8ßF}´z´Ý6}{ß1ßiß3|¦´x´´y´‡¢244¢1A6¢1yuº1P¢22Iº1N—÷ß4{ßVßFßWß35ß8ßF}´z´Ý1}{ß1ßjß3|{´x´¢1xw´y´¤xq}{´x´º1D´y´¤yU´z´Ý1}{´x´º1u´y´º1m}÷ß4{ßVßFßWß35ß8ßFßP»}´z´Ý1}{ß1ßeß3|¦´x´´y´‡¢2Hwº1K¢29s¢16Yº1y¤zI—÷ß4{ßVßFßWß35ß8ßF}´z´Ý0}{ß1ß15ß3|{´x´¢2CN´y´¢169}÷ß4{ßVßFß2y¨enemy_streets_rocky_small¨ß30»ß31Êß8ßF¨spawn_permanent¨»}´z´Ý0}{ß1ßdß3|¦´x´´y´‡¢2Ei¤vGº22¢1CC¢1mUº23º24¤vG—÷ß4{ßVßFßW¨sensor¨ß8ßF}´z´Ý0}{ß1ßbß3|¦´x´´y´‡¢1Ty¤v5¢1UGº19ºxº23º11¤vG—÷ß4{ßVßFßWß38ß8ßF}}{ß1ßqß3|¦´x´´y´‡º1I¤uw¢1vM¤w4—÷ß4{ßP»ßVßFßWß1Wß8ßF}´z´Ý1}{ß1ßrß3|{´x´¢1ce´y´¤rY}{´x´ºx´y´¤wO´z´Ý4}{´x´ºx´y´ºh}÷ß4{ßP»ßVßFßWß1Wß8ßF}´z´Ý4}{ß1ßsß3|¦´x´´y´‡¢1ja¤vkº28¤rY—÷ß4{ßP»ßVßFßWß1Wß8ßF}´z´Ý5}{ß1ßxß3|¦´x´´y´‡¢1VYº19ºxº12—{´x´ºx´y´¢14w´z´Ý4}÷ß4{ßP»ßVßFßWß1Wß8ßF}´z´Ý4}{ß1ßyß3|¦´x´´y´‡¢1g2¢1Cgº2Aº19—÷ß4{ßP»ßVßFßWß1Wß8ßF}´z´Ý5}{ß1ßzß3|{´x´¢1wy´y´ºz´z´Ý6}{´x´¢1oQ´y´¢1Au}{´x´º2C´y´º2D}÷ß4{ßP»ßVßFßWß1Wß8ßF}´z´Ý6}{ß1ß10ß3|¦´x´´y´‡º27¤w4¢1pi¤tUº29¤vk—÷ß4{ßP»ßVßFßWß1Wß8ßF}´z´Ý6}{ß1ß11ß3|¦´x´´y´‡ºxº2Bºxº12—÷ß4{ßP»ßVßFßWß1Wß8ßF}´z´Ý0}{ß1ß12ß3|{´x´ºx´y´¤wO´z´Ý0}{´x´ºx´y´ºh}÷ß4{ßP»ßVßFßWß1Wß8ßF}´z´Ý0}{ß1ß13ß3|¦´x´´y´´z´‡¢26o¢1AGÝ1º1D¢1AQÝ1¢1ya¢1FQÝ1—÷ß4{ßP»ßVßFßWß1Wß8ßF}´z´Ý1}{ß1ß19ß3|¦´x´´y´‡¢1weº2M¢1zsº2Gº2Eºz—÷ß4{ßP»ßVßFßWß1Wß8ßF}´z´Ý1}{ß1ß14ß3|¦´x´´y´‡¢2D6¢156º2Pº1zº1y¢19mº2Iº2J—÷ß4{ßP»ßVßFßWß1Wß8ßF}´z´Ý0}{ß1ß17ß3|¦´x´´y´‡º1G¤umº1L¤uwº1y¤w4—{´x´º2P´y´¤zI´z´Ý0}{´x´º2P´y´º1l}÷ß4{ßP»ßVßFßWß1Wß8ßF}´z´Ý0}{ß1ß16ß3|{´x´º1w´y´¤xq}{´x´º1u´y´º1m´z´Ý1}÷ß4{ßVßFßW¨wall_streets_fake¨ßP»ß37»ß8ßF}´z´Ý1}{ß1ß1Cß3|¦´x´´y´‡¤am¤w4¤ZU¤w4¤RG¤w4¤Gw¤yy¤Gw¢17MºWº2SºW¢18e¤X4º2T¤X4º2S¤amº2S¤am¢130—÷ß4{ßVßEßWßXß32»ß8ßE}}{ß1ß1Gß3|¦´x´´y´‡¢14S¤tAº1R¤uw¢17g¤y0º2Qº1m¢11s¤zmº1e¤xC¢11O¤uI—÷ß4{ßVßEßWß35ß8ßE}´z´Ý0}{ß1ß1Hß3|¦´x´´y´‡¢1Emº1N¢1GO¢164¢1Giº2Wº14¢19I¢1Dy¢198¢1Cqº2Wº19º2b—÷ß4{ßVßEßWß35ß8ßE}´z´Ý0}{ß1ß1Iß3|¦´x´´y´‡¢1K6¤xM¢1LE¤xq¢1LY¤yy¢1Kkº1m¢1J8º1U¢1IK¤yo¢1Iy¤xg—÷ß4{ßVßEßWß35ß8ßE}´z´Ý0}{ß1ß1Kß3|¦´x´´y´‡º5¤vGº5º23¢1PQº23º2o¤vG—÷ß4{ßVßEßWß38ß8ßE}}{ß1ß1Dß3|¦´x´´y´‡ºS¤wY¤KK¤yy¤KKº1eºSº1e¤Ue¤zm¤WGº1e¤ZU¤wY—÷ß4{ßVßEßWß38¨sensor_fov_mult¨Êß8ßE}}{ß1ß1Eß3|¦´x´´y´‡¤RG¤w4¤Op¤wi—÷ß4{ßP»ßVßEßWß1Wß8ßE}}{ß1ß1Fß3|¦´x´´y´‡¤Mk¤xM¤Gw¤yy¤Gwº2S¤ZUº2S¤ZU¢15k—÷ß4{ßP»ßVßEßWß1Wß8ßE}}{ß1ß1Qß3|{´x´¢2CI´y´¤zS}÷ß4{ßVßMß2y¨enemy_streets_camera_small¨ß30»ß31Êß8ßM}´z´Ý0}{ß1ß1Nß3|{´x´¢24O´y´¤to}÷ß4{ßVßMß2yß3Bß30»ß31Êß8ßM}´z´Ý0}{ß1ß1Pß3|{´x´¢27I´y´¤mE}÷ß4{ßVßMß2yß3Bß30»ß31Êß8ßM}´z´Ý0}{ß1ß1Rß3|¦´x´´y´‡º1I¤uw¢29O¤v6º1G¤nC—{´x´¢2OO´y´¤nC´z´Ý0}{´x´¢28G´y´¤OC}{´x´¢1s8´y´¤nC´z´Ý0}{´x´º1v´y´¤nC}÷ß4{ßVßMßWßXß8ßMß32»}´z´Ý0}{ß1ß1Oß3|{´x´¢23Q´y´¤te}{´x´º2x´y´¤sq´z´Ý0}{´x´º1y´y´¤sq´z´Ý0}{´x´º1y´y´¤te}÷ß4{ßVßMßWß38ß8ßMß3A£0.Cu}´z´Ý0}{ß1ß1Mß3|¦´x´´y´‡¢25C¤iWº1v¤nCº1I¤uw—{´x´¢25q´y´¤um´z´Ý0}{´x´¢23k´y´¤uS}÷ß4{ßP»ßVßMßWß1Wß8ßM}´z´Ý0}{ß1ß1Lß3|¦´x´´y´‡¢2EY¤ga¢2A2¤iWº1G¤nC¢28u¤uSº1G¤um—÷ß4{ßP»ßVßMßWß1Wß8ßM}´z´Ý0}{ß1ß1Sß3|{´x´º2O´y´º2G}{´x´º1D´y´º2K´z´Ý1}{´x´º1G´y´º1H´z´Ý1}{´x´º33´y´¢1FG}{´x´¢2Cm´y´º1Q´z´Ý1}{´x´¢1yG´y´¢1TI}{´x´º2N´y´º2M}÷ß4{ßVßHßWßXß8ßHß32»}´z´Ý1}{ß1ß1Tß3|¦´x´´y´‡º1D¢1S0º2Nº2M—÷ß4{ßP»ßVßHßWß1Wß8ßH}´z´Ý1}{ß1ß1Uß3|¦´x´´y´´z´‡º2Lº2MÝ1¢252¢1G4Ý1—{´x´¢210´y´º1H}{´x´¢22S´y´º1C}{´x´¢26e´y´ºz}{´x´¢27c´y´º2M}{´x´¢26K´y´¢1F6}{´x´º2z´y´º2g}{´x´¢22c´y´¢1DA´z´Ý1}{´x´º3D´y´¢1Fa}{´x´º3D´y´¢1GE}{´x´º2v´y´º2a}÷ß4{ßP»ßVßHßWß1Wß8ßH}´z´Ý1}{ß1ß1Vß3|{´x´º39´y´º3A}{´x´º3D´y´º3K´z´Ý1}÷ß4{ßVßHßWß39ßP»ß37»ß8ßH}´z´Ý1}{ß1ß1Xß3|¦´x´´y´‡¤8w¤4r¤9s¤7u—÷ß4{ßVßOßP»ßWß1Wß5ßQß8ßN}}{ß1ß1dß3|¦´x´´y´‡ºkºhºgºhºgº2Bºkº2B—÷ß4{ßVßIßWß1YßX»ß8ßDß1B»}´z´Ý3}{ß1ß1hß3|¦´x´´y´‡¤SEºhºiºh—{´x´ºi´y´ºh´z´Ý2}{´x´¤SE´y´ºh´z´Ý2}÷ß4{ßVßIßWß1Yß8ßD}}{ß1ß1iß3|¦´x´´y´‡ºiºh¤Ueºh—÷ß4{ßVßIßW¨sensor_path¨ß8ßD}}{ß1ß1fß3|¦´x´´y´‡ºjºh¤X4ºh—{´x´¤X4´y´ºh´z´Ý2}{´x´ºj´y´ºh´z´Ý2}÷ß4{ßVßIßWß1Yß8ßD}}{ß1ß1gß3|¦´x´´y´‡ºjºh¤Ueºh—÷ß4{ßVßIßWß3Cß8ßD}}{ß1ß1jß3|¦´x´´y´‡ºkºhºgºhºgº2Bºkº2B—÷ß4{ßVßIßW¨floor_train¨ß8ßDß1B»}}{ß1ß1Zß3|¦´x´´y´‡ºkºh¤SEºh¤Ru¢122¤SE¢13U¤SEº2Bºkº2B—÷ß4{ßVßIßWß3Dß8ßDß1B»}}{ß1ß1lß3|¦´x´´y´‡ºgº2B¤SEº2B¤SEº3Mºg¢13A—÷ß4{ßVßIßWß3Dß8ßDß1B»}}{ß1ß1mß3|¦´x´´y´‡ºgº3N¤SEº3M¤Ruº3LºgºT—÷ß4{ßVßIßWß3Dß8ßDß1B»}}{ß1ß1kß3|¦´x´´y´‡ºgºT¤Ruº3L¤SEºhºgºh—÷ß4{ßVßIßWß3Dß8ßDß1B»}}{ß1ß1eß3|¦´x´´y´‡¤Qm¢114¤Qm¢14m¤YWº3P¤YWº3O—÷ß4{ßVßIßWß38ß8ßDß1B»}}{ß1ß1aß3|{´x´ºk´y´ºh}{´x´ºk´y´ºh´z´Ý3}{´x´ºk´y´º2B´z´Ý3}{´x´ºk´y´º2B}÷ß4{ßVßIßWß1Yß8ßD}}{ß1ß1bß3|{´x´ºg´y´ºh}{´x´ºg´y´ºh´z´Ý3}{´x´ºg´y´º2B´z´Ý3}{´x´ºg´y´º2B}÷ß4{ßVßIßWß1Yß8ßD}}{ß1ß1cß3|¦´x´´y´‡ºgº2Bºkº2B—{´x´ºk´y´º2B´z´Ý3}{´x´ºg´y´º2B´z´Ý3}÷ß4{ßVßIßWß1Yß8ßD}}{ß1ß26ß3|¦´x´´y´‡¤Lm¤4q¤Ky¤84—÷ß4{ßVßSßW¨wall_tutorial_fake¨ßP»ß37»ß8ßS}}{ß1ß2cß3|¦´x´´y´‡¢-M6¤-U¢-NY¤K—÷ß4{ßVßUßWß3EßP»ß37»ß8ßU}}{ß1ß2xß3|¦´x´´y´‡¤AA¤g6¤By¤i0—÷ß4{ßVßGßWß3EßP»ß37»ß8ßG}}{ß1ß1Jß3|{´x´ºx´y´¤wO´z´Ý0}{´x´ºx´y´º12}{´x´¤ye´y´¢1Ec}{´x´¤yU´y´¤qQ}÷ß4{ßVßEßWßXß8ßE}´z´Ý0}{ß1ß2mß3|¦´x´´y´‡¤CQ¤ga¤DE¤gQ¤EM¤gu¤EW¤hs¤E2¤iM¤DO¤iW¤Ck¤iC—÷ß4{ßVßGßWß35ßP»ß8ßG}}{ß1ß2oß3|¦´x´´y´‡¤SO¤oe¤TC¤pSºS¤qa¤S4¤qu¤Qw¤qaºg¤pS¤RG¤oU—÷ß4{ßVßGßWß35ß8ßG}}{ß1ß2pß3|¦´x´´y´‡¤SiºZºS¤sM¤SY¤tA¤Ra¤tK¤Qw¤sg¤Qw¤ri¤Rk¤rE—÷ß4{ßVßGßWß35ß8ßG}}{ß1ß2qß3|¦´x´´y´‡¤Ss¤tU¤Tq¤uS¤Tg¤vk¤Si¤wY¤Rk¤wE¤R6¤v6¤Ra¤ty—÷ß4{ßVßGßWß35ß8ßG}}{ß1ß2rß3|¦´x´´y´‡¤OC¤vQ¤Og¤wE¤OM¤x2¤NO¤xM¤Ma¤ws¤MQºy¤NE¤vG—÷ß4{ßVßGßWß35ß8ßG}}{ß1ß1qß3|{´x´¢-2Q´y´º3}÷ß4{ßVßCß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷ß8ßC}}{ß1ß1sß3|¦´x´´y´‡¤6w¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßVßCß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßWß38ß3A£0.EWß8ßC}}{ß1ß1wß3|¦´x´´y´‡¤D4¤-A¤C6¢-42¤5eº3Tº2ºm¢-6Iº2¢-6m¤42¢-9q¤50¢-Bm¤84¢-Bc¤BI¢-7Q¤D4¢-3Y¤B8¢-26¤84¤4C¤6w¤6c¤1S—÷ß4{ßVßCßWßXß32»ß8ßC}}{ß1ß1oß3|{´x´ºm´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß3P÷ßVßCß8ßC}}{ß1ß1rß3|¦´x´´y´‡¤5eº3Tº2ºmº3Xº2º3Y¤42º3e¤84¤4C¤6w¤6c¤1S—÷ß4{ßVßCßWß38ß3AÊß8ßC}}{ß1ß1uß3|{´x´¢-BI´y´¤4q}÷ß4{ß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßVßCß8ßC}}{ß1ß22ß3|¦´x´´y´‡¤5e¢-CG¤4g¢-8O¤8Yº3c¤9Wº3g¤F9¢-HE¤9W¢-BS—÷ß4{ßVßSßWß38ß3AÝ8ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷ß8ßS}}{ß1ß2Cß3|¦´x´´y´‡¤Gw¢-Ky¤EC¢-Lc¤BS¢-KU¤4M¢-Ca¤3O¢-8i¤C6º3W¤D4¤-A¤Bm¤8s¤E2¤G8¤H6¤GI¤Ke¤9M¤WG¤84¤Wu¤2G¤Uy¢-Ay—÷ß4{ßVßSßWßXß32»ß8ßS}}{ß1ß2Dß3|¦´x´´y´‡¤Wu¢-4C¤Waº3c—{´x´¤Vw´y´¢-5o´z´£0.3E}÷ß4{ßVßSßWßXß8ßS}´z´Ý9}{ß1ß1yß3|{´x´¤G8´y´º3d}÷ß4{ßVßSß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷ß8ßS}}{ß1ß21ß3|{´x´¤KA´y´¢-5A}÷ß4{ßVßSß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷ß8ßS}}{ß1ß27ß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßVßSßWß38ß8ßS}}{ß1ß1zß3|{´x´¤Ss´y´¤-y}÷ß4{ßVßSß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ß8ßS}}{ß1ß20ß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßVßSßWß3Cß6|¨tutorial room 2 switch¨÷ß8ßS}}{ß1ß23ß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGº3T—÷ß4{ßVßSßW¨icon¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷ß8ßS}´z´£0.1c}{ß1ß25ß3|{´x´¤AU´y´¢-K0}÷ß4{ßVßSß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷ß8ßS}}{ß1ß28ß3|¦´x´´y´‡¤CQ¤y¤Ds¤FU¤HQ¤FU¤FU¤y—÷ß4{ßVßSßWß38ß3AÝ8ß8ßS}}{ß1ß2Fß3|¦´x´´y´‡¢-Lm¢-IY¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßVßTßWß38ß3A£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷ß8ßT}}{ß1ß2Nß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FKº3q¢-Ds¢-8s¢-Fe¢-8Yº48¢-A0º3y¢-DY¢-Ke—÷ß4{ßVßTßWß38ß8ßT}}{ß1ß2Qß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßVßTß2y¨enemy_tutorial_easy¨ß30»ß31Êß8ßT}}{ß1ß2Gß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßVßTß2yß4Aß30»ß31Êß8ßT}}{ß1ß2Pß3|¦´x´´y´‡¤3Oº3p¤4Mº3o¤e¢-GI¢-4Mº3n¢-84¢-Oq¢-EC¢-PAº3z¢-I4¢-OM¢-FU¢-MQº4Gº3g¢-9Cº3e¢-76—÷ß4{ßVßTßWßXß32»ß8ßT}}{ß1ß2Kß3|¦´x´´y´‡º3Xº4O¤2F¢-5T¤4qº4A¢-3F¢-Hl—÷ß4{ßVßTßWß38ß3AÝBß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷ß8ßT}}{ß1ß2Vß3|{´x´¢-L4´y´¤49}÷ß4{ßVßUß2y¨enemy_tutorial_rock_room4¨ß30»ß31Êß8ßU}}{ß1ß2dß3|¦´x´´y´‡º4Vº4Gº4Tº4U¢-W6¢-Ck¢-Ygº3tºq¤Uº3R¤Kº3R¤7G¢-Is¤7Gº4f¤34º3Q¤-U¢-J2¢-3Oº48º3p—÷ß4{ßVßUßWßXß32»ß8ßU}}{ß1ß2Sß3|{´x´¢-QI´y´¢-7G}÷ß4{ßVßUß2y¨collect_gun_basic¨ß30»ß31Êß37»ß8ßU}}{ß1ß2Tß3|{´x´º4i´y´º4j}÷ß4{ßVßUß2y¨deco_gun_basic¨ß30»ß31Êß8ßU}}{ß1ß2Zß3|¦´x´´y´‡¢-Kz¢-6w¢-Kj¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßVßUßWß40ß8ßU}}{ß1ß2Uß3|{´x´¢-Ue´y´¢-C6}÷ß4{ßVßUß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷ß8ßU}}{ß1ß2Xß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßVßUß2y¨enemy_tutorial_rocky¨ß30»ß31Êß37»ß8ßU}}{ß1ß2Yß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßVßUß2yß4Jß30»ß31Êß37»ß8ßU}}{ß1ß2Rß3|¦´x´´y´‡¢-OK¢-FkºA¢-Cu¢-Yqº3t¢-Tq¤e¢-Ma¤Uº4f¢-3E¢-IEº4C—÷ß4{ßVßUßWß38ß3A£1.4qß8ßU}}{ß1ß2Wß3|{´x´¢-Ic´y´¤16}÷ß4{ßVßUß2y¨switch¨ß30»ß31Êß8ßU}}{ß1ß2hß3|{´x´¤Fy´y´¤TW}÷ß4{ßVßGß2y¨enemy_tutorial_boss¨ß30»ß31Êß8ßGß37»}}{ß1ß2jß3|¦´x´´y´‡¤Pe¤fS¤Lw¤fc—÷ß4{ßP»ß5¨tutorial_door¨ßVßGß6|¨tutorial room 5 door end path¨÷ß8ßG}}{ß1ß2fß3|¦´x´´y´‡¤KU¤GS¤HQ¤GI—÷ß4{ßP»ß5ß4MßVßGß6|¨tutorial room 5 door start path¨÷ß8ßG}}{ß1ß2nß3|{´x´¤Tx´y´¤gx}÷ß4{ßVßGß2y¨enemy_tutorial_easy_static¨ß30»ß31Êß8ßG}}{ß1ß2iß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºS¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fw¤Ue¤fw¤Vc¤jA¤Wu¤jA¤XO¤km¤W6¤km¤X4¤o0¤YM¤o0¤am¤w4¤ZU¤wE¤RG¤w4¤Gw¤yy¤F0¤nC¤92¤h4¤9M¤gG¤AA¤g6¤1w¤X4¤4q¤M6—÷ß4{ßVßGßWßXß32»ß8ßG}}{ß1ß2wß3|{´x´¤WV´y´¤jy}÷ß4{ßVßGß2y¨enemy_tutorial_rocky_small¨ß30»ß31Êß8ßGß37»}}{ß1ß2eß3|¦´x´´y´‡¤1w¤Ko¤1w¤cEºS¤bQ¤TM¤LI—÷ß4{ßVßGßWß38ß8ßG}}{ß1ß2uß3|¦´x´´y´‡¤8s¤eK¤9g¤fI¤MG¤eo¤N4¤dq—÷ß4{ßVßGßWß38ß3AÝCß8ßG}}{ß1ß2gß3|¦´x´´y´‡¤DE¤Gm¤CG¤HQ¤JC¤Hk¤IE¤H6—÷ß4{ßVßGßWß38ß3AÝCß8ßG}}{ß1ß2tß3|¦´x´´y´‡¤DE¤g6¤Eg¤gu¤Kr¤ga¤V1¤fk¤ZU¤um¤Gc¤um¤H6¤ye¤Qwºy¤aI¤vW¤VI¤fI—÷ß4{ßVßGßWß38ß3AÊß8ßG}}{ß1ß2sß3|¦´x´´y´‡¤NE¤vG¤MkºZ—÷ß4{ßVßGßWß3Cß8ßG}}{ß1ß2Hß3|¦´x´´y´‡º4zº4Wº7¢-9gº3a¢-B8—÷ß4{ßVßTßW¨spike¨ß8ßT}}{ß1ß2Iß3|¦´x´´y´‡º4f¢-EW¢-JWº4U¢-HG¢-G8—÷ß4{ßVßTßWß4Rß8ßT}}{ß1ß2Jß3|¦´x´´y´‡¢-Af¢-PH¢-Bw¢-PKº3g¢-NO—÷ß4{ßVßTßWß4Rß8ßT}}{ß1ß2aß3|¦´x´´y´‡¢-Iu¤5Sº4f¤34º3Q¤-Uº4gº4hº48º3pº4Vº4G—÷ß4{ßVßUßWß1WßP»ß8ßU}}{ß1ß1pß3|¦´x´´y´‡¢-38¤7Aº3e¤84¤4C¤6w¤6c¤1S¤D4¤-A—÷ß4{ßP»ßVßCßWß1Wß8ßC}}{ß1ß1tß3|¦´x´´y´‡¢-6e¤2Yº3Y¤42—÷ß4{ßVßCßWß1WßP»ß8ßC}}{ß1ß1xß3|¦´x´´y´‡¤Po¤gQºS¤Vw¤RG¤MG¤H6¤GI¤Ha¤CG¤Ke¤9M¤Ky¤84¤WG¤84¤WG¤4q¤Lm¤4q¤M8¤3G¤WN¤48¤Wj¤2G¤Ut¢-Ax¤NN¢-Bh¤Ls¢-H8¤Gp¢-Ip¤Dr¢-Gp—÷ß4{ßP»ßVßSßWß1Wß8ßS}}{ß1ß29ß3|¦´x´´y´‡¤3Oº3p¤9qº4X¤C6º3W—÷ß4{ßVßSßWß1WßP»ß8ßS}}{ß1ß2bß3|¦´x´´y´‡º3R¤6Iº3R¤Kºq¤Uº4eº3tº4cº4dº4Tº4U—÷ß4{ßVßUßWß1WßP»ß8ßU}}{ß1ß24ß3|¦´x´´y´‡¤Cvº46¤Bt¢-FS¤BS¢-Ao¤4Mº3o—÷ß4{ßP»ßVßSßWß1Wß8ßS}}{ß1ß1vß3|¦´x´´y´‡¤C6º3W¤5eº3Tº2ºmº3Xº2¢-6T¤U—÷ß4{ßVßCßWß1WßP»ß8ßC}}{ß1ß2Aß3|¦´x´´y´‡¤D4¤-A¤Bm¤8s¤EW¤C1¤E2¤G8¤4q¤M6¤26¤X4¤AA¤g6¤EC¤fw—÷ß4{ßP»ßVßSßWß1Wß8ßS}}{ß1ß2Mß3|¦´x´´y´‡º4Vº4G¢-Jqº5Iº5H¢-CQº3gº4W¢-5eº5Eº3eº4X¤3Oº3p—÷ß4{ßVßTßWß1WßP»ß8ßT}}{ß1ß2Lß3|¦´x´´y´‡º4Tº4Uº3zº4Sº4gº5Gº4Qº4Rº4Oº4Pº4Nº3nº3uº49¤eº4M¤4Mº3o—÷ß4{ßVßTßWß1WßP»ß8ßT}}{ß1ß2vß3|¦´x´´y´‡¤Hu¤fm¤Lw¤fcºS¤Vw—÷ß4{ßP»ßVßGßWß1Wß8ßG}}{ß1ß2kß3|¦´x´´y´‡¤By¤i0¤G8¤mO¤RQ¤lG¤SE¤o0¤Gw¤p8—÷ß4{ßP»ßVßGßWß1Wß8ßG}}{ß1ß2lß3|¦´x´´y´‡¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤ZUº1U—÷ß4{ßP»ßVßGßWß1Wß8ßG}}{ß1ß2Eß3|¦´x´´y´‡¢-FAº5cº3qº44º3pº4Dº3iº48º4F¢-KAº4G¢-Koº42º48º5cº5c—÷ß4{ßVßTßW¨wall_tutorial_window¨ßP»ß8ßT}}{ß1ß2Oß3|¦´x´´y´‡º5cº5cº3qº44º3pº4Dº3iº48º4Fº5dº4Gº5eº42º48º5cº5c—÷ß4{ßVßTßWß4Sß8ßT}}{ß1ß4Cß3|¦´x´´y´‡º3fº56º3eº5E—÷ß4{ßVß2KßWß3EßP»ß37»ß8ßT}}{ß1ß3sß3|¦´x´´y´‡¤Hkº3Y¤Gc¢-7a—÷ß4{ßVß21ßWß3EßP»ß37»ß8ßS}}{ß1ß3Lß3|¦´x´´y´‡¤-Lº4hÒº3V¤xº3d¤1H¢-2u¤w¢-2P¤I¢-2F¤-M¢-2Z—÷ß4{ßVß1oßWß35ß8ßC}}{ß1ß3Mß3|¦´x´´y´‡¤2F¤5A¤2Z¤4W¤3N¤4C¤41¤4q¤41¤5o¤3D¤68¤2P¤5y—÷ß4{ßVß1oßWß35ß8ßC}}{ß1ß3Nß3|¦´x´´y´‡¢-5p¢-18¢-5fº2¢-4r¢-1w¢-4N¢-1Sº5p¤-o¢-51¤-U¢-5V¤-e—÷ß4{ßVß1oßWß35ß8ßC}}{ß1ß3Oß3|¦´x´´y´‡¢-3j¤5K¢-35¤50¢-2H¤50¢-1n¤5e¢-1x¤6c¢-2R¤5y¢-4B¤6G—÷ß4{ßVß1oßWß35ß8ßC}}{ß1ß3Pß3|¦´x´´y´‡º5Y¤Uº5Q¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßVß1oßW¨wall_tutorial_rock_breakable¨ß8ßC}}{ß1ß3eß3|¦´x´´y´‡¤Mn¢-3H¤Oxº4h¤Pu¢-4E¤PPºl¤OEº4r¤Mz¢-6F¤MK¢-4z—÷ß4{ßVß21ßWß35ß8ßS}}{ß1ß3fß3|¦´x´´y´‡¤Cl¢-48¤Doº3d¤Ee¢-47¤Ee¢-5F¤E8¢-6A¤Cjº69¤C8¢-52—÷ß4{ßVß21ßWß35ß8ßS}}{ß1ß3gß3|¦´x´´y´‡¤F9¢-41¤Gm¢-3s¤Ho¢-4Q¤Hq¢-5c¤Gh¢-6V¤Fbº69¤Ew¢-59—÷ß4{ßVß21ßWß35ß8ßS}}{ß1ß3hß3|¦´x´´y´‡¤Iw¢-3q¤Kv¢-3W¤Lp¢-4l¤Lk¢-67¤K1¢-6j¤IT¢-6D¤IA¢-4w—÷ß4{ßVß21ßWß35ß8ßS}}{ß1ß3iß3|¦´x´´y´‡¤Hkº3Y¤JCº3c¤JVº4W¤IR¢-A3¤H9¢-AJ¤GJ¢-96¤Gcº5f—÷ß4{ßVß21ßWß35ßP»ß8ßS}}{ß1ß3jß3|¦´x´´y´‡¤DD¢-FZ¤Dr¢-Fb¤EB¢-Fs¤EI¢-GO¤Drº5V¤D8¢-Gn¤Cvº46—÷ß4{ßVß21ßWß35ß8ßS}}{ß1ß3kß3|¦´x´´y´‡¤KZ¢-G2¤L2¢-Fn¤Lb¢-G0¤Lf¢-GR¤LJ¢-H1¤Km¢-H2¤KQ¢-GX—÷ß4{ßVß21ßWß35ß8ßS}}{ß1ß4Bß3|¦´x´´y´‡º3eº5Eº5qº5D¤Kº3Z¤1mº5E¤1Sº4d¤Aº4Gº3fº56—÷ß4{ßVß2KßWß35ßP»ß8ßT}}{ß1ß4Gß3|¦´x´´y´‡¢-VIº4z¢-V8º3o¢-UKº56º58º5aº58º3a¢-UUº3k¢-Uyº3b—÷ß4{ßVß2UßWß35ß8ßU}}{ß1ß4Hß3|¦´x´´y´‡¢-OWº5o¢-O2¢-2V¢-NJ¢-2fº59¢-2G¢-Mkº3fº3R¤-yº4Tº5l—÷ß4{ßVß2UßWß35ß8ßU}}{ß1ß4Iß3|¦´x´´y´‡¢-TMº3f¢-T2º5o¢-SEº6n¢-RQ¢-1m¢-RG¤-y¢-Ru¤-Kº6q¤-U—÷ß4{ßVß2UßWß35ß8ßU}}{ß1ß3lß3|¦´x´´y´‡¤Fd¤1h¤GZ¤1y¤HJ¤1R¤HJ¤R¤GT¤-G¤FH¤-F¤Ew¤m—÷ß4{ßVß21ßWß35ß8ßS}}{ß1ß3mß3|¦´x´´y´‡¤Hz¤1m¤J3¤1o¤JH¤19¤JA¤N¤IfÁ¤HlÒ¤Hb¤14—÷ß4{ßVß21ßWß35ß8ßS}}{ß1ß3nß3|¦´x´´y´‡¤Jl¤1o¤Km¤2V¤Lr¤22¤MF¤h¤LQÒ¤K4¤B¤JX¤c—÷ß4{ßVß21ßWß35ß8ßS}}{ß1ß3pß3|¦´x´´y´‡¤MQ¤2G¤NY¤2z¤PA¤2y¤Py¤2M¤Pw¤1A¤Oa¤R¤My¤V—÷ß4{ßVß21ßWß35ß8ßS}}{ß1ß3qß3|¦´x´´y´‡¤QR¤2D¤R7ºE¤Rw¤2f¤SI¤1u¤S2¤16¤R7¤l¤QW¤18—÷ß4{ßVß21ßWß35ß8ßS}}{ß1ß3rß3|¦´x´´y´‡¤Sn¤1x¤Uf¤2Jºj¤17¤Vo¤-L¤UV¤-k¤TG¤-G¤Sf¤h—÷ß4{ßVß21ßWß35ß8ßS}}{ß1ß3Fß3|¦´x´´y´‡¤4X¤-T¤50¤-K¤4jÎ¤50¤-K¤3OÒ—÷ß4{ßVß1qßWß40ßP»ß8ßC}´z´ÝA}{ß1ß3Gß3|¦´x´´y´‡º3W¤-yº3W¢-2aº5qº3u¤-Uº3r¤-Uº5o¤1N¢-2L¤1Sº3d¤5Kº6n—÷ß4{ßVß1qß2y¨enemy_tutorial_bit¨ß30»ß31Îß8ßC}}{ß1ß3Hß3|¦´x´´y´‡¢-4W¤5eº3X¤3sºl¤-y¢-5K¤-Aº6C¤-yº4N¤3Eº5A¤4g—÷ß4{ßVß1qß2yß4Uß30»ß31Îß8ßC}}{ß1ß3Iß3|¦´x´´y´‡¤9Mº3f¤9s¤m—÷ß4{ßP»ß5ß4MßVß1sß8ßC}}{ß1ß3Jß3|¦´x´´y´‡¤9Mº3f¤8q¢-3M—÷ß4{ß5ß4MßVß1sßP»ß8ßC}}{ß1ß3Kß3|¦´x´´y´‡¤8E¢-34¤9C¤o¤AU¤U¤9Wº4h—÷ß4{ßVß1sßW¨deco¨ß5¨tutorial_door_floor¨ß8ßC}}{ß1ß3Rß3|{´x´º3t´y´¤AA}÷ß4{ßVß1uß2yß4Jß30»ß31Êß8ßC}}{ß1ß3Sß3|{´x´¢-9M´y´¤6w}÷ß4{ßVß1uß2yß4Jß30»ß31Êß37»ß8ßC}}{ß1ß3Tß3|{´x´º5D´y´¤AA}÷ß4{ßVß1uß2yß4Jß30»ß31Êß37»ß8ßC}}{ß1ß3Xß3|¦´x´´y´‡¤A6¢-9m¤9g¢-9Q¤A5¢-93¤9gº74¤BM¢-9O—÷ß4{ßVß22ßWß40ßP»ß8ßS}´z´ÝA}{ß1ß3Yß3|¦´x´´y´‡¤ER¢-5Z¤E8¢-56¤Dnº77¤E8º78¤E8º5Q—÷ß4{ßVß22ßW¨icon_tutorial¨ßP»ß8ßS}´z´ÝA}{ß1ß3Zß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßVß22ßWß4XßP»ß8ßS}´z´ÝA}{ß1ß3oß3|{´x´¤Dz´y´¤Y}÷ß4{ßVß21ß2y¨enemy_tutorial_block¨ß30»ß31Êß37»ß8ßS}}{ß1ß3tß3|¦´x´´y´‡¤Maº5A¤Lwº5A¤LIº4h¤M4¢-4c¤M5º78¤M1º69¤KKº3Y¤NOº3Y¤Mgº3X¤M8º78¤M7º79—÷ß4{ßVß1zß2yß4Uß30»ß31Îß8ßS}}{ß1ß3uß3|¦´x´´y´‡ºS¤-U¤SO¤y¤RG¤U¤Py¤o¤SYº3f¤V8º3U¤Vcº3f—÷ß4{ßVß1zß2yß4Uß31Îß30»ß8ßS}}{ß1ß3vß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßVß1zß2yß4Uß30»ß31Îß8ßS}}{ß1ß3xß3|¦´x´´y´‡¤Ha¤Bm¤EW¤Bc¤C6¤8s¤D4¤1S¤GS¤2Q¤HQ¤1w¤JW¤26¤Ko¤2u¤Lw¤2Q¤K0¤9W—÷ß4{ßVß1zß2yß4Uß31¤Cß30»ß8ßS}}{ß1ß3Vß3|¦´x´´y´‡¤76º3Z¤6a¢-7m—÷ß4{ßP»ß5ß4MßVß22ß8ßS}}{ß1ß3Wß3|¦´x´´y´‡¤76º3Zºc¢-Bu—÷ß4{ßP»ß5ß4MßVß22ß8ßS}}{ß1ß3Uß3|¦´x´´y´‡¤6wº5L¤5yº4O¤7G¢-7k¤8Eº3b—÷ß4{ßVß22ßWß4Vß5ß4Wß8ßS}}{ß1ß3wß3|{´x´¤Hb´y´¢-C3}÷ß4{ßVß1zß2y¨enemy_tutorial_4way¨ß30»ß31Êß8ßS}}{ß1ß3yß3|{´x´¤R6´y´¤5o}÷ß4{ßVß1zß2y¨enemy_tutorial_down¨ß30»ß31Êß8ßS}}{ß1ß3zß3|{´x´¤FM´y´¢-7V}÷ß4{ßVß20ß2yß4Kß30»ß31Êß8ßS}}{ß1ß41ß3|¦´x´´y´‡¤E6¢-1h¤EB¢-21—÷ß4{ßVß23ßWß40ßP»ß8ßS}´z´ÝA}{ß1ß42ß3|¦´x´´y´‡¤E4¢-1X¤E4º7N—÷ß4{ßVß23ßWß40ßP»ß8ßS}´z´ÝA}{ß1ß43ß3|{´x´¤Eg´y´º5Z}÷ß4{ßVß25ß2yß4Jß30»ß31Êß37»ß8ßS}}{ß1ß47ß3|{´x´¤Bw´y´º48}÷ß4{ßVß25ß2yß4Jß30»ß31Êß37»ß8ßS}}{ß1ß44ß3|¦´x´´y´‡¤Ba¢-FT¤H1¢-JI¤Gl¢-L3¤E4¢-Lp¤BS¢-Ki¤9f¢-Il¤9j¢-GL—÷ß4{ßVß25ßWß38ß3A£0.BIß8ßS}}{ß1ß45ß3|¦´x´´y´‡¤D8º6V¤EC¢-FN—÷ß4{ßVß25ßWß3Cß8ßS}}{ß1ß48ß3|¦´x´´y´‡º3l¢-Eg¢-NE¢-Gw—÷ß4{ßP»ß5ß4MßVß2Fß8ßT}}{ß1ß49ß3|¦´x´´y´‡¢-LIº5Fº5eº49¢-Mu¢-H6º5Nºs—÷ß4{ßVß2FßWß4Vß5ß4Wß8ßT}}{ß1ß4Nß3|¦´x´´y´‡¤Lw¤fc¤EC¤fw—÷ß4{ßVß2jßWß3Cß8ßG}}{ß1ß4Oß3|¦´x´´y´‡¤HQ¤GI¤E2¤G8—÷ß4{ßVß2fßWß3Cß8ßG}}{ß1ß3aß3|¦´x´´y´‡¤Gh¢-43¤G8º3T¤FPº3r—÷ß4{ßVß1yßWß4Rß8ßS}}{ß1ß3bß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Keº2—÷ß4{ßVß1yßWß4Rß8ßS}}{ß1ß3cß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Ojº5k¤P3¢-5i¤Tdº6K¤PE¢-4S¤OX¢-3f¤OCº3f¤N9º3d—÷ß4{ßVß1yßWß4Rß8ßS}}{ß1ß3dß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßVß1yßWß4Rß8ßS}}{ß1ß3Qß3|¦´x´´y´‡º5z¤6Gº3Y¤42º3Z¤50º7k¤83º3b¤BIº3c¤D4º3d¤B8º5P¤7A—÷ß4{ßP»ßVß1ußWß1Wß8ßC}}{ß1ß46ß3|¦´x´´y´‡¤Gpº5U¤GZº4o¤E4¢-LR¤Bcº50¤A0º5C¤A3¢-GT¤Btº5W—÷ß4{ßP»ßVß25ßWß1Wß8ßS}}÷¨icons¨|÷}");
