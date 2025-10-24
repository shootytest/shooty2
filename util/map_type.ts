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
export const TEST_MAP: map_type = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢5Ca´y´É}÷¨options¨{¨style¨ß2¨contains¨|¨home wall 1¨÷}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ß8¨room_connections¨|¨tutorial room 1¨÷¨is_room¨»}}{ß1¨test group¨ß3|{´x´¢6x´y´¢7q}÷ß4{ß6|¨test 1¨÷¨open_loop¨«ß5¨test¨ß9|÷ßB»}}{ß1¨tutorial¨ß3|{´x´¢-Ty´y´¢-Xn}÷ß4{ß5ßGß6|ßA¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨¨tutorial room 5¨÷}}{ß1ß7ß3|¦´x´´y´‡¢5iB¢-Kb¢5NL¢-Th¢54wºA¢4pd¢-Q7¢4ep¢-Fq¢4bf¢-36¢4fP¢CM¢4pM¢MS—÷ß4{ßE»¨parent¨ß2¨make_id¨¨wall_home¨}}{ß1ßDß3|¦´x´´y´‡¢7c¢46¢8u¢88—÷ß4{ßLßCßE»ßM¨wall¨ß5ßFß6|¨test 2¨÷}}{ß1ßAß3|{´x´¢-6A´y´¢-4y}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨÷ßLßGß5ßGßB»ß9|ßHßJß8ßI÷}}{ß1ßHß3|{´x´¢OW´y´¢-DP}÷ß4{ßLßGß5ßGß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨home wow test wow¨÷ßB»ß9|ßKßAßI÷}}{ß1ßIß3|{´x´¢-JV´y´¢-Te}÷ß4{ßLßGß5ßGß6|¨tutorial window 1¨¨tutorial room 3 enemy 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨÷ßB»ß9|ßIßJßHßA÷}}{ß1ßJß3|{´x´¢-Yy´y´¢-Ge}÷ß4{ßLßGß5ßGß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨÷ßB»ß9|ßIßA÷}}{ß1ßKß3|{´x´¢9t´y´¢GK}÷ß4{ßLßGß5ßGß6|¨tutorial room 5 sensor¨¨tutorial room 5 switch path¨¨tutorial room 5 door¨¨tutorial room 5 sensor start¨¨tutorial room 5 boss¨÷ßB»ß9|ßH÷}}{ß1ßmß3|{´x´¢GW´y´¢6R}÷ß4{ßLßH¨spawn_enemy¨¨checkpoint¨¨is_spawner¨»¨spawn_repeat¨Ê}}{ß1ßPß3|¦´x´´y´‡¢8w¢4r¢9s¢7u—÷ß4{ßLßDßE»ßMßOß5ßF}}{ß1ßhß3|¦´x´´y´‡¢Lm¢4q¢Ky¢84—÷ß4{ßLßHßM¨wall_tutorial_fake¨ßE»¨spawn_permanent¨»}}{ß1ß1Aß3|¦´x´´y´‡¢-M7¢-T¢-Nd¤K—÷ß4{ßLßJßMß1KßE»ß1L»}}{ß1ßSß3|{´x´¢-2Q´y´º2}÷ß4{ß5ßGßLßAß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷}}{ß1ßUß3|¦´x´´y´‡¢6w¢-2kºf¢18¢Bm¤A¢Ao¢-3i—÷ß4{ßLßAß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßM¨sensor¨¨sensor_fov_mult¨£0.EW}}{ß1ßQß3|{´x´¢-50´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß1Y÷ßLßAß5ßG}}{ß1ßTß3|¦´x´´y´‡¢5eºnº1ºu¢-6Iº1¢-6m¢42¢-26ºj¤4Cºo¤6c¤1S—÷ß4{ßLßAßMß1Sß1TÊ}}{ß1ßWß3|{´x´¢-BI´y´ºh}÷ß4{ß5ßGß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßLßA}}{ß1ßdß3|¦´x´´y´‡ºw¢-CG¤4g¢-8O¤8Y¢-7Q¤9Wº11¤F9¢-HE¤9W¢-BS—÷ß4{ßLßHßMß1Sß1TÝ0ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷}}{ß1ßZß3|{´x´¤G7´y´¢-3R}÷ß4{ßLßHß5ßGß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷}}{ß1ßcß3|{´x´¤K7´y´¢-58}÷ß4{ßLßHß5ßGß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷}}{ß1ßiß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßLßHßMß1S}}{ß1ßaß3|{´x´¤Sl´y´¤-y}÷ß4{ßLßHß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ß5ßG}}{ß1ßbß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßLßHßM¨sensor_path¨ß6|¨tutorial room 2 switch¨÷}}{ß1ßeß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGºn—÷ß4{ßLßHßM¨icon_tutorial¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷}´z´£0.-1c}{ß1ßgß3|{´x´¤AT´y´¢-Jz}÷ß4{ßLßHß5ßGß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷}}{ß1ßjß3|¦´x´´y´‡¤CV¤11¤Dk¤Fa¤Hi¤FV¤FX¤12—÷ß4{ßLßHßMß1Sß1TÝ0}}{ß1ßpß3|¦´x´´y´‡¢-Lm¢-IY¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßLßIßMß1Sß1T£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷}}{ß1ßxß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FK¢-Ay¢-Ds¢-8s¢-Fe¢-8Yº1N¢-A0¢-K0¢-DY¢-Ke—÷ß4{ßLßIßMß1S}}{ß1ßoß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßLßIß1G¨enemy_tutorial_easy¨ß1I»ß1JÊ}}{ß1ßqß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßLßIß1Gß2Kß1I»ß1JÊ}}{ß1ßuß3|¦´x´´y´‡¢-6K¢-88¤2F¢-5T¤4k¢-FC¢-3B¢-Hl—÷ß4{ßLßIßMß1Sß1TÝ2ß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷}}{ß1ß13ß3|{´x´¢-L4´y´¤49}÷ß4{ßLßJß1G¨enemy_tutorial_rock_room4¨ß1I»ß1JÊ}}{ß1ß10ß3|{´x´¢-QI´y´¢-7G}÷ß4{ßLßJß1G¨collect_gun_basic¨ß1I»ß1JÊß1L»}}{ß1ß11ß3|{´x´º1k´y´º1l}÷ß4{ßLßJß1G¨deco_gun_basic¨ß1I»ß1JÊ}}{ß1ß17ß3|¦´x´´y´‡¢-Kz¢-6w¢-Kj¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßLßJßMß2A}}{ß1ß12ß3|{´x´¢-UG´y´¢-Ej}÷ß4{ßLßJß5ßGß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷}}{ß1ß15ß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßLßJß1G¨enemy_tutorial_rocky¨ß1I»ß1JÊß1L»}}{ß1ß16ß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßLßJß1Gß2Tß1I»ß1JÊß1L»}}{ß1ßzß3|¦´x´´y´‡¢-OK¢-Fk¢-WU¢-D3¢-ZC¢-5I¢-Tv¤i¢-Mi¤V¢-Ik¢-3M¢-I6º1S—÷ß4{ßLßJßMß1Sß1T£1.4q}}{ß1ß14ß3|{´x´¢-Ic´y´¤16}÷ß4{ßLßJß1G¨switch¨ß1I»ß1JÊ}}{ß1ß1Fß3|{´x´¤Fq´y´¤TU}÷ß4{ßLßKß1G¨enemy_tutorial_boss¨ß1I»ß1JÊ}}{ß1ß1Dß3|¦´x´´y´‡¤KU¤GS¤HQ¤GI—÷ß4{ßE»ß5¨tutorial_door¨ßLßK}}{ß1ß1Bß3|¦´x´´y´‡¤6B¤Kc¤4y¤LR¤Qm¤Ld¤PA¤Kl—÷ß4{ßLßKßMß1S}}{ß1ß1Eß3|¦´x´´y´‡¤Cy¤GU¤Be¤HL¤JK¤HM¤I1¤Gc—÷ß4{ßLßKßMß1Sß1T£1.6S}}{ß1ß1Cß3|¦´x´´y´‡¤HQ¤GI¤E2¤G8—÷ß4{ßLßKßMß28}}{ß1ßrß3|¦´x´´y´‡¢-C2¢-9C¢-D4¢-9h¢-Bg¢-B7—÷ß4{ßLßIßM¨wall_tutorial_spike¨}}{ß1ßsß3|¦´x´´y´‡¢-J1¢-ET¢-Jh¢-FO¢-HF¢-G8—÷ß4{ßLßIßMß2X}}{ß1ßtß3|¦´x´´y´‡¢-Ab¢-PI¢-Bt¢-PL¢-BH¢-NN—÷ß4{ßLßIßMß2X}}{ß1ß18ß3|¦´x´´y´‡¢-Ix¤5V¢-Is¤34ºkºl¢-J6¢-3V¢-IQ¢-8f¢-MQº1X—÷ß4{ßLßJßM¨wall_tutorial¨ßE»}}{ß1ßRß3|¦´x´´y´‡¢-38¤7Aº10ºj¤4Cºo¤6c¤1S¤D4¤-A—÷ß4{ßE»ßLßAßMß2Y}}{ß1ßVß3|¦´x´´y´‡¢-6e¤2Yºyºz—÷ß4{ßLßAßMß2YßE»}}{ß1ßYß3|¦´x´´y´‡¤M0¤fR¤T2¤Vy¤RE¤MK¤H6¤GI¤Ha¤CG¤Ke¤9Mºiºj¤WGºj¤WGºhºgºh¤M8¤3G¤WN¤48¤Wj¤2G¤Ut¢-Ax¤NN¢-Bh¤Ls¢-H8¤Gp¢-Ip¤Dr¢-Gp—÷ß4{ßE»ßLßHßMß2Y}}{ß1ßkß3|¦´x´´y´‡¤3O¢-8i¤9q¢-76¤C6¢-42—÷ß4{ßLßHßMß2YßE»}}{ß1ß19ß3|¦´x´´y´‡¢-NZ¤6Kºm¤K¢-Tj¤O¢-Yf¢-5G¢-WA¢-Cj¢-OM¢-FU—÷ß4{ßLßJßMß2YßE»}}{ß1ßfß3|¦´x´´y´‡¤Cvº1L¤Bt¢-FS¤BS¢-Ao¤4M¢-Ca—÷ß4{ßE»ßLßHßMß2Y}}{ß1ßXß3|¦´x´´y´‡¤C6º2qºwºnº1ºuºxº1¢-6T¤U—÷ß4{ßLßAßMß2YßE»}}{ß1ßlß3|¦´x´´y´‡¤D4¤-Aºr¤8s¤EW¤C1¤E2¤G8¤4m¤M8¤23¤X3¤AB¤g0¤M9¤fQ—÷ß4{ßE»ßLßHßMß2Y}}{ß1ßwß3|¦´x´´y´‡º2gº1X¢-Jqº2T¢-HD¢-CN¢-BJ¢-9D¢-5h¢-B5¢-25¢-70¤3Oº2o—÷ß4{ßLßIßMß2YßE»}}{ß1ßvß3|¦´x´´y´‡º2xº2yº1E¢-I4¢-J5¢-JS¢-EG¢-PD¢-81¢-Os¢-4N¢-KY¢-4j¢-Ex¤f¢-GM¤4Mº31—÷ß4{ßLßIßMß2YßE»}}{ß1ßnß3|¦´x´´y´‡¢-FAº3Oº1Qº1Jº2oº1Tº13º1Nº1V¢-KAº1X¢-Koº1Hº1Nº3Oº3O—÷ß4{ßLßIßM¨wall_tutorial_window¨ßE»}}{ß1ßyß3|¦´x´´y´‡º3Oº3Oº1Qº1Jº2oº1Tº13º1Nº1Vº3Pº1Xº3Qº1Hº1Nº3Oº3O—÷ß4{ßLßIßMß2Z}}{ß1ß2Mß3|¦´x´´y´‡¢-1M¢-Csº3A¢-BB—÷ß4{ßLßußMß1KßE»ß1L»}}{ß1ß21ß3|¦´x´´y´‡¤Hkºy¤Gc¢-7a—÷ß4{ßLßcßMß1KßE»ß1L»}}{ß1ß1Uß3|¦´x´´y´‡¤-L¢-3OÒºt¤x¢-3Y¤1H¢-2u¤w¢-2P¤I¢-2F¤-M¢-2Z—÷ß4{ßLßQßM¨wall_tutorial_rock¨}}{ß1ß1Vß3|¦´x´´y´‡¤2F¤5A¤2Z¤4W¤3N¤4C¤41ºh¤41¤5o¤3D¤68¤2P¤5y—÷ß4{ßLßQßMß2a}}{ß1ß1Wß3|¦´x´´y´‡¢-5p¢-18¢-5fº1¢-4r¢-1wº3J¢-1Sº3J¤-o¢-51¤-U¢-5V¤-e—÷ß4{ßLßQßMß2a}}{ß1ß1Xß3|¦´x´´y´‡¢-3j¤5K¢-35¤50¢-2H¤50¢-1nºw¢-1x¤6c¢-2R¤5y¢-4B¤6G—÷ß4{ßLßQßMß2a}}{ß1ß1Yß3|¦´x´´y´‡º32¤Uº2i¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßLßQßM¨wall_tutorial_rock_breakable¨}}{ß1ß1nß3|¦´x´´y´‡¤Mn¢-3H¤Oxº3V¤Pu¢-4E¤PP¢-68¤OEº1t¤Mz¢-6F¤MK¢-4z—÷ß4{ßLßcßMß2a}}{ß1ß1oß3|¦´x´´y´‡¤Cl¢-48¤Doº3W¤Ee¢-47¤Ee¢-5F¤E8ºQ¤CjºQ¤C8¢-52—÷ß4{ßLßcßMß2a}}{ß1ß1pß3|¦´x´´y´‡¤F9¢-41¤Gp¢-3r¤Ho¢-4Q¤Hq¢-5c¤Gh¢-6V¤FbºQ¤Ew¢-59—÷ß4{ßLßcßMß2a}}{ß1ß1qß3|¦´x´´y´‡¤Iw¢-3q¤Kv¢-3W¤Lp¢-4l¤Lk¢-67¤K1¢-6j¤IT¢-6D¤IA¢-4w—÷ß4{ßLßcßMß2a}}{ß1ß1rß3|¦´x´´y´‡¤Hkºy¤JCº14¤JVº2J¤IR¢-A3¤H9¢-AJ¤GJ¢-96¤Gcº3U—÷ß4{ßLßcßMß2aßE»}}{ß1ß1sß3|¦´x´´y´‡¤DD¢-FZ¤Dr¢-Fb¤EB¢-Fs¤EI¢-GO¤Drº2n¤D8¢-Gn¤Cvº1L—÷ß4{ßLßcßMß2a}}{ß1ß1tß3|¦´x´´y´‡¤KZ¢-G2¤L2¢-Fn¤Lb¢-G0¤Lf¢-GR¤LJ¢-H1¤Km¢-H2¤KQ¢-GX—÷ß4{ßLßcßMß2a}}{ß1ß2Lß3|¦´x´´y´‡º3Aº3T¢-1T¢-9c¤N¢-9s¤1pº3T¤1S¢-Cl¤C¢-Deº3Rº3S—÷ß4{ßLßußMß2aßE»}}{ß1ß2Qß3|¦´x´´y´‡¢-VJ¢-C4¢-V9¢-CY¢-ULº3S¢-Tr¢-COº4d¢-Bk¢-UV¢-BQ¢-Uz¢-Ba—÷ß4{ßLß12ßMß2a}}{ß1ß2Rß3|¦´x´´y´‡¢-OU¢-1s¢-O0¢-2V¢-NJ¢-2d¢-Mg¢-2Gº4qºv¢-NU¤-y¢-OIº3c—÷ß4{ßLß12ßMß2a}}{ß1ß2Sß3|¦´x´´y´‡¢-TO¢-1F¢-Szº4l¢-SC¢-2C¢-RT¢-1k¢-RL¢-12¢-Rq¤-Iº4w¤-V—÷ß4{ßLß12ßMß2a}}{ß1ß1uß3|¦´x´´y´‡¤Fd¤1h¤GZ¤1y¤HJ¤1R¤HJ¤R¤GT¤-G¤FH¤-F¤Ew¤m—÷ß4{ßLßcßMß2a}}{ß1ß1vß3|¦´x´´y´‡¤Hz¤1m¤J3¤1o¤JH¤19¤JA¤N¤IfÁ¤HlÒ¤Hb¤14—÷ß4{ßLßcßMß2a}}{ß1ß1wß3|¦´x´´y´‡¤Jl¤1o¤Km¤2V¤Lr¤22¤MF¤h¤LQÒ¤K4¤B¤JX¤c—÷ß4{ßLßcßMß2a}}{ß1ß1yß3|¦´x´´y´‡¤MQ¤2G¤NY¤2z¤PA¤2y¤Py¤2M¤Pw¤1A¤Oa¤R¤My¤V—÷ß4{ßLßcßMß2a}}{ß1ß1zß3|¦´x´´y´‡¤QR¤2D¤R7¤2m¤Rw¤2f¤SI¤1u¤S2¤16¤R7¤l¤QWºq—÷ß4{ßLßcßMß2a}}{ß1ß20ß3|¦´x´´y´‡¤Sn¤1x¤Uf¤2J¤Vr¤17¤Vo¤-L¤UV¤-k¤TG¤-G¤Sf¤h—÷ß4{ßLßcßMß2a}}{ß1ß1Mß3|¦´x´´y´‡¤4M¤-e¤50¤-K¤4i¤J¤50¤-K¤2Q¤K—÷ß4{ßLßSßMß2AßE»}´z´Ý1}{ß1ß1Nß3|¦´x´´y´‡º2q¤-yº2q¢-2aº3gº19¤-U¢-4C¤-Uº3f¤1N¢-2L¤1Sº3W¤5Kº4r—÷ß4{ßLßSß1G¨enemy_tutorial_bit¨ß1I»ß1JÎ}}{ß1ß1Oß3|¦´x´´y´‡¢-4Wºwºx¤3sº3u¤-y¢-5K¤-A¢-3s¤-y¢-4M¤3E¢-3E¤4g—÷ß4{ßLßSß1Gß2cß1I»ß1JÎ}}{ß1ß1Pß3|¦´x´´y´‡¤9Mºvºe¤m—÷ß4{ßE»ß5ß2WßLßU}}{ß1ß1Qß3|¦´x´´y´‡¤9Mºv¤8qº2F—÷ß4{ß5ß2WßLßUßE»}}{ß1ß1Rß3|¦´x´´y´‡¤8E¢-34¤9C¤o¤AU¤U¤9Wº3V—÷ß4{ßLßUßM¨floor_tutorial¨}}{ß1ß1aß3|{´x´¢-5B´y´¤A9}÷ß4{ßLßWß1Gß2Tß1I»ß1JÊ}}{ß1ß1bß3|{´x´¢-9P´y´¤71}÷ß4{ßLßWß1Gß2Tß1I»ß1JÊß1L»}}{ß1ß1cß3|{´x´¢-9i´y´¤A7}÷ß4{ßLßWß1Gß2Tß1I»ß1JÊß1L»}}{ß1ß1gß3|¦´x´´y´‡¤AL¢-9v¤9g¢-9Q¤AK¢-90¤9gº5H¤C0¢-9Z—÷ß4{ßLßdßMß2AßE»}´z´Ý1}{ß1ß1hß3|¦´x´´y´‡¤Ef¢-5j¤E8¢-56¤Dd¢-5k¤E8º5L¤E6¢-75—÷ß4{ßLßdßMß2AßE»}´z´Ý1}{ß1ß1iß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßLßdßMß2AßE»}´z´Ý1}{ß1ß1xß3|{´x´¤Dz´y´¤Y}÷ß4{ßLßcß1G¨enemy_tutorial_block¨ß1I»ß1JÊß1L»}}{ß1ß22ß3|¦´x´´y´‡¤MZ¢-3F¤Lx¢-3K¤LHº17¤M4¢-4c¤M5º5L¤M1ºQ¤KK¢-6r¤NVº2i¤Mgºx¤M8º5L¤M7º5Q—÷ß4{ßLßaß1Gß2cß1I»ß1JÎ}}{ß1ß23ß3|¦´x´´y´‡¤TBºl¤SI¤x¤RG¤X¤Q1¤i¤SYº4v¤Uy¢-2n¤VZ¢-1G—÷ß4{ßLßaß1Gß2cß1JÎß1I»}}{ß1ß24ß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßLßaß1Gß2cß1I»ß1JÎ}}{ß1ß26ß3|¦´x´´y´‡¤Hb¤Bg¤EN¤BX¤CB¤8h¤D6¤1Q¤GP¤2Q¤HM¤1x¤JV¤24¤Kk¤2q¤Lo¤2U¤Js¤9U—÷ß4{ßLßaß1Gß2cß1J¤Cß1I»}}{ß1ß1eß3|¦´x´´y´‡¤76¢-9q¤6a¢-7m—÷ß4{ßE»ß5ß2WßLßd}}{ß1ß1fß3|¦´x´´y´‡¤76º5aºM¢-Bu—÷ß4{ßE»ß5ß2WßLßd}}{ß1ß1dß3|¦´x´´y´‡ºo¢-Bw¤5y¢-84¤7G¢-7k¤8E¢-Bc—÷ß4{ßLßdßMß2d}}{ß1ß25ß3|{´x´¤Hb´y´¢-C3}÷ß4{ßLßaß1G¨enemy_tutorial_4way¨ß1I»ß1JÊ}}{ß1ß27ß3|{´x´¤R6´y´¤5o}÷ß4{ßLßaß1G¨enemy_tutorial_down¨ß1I»ß1JÊ}}{ß1ß29ß3|{´x´¤FM´y´¢-7V}÷ß4{ßLßbß1Gß2Uß1I»ß1JÊ}}{ß1ß2Bß3|¦´x´´y´‡¤E6¢-1h¤EB¢-21—÷ß4{ßLßeßMß2AßE»}´z´Ý1}{ß1ß2Cß3|¦´x´´y´‡¤E4¢-1X¤E4º5l—÷ß4{ßLßeßMß2AßE»}´z´Ý1}{ß1ß2Dß3|{´x´¤Ei´y´¢-Jr}÷ß4{ßLßgß1Gß2Tß1I»ß1JÊß1L»}}{ß1ß2Hß3|{´x´¤Bv´y´¢-IN}÷ß4{ßLßgß1Gß2Tß1I»ß1JÊß1L»}}{ß1ß2Eß3|¦´x´´y´‡¤Ba¢-FT¤H1¢-JI¤Gl¢-L3¤E4¢-Lp¤BS¢-Ki¤9f¢-Il¤9j¢-GL—÷ß4{ßLßgßMß1Sß1T£0.BI}}{ß1ß2Fß3|¦´x´´y´‡¤D8º4L¤EC¢-FN—÷ß4{ßLßgßMß28}}{ß1ß2Iß3|¦´x´´y´‡¢-Ky¢-Eg¢-NE¢-Gw—÷ß4{ßE»ß5ß2WßLßp}}{ß1ß2Jß3|¦´x´´y´‡¢-LI¢-EWº3Qº1O¢-Mu¢-H6¢-NO¢-Gc—÷ß4{ßLßpßMß2d}}{ß1ß1jß3|¦´x´´y´‡¤Gh¢-43¤G2¢-2K¤FPº55—÷ß4{ßLßZßMß2X}}{ß1ß1kß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Kf¢-1b—÷ß4{ßLßZßMß2X}}{ß1ß1lß3|¦´x´´y´‡¤NO¢-62¤OZº1e¤Ojº3b¤P3¢-5i¤Tdº4A¤PE¢-4S¤OX¢-3f¤OH¢-1J¤N9º3W—÷ß4{ßLßZßMß2X}}{ß1ß1mß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßLßZßMß2X}}{ß1ß1Zß3|¦´x´´y´‡º3p¤6Gºyºzº5a¤50º6G¤83º5g¤BIº14¤D4º3W¤B8º2h¤7A—÷ß4{ßE»ßLßWßMß2Y}}{ß1ß2Gß3|¦´x´´y´‡¤Gpº2m¤GZº1q¤E4¢-LR¤Bcº22¤A0º2H¤A3¢-GT¤Btº2z—÷ß4{ßE»ßLßgßMß2Y}}÷¨icons¨|÷}");

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