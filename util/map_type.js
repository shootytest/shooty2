import { vector, vector3 } from "./vector.js";
;
/*
export type map_type = {
  
  root: map_group_type,
  all_shapes?: map_shape_type[],
  all_icons?: map_icon_type[],

};
*/
export const map_serialiser = {
    compute: (map) => {
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
    stringify: (map) => {
        const m = {
            shapes: [],
            icons: [],
        };
        for (const s of map.shapes ?? []) {
            m.shapes.push({ id: s.id, z: s.z, vertices: s.vertices, style: s.style });
        }
        for (const i of map.icons ?? []) {
            m.icons.push({ icon: i.icon, color: i.color });
        }
        return JSON.stringify(m);
    },
    parse: (raw_string) => {
        const m = JSON.parse(raw_string);
        const map = {
            shapes: m.shapes ?? [],
            icons: m.icons ?? [],
        };
        map_serialiser.compute(map);
        return map;
    },
    save: (slot, map) => {
        const raw_string = map_serialiser.stringify(map);
        localStorage.setItem("map_" + slot, raw_string);
        console.log("saved current map to slot \"" + slot + "\"!");
        return; // JSON.parse(raw_string);
    },
    load: (slot) => {
        const raw_string = localStorage.getItem("map_" + slot);
        if (raw_string == null) {
            console.error("map slot \"" + slot + "\" doesn't exist!");
            return {};
        }
        else {
            console.log("loaded current map from slot \"" + slot + "\"!");
        }
        const map = map_serialiser.parse(raw_string);
        return map;
    },
    delete: (slot) => {
        const map = map_serialiser.load(slot);
        localStorage.removeItem("map_" + slot);
        console.log("deleted current map from slot \"" + slot + "\"!");
        return map;
    },
};
export const TEST_MAP = {
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
                { x: 0, y: 0, },
                { x: 0, y: 200, },
                { x: 200, y: 200, },
                { x: 200, y: 0, },
            ],
            style: { stroke: "white", fill: "#123456", fill_opacity: 0.3, }
        },
    ],
    icons: [],
};
for (const s of TEST_MAP.shapes || []) {
    for (const v of s.vertices) {
        v.x += 50;
        v.y += 50;
        // v.z = -0.5;
    }
}
