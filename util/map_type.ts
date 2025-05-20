import { vector, vector3, vector3_, AABB, AABB3 } from "./vector.js";

export type line_style = {
  stroke?: string,
  width?: number,
  opacity?: number,
};

export interface shape_style extends line_style {
  fill?: string,
  fill_opacity?: number,
};

export type map_shape_type = {
  id: string,
  z: number,
  vertices: vector3_[],
  style: shape_style,
  // optional attributes
  // animation/movement??? then there will be a need for a manually constructed AABB
  options?: map_shape_options_type,
  // computed attributes
  computed?: map_shape_compute_type
};

export type map_shape_compute_type = {
  aabb: AABB,
  aabb3: AABB3,
  centroid: vector3,
  vertices: vector3[],
  screen_vertices?: vector3[],
  on_screen?: boolean,
  distance2?: number,
};

export type map_shape_options_type = {  
  // actual shape options
  open_loop?: boolean, // is the shape loop not closed? (e.g. this is true if the vertices are actually a list of walls instead)

  // group options
  part_of?: string,

  // physics options
  movable?: boolean, // default should be static, there should be more walls than movable objects right?

  // game options
};

export type map_icon_type = {
  icon: string,
  color: string,
};

export type map_group_type = {
  id: string,
  ids: string[],
  root?: boolean,
};

export type map_type = {

  shapes?: map_shape_type[],
  groups?: map_type[],
  icons?: map_icon_type[],
  // map?: map_type,

};

/*
export type map_type = {
  
  root: map_group_type,
  all_shapes?: map_shape_type[],
  all_icons?: map_icon_type[],

};
*/

export const map_serialiser = {

  compute: (map: map_type) => {

    if (map.shapes != undefined) {
      for (const shape of map.shapes) {
        const world_vertices = vector3.create_many(shape.vertices, shape.z);
        shape.computed = {
          aabb: vector.make_aabb(world_vertices),
          aabb3: vector3.make_aabb(world_vertices),
          centroid: vector3.mean(world_vertices),
          vertices: world_vertices,
        };
      }
    }

  },

  stringify: (map: map_type): string => {
    const m: map_type = {
      shapes: [],
      icons: [],
    };
    for (const s of map.shapes ?? []) {
      m.shapes!!.push({ id: s.id, z: s.z, vertices: s.vertices, options: s.options, style: s.style });
    }
    for (const i of map.icons ?? []) {
      m.icons!!.push({ icon: i.icon, color: i.color });
    }
    return JSON.stringify(m);
  },

  parse: (raw_string: string): map_type => {
    const m = JSON.parse(raw_string);
    const map: map_type = {
      shapes: m.shapes ?? [],
      icons: m.icons ?? [],
    };
    map_serialiser.compute(map);
    return map;
  },

  save: (slot: string, map: map_type): void => {
    const raw_string = map_serialiser.stringify(map);
    localStorage.setItem("map_" + slot, raw_string);
    console.log("saved current map to slot \"" + slot + "\"!");
    return; // JSON.parse(raw_string);
  },

  load: (slot: string): map_type => {
    const raw_string = localStorage.getItem("map_" + slot);
    if (raw_string == null) {
      console.error("map slot \"" + slot + "\" doesn't exist!");
      return { };
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

};


export const TEST_MAP: map_type = {
  shapes: [
    /*
    // todo imagine rendering these 2 "arch" shapes with shadows accurately...
    {
      id: "1",
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
      id: "2",
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
      id: "a random square",
      z: 0,
      vertices: [
        { x: 0, y: 0 },
        { x: 0, y: 200 },
        { x: 200, y: 200 },
        { x: 200, y: 0 },
        { x: 300, y: -100 },
      ],
      options: { open_loop: true, },
      style: { stroke: "#abcdef", fill: "#abcdef", fill_opacity: 0.8, }
    },
    {
      id: "wall 1",
      z: 0,
      vertices: [
        { x: -200, y: 165 },
        { x: -365, y: 165 },
        { x: -365, y: 0 },
        { x: -200, y: 0 },
      ],
      options: { open_loop: true, },
      style: { stroke: "#abcdef", fill: "#abcdef", fill_opacity: 0.8, }
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
  groups: [
    
  ],
  icons: [],
};

for (const s of TEST_MAP.shapes || []) {
  for (const v of s.vertices) {
    v.x += 50;
    v.y += 50;
  }
}