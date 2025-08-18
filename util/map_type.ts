import { clone_object, make, maketype, override_object } from "../game/make.js";
import { vector, vector3, vector3_, AABB, AABB3 } from "./vector.js";

export interface map_shape_type {
  id: string,
  z: number,
  vertices: vector3_[],
  // all other stuff
  // todo move style into options
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
  contains?: string[],
  make_id?: string,
  
  // actual shape options
  open_loop?: boolean, // is the shape loop not closed? (e.g. this is true if the vertices are actually a list of 1d walls instead of a 2d shape)
  merge?: boolean, // merge shape with its parent? (use the same thing object)
  
  // spawner options
  is_spawner?: boolean,
  spawn_enemy?: string,
  spawn_repeat?: number,
  spawn_delay?: number,
  spawn_repeat_delay?: number,
};

export interface map_icon_type {
  icon: string,
  color: string,
};

export interface map_computed_type {
  shape_map: { [key: string]: map_shape_type },
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
  width?: number,
  opacity?: number,
  stroke_opacity?: number,
  fill_opacity?: number,
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
    };

    if (map.shapes != undefined) {
      for (const shape of map.shapes) {
        map.computed.shape_map[shape.id] = shape;
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
      for (const shape of map.shapes) {
        if (shape.computed == undefined || shape.computed.depth) continue;
        if ((shape.options.parent?.length ?? 0) > 0 && shape.options.parent !== "all") {
          let s = shape;
          let depth = 1;
          while ((s?.computed?.depth ?? 0) === 0 && (s.options.parent?.length ?? 0) > 0 && s.options.parent !== "all" && depth < 100) {
            const parent_id = s.options.parent!;
            s = map.computed.shape_map[parent_id];
            if (s == undefined) console.error(`[map_serialiser/compute] (${shape.id}) why is '${parent_id}' not in the computed shape map?`);
            depth++;
          }
          shape.computed.depth = depth + (s.computed?.depth ?? 0);
        } else {
          shape.computed.depth = 1;
        }
      }
      // now sort shapes by depth
      map.shapes.sort((s1, s2) => (s1.computed?.depth ?? 0) - (s2.computed?.depth ?? 0));
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
      m.shapes!.push({ id: s.id, z: s.z, vertices: s.vertices, options: s.options });
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
export const TEST_MAP: map_type = zipson.parse("{¨shapes¨|{¨id¨¨start¨´z´É¨vertices¨|{´x´¢-1w´y´¢1m}÷¨options¨{¨open_loop¨«¨style¨ß2}}{ß1¨test group¨´z´Éß3|{´x´¢6m´y´¢-4M}÷ß4{¨contains¨|¨test 1¨÷ß5«ß6¨test¨}}{ß1¨tutorial¨´z´Éß3|{´x´¢-FU´y´¢-AU}÷ß4{ß6ßBß8|¨tutorial room 1¨¨tutorial room 1.1¨÷}}{ß1ßD´z´Éß3|{´x´¢-Bc´y´¢5A}÷ß4{ß6ßBß8|¨tutorial wall 2¨÷¨parent¨ßB}}{ß1ßC´z´Éß3|{´x´¢-68´y´¢-4q}÷ß4{ß8|¨tutorial wall 1¨¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial room 1 enemy¨÷ßFßBß6ßB}}{ß1ß9´z´Éß3|¦´x´´y´‡º2¢-84¢84¢-42—÷ß4{ßFß7ß5»¨make_id¨¨wall¨ß6ßA}}{ß1ßE´z´Éß3|¦´x´´y´‡¢-6m¢42¢-9q¢50¢-BmºBº6¢BI¢-7Q¢D4¢-3Y¢B8¢-38¢7A—÷ß4{ß5»ßFßDßN¨wall_tutorial¨}}{ß1ßH´z´Éß3|{´x´¢-50´y´¢-1I}÷ß4{ß8|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨÷ßFßCß6ßB}}{ß1ßM´z´Éß3|{´x´¢1c´y´º1}÷ß4{ßFßCß6¨spawner¨¨spawn_enemy¨¨enemy_tutorial_block¨¨is_spawner¨»¨spawn_repeat¨Ê}}{ß1ßJ´z´Éß3|{´x´¢-5U´y´¢-4C}÷ß4{ß5«ß6ßBßFßCß8|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷¨decoration¨»}}{ß1ßK´z´Éß3|¦´x´´y´‡¢5e¢-2Q¢-1cºP¢-6IºWºDºE¢-26ºB¢4C¢6w¢6c¢1S—÷ß4{ßFßCßN¨sensor¨}}{ß1ßG´z´Éß3|¦´x´´y´‡¢C6ºCºUºVºWºPºXºWºDºE¢-4B¢6G—÷ß4{ßFßCßNßPß5»}}{ß1ßI´z´Éß3|¦´x´´y´‡ºNºOºYºBºZºaºbºcºK¢-A—÷ß4{ß5»ßFßCßNßP}}{ß1ßL´z´Éß3|¦´x´´y´‡¢6I¢-2a£7H.H£1I.1x£CR.H£0.1x£BT.H£-3r.-EB—÷ß4{ßFßCß8|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßNße}}{ß1ßb´z´Éß3|¦´x´´y´‡ºC¢-yºCºi¢-1S¢-4g¢-UºTºmº0£1M.9T£-2L.-2bºcºL¢5K¢-2G—÷ß4{ßFßJß6ßVßW¨enemy_tutorial_bit¨ßY»ßZ¤A}}{ß1ßc´z´Éß3|¦´x´´y´‡¢-4WºUºX¢3sº8ºj¢-5Kºg¢-3sºjº3¢3E¢-3E¢4g—÷ß4{ßFßJß6ßVßWßißY»ßZ¤A}}{ß1ßh´z´Éß3|¦´x´´y´‡¢8E¢-34¢9C¤o¢AU¤U¤9W¢-3O—÷ß4{ßFßLßN¨floor_tutorial¨}}{ß1ßf´z´Éß3|¦´x´´y´‡¤9MºQ¤9s¤m—÷ß4{ß5»ß6¨tutorial_door¨ßFßL}}{ß1ßg´z´Éß3|¦´x´´y´‡¤9MºQ¤8q¢-3M—÷ß4{ß5»ß6ßkßFßL}}{ß1ßT´z´Éß3|¦´x´´y´‡£-3i.-9W£5J.8V£-34.-9W£4z.8V£-2G.-9WÝB£-1m.-9W£5d.8V£-1w.-9W£6b.8V£-2Q.-9W£5x.8Vºeºf—÷ß4{ßFßHßN¨wall_tutorial_rock¨}}{ß1ßS´z´Éß3|¦´x´´y´‡£-5o.-9W£-18.-7d£-5e.-9W£-1c.-7d£-4q.-9W£-1w.-7d£-4M.-9W£-1S.-7dÝP£-o.-7d£-50.-9W£-U.-7d£-5U.-9W£-e.-7d—÷ß4{ßFßHßNßl}}{ß1ßR´z´Éß3|¦´x´´y´‡£2F.6c£59.8V£2Z.6c£4V.8V£3N.6c£4B.8V£41.6c£4p.8VÝc£5n.8V£3D.6c£67.8V£2P.6cÝI—÷ß4{ßFßHßNßl}}{ß1ßQ´z´Éß3|¦´x´´y´‡£-K.-9W£-3O.-7d£9.6c£-3i.-7d£x.6c£-3Y.-7d£1H.6c£-2u.-7d£w.2o£-2P.-K£I.2o£-2F.-K£-L.-DK£-2Z.-K—÷ß4{ßFßHßNßl}}{ß1ßa´z´£0.-1cß3|¦´x´´y´‡¤4M¤-eºG¤-K¤4b¤HºG¤-K¤2Q¤K—÷ß4{ßFßJßN¨icon_tutorial¨ß5»}}÷¨icons¨|÷}");

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