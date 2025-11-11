import { clone_object, make, maketype, override_object } from "../game/make.js";
import { vector, vector3, vector3_, AABB, AABB3 } from "./vector.js";

export interface map_shape_type {
  id: string,
  z: number,
  vertices: vector3_[],
  options: map_shape_options_type,
  // computed attributes, not part of definition
  computed?: map_shape_compute_type,
};

export interface map_shape_compute_type {
  aabb: AABB,
  aabb3: AABB3,
  mean: vector3,
  vertices: vector3[],
  screen_vertices?: vector3[],
  shadow_vertices?: vector3[],
  on_screen?: boolean,
  distance2?: number,
  depth?: number,
  options?: map_shape_options_type,
};

export interface map_shape_options_type extends maketype {
  // important options
  parent?: string,
  contains?: string[], // calculated
  make_id?: string,
  room_id?: string, // calculated

  // actual shape options
  open_loop?: boolean, // is the shape loop not closed? (e.g. this is true if the vertices are actually a list of 1d walls instead of a 2d shape)
  merge?: boolean, // merge shape with its parent? (use the same thing object)

  // sensor options
  sensor_fov_mult?: number,
  sensor_dont_set_room?: boolean,

  // spawner options
  is_spawner?: boolean,
  spawn_enemy?: string,
  spawn_repeat?: number,
  spawn_delay?: number,
  spawn_repeat_delay?: number,
  spawn_permanent?: boolean,

  // room options
  is_room?: boolean,
  room_connections?: string[],

  // floor options
  safe_floor?: boolean; // save player position when on this floor
};

export interface map_icon_type {
  icon: string,
  color: string,
};

export interface map_computed_type {
  shape_map: { [key: string]: map_shape_type },
  room_map: { [key: string]: string[] },
  shape_room: { [key: string]: string },
};

export interface map_type {

  shapes: map_shape_type[],
  icons?: map_icon_type[],
  computed?: map_computed_type,

};

export interface map_vertex_type {
  // for map maker ui
  shape: map_shape_type,
  vertex: vector3,
  vertex_old: vector3_[],
  id: string,
  index: number,
  new: boolean,
};

export interface style_type {
  stroke?: string,
  fill?: string,
  health?: string,
  width?: number,
  opacity?: number,
  stroke_opacity?: number,
  fill_opacity?: number,
  health_opacity?: number,
};

export type styles_type = {
  [key: string]: style_type,
};

export const map_serialiser = {

  initial_state: "",
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
        if (map.computed.shape_room[s.id]) room = map.computed.shape_room[s.id];
        if (map.computed.room_map[room] == undefined) map.computed.room_map[room] = [];
        map.computed.room_map[room].push(shape.id);
        map.computed.shape_room[shape.id] = room;
        shape.computed.depth = depth + (s.computed?.depth ?? 0);
      } else {
        shape.computed.depth = 1;
      }
    }
    // now sort shapes by depth
    map.shapes?.sort((s1, s2) => (s1.computed?.depth ?? 0) - (s2.computed?.depth ?? 0));

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
      const o = { id: s.id, vertices: vector3.round_list(s.vertices, 1), options: s.options } as any;
      if (s.z !== 0) o.z = s.z;
      m.shapes!.push(o);
    }
    for (const i of map.icons ?? []) {
      m.icons!.push({ icon: i.icon, color: i.color });
    }
    return m;
  },

  stringify: (map: map_type): string => {
    return zipson.stringify(map_serialiser.stringify_(map));
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
export const TEST_MAP: map_type = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢5Ca´y´É}÷¨options¨{¨style¨ß2¨contains¨|¨home wall 1¨÷}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ß8¨room_connections¨|¨tutorial room 1¨÷¨is_room¨»}}{ß1¨test group¨ß3|{´x´¢6x´y´¢7q}÷ß4{ß6|¨test 1¨÷¨open_loop¨«ß5¨test¨ß9|÷ßB»}}{ß1¨tutorial¨ß3|{´x´¢-Ty´y´¢-Xn}÷ß4{ß5ßGß6|ßA¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨¨tutorial room 5¨¨tutorial room 6¨÷}}{ß1ß7ß3|¦´x´´y´‡¢5iB¢-Kb¢5NL¢-Th¢54wºA¢4pd¢-Q7¢4ep¢-Fq¢4bf¢-36¢4fP¢CM¢4pM¢MS—÷ß4{ßE»¨parent¨ß2¨make_id¨¨wall_home¨}}{ß1ßDß3|¦´x´´y´‡¢7c¢46¢8u¢88—÷ß4{ßMßCßE»ßN¨wall¨ß5ßFß6|¨test 2¨÷}}{ß1ßAß3|{´x´¢-6A´y´¢-4y}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨¨tutorial room 1 floor¨÷ßMßGß5ßGßB»ß9|ßHßJß8ßI÷}}{ß1ßHß3|{´x´¢OW´y´¢-DP}÷ß4{ßMßGß5ßGß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨home wow test wow¨¨tutorial room 2 floor¨¨tutorial wall 14¨¨tutorial room 2 floor platform¨¨tutorial fake wall 5¨÷ßB»ß9|ßKßAßI÷}}{ß1ßIß3|{´x´¢-JV´y´¢-Te}÷ß4{ßMßGß5ßGß6|¨tutorial window 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨¨tutorial room 3 floor¨¨tutorial room 3 enemy 3¨÷ßB»ß9|ßIßJßHßA÷}}{ß1ßJß3|{´x´¢-Yy´y´¢-Ge}÷ß4{ßMßGß5ßGß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨¨tutorial room 4 floor¨÷ßB»ß9|ßIßA÷}}{ß1ßKß3|{´x´¢9t´y´¢GK}÷ß4{ßMßGß5ßGß6|¨tutorial room 5 sensor boss¨¨tutorial room 5 door start¨¨tutorial room 5 sensor boss start¨¨tutorial room 5 boss¨¨tutorial room 5 floor¨¨tutorial room 5 door end¨¨tutorial wall 15¨¨tutorial wall 16¨¨tutorial rock 23¨¨tutorial room 5 enemy¨¨tutorial rock 24¨¨tutorial rock 25¨¨tutorial rock 26¨¨tutorial rock 27¨¨tutorial room 5 switch path¨¨tutorial room 5 sensor middle¨¨tutorial room 5 sensor boss end¨÷ßB»ß9|ßHßL÷}}{ß1ßLß3|{´x´¢Ck´y´¢114}÷ß4{ßMßGß5ßGßB»ß9|ßK÷ß6|¨tutorial room 6 floor¨¨tutorial room 6 sensor start¨¨tutorial room 6 test train¨¨train¨¨tutorial wall 18¨¨tutorial wall 17¨÷}}{ß1ßoß3|{´x´¢Ii´y´¢3i}÷ß4{ßMßH¨spawn_enemy¨¨checkpoint¨¨is_spawner¨»¨spawn_repeat¨Ê}}{ß1ßQß3|¦´x´´y´‡¢8w¢4r¢9s¢7u—÷ß4{ßMßDßE»ßNßPß5ßF}}{ß1ß1dß3|¦´x´´y´‡¢Vr¢10u¢Ygºjºk¢14w¢Qcºlºmºj¢TRºj—÷ß4{ßMßLßN¨wall_train¨ßE»ß6|¨train floor¨÷}}{ß1ßjß3|¦´x´´y´‡¢Lm¢4q¢Ky¢84—÷ß4{ßMßHßN¨wall_tutorial_fake¨ßE»¨spawn_permanent¨»}}{ß1ß1Hß3|¦´x´´y´‡¢-M6¢-U¢-NY¤K—÷ß4{ßMßJßNß1mßE»ß1n»}}{ß1ßsß3|¦´x´´y´‡¢AA¢g6¢By¢i0—÷ß4{ßMßHßNß1mßE»ß1n»}}{ß1ß1Rß3|¦´x´´y´‡¢CQ¤ga¤DE¤gQ¤EM¤gu¤EW¤hs¤E2¤iM¤DO¤iWºa¤iC—÷ß4{ßMßKßN¨wall_tutorial_rock¨ßE»}}{ß1ß1Tß3|¦´x´´y´‡¤SO¤oe¤TC¤pS¤T2¤qa¤S4¤qu¤Qw¤qaºm¤pS¤RG¤oU—÷ß4{ßMßKßNß1o}}{ß1ß1Uß3|¦´x´´y´‡¤Si¤rO¤T2¤sM¤SY¤tA¤Ra¤tK¤Qw¤sg¤Qw¤ri¤Rk¤rE—÷ß4{ßMßKßNß1o}}{ß1ß1Vß3|¦´x´´y´‡¤Ss¤tU¤Tq¤uS¤Tg¤vk¤Si¤wY¤Rk¤wE¤R6¤v6¤Ra¤ty—÷ß4{ßMßKßNß1o}}{ß1ß1Wß3|¦´x´´y´‡¤OC¤vQ¤Og¤wE¤OM¤x2¤NO¤xM¤Ma¤ws¤MQ¤vu¤NE¤vG—÷ß4{ßMßKßNß1o}}{ß1ßTß3|{´x´¢-2Q´y´º2}÷ß4{ß5ßGßMßAß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷}}{ß1ßVß3|¦´x´´y´‡¤6w¢-2kºh¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßMßAß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßN¨sensor¨¨sensor_fov_mult¨£0.EW}}{ß1ßZß3|¦´x´´y´‡¤D4¤-A¤C6¢-42¤5eº10º1¢-50¢-6Iº1¢-6m¤42¢-9q¤50¢-Bmºr¢-Bc¤BI¢-7Q¤D4¢-3Y¤B8¢-26ºr¤4C¤6w¤6c¤1S—÷ß4{ßMßAßN¨floor_tutorial¨¨safe_floor¨»}}{ß1ßRß3|{´x´º14´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß23÷ßMßAß5ßG}}{ß1ßUß3|¦´x´´y´‡¤5eº10º1º14º15º1º16¤42º1Cºr¤4C¤6w¤6c¤1S—÷ß4{ßMßAßNß1vß1wÊ}}{ß1ßXß3|{´x´¢-BI´y´ºp}÷ß4{ß5ßGß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßMßA}}{ß1ßfß3|¦´x´´y´‡¤5e¢-CG¤4g¢-8O¤8Yº1A¤9Wº1E¤F9¢-HE¤9W¢-BS—÷ß4{ßMßHßNß1vß1wÝ0ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷}}{ß1ßpß3|¦´x´´y´‡¤Gw¢-Ky¤EC¢-Lc¤BS¢-KU¤4M¢-Ca¤3O¢-8i¤C6º13¤D4¤-A¤Bm¤8s¤E2¤G8¤H6¤GI¤Ke¤9M¤WGºr¤Wu¤2G¤Uy¢-Ay—÷ß4{ßMßHßNß1xß1y»}}{ß1ßrß3|¦´x´´y´‡¤Vmº13¤VS¢-7G¤Uo¢-5e—÷ß4{ßMßHßNß1x}´z´£0.3E}{ß1ßbß3|{´x´¤G8´y´º1B}÷ß4{ßMßHß5ßGß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷}}{ß1ßeß3|{´x´¤K7´y´¢-58}÷ß4{ßMßHß5ßGß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷}}{ß1ßkß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßMßHßNß1v}}{ß1ßcß3|{´x´¤Sl´y´¤-y}÷ß4{ßMßHß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ß5ßG}}{ß1ßdß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßMßHßN¨sensor_path¨ß6|¨tutorial room 2 switch¨÷}}{ß1ßgß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGº10—÷ß4{ßMßHßN¨icon_tutorial¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷}´z´£0.1c}{ß1ßiß3|{´x´¤AT´y´¢-Jz}÷ß4{ßMßHß5ßGß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷}}{ß1ßlß3|¦´x´´y´‡ºz¤y¤Ds¤FU¤HQ¤FU¤FU¤y—÷ß4{ßMßHßNß1vß1wÝ0}}{ß1ßuß3|¦´x´´y´‡¢-Lm¢-IY¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßMßIßNß1vß1w£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷}}{ß1ß12ß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FKº1O¢-Ds¢-8s¢-Fe¢-8Yº1g¢-A0¢-K0¢-DY¢-Ke—÷ß4{ßMßIßNß1v}}{ß1ßvß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßMßIß1g¨enemy_tutorial_easy¨ß1i»ß1jÊ}}{ß1ß15ß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßMßIß1gß2pß1i»ß1jÊ}}{ß1ß14ß3|¦´x´´y´‡¤3Oº1N¤4Mº1M¤e¢-GI¢-4Mº1L¢-84¢-Oq¢-EC¢-PAº1X¢-I4¢-OM¢-FU¢-MQº1pº1E¢-9Cº1C¢-76—÷ß4{ßMßIßNß1xß1y»}}{ß1ßzß3|¦´x´´y´‡º15º1x¤2F¢-5Tºpº1i¢-3F¢-Hl—÷ß4{ßMßIßNß1vß1wÝ3ß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷}}{ß1ß1Aß3|{´x´¢-L4´y´¤49}÷ß4{ßMßJß1g¨enemy_tutorial_rock_room4¨ß1i»ß1jÊ}}{ß1ß1Iß3|¦´x´´y´‡º24º1pº22º23¢-W6¢-Ck¢-Yg¢-5A¢-Tg¤Uºu¤Kºu¤7G¢-Is¤7Gº2G¤34ºsºt¢-J2¢-3Oº1gº1N—÷ß4{ßMßJßNß1xß1y»}}{ß1ß17ß3|{´x´¢-QI´y´º1P}÷ß4{ßMßJß1g¨collect_gun_basic¨ß1i»ß1jÊß1n»}}{ß1ß18ß3|{´x´º2J´y´º1P}÷ß4{ßMßJß1g¨deco_gun_basic¨ß1i»ß1jÊ}}{ß1ß1Eß3|¦´x´´y´‡¢-Kz¢-6w¢-Kj¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßMßJßNß2f}}{ß1ß19ß3|{´x´¢-UG´y´¢-Ej}÷ß4{ßMßJß5ßGß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷}}{ß1ß1Cß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßMßJß1g¨enemy_tutorial_rocky¨ß1i»ß1jÊß1n»}}{ß1ß1Dß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßMßJß1gß2yß1i»ß1jÊß1n»}}{ß1ß16ß3|¦´x´´y´‡¢-OK¢-Fk¢-WG¢-Cu¢-Yqº2E¢-Tq¤e¢-Ma¤Uº2G¢-3E¢-IEº1k—÷ß4{ßMßJßNß1vß1w£1.4q}}{ß1ß1Bß3|{´x´¢-Ic´y´¤16}÷ß4{ßMßJß1g¨switch¨ß1i»ß1jÊ}}{ß1ß1Mß3|{´x´¤Fq´y´¤TU}÷ß4{ßMßKß1g¨enemy_tutorial_boss¨ß1i»ß1jÊ}}{ß1ß1Oß3|¦´x´´y´‡¤Lc¤fc¤Hu¤fm—÷ß4{ßE»ß5¨tutorial_door¨ßMßKß6|¨tutorial room 5 door end path¨÷}}{ß1ß1Kß3|¦´x´´y´‡¤KU¤GS¤HQ¤GI—÷ß4{ßE»ß5ß31ßMßKß6|¨tutorial room 5 door start path¨÷}}{ß1ß1Sß3|{´x´¤Tx´y´¤gx}÷ß4{ßMßKß1g¨enemy_tutorial_easy_static¨ß1i»ß1jÊ}}{ß1ß1Nß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MG¤T2¤Vw¤Lw¤fc¤Ue¤fw¤Z0¤uS¤RG¤w4¤Gw¤yy¤FA¤nC¤92¤h4¤9M¤gGºvºw¤1w¤X4ºp¤M6—÷ß4{ßMßKßNß1xß1y»}}{ß1ß1Jß3|¦´x´´y´‡¤1w¤Ko¤1w¤cE¤T2¤bQ¤TM¤LI—÷ß4{ßMßKßNß1v}}{ß1ß1Zß3|¦´x´´y´‡¤8s¤eK¤9g¤fI¤MG¤eo¤N4¤dq—÷ß4{ßMßKßNß1vß1wÝ4}}{ß1ß1Lß3|¦´x´´y´‡¤DE¤Gm¤CG¤HQ¤JC¤Hk¤IE¤H6—÷ß4{ßMßKßNß1vß1wÝ4}}{ß1ß1Yß3|¦´x´´y´‡¤DEºw¤Eg¤guºq¤ga¤Lc¤fm—÷ß4{ßMßKßNß1vß1wÊ}}{ß1ß1Xß3|¦´x´´y´‡¤NE¤vG¤Mk¤rO—÷ß4{ßMßKßNß2d}}{ß1ß1aß3|¦´x´´y´‡¤aI¤w4¤ZU¤w4¤Z0¤uS¤RG¤w4¤Gw¤yy¤Gw¢17M¤ZUº2o¤aIº2o¤aI¢130—÷ß4{ßMßLßNß1xß1y»}}{ß1ß1bß3|¦´x´´y´‡¤T2¤wY¤T2¤xg¤ZU¤xg¤ZU¤wY—÷ß4{ßMßLßNß1v}}{ß1ß1cß3|{´x´ºc´y´¢164}÷ß4{ßMßLß1gß1hß1i»ß1jÊ}}{ß1ßwß3|¦´x´´y´‡¢-C6º25¢-D4¢-9gº18¢-B8—÷ß4{ßMßIßN¨wall_tutorial_spike¨}}{ß1ßxß3|¦´x´´y´‡º2G¢-EW¢-JWº23¢-HG¢-G8—÷ß4{ßMßIßNß35}}{ß1ßyß3|¦´x´´y´‡¢-Af¢-PH¢-Bw¢-PKº1E¢-NO—÷ß4{ßMßIßNß35}}{ß1ß1Fß3|¦´x´´y´‡¢-Iu¤5Sº2G¤34ºsºtº2Hº2Iº1gº1Nº24º1p—÷ß4{ßMßJßN¨wall_tutorial¨ßE»}}{ß1ßSß3|¦´x´´y´‡¢-38¤7Aº1Cºr¤4C¤6w¤6c¤1S¤D4¤-A—÷ß4{ßE»ßMßAßNß36}}{ß1ßWß3|¦´x´´y´‡¢-6e¤2Yº16¤42—÷ß4{ßMßAßNß36ßE»}}{ß1ßaß3|¦´x´´y´‡¤Lw¤fc¤T2¤Vw¤RG¤MG¤H6¤GI¤Ha¤CG¤Ke¤9Mºqºr¤WGºr¤WGºpºoºp¤M8¤3G¤WN¤48¤Wj¤2G¤Ut¢-Ax¤NN¢-Bh¤Ls¢-H8¤Gp¢-Ip¤Dr¢-Gp—÷ß4{ßE»ßMßHßNß36}}{ß1ßmß3|¦´x´´y´‡¤3Oº1N¤9qº26¤C6º13—÷ß4{ßMßHßNß36ßE»}}{ß1ß1Gß3|¦´x´´y´‡ºu¤6Iºu¤Kº2F¤Uº2Dº2Eº2Bº2Cº22º23—÷ß4{ßMßJßNß36ßE»}}{ß1ßhß3|¦´x´´y´‡¤Cvº1e¤Bt¢-FS¤BS¢-Ao¤4Mº1M—÷ß4{ßE»ßMßHßNß36}}{ß1ßYß3|¦´x´´y´‡¤C6º13¤5eº10º1º14º15º1¢-6T¤U—÷ß4{ßMßAßNß36ßE»}}{ß1ßnß3|¦´x´´y´‡¤D4¤-A¤Bm¤8s¤EW¤C1¤E2¤G8ºp¤M6¤26¤X4ºvºw¤EC¤fw—÷ß4{ßE»ßMßHßNß36}}{ß1ß11ß3|¦´x´´y´‡º24º1p¢-Jqº2yº2x¢-CQº1Eº25º1Qº2uº1Cº26¤3Oº1N—÷ß4{ßMßIßNß36ßE»}}{ß1ß10ß3|¦´x´´y´‡º22º23º1Xº21º2Hº2wº1zº20º1xº1yº1wº1Lº1Sº1h¤eº1v¤4Mº1M—÷ß4{ßMßIßNß36ßE»}}{ß1ßqß3|¦´x´´y´‡¤Hu¤fm¤Lw¤fc—÷ß4{ßE»ßMßHßNß36}}{ß1ß1Pß3|¦´x´´y´‡ºxºy¤G8¤mO¤RQ¤lG¤SE¤o0¤Gw¤p8—÷ß4{ßE»ßMßKßNß36}}{ß1ß1Qß3|¦´x´´y´‡¤Lw¤fcºq¤gu¤Ue¤fw¤ZU¤w4¤ZU¢106—÷ß4{ßE»ßMßKßNß36}}{ß1ß1fß3|¦´x´´y´‡¤RG¤w4¤Op¤wi—÷ß4{ßE»ßMßLßNß36}}{ß1ß1eß3|¦´x´´y´‡¤Mk¤xM¤Gw¤yy¤Gwº2o¤ZUº2o¤ZU¢15k—÷ß4{ßE»ßMßLßNß36}}{ß1ßtß3|¦´x´´y´‡¢-FAº3Jº1Oº1cº1Nº1lº1Gº1gº1n¢-KAº1p¢-Koº1aº1gº3Jº3J—÷ß4{ßMßIßN¨wall_tutorial_window¨ßE»}}{ß1ß13ß3|¦´x´´y´‡º3Jº3Jº1Oº1cº1Nº1lº1Gº1gº1nº3Kº1pº3Lº1aº1gº3Jº3J—÷ß4{ßMßIßNß37}}{ß1ß1lß3|¦´x´´y´‡ºkºjºmºjºmºlºkºl—÷ß4{ßMß1dßN¨floor_train¨ß1y»}}{ß1ß2rß3|¦´x´´y´‡º1Dº2hº1Cº2u—÷ß4{ßMßzßNß1mßE»ß1n»}}{ß1ß2Wß3|¦´x´´y´‡¤Hkº16¤Gc¢-7a—÷ß4{ßMßeßNß1mßE»ß1n»}}{ß1ß1zß3|¦´x´´y´‡¤-Lº2IÒº12¤xº1B¤1H¢-2u¤w¢-2P¤I¢-2F¤-M¢-2Z—÷ß4{ßMßRßNß1o}}{ß1ß20ß3|¦´x´´y´‡¤2F¤5A¤2Z¤4W¤3N¤4C¤41ºp¤41¤5o¤3D¤68¤2P¤5y—÷ß4{ßMßRßNß1o}}{ß1ß21ß3|¦´x´´y´‡¢-5p¢-18¢-5fº1¢-4r¢-1w¢-4N¢-1Sº3W¤-o¢-51ºt¢-5V¤-e—÷ß4{ßMßRßNß1o}}{ß1ß22ß3|¦´x´´y´‡¢-3j¤5K¢-35¤50¢-2H¤50¢-1n¤5e¢-1x¤6c¢-2R¤5y¢-4B¤6G—÷ß4{ßMßRßNß1o}}{ß1ß23ß3|¦´x´´y´‡º3E¤Uº36¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßMßRßN¨wall_tutorial_rock_breakable¨}}{ß1ß2Iß3|¦´x´´y´‡¤Mn¢-3H¤Oxº2I¤Pu¢-4E¤PP¢-68¤OEº2R¤Mz¢-6F¤MK¢-4z—÷ß4{ßMßeßNß1o}}{ß1ß2Jß3|¦´x´´y´‡¤Cl¢-48¤Doº1B¤Ee¢-47¤Ee¢-5F¤E8ºQ¤CjºQ¤C8¢-52—÷ß4{ßMßeßNß1o}}{ß1ß2Kß3|¦´x´´y´‡¤F9¢-41¤Gm¢-3s¤Ho¢-4Q¤Hq¢-5c¤Gh¢-6V¤FbºQ¤Ew¢-59—÷ß4{ßMßeßNß1o}}{ß1ß2Lß3|¦´x´´y´‡¤Iw¢-3q¤Kv¢-3W¤Lp¢-4l¤Lk¢-67¤K1¢-6j¤IT¢-6D¤IA¢-4w—÷ß4{ßMßeßNß1o}}{ß1ß2Mß3|¦´x´´y´‡¤Hkº16¤JCº1A¤JVº25¤IR¢-A3¤H9¢-AJ¤GJ¢-96¤Gcº3M—÷ß4{ßMßeßNß1oßE»}}{ß1ß2Nß3|¦´x´´y´‡¤DD¢-FZ¤Dr¢-Fb¤EB¢-Fs¤EI¢-GO¤Drº3B¤D8¢-Gn¤Cvº1e—÷ß4{ßMßeßNß1o}}{ß1ß2Oß3|¦´x´´y´‡¤KZ¢-G2¤L2¢-Fn¤Lb¢-G0¤Lf¢-GR¤LJ¢-H1¤Km¢-H2¤KQ¢-GX—÷ß4{ßMßeßNß1o}}{ß1ß2qß3|¦´x´´y´‡º1Cº2uº3Xº2t¤Kº17¤1mº2u¤1Sº2C¤Aº1pº1Dº2h—÷ß4{ßMßzßNß1oßE»}}{ß1ß2vß3|¦´x´´y´‡¢-VIº2r¢-V8º1M¢-UKº2hº2jº3Gº2jº18¢-UUº1I¢-Uyº19—÷ß4{ßMß19ßNß1o}}{ß1ß2wß3|¦´x´´y´‡¢-OWº3V¢-O2¢-2V¢-NJ¢-2fº2k¢-2G¢-Mkº1Dºu¤-yº22º3S—÷ß4{ßMß19ßNß1o}}{ß1ß2xß3|¦´x´´y´‡¢-TMº1D¢-T2º3V¢-SEº4U¢-RQ¢-1m¢-RG¤-y¢-Ru¤-Kº4Xºt—÷ß4{ßMß19ßNß1o}}{ß1ß2Pß3|¦´x´´y´‡¤Fd¤1h¤GZ¤1y¤HJ¤1R¤HJ¤R¤GT¤-G¤FH¤-F¤Ew¤m—÷ß4{ßMßeßNß1o}}{ß1ß2Qß3|¦´x´´y´‡¤Hz¤1m¤J3¤1o¤JH¤19¤JA¤N¤IfÁ¤HlÒ¤Hb¤14—÷ß4{ßMßeßNß1o}}{ß1ß2Rß3|¦´x´´y´‡¤Jl¤1o¤Km¤2V¤Lr¤22¤MF¤h¤LQÒ¤K4¤B¤JX¤c—÷ß4{ßMßeßNß1o}}{ß1ß2Tß3|¦´x´´y´‡¤MQ¤2G¤NY¤2z¤PA¤2y¤Py¤2M¤Pw¤1A¤Oa¤R¤My¤V—÷ß4{ßMßeßNß1o}}{ß1ß2Uß3|¦´x´´y´‡¤QR¤2D¤R7¤2m¤Rw¤2f¤SI¤1u¤S2¤16¤R7¤l¤QW¤18—÷ß4{ßMßeßNß1o}}{ß1ß2Vß3|¦´x´´y´‡¤Sn¤1x¤Uf¤2Jºi¤17¤Vo¤-L¤UV¤-k¤TG¤-G¤Sf¤h—÷ß4{ßMßeßNß1o}}{ß1ß1pß3|¦´x´´y´‡¤4X¤-T¤50¤-K¤4jÎ¤50¤-K¤3OÒ—÷ß4{ßMßTßNß2fßE»}´z´Ý2}{ß1ß1qß3|¦´x´´y´‡º13¤-yº13¢-2aº3Xº1Sºt¢-4Cºtº3V¤1N¢-2L¤1Sº1B¤5Kº4U—÷ß4{ßMßTß1g¨enemy_tutorial_bit¨ß1i»ß1jÎ}}{ß1ß1rß3|¦´x´´y´‡¢-4W¤5eº15¤3sº3l¤-y¢-5K¤-Aº3t¤-yº1w¤3Eº2l¤4g—÷ß4{ßMßTß1gß3Aß1i»ß1jÎ}}{ß1ß1sß3|¦´x´´y´‡¤9Mº1Dºg¤m—÷ß4{ßE»ß5ß31ßMßV}}{ß1ß1tß3|¦´x´´y´‡¤9Mº1D¤8q¢-3M—÷ß4{ß5ß31ßMßVßE»}}{ß1ß1uß3|¦´x´´y´‡¤8E¢-34¤9C¤o¤AU¤U¤9Wº2I—÷ß4{ßMßVßN¨deco¨ß5¨tutorial_door_floor¨}}{ß1ß25ß3|{´x´¢-5B´y´¤A9}÷ß4{ßMßXß1gß2yß1i»ß1jÊ}}{ß1ß26ß3|{´x´¢-9P´y´¤71}÷ß4{ßMßXß1gß2yß1i»ß1jÊß1n»}}{ß1ß27ß3|{´x´¢-9i´y´¤A7}÷ß4{ßMßXß1gß2yß1i»ß1jÊß1n»}}{ß1ß2Bß3|¦´x´´y´‡¤A6¢-9m¤9g¢-9Q¤A5¢-93¤9gº4o¤BM¢-9O—÷ß4{ßMßfßNß2fßE»}´z´Ý2}{ß1ß2Cß3|¦´x´´y´‡¤ER¢-5Z¤E8¢-56¤Dnº4r¤E8º4s¤E8º36—÷ß4{ßMßfßNß2fßE»}´z´Ý2}{ß1ß2Dß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßMßfßNß2fßE»}´z´Ý2}{ß1ß2Sß3|{´x´¤Dz´y´¤Y}÷ß4{ßMßeß1g¨enemy_tutorial_block¨ß1i»ß1jÊß1n»}}{ß1ß2Xß3|¦´x´´y´‡¤MZº28¤Lx¢-3K¤LH¢-3R¤M4¢-4c¤M5º4s¤M1ºQ¤KK¢-6r¤NVº36¤Mgº15¤M8º4s¤M7º4v—÷ß4{ßMßcß1gß3Aß1i»ß1jÎ}}{ß1ß2Yß3|¦´x´´y´‡¤TB¤-T¤SI¤x¤RG¤X¤Q1¤i¤SY¢-1F¤Uy¢-2n¤VZ¢-1G—÷ß4{ßMßcß1gß3Aß1jÎß1i»}}{ß1ß2Zß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßMßcß1gß3Aß1i»ß1jÎ}}{ß1ß2bß3|¦´x´´y´‡¤Ha¤Bm¤EW¤Bc¤C6¤8s¤D4¤1S¤GS¤2Q¤HQ¤1w¤JW¤26¤Ko¤2u¤Lw¤2Q¤K0¤9W—÷ß4{ßMßcß1gß3Aß1j¤Cß1i»}}{ß1ß29ß3|¦´x´´y´‡¤76º17¤6a¢-7m—÷ß4{ßE»ß5ß31ßMßf}}{ß1ß2Aß3|¦´x´´y´‡¤76º17ºM¢-Bu—÷ß4{ßE»ß5ß31ßMßf}}{ß1ß28ß3|¦´x´´y´‡¤6wº31¤5yº1x¤7G¢-7k¤8Eº19—÷ß4{ßMßfßNß3Bß5ß3C}}{ß1ß2aß3|{´x´¤Hb´y´¢-C3}÷ß4{ßMßcß1g¨enemy_tutorial_4way¨ß1i»ß1jÊ}}{ß1ß2cß3|{´x´¤R6´y´¤5o}÷ß4{ßMßcß1g¨enemy_tutorial_down¨ß1i»ß1jÊ}}{ß1ß2eß3|{´x´¤FM´y´¢-7V}÷ß4{ßMßdß1gß2zß1i»ß1jÊ}}{ß1ß2gß3|¦´x´´y´‡¤E6¢-1h¤EB¢-21—÷ß4{ßMßgßNß2fßE»}´z´Ý2}{ß1ß2hß3|¦´x´´y´‡¤E4¢-1X¤E4º5D—÷ß4{ßMßgßNß2fßE»}´z´Ý2}{ß1ß2iß3|{´x´¤Ei´y´¢-Jr}÷ß4{ßMßiß1gß2yß1i»ß1jÊß1n»}}{ß1ß2mß3|{´x´¤Bv´y´¢-IN}÷ß4{ßMßiß1gß2yß1i»ß1jÊß1n»}}{ß1ß2jß3|¦´x´´y´‡¤Ba¢-FT¤H1¢-JI¤Gl¢-L3¤E4¢-Lp¤BS¢-Ki¤9f¢-Il¤9j¢-GL—÷ß4{ßMßißNß1vß1w£0.BI}}{ß1ß2kß3|¦´x´´y´‡¤D8º4C¤EC¢-FN—÷ß4{ßMßißNß2d}}{ß1ß2nß3|¦´x´´y´‡º1J¢-Eg¢-NE¢-Gw—÷ß4{ßE»ß5ß31ßMßu}}{ß1ß2oß3|¦´x´´y´‡¢-LIº2vº3Lº1h¢-Mu¢-H6º33¢-Gc—÷ß4{ßMßußNß3Bß5ß3C}}{ß1ß32ß3|¦´x´´y´‡¤Hu¤fm¤EC¤fw—÷ß4{ßMß1OßNß2d}}{ß1ß33ß3|¦´x´´y´‡¤HQ¤GI¤E2¤G8—÷ß4{ßMß1KßNß2d}}{ß1ß2Eß3|¦´x´´y´‡¤Gh¢-43¤G8º10¤FPº4e—÷ß4{ßMßbßNß35}}{ß1ß2Fß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Keº1—÷ß4{ßMßbßNß35}}{ß1ß2Gß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Ojº3R¤P3¢-5i¤Tdº41¤PE¢-4S¤OX¢-3f¤OCº1D¤N9º1B—÷ß4{ßMßbßNß35}}{ß1ß2Hß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßMßbßNß35}}{ß1ß24ß3|¦´x´´y´‡º3g¤6Gº16¤42º17¤50º5d¤83º19¤BIº1A¤D4º1B¤B8º35¤7A—÷ß4{ßE»ßMßXßNß36}}{ß1ß2lß3|¦´x´´y´‡¤Gpº3A¤GZº2O¤E4¢-LR¤Bcº2a¤A0º2n¤A3¢-GT¤Btº3C—÷ß4{ßE»ßMßißNß36}}÷¨icons¨|÷}");

const TEST_MAP_: map_type = {
  shapes: [
    /*
    // todo imagine rendering these 2 "arch" shapes with shadows accurately...
    {
      id: "arch_1",
      z: 0,
      vertices: [
        { x: 100, y: 100, z: 0, }, { x: 100, y: 0, z: 1, },
        { x: 700, y: 0, z: 1, }, { x: 700, y: 100, z: 0, }, { x: 500, y: 100, z: 0, },
        { x: 500, y: 50, z: 0.5, }, { x: 300, y: 50, z: 0.5, },
        { x: 300, y: 100, z: 0, },
        // { x: 100, y: 100, z: 0, }
      ],
      style: { stroke: "white", fill: "#563412", fill_opacity: 0.5, }
    },
    {
      id: "arch_2",
      z: 0,
      vertices: [
        { x: 100, y: -100, z: 0, }, { x: 100, y: 0, z: 1, },
        { x: 700, y: 0, z: 1, }, { x: 700, y: -100, z: 0, }, { x: 500, y: -100, z: 0, },
        { x: 500, y: -50, z: 0.5, }, { x: 300, y: -50, z: 0.5, },
        { x: 300, y: -100, z: 0, },
        // { x: 100, y: -100, z: 0, }
      ],
      style: { stroke: "white", fill: "#123456", fill_opacity: 0.5, }
    },
    */
    {
      id: "start",
      z: 0,
      vertices: [
        { x: 0, y: 0 },
      ],
      options: { open_loop: false, style: "start" }
    },
    {
      id: "a random square",
      z: 0,
      vertices: [
        { x: 50, y: 50 },
        { x: 50, y: 250 },
        { x: 250, y: 250 },
        { x: 250, y: 50 },
        { x: 350, y: -50 },
      ],
      options: { open_loop: true, parent: "wall 1", style: "test" }
    },
    {
      id: "wall 1",
      z: 0,
      vertices: [
        { x: -200, y: 160 },
        { x: -360, y: 160 },
        { x: -360, y: 0 },
        { x: -200, y: 0 },
      ],
      options: { open_loop: false, contains: ["a random square"], style: "test" }
    },
    /*
    {
      id: "hovering above a random square is another random square", // i don't intend for IDs to be this long usually but now i can't resist the temptation for close to 200-character long lines...
      z: 0.5,
      vertices: [
        { x: 0, y: 0, },
        { x: 0, y: 200, },
        { x: 200, y: 200, },
        { x: 200, y: 0, },
      ],
      options: { part_of: "a random square" },
      style: { stroke: "transparent", fill: "#123456", fill_opacity: 0.6, }
    },
    {
      id: "hovering 1",
      z: 0.25,
      vertices: [
        { x: 0, y: 0, },
        { x: 0, y: 200, },
        { x: 200, y: 200, },
        { x: 200, y: 0, },
      ],
      options: { part_of: "a random square" },
      style: { stroke: "transparent", fill: "#123456", fill_opacity: 0.7, }
    },
    {
      id: "hovering 3",
      z: 0.75,
      vertices: [
        { x: 0, y: 0, },
        { x: 0, y: 200, },
        { x: 200, y: 200, },
        { x: 200, y: 0, },
      ],
      options: { part_of: "a random square" },
      style: { stroke: "transparent", fill: "#123456", fill_opacity: 0.5, }
    },
    */
    /*
    {
      id: "hovering wall 1",
      z: 0,
      vertices: [
        { x: -200, y: 0, z: 0.5, },
        { x: -200, y: 200, z: 0.5 },
        { x: 0, y: 200, z: 1 },
        { x: 0, y: 0, z: 1 },
      ],
      options: { part_of: "a random square" },
      style: { stroke: "transparent", fill: "#123456", fill_opacity: 0.5, }
    },
    {
      id: "hovering wall 2",
      z: 0,
      vertices: [
        { x: 0, y: 200, z: 0, },
        { x: 200, y: 200, z: 0 },
        { x: 200, y: 200, z: 1 },
        { x: 0, y: 200, z: 1 },
      ],
      options: { part_of: "a random square" },
      style: { stroke: "transparent", fill: "#123456", fill_opacity: 0.5, }
    },
    {
      id: "hovering wall 3",
      z: 0,
      vertices: [
        { x: 200, y: 200, z: 0, },
        { x: 200, y: 0, z: 0 },
        { x: 200, y: 0, z: 1 },
        { x: 200, y: 200, z: 1 },
      ],
      options: { part_of: "a random square" },
      style: { stroke: "transparent", fill: "#123456", fill_opacity: 0.5, }
    },
    {
      id: "hovering wall 4",
      z: 0,
      vertices: [
        { x: 200, y: 0, z: 0, },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 200, y: 0, z: 1 },
      ],
      options: { part_of: "a random square" },
      style: { stroke: "transparent", fill: "#123456", fill_opacity: 0.5, }
    },
    */
  ],
  icons: [],
};