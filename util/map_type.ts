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
export const TEST_MAP: map_type = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢3Ng´y´¢WQ}÷¨options¨{¨style¨ß2¨contains¨|¨home floor¨÷¨room_id¨´´¨is_room¨»}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ßA¨room_connections¨|¨tutorial room 1¨÷ß9»ß8´´}}{ß1¨station¨ß3|{´x´¢1RC´y´¢1NU}÷ß4{ßB|¨station tutorial¨¨station streets¨¨tutorial room 5¨¨streets side room 1¨÷ß6|¨train¨ßE¨station tracks¨ßF¨station tracks particle¨÷ß8´´ß9»}}{ß1¨streets¨ß3|{´x´¢1f4´y´¢-D4}÷ß4{ß8´´ß6|¨streets room 1¨ßH¨streets room 2¨÷}}{ß1¨test group¨ß3|{´x´¢6x´y´¢7q}÷ß4{ß6|¨test 1¨÷¨open_loop¨«ß5¨test¨ßB|÷ß9»ß8´´}}{ß1¨tutorial¨ß3|{´x´¢-WG´y´ºA}÷ß4{ß6|ßC¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨ßG÷ß8´´}}{ß1ß7ß3|¦´x´´y´‡¢3sk¢Bs¢3Xu¢2m¢3FVºE¢30C¢6M¢2pO¢Gd¢2mE¢TN¢2py¢ip¢2zv¢sv—÷ß4{¨parent¨ß2¨make_id¨¨floor¨ß8ß2}}{ß1ßFß3|{´x´¢1dc´y´¢12g}÷ß4{ßWßDß6|¨station streets rock 1¨¨station streets rock 2¨¨station streets rock 3¨¨station streets sensor start¨¨station streets rock 0¨¨station streets sensor end¨¨station streets rock block¨¨station streets rock 4¨¨station streets rock 5¨¨station streets rock 6¨¨station streets rock 7¨¨station streets rock 8¨¨station streets floor 1¨¨station streets floor 1.5¨¨station streets floor 2¨¨station streets floor 2.5¨¨station streets floor 3¨¨station streets floor 3.5¨¨station streets wall 1¨¨station streets wall 2¨¨station streets wall 3¨¨station streets floor 0¨¨station streets floor 4¨¨station streets floor 5¨¨station streets floor 4.5¨¨station streets wall 5¨¨station streets wall 6¨¨station streets wall 7¨¨station streets wall 8¨¨station streets wall 9¨¨station streets wall 10¨¨station streets wall 11¨¨station streets wall 13¨¨station streets rocky 1¨¨station streets wall fake 1¨¨station streets wall 14¨¨station streets floor 4.1¨¨station streets wall 12¨¨station streets breakables 1¨¨station streets breakables 2¨¨station streets breakables 2.5¨÷ß8ßDß9»ßB|ßDßMßHßE÷}´z´£0.-3E}{ß1ßJß3|¦´x´´y´‡¢T2¢12W¢3U8ºTºU¢13KºSºV—÷ß4{ßWßDßX¨floor_train_track¨ß8ßD¨sensor_dont_set_room¨»}}{ß1ßKß3|¦´x´´y´‡ºSºTºSºV—÷ß4{ßWßDßXß1Eß8ßDß1F»}}{ß1ßEß3|{´x´¢VS´y´¢yA}÷ß4{ßWßDß6|¨station tutorial floor¨¨station tutorial sensor start¨¨station tutorial wall 1¨¨station tutorial wall 2¨¨station tutorial rock 1¨¨station tutorial rock 2¨¨station tutorial rock 3¨¨tutorial floor low¨¨station tutorial sensor end¨÷ß8ßDß9»ßB|ßGßDßF÷}}{ß1ßMß3|{´x´¢1zO´y´¢rO}÷ß4{ßWßLß8´´ß9»ßB|ßFßN÷ß6|¨streets room 1 wall 2¨¨streets room 1 wall 1¨¨streets room 1 camera 1¨¨streets room 1 sensor start¨¨streets room 1 camera 2¨¨streets room 1 camera 0¨¨streets room 1 floor¨¨streets room 1 sensor end¨¨streets room 1 camera 3¨÷}´z´£0.-84}{ß1ßNß3|{´x´¢1w0´y´¢f8}÷ß4{ßWßLß8´´ß9»ßB|ßM÷ß6|¨streets room 2 rock¨¨streets room 2 sensor start¨¨streets room 2 floor¨¨home wow test wow¨÷}´z´Ý1}{ß1ßHß3|{´x´¢1wo´y´¢1C2}÷ß4{ßWßLß8´´ß9»ßB|ßFßD÷ß6|¨streets side room 1 floor¨¨streets side room 1 wall 1¨¨streets side room 1 wall 2¨¨streets side room 1 wall fake 1¨¨streets side room 1 test¨¨streets side room 1 window 1¨÷}´z´£0.-6S}{ß1ßPß3|¦´x´´y´‡¢7c¢46¢8u¢88—÷ß4{ßWßOßQ»ßX¨wall¨ß5ßRß6|¨test 2¨÷ß8ßO}}{ß1ßIß3|¦´x´´y´‡¢Qc¢10u¢TRºj—{´x´ºk´y´ºj´z´£0.4q}{´x´¢Vr´y´ºj´z´Ý3}{´x´ºl´y´ºj}{´x´¢Yg´y´ºj}{´x´ºm´y´ºj´z´£0.84}{´x´ºi´y´ºj´z´Ý4}÷ß4{ßWßDßX¨wall_train¨ß6|¨train floor broken¨¨train wall 1¨¨train wall 2¨¨train wall 3¨¨train ceiling¨¨train sensor¨¨train door right¨¨train door right path¨¨train door left¨¨train door left path¨¨train floor¨¨train floor broken top¨¨train floor broken bottom¨¨train floor broken middle¨÷¨seethrough¨»ß8ßD}}{ß1ßCß3|{´x´¢-68´y´¢-50}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨¨tutorial room 1 floor¨÷ßWßSß9»ßB|ßTßVßAßU÷ß8´´}}{ß1ßTß3|{´x´¢OW´y´¢-DO}÷ß4{ßWßSß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨tutorial room 2 floor¨¨tutorial room 2 floor platform¨÷ß9»ßB|ßGßCßU÷ß8´´}}{ß1ßUß3|{´x´¢-JM´y´¢-Tg}÷ß4{ßWßSß6|¨tutorial window 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨¨tutorial room 3 floor¨¨tutorial room 3 enemy 1¨÷ß9»ßB|ßUßVßTßC÷ß8´´}}{ß1ßVß3|{´x´¢-Z0´y´¢-Gc}÷ß4{ßWßSß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨¨tutorial room 4 floor¨÷ß9»ßB|ßUßC÷ß8´´}}{ß1ßGß3|{´x´¢9t´y´¢GK}÷ß4{ßWßSß6|¨tutorial room 5 sensor boss¨¨tutorial room 5 door start¨¨tutorial room 5 sensor boss start¨¨tutorial room 5 boss¨¨tutorial room 5 floor¨¨tutorial room 5 door end¨¨tutorial wall 15¨¨tutorial wall 16¨¨tutorial rock 23¨¨tutorial room 5 enemy¨¨tutorial rock 24¨¨tutorial rock 25¨¨tutorial rock 26¨¨tutorial rock 27¨¨tutorial room 5 switch path¨¨tutorial room 5 sensor middle¨¨tutorial room 5 sensor boss end¨¨tutorial wall 14¨¨tutorial room 5 rocky 3¨¨tutorial fake wall 5¨÷ß9»ßB|ßTßEßD÷ß8´´}}{ß1ß1bß3|{´x´¢28G´y´ºi}÷ß4{ßWßN¨spawn_enemy¨¨checkpoint¨¨is_spawner¨»¨spawn_repeat¨Êß8ßN}´z´Ý1}{ß1ß1Bß3|¦´x´´y´‡¢1Viºd¢1VE¢14c¢1RM¢17Mº11¤wY¢1cA¤sC¢1aE¤xM¢1VY¤yK¢1ZG¢114—÷ß4{ßWßFß39¨enemy_streets_bit¨ß3C¤Kß3B»ß8ßF}´z´£0.-1c}{ß1ß1Cß3|{´x´¢1jG´y´¤vu´z´Ý0}{´x´¢1bM´y´¤ws}{´x´¢1co´y´¤s2}÷ß4{ßWßFß39ß3Dß3CÍß3B»ß8ßF}´z´Ý0}{ß1ß1Dß3|{´x´¢1fi´y´¢1CM´z´Ý0}{´x´¢1aO´y´¢1Cg}{´x´ºQ´y´¢15a´z´Ý0}{´x´¢1bg´y´¢10k}{´x´¢1ic´y´¤zS}÷ß4{ßWßFß39ß3Dß3CÐß3B»ß8ßF}´z´Ý0}{ß1ßuß3|¦´x´´y´‡¢1Qi¤vuº1J¢1Aa¢1RWº1Kº1L¤vu—÷ß4{ßWßFßXßYß8ßF}´z´Ý5}{ß1ßlß3|¦´x´´y´‡¢1Qs¤wOº1M¢18y¢1Uk¢1Fk¢1dI¤pc—÷ß4{ßWßFßXßYß8ßF¨safe_floor¨»ß5¨wall_floor¨}´z´Ý5}{ß1ßmß3|¦´x´´y´‡º1Q¤pcº1Oº1P—{´x´º1O´y´º1P´z´Ý0}{´x´º1Q´y´¤pc´z´Ý0}÷ß4{ßWßFßXß3Fß8ßF}´z´Ý5}{ß1ßnß3|¦´x´´y´‡º1Q¤pcº1Oº1P¢1fOº1P¢1ks¤pc—÷ß4{ßWßFßXßYß8ßFß3E»ß5ß3F}´z´Ý0}{ß1ßoß3|¦´x´´y´‡º1S¤pcº1Rº1P—{´x´º1R´y´º1P´z´£0.-4q}{´x´º1S´y´¤pc´z´Ý6}÷ß4{ßWßFßXß3Fß8ßF}´z´Ý0}{ß1ßpß3|¦´x´´y´‡º1S¤pcº1Rº1P¢1xI¢1DK¢1us¤ri—÷ß4{ßWßFßXßYß8ßFß3E»ß5ß3F}´z´Ý6}{ß1ßqß3|¦´x´´y´‡º1V¤riº1Tº1U—{´x´º1T´y´º1U´z´Ý2}{´x´º1V´y´¤ri´z´Ý2}÷ß4{ßWßFßXß3Fß8ßF}´z´Ý6}{ß1ßvß3|¦´x´´y´‡º1V¤riº1Tº1U—{´x´¢20g´y´¢1Ak´z´Ý2}{´x´¢21o´y´º1K´z´Ý2}{´x´¢202´y´¢1DU}{´x´¢27S´y´¢1De´z´Ý2}{´x´¢23u´y´¤uw}÷ß4{ßWßFßXßYß8ßFß3E»}´z´Ý2}{ß1ß19ß3|{´x´º1d´y´¤uw´z´Ý2}{´x´º1b´y´º1c}÷ß4{ßWßFßX¨wall_floor_halfwidth¨ß8ßF}´z´Ý2}{ß1ßxß3|¦´x´´y´‡º1d¤uwº1bº1c—{´x´º1b´y´º1c´z´Ý1}{´x´º1d´y´¤uw´z´Ý1}÷ß4{ßWßFßXß3Fß8ßF}´z´Ý2}{ß1ßwß3|{´x´º1d´y´¤uw´z´Ý1}{´x´º1b´y´º1c}{´x´¢2LA´y´¢12v´z´Ý1}{´x´¢294´y´¤uw}÷ß4{ßWßFßXßYß8ßFß3E»}´z´Ý1}{ß1ßdß3|¦´x´´y´‡¢1Uu¢15Qºz¢19S¢1SU¢172—÷ß4{ßWßFßX¨rock¨ß8ßF}´z´Ý5}{ß1ßZß3|¦´x´´y´‡¢1ZQ¤xq¢1YS¢106—{´x´¢1WM´y´¤yU´z´Ý5}÷ß4{ßWßFßXß3Hß8ßF}´z´Ý5}{ß1ßaß3|¦´x´´y´‡¢1d8º1F¢1b5¢19l¢1Yp¢15F—÷ß4{ßWßFßXß3Hß8ßF}´z´Ý0}{ß1ßbß3|¦´x´´y´‡¢1fb¤zl¢1cK¢10G¢1df¤xV—÷ß4{ßWßFßXß3Hß8ßF}´z´Ý0}{ß1ßgß3|¦´x´´y´‡¢1nI¢16s¢1im¢19cº1Sº1i—÷ß4{ßWßFßXß3Hß8ßF}´z´Ý6}{ß1ßhß3|¦´x´´y´‡¢1scº1Hº1z¢10Q¢1qh¤vx—÷ß4{ßWßFßXß3Hß8ßF}´z´Ý6}{ß1ßiß3|¦´x´´y´‡¢1uEº1i¢1tQ¢16iº23¢15G—÷ß4{ßWßFßXß3Hß8ßF}´z´Ý6}{ß1ßjß3|¦´x´´y´‡¢244¢1A6¢1yuº1j¢22Iº1i—÷ß4{ßWßFßXß3Hß8ßF}´z´Ý2}{ß1ßkß3|{´x´¢1xw´y´¤xq}{´x´º1Y´y´¤yU´z´Ý2}{´x´º2C´y´º24}÷ß4{ßWßFßXß3Hß8ßFßQ»}´z´Ý2}{ß1ßfß3|¦´x´´y´‡¢2Hwº1f¢29s¢16Yº2G¤zI—÷ß4{ßWßFßXß3Hß8ßF}´z´Ý1}{ß1ß16ß3|{´x´¢2CN´y´¢169}÷ß4{ßWßFß39¨enemy_streets_rocky_small¨ß3B»ß3CÊß8ßF¨spawn_permanent¨»}´z´Ý1}{ß1ßeß3|¦´x´´y´‡¢2Ei¤vGº2K¢1CC¢1mUº2Lº2M¤vG—÷ß4{ßWßFßX¨sensor¨ß8ßF}´z´Ý1}{ß1ßcß3|¦´x´´y´‡¢1Ty¤v5¢1UGº1Uº1Jº2Lº1M¤vG—÷ß4{ßWßFßXß3Kß8ßF}}{ß1ßrß3|¦´x´´y´‡º1d¤uw¢1vM¤w4—÷ß4{ßQ»ßWßFßXß1iß8ßF}´z´Ý2}{ß1ßsß3|{´x´¢1ce´y´¤rY}{´x´º1J´y´¤wO´z´Ý5}{´x´º1J´y´ºj}÷ß4{ßQ»ßWßFßXß1iß8ßF}´z´Ý5}{ß1ßtß3|¦´x´´y´‡¢1ja¤vkº2Q¤rY—÷ß4{ßQ»ßWßFßXß1iß8ßF}´z´Ý0}{ß1ßyß3|¦´x´´y´‡º15º1Uº1Jº1N—{´x´º1J´y´¢14w´z´Ý5}÷ß4{ßQ»ßWßFßXß1iß8ßF}´z´Ý5}{ß1ßzß3|¦´x´´y´‡¢1g2º1Eº15º1U—÷ß4{ßQ»ßWßFßXß1iß8ßF}´z´Ý0}{ß1ß10ß3|{´x´¢1wy´y´º1K´z´Ý6}{´x´¢1oQ´y´¢1Au}{´x´º2T´y´º1E}÷ß4{ßQ»ßWßFßXß1iß8ßF}´z´Ý6}{ß1ß11ß3|¦´x´´y´‡º2P¤w4¢1pi¤tUº2R¤vk—÷ß4{ßQ»ßWßFßXß1iß8ßF}´z´Ý6}{ß1ß12ß3|¦´x´´y´‡º1Jº2Sº1Jº1N—÷ß4{ßQ»ßWßFßXß1iß8ßF}´z´Ý1}{ß1ß13ß3|{´x´º1J´y´¤wO´z´Ý1}{´x´º1J´y´ºj}÷ß4{ßQ»ßWßFßXß1iß8ßF}´z´Ý1}{ß1ß14ß3|¦´x´´y´´z´‡¢26o¢1AGÝ2º1Y¢1AQÝ2¢1ya¢1FQÝ2—÷ß4{ßQ»ßWßFßXß1iß8ßF}´z´Ý2}{ß1ß1Aß3|¦´x´´y´‡¢1weº2c¢1zsº2Wº2Uº1K—÷ß4{ßQ»ßWßFßXß1iß8ßF}´z´Ý2}{ß1ß15ß3|¦´x´´y´‡¢2D6¢156º2fº2Hº2G¢19mº2Yº2Z—÷ß4{ßQ»ßWßFßXß1iß8ßF}´z´Ý1}{ß1ß18ß3|¦´x´´y´‡º1b¤umº1g¤uwº2G¤w4—{´x´º2f´y´¤zI´z´Ý1}{´x´º2f´y´º1H}÷ß4{ßQ»ßWßFßXß1iß8ßF}´z´Ý1}{ß1ß17ß3|{´x´º2E´y´¤xq}{´x´º2C´y´º24´z´Ý2}÷ß4{ßWßFßX¨wall_streets_fake¨ßQ»ß3J»ß8ßF}´z´Ý2}{ß1ß1Gß3|¦´x´´y´‡¤am¤w4¤YM¤o0¤X4¤o0¤Y2¤rE¤Fo¤s2¤Gw¤yy¤Gwº12ºWº12ºW¢18e¤X4º2i¤X4º12¤amº12¤am¢130—÷ß4{ßWßEßXßYß3E»ß8ßE}}{ß1ß1Kß3|¦´x´´y´‡¢14S¤tAº1l¤uw¢17g¤y0º2gº24¢11s¤zmº1x¤xC¢11O¤uI—÷ß4{ßWßEßXß3Hß8ßE}´z´Ý1}{ß1ß1Lß3|¦´x´´y´‡¢1Emº1i¢1GO¢164¢1Giº2lº1P¢19I¢1Dy¢198¢1Cqº2lº1Uº2q—÷ß4{ßWßEßXß3Hß8ßE}´z´Ý1}{ß1ß1Mß3|¦´x´´y´‡¢1K6¤xM¢1LE¤xq¢1LY¤yy¢1Kkº24¢1J8º1o¢1IK¤yo¢1Iy¤xg—÷ß4{ßWßEßXß3Hß8ßE}´z´Ý1}{ß1ß1Oß3|¦´x´´y´‡º5¤vGº5º2L¢1PQº2Lº33¤vG—÷ß4{ßWßEßXß3Kß8ßE}}{ß1ß1Hß3|¦´x´´y´‡ºS¤wY¤KK¤yy¤KKº1xºSº1x¤Ue¤zm¤WGº1x¤ZU¤wY—÷ß4{ßWßEßXß3K¨sensor_fov_mult¨Êß8ßE}}{ß1ß1Iß3|¦´x´´y´‡¤RG¤w4¤Op¤wi—÷ß4{ßQ»ßWßEßXß1iß8ßE}}{ß1ß1Jß3|¦´x´´y´‡¤Mk¤xM¤Gw¤yy¤Gwº12¤ZUº12¤ZU¢15k—÷ß4{ßQ»ßWßEßXß1iß8ßE}}{ß1ß1Uß3|{´x´¢2CI´y´¤zS}÷ß4{ßWßMß39¨enemy_streets_camera_small¨ß3B»ß3CÊß8ßM}´z´Ý1}{ß1ß1Rß3|{´x´¢24O´y´¤to}÷ß4{ßWßMß39ß3Nß3B»ß3CÊß8ßM}´z´Ý1}{ß1ß1Tß3|{´x´¢27I´y´¤mE}÷ß4{ßWßMß39ß3Nß3B»ß3CÊß8ßM}´z´Ý1}{ß1ß1Xß3|{´x´¢252´y´¤fw}÷ß4{ßWßMß39ß3Nß3B»ß3CÊß8ßM}´z´Ý1}{ß1ß1Vß3|¦´x´´y´‡º1d¤uw¢29O¤v6—{´x´º1b´y´¤nC´z´Ý1}{´x´¢2A2´y´¤iM}{´x´¢25C´y´¤iM}{´x´º2D´y´¤nC}÷ß4{ßWßMßXßYß8ßMß3E»}´z´Ý1}{ß1ß1Wß3|{´x´¢22w´y´¤fS}{´x´º3C´y´¤ee´z´Ý1}{´x´º39´y´¤ee´z´Ý1}{´x´º39´y´¤fS}÷ß4{ßWßMßXß3Kß8ßMß3M£0.Cu}´z´Ý1}{ß1ß1Sß3|{´x´¢23Q´y´¤te}{´x´º3D´y´¤sq´z´Ý1}{´x´º2G´y´¤sq´z´Ý1}{´x´º2G´y´¤te}÷ß4{ßWßMßXß3Kß8ßMß3MÝ7}´z´Ý1}{ß1ß1Qß3|¦´x´´y´‡ºx¤Hkº2b¤Wkº3D¤eK—{´x´º3B´y´¤iM´z´Ý1}{´x´º2D´y´¤nC}{´x´º1d´y´¤uw}{´x´¢25q´y´¤um´z´Ý1}{´x´¢23k´y´¤uS}÷ß4{ßQ»ßWßMßXß1iß8ßM}´z´Ý1}{ß1ß1Pß3|¦´x´´y´‡ºx¤Hkº2F¤Wkºx¤eKº3A¤iMº1b¤nC¢28u¤uSº1b¤um—÷ß4{ßQ»ßWßMßXß1iß8ßM}´z´Ý1}{ß1ß1aß3|¦´x´´y´´z´‡¢1s8¤gkÝ1º3B¤iMÝ1—{´x´º3A´y´¤iM}{´x´¢2OO´y´¤gk}{´x´ºx´y´¤Hk}÷ß4{ßWßNßXßYß8ßNß3E»}´z´Ý1}{ß1ß1Yß3|¦´x´´y´‡¢2B0¤X4º1d¤X4—{´x´º3E´y´¤b6´z´Ý1}÷ß4{ßWßNßXß3Hß8ßN}´z´Ý1}{ß1ß1Zß3|{´x´¢1xm´y´¤X4}{´x´º3K´y´¤WG´z´Ý1}{´x´¢2Ik´y´¤WG´z´Ý1}{´x´º3L´y´¤X4}÷ß4{ßWßNßXß3Kß8ßNß3M£1.1c}´z´Ý1}{ß1ß1cß3|{´x´º2e´y´º2W}{´x´º1Y´y´º2a´z´Ý2}{´x´º1b´y´º1c´z´Ý2}{´x´º3G´y´¢1FG}{´x´º3G´y´¢1T8´z´Ý2}{´x´º2d´y´º3N}{´x´º2d´y´º2c}÷ß4{ßWßHßXßYß8ßHß3E»}´z´Ý2}{ß1ß1gß3|{´x´º2K´y´¢1KQ´z´Ý2}÷ß4{ßWßHß8ßHß3B»ß6|¨streets side room 1 test 0¨¨streets side room 1 test 1¨÷}´z´Ý2}{ß1ß1dß3|¦´x´´y´‡¢21Aº1Jº2dº2c—÷ß4{ßQ»ßWßHßXß1iß8ßH}´z´Ý2}{ß1ß1eß3|¦´x´´y´´z´‡º2bº2cÝ2º38¢1G4Ý2—{´x´¢210´y´º1c}{´x´¢22S´y´º1X}{´x´¢26e´y´º1K}{´x´¢27c´y´º2c}{´x´¢26K´y´¢1F6}{´x´º3E´y´º2v}{´x´¢22c´y´¢1DA´z´Ý2}{´x´º3T´y´¢1Fa}{´x´º3T´y´¢1GE}{´x´ºx´y´º2p}÷ß4{ßQ»ßWßHßXß1iß8ßH}´z´Ý2}{ß1ß1fß3|{´x´º38´y´º3Q}{´x´º3T´y´º3a´z´Ý2}÷ß4{ßWßHßXß3LßQ»ß3J»ß8ßH}´z´Ý2}{ß1ß1hß3|¦´x´´y´´z´‡º3P¢1LsÝ2º2bº2cÝ2—÷ß4{ßQ»ßWßHßX¨wall_window¨ß8ßH}´z´Ý2}{ß1ß1jß3|¦´x´´y´‡¤8w¤4r¤9s¤7u—÷ß4{ßWßPßQ»ßXß1iß5ßRß8ßO}}{ß1ß1pß3|¦´x´´y´‡ºmºjºiºjºiº2Sºmº2S—÷ß4{ßWßIßXß1kßY»ß8ßDß1F»}´z´Ý4}{ß1ß1tß3|¦´x´´y´‡¤SEºjºkºj—{´x´ºk´y´ºj´z´Ý3}{´x´¤SE´y´ºj´z´Ý3}÷ß4{ßWßIßXß1kß8ßD}}{ß1ß1uß3|¦´x´´y´‡ºkºj¤Ueºj—÷ß4{ßWßIßX¨sensor_path¨ß8ßD}}{ß1ß1rß3|¦´x´´y´‡ºlºj¤X4ºj—{´x´¤X4´y´ºj´z´Ý3}{´x´ºl´y´ºj´z´Ý3}÷ß4{ßWßIßXß1kß8ßD}}{ß1ß1sß3|¦´x´´y´‡ºlºj¤Ueºj—÷ß4{ßWßIßXß3Rß8ßD}}{ß1ß1vß3|¦´x´´y´‡ºmºjºiºjºiº2Sºmº2S—÷ß4{ßWßIßX¨floor_train¨ß8ßDß1F»}}{ß1ß1lß3|¦´x´´y´‡ºmºj¤SEºj¤Ru¢122¤SE¢13U¤SEº2Sºmº2S—÷ß4{ßWßIßXß3Sß8ßDß1F»}}{ß1ß1xß3|¦´x´´y´‡ºiº2S¤SEº2S¤SEº3dºi¢13A—÷ß4{ßWßIßXß3Sß8ßDß1F»}}{ß1ß1yß3|¦´x´´y´‡ºiº3e¤SEº3d¤Ruº3cºiºT—÷ß4{ßWßIßXß3Sß8ßDß1F»}}{ß1ß1wß3|¦´x´´y´‡ºiºT¤Ruº3c¤SEºjºiºj—÷ß4{ßWßIßXß3Sß8ßDß1F»}}{ß1ß1qß3|¦´x´´y´‡¤Qmº17¤Qm¢14m¤YWº3f¤YWº17—÷ß4{ßWßIßXß3Kß8ßDß1F»}}{ß1ß1mß3|{´x´ºm´y´ºj}{´x´ºm´y´ºj´z´Ý4}{´x´ºm´y´º2S´z´Ý4}{´x´ºm´y´º2S}÷ß4{ßWßIßXß1kß8ßD}}{ß1ß1nß3|{´x´ºi´y´ºj}{´x´ºi´y´ºj´z´Ý4}{´x´ºi´y´º2S´z´Ý4}{´x´ºi´y´º2S}÷ß4{ßWßIßXß1kß8ßD}}{ß1ß1oß3|¦´x´´y´‡ºiº2Sºmº2S—{´x´ºm´y´º2S´z´Ý4}{´x´ºi´y´º2S´z´Ý4}÷ß4{ßWßIßXß1kß8ßD}}{ß1ß2Iß3|¦´x´´y´‡¤Lm¤4q¤Ky¤84—÷ß4{ßWßTßX¨wall_tutorial_fake¨ßQ»ß3J»ß8ßT}}{ß1ß2nß3|¦´x´´y´‡¢-M6¤-U¢-NY¤K—÷ß4{ßWßVßXß3TßQ»ß3J»ß8ßV}}{ß1ß38ß3|¦´x´´y´‡¤AA¤g6¤By¤i0—÷ß4{ßWßGßXß3TßQ»ß3J»ß8ßG}}{ß1ß1Nß3|{´x´º1J´y´¤wO´z´Ý1}{´x´º1J´y´º1N}{´x´¤ye´y´¢1Ec}{´x´¤yU´y´¤qQ}÷ß4{ßWßEßXßYß8ßE}´z´Ý1}{ß1ß2xß3|¦´x´´y´‡¤CQ¤ga¤DE¤gQ¤EM¤gu¤EW¤hs¤E2¤iM¤DO¤iW¤Ck¤iC—÷ß4{ßWßGßXß3HßQ»ß8ßG}}{ß1ß2zß3|¦´x´´y´‡¤SO¤oe¤TC¤pSºS¤qa¤S4¤qu¤Qw¤qaºi¤pS¤RG¤oU—÷ß4{ßWßGßXß3Hß8ßG}}{ß1ß30ß3|¦´x´´y´‡¤SiºZºS¤sM¤SY¤tA¤Ra¤tK¤Qw¤sg¤Qw¤ri¤Rk¤rE—÷ß4{ßWßGßXß3Hß8ßG}}{ß1ß31ß3|¦´x´´y´‡¤Ss¤tU¤Tq¤uS¤Tg¤vk¤Si¤wY¤Rk¤wE¤R6¤v6¤Ra¤ty—÷ß4{ßWßGßXß3Hß8ßG}}{ß1ß32ß3|¦´x´´y´‡¤OC¤vQ¤Og¤wE¤OM¤x2¤NO¤xM¤Ma¤ws¤MQ¤vu¤NE¤vG—÷ß4{ßWßGßXß3Hß8ßG}}{ß1ß22ß3|{´x´¢-2Q´y´º3}÷ß4{ßWßCß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷ß8ßC}}{ß1ß24ß3|¦´x´´y´‡¤6w¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßWßCß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßXß3Kß3M£0.EWß8ßC}}{ß1ß28ß3|¦´x´´y´‡¤D4¤-A¤C6¢-42¤5eº3jº2ºo¢-6Iº2¢-6m¤42¢-9q¤50¢-Bm¤84¢-Bc¤BI¢-7Q¤D4¢-3Y¤B8¢-26¤84¤4C¤6w¤6c¤1S—÷ß4{ßWßCßXßYß3E»ß8ßC}}{ß1ß20ß3|{´x´ºo´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß3e÷ßWßCß8ßC}}{ß1ß23ß3|¦´x´´y´‡¤5eº3jº2ºoº3nº2º3o¤42º3u¤84¤4C¤6w¤6c¤1S—÷ß4{ßWßCßXß3Kß3MÊß8ßC}}{ß1ß26ß3|{´x´¢-BI´y´¤4q}÷ß4{ß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßWßCß8ßC}}{ß1ß2Eß3|¦´x´´y´‡¤5e¢-CG¤4g¢-8O¤8Yº3s¤9Wº3w¤F9¢-HE¤9W¢-BS—÷ß4{ßWßTßXß3Kß3MÝ9ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷ß8ßT}}{ß1ß2Nß3|¦´x´´y´‡¤Gw¢-Ky¤EC¢-Lc¤BS¢-KU¤4M¢-Ca¤3O¢-8i¤C6º3m¤D4¤-A¤Bm¤8s¤E2¤G8¤H6¤GI¤Ke¤9M¤WG¤84¤Wu¤2G¤Uy¢-Ay—÷ß4{ßWßTßXßYß3E»ß8ßT}}{ß1ß2Oß3|¦´x´´y´‡¤Wu¢-4C¤Waº3s—{´x´¤Vw´y´¢-5o´z´£0.3E}÷ß4{ßWßTßXßYß8ßT}´z´ÝA}{ß1ß2Aß3|{´x´¤G8´y´º3t}÷ß4{ßWßTß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷ß8ßT}}{ß1ß2Dß3|{´x´¤KA´y´¢-5A}÷ß4{ßWßTß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷ß8ßT}}{ß1ß2Jß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßWßTßXß3Kß8ßT}}{ß1ß2Bß3|{´x´¤Ss´y´¤-y}÷ß4{ßWßTß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ß8ßT}}{ß1ß2Cß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßWßTßXß3Rß6|¨tutorial room 2 switch¨÷ß8ßT}}{ß1ß2Fß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGº3j—÷ß4{ßWßTßX¨icon¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷ß8ßT}´z´£0.1c}{ß1ß2Hß3|{´x´¤AU´y´¢-K0}÷ß4{ßWßTß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷ß8ßT}}{ß1ß2Kß3|¦´x´´y´‡¤CQ¤y¤Ds¤FU¤HQ¤FU¤FU¤y—÷ß4{ßWßTßXß3Kß3MÝ9ß8ßT}}{ß1ß2Qß3|¦´x´´y´‡¢-Lm¢-IY¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßWßUßXß3Kß3M£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷ß8ßU}}{ß1ß2Yß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FKº46¢-Ds¢-8s¢-Fe¢-8Yº4O¢-A0º4E¢-DY¢-Ke—÷ß4{ßWßUßXß3Kß8ßU}}{ß1ß2bß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßWßUß39¨enemy_tutorial_easy¨ß3B»ß3CÊß8ßU}}{ß1ß2Rß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßWßUß39ß4Pß3B»ß3CÊß8ßU}}{ß1ß2aß3|¦´x´´y´‡¤3Oº45¤4Mº44¤e¢-GI¢-4Mº43¢-84¢-Oq¢-EC¢-PAº4F¢-I4¢-OM¢-FU¢-MQº4Wº3w¢-9Cº3u¢-76—÷ß4{ßWßUßXßYß3E»ß8ßU}}{ß1ß2Vß3|¦´x´´y´‡º3nº4e¤2F¢-5T¤4qº4Q¢-3F¢-Hl—÷ß4{ßWßUßXß3Kß3MÝCß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷ß8ßU}}{ß1ß2gß3|{´x´¢-L4´y´¤49}÷ß4{ßWßVß39¨enemy_tutorial_rock_room4¨ß3B»ß3CÊß8ßV}}{ß1ß2oß3|¦´x´´y´‡º4lº4Wº4jº4k¢-W6¢-Ck¢-Ygº49ºs¤Uº3h¤Kº3h¤7G¢-Is¤7Gº4v¤34º3g¤-U¢-J2¢-3Oº4Oº45—÷ß4{ßWßVßXßYß3E»ß8ßV}}{ß1ß2dß3|{´x´¢-QI´y´¢-7G}÷ß4{ßWßVß39¨collect_gun_basic¨ß3B»ß3CÊß3J»ß8ßV}}{ß1ß2eß3|{´x´º4y´y´º4z}÷ß4{ßWßVß39¨deco_gun_basic¨ß3B»ß3CÊß8ßV}}{ß1ß2kß3|¦´x´´y´‡¢-Kz¢-6w¢-Kj¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßWßVßXß4Fß8ßV}}{ß1ß2fß3|{´x´¢-Ue´y´¢-C6}÷ß4{ßWßVß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷ß8ßV}}{ß1ß2iß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßWßVß39¨enemy_tutorial_rocky¨ß3B»ß3CÊß3J»ß8ßV}}{ß1ß2jß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßWßVß39ß4Yß3B»ß3CÊß3J»ß8ßV}}{ß1ß2cß3|¦´x´´y´‡¢-OK¢-FkºA¢-Cu¢-Yqº49¢-Tq¤e¢-Ma¤Uº4v¢-3E¢-IEº4S—÷ß4{ßWßVßXß3Kß3M£1.4qß8ßV}}{ß1ß2hß3|{´x´¢-Ic´y´¤16}÷ß4{ßWßVß39¨switch¨ß3B»ß3CÊß8ßV}}{ß1ß2sß3|{´x´¤Fy´y´¤TW}÷ß4{ßWßGß39¨enemy_tutorial_boss¨ß3B»ß3CÊß8ßGß3J»}}{ß1ß2uß3|¦´x´´y´‡¤Pe¤fS¤Lw¤fc—÷ß4{ßQ»ß5¨tutorial_door¨ßWßGß6|¨tutorial room 5 door end path¨÷ß8ßG}}{ß1ß2qß3|¦´x´´y´‡¤KU¤GS¤HQ¤GI—÷ß4{ßQ»ß5ß4bßWßGß6|¨tutorial room 5 door start path¨÷ß8ßG}}{ß1ß2yß3|{´x´¤Tx´y´¤gx}÷ß4{ßWßGß39¨enemy_tutorial_easy_static¨ß3B»ß3CÊß8ßG}}{ß1ß2tß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºS¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fw¤Ue¤fw¤Vc¤jA¤Wu¤jA¤XO¤km¤W6¤km¤Y2¤rE¤Fo¤s2¤F0¤nC¤92¤h4¤9M¤gG¤AA¤g6¤1w¤X4¤4q¤M6—÷ß4{ßWßGßXßYß3E»ß8ßG}}{ß1ß37ß3|{´x´¤WV´y´¤jy}÷ß4{ßWßGß39¨enemy_tutorial_rocky_small¨ß3B»ß3CÊß8ßGß3J»}}{ß1ß2pß3|¦´x´´y´‡¤1w¤Ko¤1w¤cEºS¤bQ¤TM¤LI—÷ß4{ßWßGßXß3Kß8ßG}}{ß1ß35ß3|¦´x´´y´‡¤8s¤eK¤9g¤fI¤MG¤eo¤N4¤dq—÷ß4{ßWßGßXß3Kß3MÝDß8ßG}}{ß1ß2rß3|¦´x´´y´‡¤DE¤Gm¤CG¤HQ¤JC¤Hk¤IE¤H6—÷ß4{ßWßGßXß3Kß3MÝDß8ßG}}{ß1ß34ß3|¦´x´´y´‡¤DE¤g6¤Eg¤gu¤Kr¤ga¤V1¤fk¤ZU¤um¤Gc¤um¤H6¤ye¤Qw¤vu¤aI¤vW¤VI¤fI—÷ß4{ßWßGßXß3Kß3MÊß8ßG}}{ß1ß33ß3|¦´x´´y´‡¤NE¤vG¤MkºZ—÷ß4{ßWßGßXß3Rß8ßG}}{ß1ß2Sß3|¦´x´´y´‡º5Fº4mº7¢-9gº3q¢-B8—÷ß4{ßWßUßX¨spike¨ß8ßU}}{ß1ß2Tß3|¦´x´´y´‡º4v¢-EW¢-JWº4k¢-HG¢-G8—÷ß4{ßWßUßXß4gß8ßU}}{ß1ß2Uß3|¦´x´´y´‡¢-Af¢-PH¢-Bw¢-PKº3w¢-NO—÷ß4{ßWßUßXß4gß8ßU}}{ß1ß2lß3|¦´x´´y´‡¢-Iu¤5Sº4v¤34º3g¤-Uº4wº4xº4Oº45º4lº4W—÷ß4{ßWßVßXß1ißQ»ß8ßV}}{ß1ß21ß3|¦´x´´y´‡¢-38¤7Aº3u¤84¤4C¤6w¤6c¤1S¤D4¤-A—÷ß4{ßQ»ßWßCßXß1iß8ßC}}{ß1ß25ß3|¦´x´´y´‡¢-6e¤2Yº3o¤42—÷ß4{ßWßCßXß1ißQ»ß8ßC}}{ß1ß29ß3|¦´x´´y´‡¤Po¤gQºS¤Vw¤RG¤MG¤H6¤GI¤Ha¤CG¤Ke¤9M¤Ky¤84¤WG¤84¤WG¤4q¤Lm¤4q¤M8¤3G¤WN¤48¤Wj¤2G¤Ut¢-Ax¤NN¢-Bh¤Ls¢-H8¤Gp¢-Ip¤Dr¢-Gp—÷ß4{ßQ»ßWßTßXß1iß8ßT}}{ß1ß2Lß3|¦´x´´y´‡¤3Oº45¤9qº4n¤C6º3m—÷ß4{ßWßTßXß1ißQ»ß8ßT}}{ß1ß2mß3|¦´x´´y´‡º3h¤6Iº3h¤Kºs¤Uº4uº49º4sº4tº4jº4k—÷ß4{ßWßVßXß1ißQ»ß8ßV}}{ß1ß2Gß3|¦´x´´y´‡¤Cvº4M¤Bt¢-FS¤BS¢-Ao¤4Mº44—÷ß4{ßQ»ßWßTßXß1iß8ßT}}{ß1ß27ß3|¦´x´´y´‡¤C6º3m¤5eº3jº2ºoº3nº2¢-6T¤U—÷ß4{ßWßCßXß1ißQ»ß8ßC}}{ß1ß2Mß3|¦´x´´y´‡¤D4¤-A¤Bm¤8s¤EW¤C1¤E2¤G8¤4q¤M6¤26¤X4¤AA¤g6¤EC¤fw—÷ß4{ßQ»ßWßTßXß1iß8ßT}}{ß1ß2Xß3|¦´x´´y´‡º4lº4W¢-Jqº5Yº5X¢-CQº3wº4m¢-5eº5Uº3uº4n¤3Oº45—÷ß4{ßWßUßXß1ißQ»ß8ßU}}{ß1ß2Wß3|¦´x´´y´‡º4jº4kº4Fº4iº4wº5Wº4gº4hº4eº4fº4dº43º4Aº4P¤eº4c¤4Mº44—÷ß4{ßWßUßXß1ißQ»ß8ßU}}{ß1ß36ß3|¦´x´´y´‡¤Hu¤fm¤Lw¤fcºS¤Vw—÷ß4{ßQ»ßWßGßXß1iß8ßG}}{ß1ß2vß3|¦´x´´y´‡¤By¤i0¤G8¤mO¤RQ¤lG¤SE¤o0¤Gw¤p8—÷ß4{ßQ»ßWßGßXß1iß8ßG}}{ß1ß2wß3|¦´x´´y´‡¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤ZUº1o—÷ß4{ßQ»ßWßGßXß1iß8ßG}}{ß1ß2Pß3|¦´x´´y´‡¢-FAº5sº46º4Kº45º4Tº3yº4Oº4V¢-KAº4W¢-Koº4Iº4Oº5sº5s—÷ß4{ßWßUßXß3QßQ»ß8ßU}}{ß1ß2Zß3|¦´x´´y´‡º5sº5sº46º4Kº45º4Tº3yº4Oº4Vº5tº4Wº5uº4Iº4Oº5sº5s—÷ß4{ßWßUßXß3Qß8ßU}}{ß1ß3Oß3|¦´x´´y´´z´‡¢2Mc¢1IoÝ2º5v¢1MqÝ2—{´x´¢2Ia´y´º5x}{´x´º5y´y´º5w´z´Ý2}÷ß4{ßWß1gß8ßHß3B»}´z´Ý2}{ß1ß3Pß3|¦´x´´y´´z´‡¢2GH¢1PBÝ2º5z¢1TDÝ2¢2CFº61Ý2º62º60Ý2—÷ß4{ßWß1gß8ßHß3B»}´z´Ý2}{ß1ß4Rß3|¦´x´´y´‡º3vº5Mº3uº5U—÷ß4{ßWß2VßXß3TßQ»ß3J»ß8ßU}}{ß1ß47ß3|¦´x´´y´‡¤Hkº3o¤Gc¢-7a—÷ß4{ßWß2DßXß3TßQ»ß3J»ß8ßT}}{ß1ß3aß3|¦´x´´y´‡¤-Lº4xÒº3l¤xº3t¤1H¢-2u¤w¢-2P¤I¢-2F¤-M¢-2Z—÷ß4{ßWß20ßXß3Hß8ßC}}{ß1ß3bß3|¦´x´´y´‡¤2F¤5A¤2Z¤4W¤3N¤4C¤41¤4q¤41¤5o¤3D¤68¤2P¤5y—÷ß4{ßWß20ßXß3Hß8ßC}}{ß1ß3cß3|¦´x´´y´‡¢-5p¢-18¢-5fº2¢-4r¢-1w¢-4N¢-1Sº6D¤-o¢-51¤-U¢-5V¤-e—÷ß4{ßWß20ßXß3Hß8ßC}}{ß1ß3dß3|¦´x´´y´‡¢-3j¤5K¢-35¤50¢-2H¤50¢-1n¤5e¢-1x¤6c¢-2R¤5y¢-4B¤6G—÷ß4{ßWß20ßXß3Hß8ßC}}{ß1ß3eß3|¦´x´´y´‡º5o¤Uº5g¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßWß20ßX¨wall_tutorial_rock_breakable¨ß8ßC}}{ß1ß3tß3|¦´x´´y´‡¤Mn¢-3H¤Oxº4x¤Pu¢-4E¤PPºn¤OEº57¤Mz¢-6F¤MK¢-4z—÷ß4{ßWß2DßXß3Hß8ßT}}{ß1ß3uß3|¦´x´´y´‡¤Cl¢-48¤Doº3t¤Ee¢-47¤Ee¢-5F¤E8¢-6A¤Cjº6X¤C8¢-52—÷ß4{ßWß2DßXß3Hß8ßT}}{ß1ß3vß3|¦´x´´y´‡¤F9¢-41¤Gm¢-3s¤Ho¢-4Q¤Hq¢-5c¤Gh¢-6V¤Fbº6X¤Ew¢-59—÷ß4{ßWß2DßXß3Hß8ßT}}{ß1ß3wß3|¦´x´´y´‡¤Iw¢-3q¤Kv¢-3W¤Lp¢-4l¤Lk¢-67¤K1¢-6j¤IT¢-6D¤IA¢-4w—÷ß4{ßWß2DßXß3Hß8ßT}}{ß1ß3xß3|¦´x´´y´‡¤Hkº3o¤JCº3s¤JVº4m¤IR¢-A3¤H9¢-AJ¤GJ¢-96¤Gcº63—÷ß4{ßWß2DßXß3HßQ»ß8ßT}}{ß1ß3yß3|¦´x´´y´‡¤DD¢-FZ¤Dr¢-Fb¤EB¢-Fs¤EI¢-GO¤Drº5l¤D8¢-Gn¤Cvº4M—÷ß4{ßWß2DßXß3Hß8ßT}}{ß1ß3zß3|¦´x´´y´‡¤KZ¢-G2¤L2¢-Fn¤Lb¢-G0¤Lf¢-GR¤LJ¢-H1¤Km¢-H2¤KQ¢-GX—÷ß4{ßWß2DßXß3Hß8ßT}}{ß1ß4Qß3|¦´x´´y´‡º3uº5Uº6Eº5T¤Kº3p¤1mº5U¤1Sº4t¤Aº4Wº3vº5M—÷ß4{ßWß2VßXß3HßQ»ß8ßU}}{ß1ß4Vß3|¦´x´´y´‡¢-VIº5F¢-V8º44¢-UKº5Mº5Oº5qº5Oº3q¢-UUº40¢-Uyº3r—÷ß4{ßWß2fßXß3Hß8ßV}}{ß1ß4Wß3|¦´x´´y´‡¢-OWº6C¢-O2¢-2V¢-NJ¢-2fº5P¢-2G¢-Mkº3vº3h¤-yº4jº69—÷ß4{ßWß2fßXß3Hß8ßV}}{ß1ß4Xß3|¦´x´´y´‡¢-TMº3v¢-T2º6C¢-SEº7B¢-RQ¢-1m¢-RG¤-y¢-Ru¤-Kº7E¤-U—÷ß4{ßWß2fßXß3Hß8ßV}}{ß1ß40ß3|¦´x´´y´‡¤Fd¤1h¤GZ¤1y¤HJ¤1R¤HJ¤R¤GT¤-G¤FH¤-F¤Ew¤m—÷ß4{ßWß2DßXß3Hß8ßT}}{ß1ß41ß3|¦´x´´y´‡¤Hz¤1m¤J3¤1o¤JH¤19¤JA¤N¤IfÁ¤HlÒ¤Hb¤14—÷ß4{ßWß2DßXß3Hß8ßT}}{ß1ß42ß3|¦´x´´y´‡¤Jl¤1o¤Km¤2V¤Lr¤22¤MF¤h¤LQÒ¤K4¤B¤JX¤c—÷ß4{ßWß2DßXß3Hß8ßT}}{ß1ß44ß3|¦´x´´y´‡¤MQ¤2G¤NY¤2z¤PA¤2y¤Py¤2M¤Pw¤1A¤Oa¤R¤My¤V—÷ß4{ßWß2DßXß3Hß8ßT}}{ß1ß45ß3|¦´x´´y´‡¤QR¤2D¤R7ºE¤Rw¤2f¤SI¤1u¤S2¤16¤R7¤l¤QW¤18—÷ß4{ßWß2DßXß3Hß8ßT}}{ß1ß46ß3|¦´x´´y´‡¤Sn¤1x¤Uf¤2Jºl¤17¤Vo¤-L¤UV¤-k¤TG¤-G¤Sf¤h—÷ß4{ßWß2DßXß3Hß8ßT}}{ß1ß3Uß3|¦´x´´y´‡¤4X¤-T¤50¤-K¤4jÎ¤50¤-K¤3OÒ—÷ß4{ßWß22ßXß4FßQ»ß8ßC}´z´ÝB}{ß1ß3Vß3|¦´x´´y´‡º3m¤-yº3m¢-2aº6Eº4A¤-Uº47¤-Uº6C¤1N¢-2L¤1Sº3t¤5Kº7B—÷ß4{ßWß22ß39¨enemy_tutorial_bit¨ß3B»ß3CÎß8ßC}}{ß1ß3Wß3|¦´x´´y´‡¢-4W¤5eº3n¤3sºn¤-y¢-5K¤-Aº6a¤-yº4d¤3Eº5Q¤4g—÷ß4{ßWß22ß39ß4iß3B»ß3CÎß8ßC}}{ß1ß3Xß3|¦´x´´y´‡¤9Mº3v¤9s¤m—÷ß4{ßQ»ß5ß4bßWß24ß8ßC}}{ß1ß3Yß3|¦´x´´y´‡¤9Mº3v¤8q¢-3M—÷ß4{ß5ß4bßWß24ßQ»ß8ßC}}{ß1ß3Zß3|¦´x´´y´‡¤8E¢-34¤9C¤o¤AU¤U¤9Wº4x—÷ß4{ßWß24ßX¨deco¨ß5¨tutorial_door_floor¨ß8ßC}}{ß1ß3gß3|{´x´º49´y´¤AA}÷ß4{ßWß26ß39ß4Yß3B»ß3CÊß8ßC}}{ß1ß3hß3|{´x´¢-9M´y´¤6w}÷ß4{ßWß26ß39ß4Yß3B»ß3CÊß3J»ß8ßC}}{ß1ß3iß3|{´x´º5T´y´¤AA}÷ß4{ßWß26ß39ß4Yß3B»ß3CÊß3J»ß8ßC}}{ß1ß3mß3|¦´x´´y´‡¤A6¢-9m¤9g¢-9Q¤A5¢-93¤9gº7S¤BM¢-9O—÷ß4{ßWß2EßXß4FßQ»ß8ßT}´z´ÝB}{ß1ß3nß3|¦´x´´y´‡¤ER¢-5Z¤E8¢-56¤Dnº7V¤E8º7W¤E8º5g—÷ß4{ßWß2EßX¨icon_tutorial¨ßQ»ß8ßT}´z´ÝB}{ß1ß3oß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßWß2EßXß4lßQ»ß8ßT}´z´ÝB}{ß1ß43ß3|{´x´¤Dz´y´¤Y}÷ß4{ßWß2Dß39¨enemy_tutorial_block¨ß3B»ß3CÊß3J»ß8ßT}}{ß1ß48ß3|¦´x´´y´‡¤Maº5Q¤Lwº5Q¤LIº4x¤M4¢-4c¤M5º7W¤M1º6X¤KKº3o¤NOº3o¤Mgº3n¤M8º7W¤M7º7X—÷ß4{ßWß2Bß39ß4iß3B»ß3CÎß8ßT}}{ß1ß49ß3|¦´x´´y´‡ºS¤-U¤SO¤y¤RG¤U¤Py¤o¤SYº3v¤V8º3k¤Vcº3v—÷ß4{ßWß2Bß39ß4iß3CÎß3B»ß8ßT}}{ß1ß4Aß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßWß2Bß39ß4iß3B»ß3CÎß8ßT}}{ß1ß4Cß3|¦´x´´y´‡¤Ha¤Bm¤EW¤Bc¤C6¤8s¤D4¤1S¤GS¤2Q¤HQ¤1w¤JW¤26¤Ko¤2u¤Lw¤2Q¤K0¤9W—÷ß4{ßWß2Bß39ß4iß3C¤Cß3B»ß8ßT}}{ß1ß3kß3|¦´x´´y´‡¤76º3p¤6a¢-7m—÷ß4{ßQ»ß5ß4bßWß2Eß8ßT}}{ß1ß3lß3|¦´x´´y´‡¤76º3pºe¢-Bu—÷ß4{ßQ»ß5ß4bßWß2Eß8ßT}}{ß1ß3jß3|¦´x´´y´‡¤6wº5b¤5yº4e¤7G¢-7k¤8Eº3r—÷ß4{ßWß2EßXß4jß5ß4kß8ßT}}{ß1ß4Bß3|{´x´¤Hb´y´¢-C3}÷ß4{ßWß2Bß39¨enemy_tutorial_4way¨ß3B»ß3CÊß8ßT}}{ß1ß4Dß3|{´x´¤R6´y´¤5o}÷ß4{ßWß2Bß39¨enemy_tutorial_down¨ß3B»ß3CÊß8ßT}}{ß1ß4Eß3|{´x´¤FM´y´¢-7V}÷ß4{ßWß2Cß39ß4Zß3B»ß3CÊß8ßT}}{ß1ß4Gß3|¦´x´´y´‡¤E6¢-1h¤EB¢-21—÷ß4{ßWß2FßXß4FßQ»ß8ßT}´z´ÝB}{ß1ß4Hß3|¦´x´´y´‡¤E4¢-1X¤E4º7l—÷ß4{ßWß2FßXß4FßQ»ß8ßT}´z´ÝB}{ß1ß4Iß3|{´x´¤Eg´y´º5p}÷ß4{ßWß2Hß39ß4Yß3B»ß3CÊß3J»ß8ßT}}{ß1ß4Mß3|{´x´¤Bw´y´º4O}÷ß4{ßWß2Hß39ß4Yß3B»ß3CÊß3J»ß8ßT}}{ß1ß4Jß3|¦´x´´y´‡¤Ba¢-FT¤H1¢-JI¤Gl¢-L3¤E4¢-Lp¤BS¢-Ki¤9f¢-Il¤9j¢-GL—÷ß4{ßWß2HßXß3Kß3M£0.BIß8ßT}}{ß1ß4Kß3|¦´x´´y´‡¤D8º6t¤EC¢-FN—÷ß4{ßWß2HßXß3Rß8ßT}}{ß1ß4Nß3|¦´x´´y´‡º41¢-Eg¢-NE¢-Gw—÷ß4{ßQ»ß5ß4bßWß2Qß8ßU}}{ß1ß4Oß3|¦´x´´y´‡¢-LIº5Vº5uº4P¢-Mu¢-H6º5dºu—÷ß4{ßWß2QßXß4jß5ß4kß8ßU}}{ß1ß4cß3|¦´x´´y´‡¤Lw¤fc¤EC¤fw—÷ß4{ßWß2ußXß3Rß8ßG}}{ß1ß4dß3|¦´x´´y´‡¤HQ¤GI¤E2¤G8—÷ß4{ßWß2qßXß3Rß8ßG}}{ß1ß3pß3|¦´x´´y´‡¤Gh¢-43¤G8º3j¤FPº47—÷ß4{ßWß2AßXß4gß8ßT}}{ß1ß3qß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Keº2—÷ß4{ßWß2AßXß4gß8ßT}}{ß1ß3rß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Ojº68¤P3¢-5i¤Tdº6i¤PE¢-4S¤OX¢-3f¤OCº3v¤N9º3t—÷ß4{ßWß2AßXß4gß8ßT}}{ß1ß3sß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßWß2AßXß4gß8ßT}}{ß1ß3fß3|¦´x´´y´‡º6N¤6Gº3o¤42º3p¤50º88¤83º3r¤BIº3s¤D4º3t¤B8º5f¤7A—÷ß4{ßQ»ßWß26ßXß1iß8ßC}}{ß1ß4Lß3|¦´x´´y´‡¤Gpº5k¤GZº54¤E4¢-LR¤Bcº5G¤A0º5S¤A3¢-GT¤Btº5m—÷ß4{ßQ»ßWß2HßXß1iß8ßT}}÷¨icons¨|÷}");
