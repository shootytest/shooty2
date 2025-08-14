import { vector, vector3, vector3_, AABB, AABB3 } from "./vector.js";

export type map_shape_type = {
  id: string,
  z: number,
  vertices: vector3_[],
  // all other stuff
  // todo move style into options
  options: map_shape_options_type,
  // computed attributes, not part of definition
  computed?: map_shape_compute_type,
};

export type map_shape_compute_type = {
  aabb: AABB,
  aabb3: AABB3,
  mean: vector3,
  vertices: vector3[],
  screen_vertices?: vector3[],
  on_screen?: boolean,
  distance2?: number,
  depth?: number,
};

export type map_shape_options_type = {  
  // important options
  parent?: string,
  contains?: string[],
  
  // actual shape options
  open_loop?: boolean, // is the shape loop not closed? (e.g. this is true if the vertices are actually a list of 1d walls instead of a 2d shape)
  
  // display options
  style?: string,
  style_?: style_type, // consider renaming to style_override (not really)
  
  // game options
  merge?: boolean, // use the same thing object as its parent?
  decoration?: boolean, // this won't add a physics object
  sensor?: boolean, // invisible physics sensor
  invisible?: boolean, // invisible shape
  movable?: boolean, // dynamic physics object
  seethrough?: boolean, // visibility

};

export type map_icon_type = {
  icon: string,
  color: string,
};

export type map_computed_type = {
  shape_map: { [key: string]: map_shape_type },
};

export type map_type = {

  shapes: map_shape_type[],
  icons?: map_icon_type[],
  computed?: map_computed_type,

};

export type map_vertex_type = {
  // for map maker ui
  shape: map_shape_type,
  vertex: vector3,
  vertex_old: vector3_[],
  id: string,
  index: number,
  new: boolean,
};

export type style_type = {
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
    }

  },

  clone_shape: (shape: map_shape_type) => {
    return {
      id: shape.id,
      z: shape.z,
      vertices: vector3.clone_list_(shape.vertices),
      options: map_serialiser.clone_object(shape.options),
    };
  },

  clone_style: (style: style_type): style_type => {
    return map_serialiser.clone_object(style);
  },

  clone_object: (o: any): any => {
    const result: any = {};
    for (const k in o) {
      if (typeof o[k] === "object") (result as any)[k] = map_serialiser.clone_object((o as any)[k]);
      else (result as any)[k] = (o as any)[k];
    }
    return result;
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
    if (raw_string == null) {
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
    navigator.clipboard.writeText(map_serialiser.special_stringify(map_serialiser.stringify_(map)));
    // map_serialiser.compute(map);
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
export const TEST_MAP: map_type = {shapes:[{id:"start",z:0,vertices:[{x:-120,y:110}],options:{open_loop:false,style:"start"}},{id:"test group",z:0,vertices:[{x:420,y:-270}],options:{contains:["test 1"],open_loop:false,style:"test"}},{id:"tutorial",z:0,vertices:[{x:-510,y:-360}],options:{style:"tutorial",contains:["tutorial room 1","tutorial room 1.1"]}},{id:"tutorial room 1.1",z:0,vertices:[{x:-720,y:320}],options:{style:"tutorial",contains:["tutorial wall 2"],parent:"tutorial"}},{id:"tutorial room 1",z:0,vertices:[{x:-380,y:-300}],options:{style:"tutorial",contains:["tutorial wall 1","tutorial room 1 rocks","tutorial wall 3","tutorial room 1 deco","tutorial door 1","tutorial room 1 sensor"],parent:"tutorial"}},{id:"test 1",z:0,vertices:[{x:420,y:-500},{x:500,y:-250}],options:{open_loop:true,style:"test",parent:"test group"}},{id:"tutorial wall 2",z:0,vertices:[{x:-420,y:250},{x:-610,y:310},{x:-730,y:500},{x:-720,y:700},{x:-460,y:810},{x:-220,y:690},{x:-199,y:440}],options:{open_loop:true,style:"tutorial",parent:"tutorial room 1.1"}},{id:"tutorial room 1 rocks",z:0,vertices:[{x:-120,y:-140}],options:{contains:["tutorial rock 1","tutorial rock 2","tutorial rock 3","tutorial rock 4","tutorial rock 5"],open_loop:false,style:"tutorial",parent:"tutorial room 1"}},{id:"tutorial room 1 deco",z:0,vertices:[{x:-340,y:-260}],options:{open_loop:false,style:"tutorial",parent:"tutorial room 1",contains:["tutorial room 1 arrow"]}},{id:"tutorial door 1",z:0,vertices:[{x:550,y:-200},{x:610,y:40}],options:{open_loop:true,style:"tutorial_door",parent:"tutorial room 1",contains:["tutorial door 1 sensor"]}},{id:"tutorial room 1 sensor",z:0,vertices:[{x:350,y:-150},{x:-100,y:-310},{x:-390,y:-100},{x:-420,y:250},{x:-130,y:500},{x:260,y:430},{x:410,y:90}],options:{style:"sensor",parent:"tutorial room 1",sensor:true,invisible:true}},{id:"tutorial wall 1",z:0,vertices:[{x:750,y:-250},{x:350,y:-150},{x:-100,y:-310},{x:-390,y:-100},{x:-420,y:250},{x:-259,y:388}],options:{open_loop:true,style:"tutorial",parent:"tutorial room 1"}},{id:"tutorial wall 3",z:0,vertices:[{x:-199,y:440},{x:-130,y:500},{x:260,y:430},{x:410,y:90},{x:810,y:-10}],options:{open_loop:true,style:"tutorial",parent:"tutorial room 1"}},{id:"tutorial door 1 sensor",z:0,vertices:[{x:391.017,y:-159.879},{x:451.017,y:80.121},{x:771.017,y:0.121},{x:711.017,y:-239.879}],options:{style:"sensor",parent:"tutorial door 1",sensor:true,invisible:true}},{id:"tutorial rock 4",z:0,vertices:[{x:-230.59,y:329.527},{x:-190.59,y:309.527},{x:-140.59,y:309.527},{x:-110.59,y:349.527},{x:-120.59,y:409.527},{x:-150.59,y:369.527},{x:-259,y:388}],options:{style:"tutorial",parent:"tutorial room 1 rocks"}},{id:"tutorial rock 3",z:0,vertices:[{x:-360.59,y:-70.473},{x:-350.59,y:-100.473},{x:-300.59,y:-120.473},{x:-270.59,y:-90.473},{x:-270.59,y:-50.473},{x:-310.59,y:-30.473},{x:-340.59,y:-40.473}],options:{style:"tutorial",parent:"tutorial room 1 rocks"}},{id:"tutorial rock 2",z:0,vertices:[{x:139.41,y:319.527},{x:159.41,y:279.527},{x:209.41,y:259.527},{x:249.41,y:299.527},{x:249.41,y:359.527},{x:199.41,y:379.527},{x:149.41,y:369.527}],options:{style:"tutorial",parent:"tutorial room 1 rocks"}},{id:"tutorial rock 1",z:0,vertices:[{x:-20.59,y:-210.473},{x:9.41,y:-230.473},{x:59.41,y:-220.473},{x:79.41,y:-180.473},{x:58.174,y:-149.02},{x:18.174,y:-139.02},{x:-21.826,y:-159.02}],options:{style:"tutorial",parent:"tutorial room 1 rocks"}},{id:"tutorial room 1 arrow",z:0,vertices:[{x:270,y:-40},{x:310,y:-20},{x:285,y:17},{x:310,y:-20},{x:150,y:20}],options:{style:"tutorial",parent:"tutorial room 1 deco",open_loop:true,decoration:true,seethrough:true}}],icons:[]};

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

export const STYLES: styles_type = {
  error: {
    stroke: "#ff0000",
    fill: "#ff0000",
  },
  test: {
    stroke: "#abcdef99",
    fill: "#abcdef99",
    fill_opacity: 0.8,
  },
  tutorial: {
    stroke: "#7f77ea",
    fill: "#544bdb",
    fill_opacity: 0.7,
  },
  tutorial_door: {
    stroke: "#4e47af",
  },
  tutorial_floor: {
    stroke: "#7f77ea",
    stroke_opacity: 0,
    fill: "#4e47af",
    fill_opacity: 0.3,
  },
  start: {
    stroke: "#00ddff99",
  },
  sensor: {
    stroke: "#00ddff",
    stroke_opacity: 0,
    fill: "#00ddff",
    fill_opacity: 0.2,
  },
};