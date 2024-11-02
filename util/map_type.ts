import { map_draw } from "./map_draw.js";
import { vector, vector3, vector3_, AABB } from "./vector.js";

export type line_style = {
  stroke: string,
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
  // computed attributes
  computed?: map_shape_compute_type
};

export type map_shape_compute_type = {
  aabb: AABB,
  centroid: vector3,
  vertices: vector3[],
  screen_vertices?: vector3[],
  on_screen?: boolean,
  distance2?: number,
};

export type map_icon_type = {
  icon: string,
  color: string,
};

export type map_type = {

  shapes?: map_shape_type[],
  icons?: map_icon_type[],

};

export const map_serialiser = {

  stringify: (map: map_type): string => {
    const m: map_type = {
      shapes: [],
      icons: [],
    };
    for (const s of map.shapes ?? []) {
      m.shapes!!.push({ id: s.id, z: s.z, vertices: s.vertices, style: s.style });
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
    map_draw.compute(map);
    return map;
  },

  save: (slot: string, map: map_type): void => {
    const raw_string = map_serialiser.stringify(map);
    localStorage.setItem("map_" + slot, raw_string);
    console.log("saved current map to slot \"" + slot + "\"!");
    return;// JSON.parse(raw_string);
  },

  load: (slot: string): map_type => {
    const raw_string = localStorage.getItem("map_" + slot);
    if (raw_string == null) {
      console.error("map slot \"" + slot + "\" doesn't exist!");
      return { };
    } else {
      console.log("loaded current map from slot \"" + slot + "\"!");
    }
    return map_serialiser.parse(raw_string);
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
    {
      id: "1",
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
      id: "0",
      z: 0,
      vertices: [
        { x: 0, y: 0 },
        { x: 0, y: 200 },
        { x: 200, y: 200 },
        { x: 200, y: 0 },
      ],
      style: { stroke: "white", fill: "#abcdef", fill_opacity: 0.8, }
    },
    {
      id: "0.5",
      z: 0.5,
      vertices: [
        { x: 0, y: 0, z: 0.5, },
        { x: 0, y: 200, z: 0.5, },
        { x: 200, y: 200, z: 0.5, },
        { x: 200, y: 0, z: 0.5, },
      ],
      style: { stroke: "white", fill: "#abcdef", fill_opacity: 0.8, }
    },
  ],
  icons: [],
};

for (const s of TEST_MAP.shapes || []) {
  for (const v of s.vertices) {
    // v.x += 100;
    // v.y += 100;
    // v.z = -0.5;
  }
}