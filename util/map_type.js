import { vector, vector3 } from "./vector.js";
export const map_serialiser = {
    initial_state: "",
    undo_states: [],
    compute: (map) => {
        map.computed = {
            shape_map: {},
        };
        if (map.shapes != undefined) {
            for (const shape of map.shapes) {
                map.computed.shape_map[shape.id] = shape;
                // debug, this shouldn't happen normally i hope
                if (shape.options.contains?.includes(shape.id))
                    console.error("[map_serialiser/compute] why does '" + shape.id + "' contain itself?");
                if (shape.id === "start")
                    delete shape.options.contains;
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
                if (shape.computed == undefined || shape.computed.depth)
                    continue;
                if ((shape.options.parent?.length ?? 0) > 0 && shape.options.parent !== "all") {
                    let s = shape;
                    let depth = 1;
                    while ((s?.computed?.depth ?? 0) === 0 && (s.options.parent?.length ?? 0) > 0 && s.options.parent !== "all" && depth < 100) {
                        const parent_id = s.options.parent;
                        s = map.computed.shape_map[parent_id];
                        if (s == undefined)
                            console.error(`[map_serialiser/compute] (${shape.id}) why is '${parent_id}' not in the computed shape map?`);
                        depth++;
                    }
                    shape.computed.depth = depth + (s.computed?.depth ?? 0);
                }
                else {
                    shape.computed.depth = 1;
                }
            }
        }
        // console.log(map);
    },
    clone_shape: (shape) => {
        return {
            id: shape.id,
            z: shape.z,
            vertices: vector3.clone_list_(shape.vertices),
            options: map_serialiser.clone_object(shape.options),
            // style: map_serialiser.clone_object(shape.style),
        };
    },
    clone_object: (o) => {
        const result = {};
        for (const k in o) {
            result[k] = o[k];
        }
        return result;
    },
    stringify_: (map) => {
        const m = {
            shapes: [],
            icons: [],
        };
        for (const s of map.shapes ?? []) {
            if (s.options.parent === "all")
                delete s.options.parent;
            m.shapes.push({ id: s.id, z: s.z, vertices: s.vertices, options: s.options });
        }
        for (const i of map.icons ?? []) {
            m.icons.push({ icon: i.icon, color: i.color });
        }
        return m;
    },
    stringify: (map) => {
        return zipson.stringify(map_serialiser.stringify_(map));
    },
    parse: (raw_string) => {
        const m = zipson.parse(raw_string);
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
        if (slot !== "auto")
            console.log("saved current map to slot \"" + slot + "\"!");
        return raw_string;
    },
    load: (slot) => {
        const raw_string = localStorage.getItem("map_" + slot);
        if (raw_string == null) {
            console.error("map slot \"" + slot + "\" doesn't exist!");
            return { shapes: [] };
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
    special_stringify(o) {
        if (typeof o !== "object") {
            return JSON.stringify(o);
        }
        else if (Array.isArray(o)) {
            if (o.length <= 0)
                return "[]";
            let s = "[";
            for (const p of o) {
                s += map_serialiser.special_stringify(p) + ",";
            }
            return s.substring(0, s.length - 1) + "]";
        }
        else {
            const s = Object.keys(o).map(key => `${key}:${map_serialiser.special_stringify(o[key])}`).join(",");
            return `{${s}}`;
        }
    },
    copy: (map) => {
        navigator.clipboard.writeText(map_serialiser.special_stringify(map_serialiser.stringify_(map)));
        // map_serialiser.compute(map);
    },
    save_undo_state: (raw_string) => {
        if (map_serialiser.undo_states.length <= 0)
            map_serialiser.initial_state = raw_string;
        map_serialiser.undo_states.push(raw_string);
        while (map_serialiser.undo_states.length > 10)
            map_serialiser.undo_states.shift();
    },
    undo: () => {
        if (map_serialiser.undo_states.length <= 1)
            return undefined;
        map_serialiser.undo_states.pop();
        // if (raw_string === undefined) return undefined;
        return map_serialiser.parse(map_serialiser.undo_states[map_serialiser.undo_states.length - 1]);
    },
};
// just realised it's possible to paste the zipped JSON
export const TEST_MAP = { shapes: [{ id: "start", z: 0, vertices: [{ x: -160, y: 110 }], options: { contains: ["test 1_0"], open_loop: false, style: "start" } }, { id: "tutorial rocks", z: 0, vertices: [{ x: -120, y: -180 }], options: { contains: ["tutorial rock 1", "tutorial rock 2", "tutorial rock 3", "tutorial rock 4", "tutorial rock 5"], open_loop: false, style: "tutorial" } }, { id: "test group", z: 0, vertices: [{ x: 290, y: -400 }], options: { contains: ["test 1"], open_loop: false, style: "test" } }, { id: "wall 1", z: 0, vertices: [{ x: -260, y: -360 }, { x: -420, y: -360 }, { x: -420, y: -520 }, { x: -260, y: -520 }], options: { style: "tutorial", contains: ["tutorial wall 1", "tutorial wall 2"] } }, { id: "test 1", z: 0, vertices: [{ x: 321.947, y: -350.067 }, { x: 431.947, y: -460.067 }, { x: 121.947, y: -440.067 }], options: { open_loop: true, style: "test", parent: "test group" } }, { id: "tutorial rock 4", z: 0, vertices: [{ x: -230, y: 330 }, { x: -190, y: 310 }, { x: -140, y: 310 }, { x: -110, y: 350 }, { x: -120, y: 410 }, { x: -150, y: 370 }, { x: -250, y: 380 }], options: { style: "tutorial", parent: "tutorial rocks" } }, { id: "tutorial rock 3", z: 0, vertices: [{ x: -361.236, y: -78.547 }, { x: -351.236, y: -98.547 }, { x: -311.236, y: -108.547 }, { x: -281.236, y: -98.547 }, { x: -271.236, y: -58.547 }, { x: -301.236, y: -28.547 }, { x: -351.236, y: -38.547 }], options: { style: "tutorial", parent: "tutorial rocks" } }, { id: "tutorial rock 2", z: 0, vertices: [{ x: 140, y: 320 }, { x: 160, y: 280 }, { x: 210, y: 260 }, { x: 250, y: 300 }, { x: 250, y: 360 }, { x: 200, y: 380 }, { x: 150, y: 370 }], options: { style: "tutorial", parent: "tutorial rocks" } }, { id: "tutorial rock 1", z: 0, vertices: [{ x: -40, y: -210 }, { x: 0, y: -230 }, { x: 70, y: -220 }, { x: 100, y: -180 }, { x: 58.764, y: -148.547 }, { x: 18.764, y: -138.547 }, { x: -21.236, y: -158.547 }], options: { style: "tutorial", parent: "tutorial rocks" } }, { id: "tutorial rock 5", z: 0, vertices: [{ x: 510, y: -100 }, { x: 630, y: -190 }, { x: 740, y: -100 }, { x: 630, y: -160 }], options: { style: "tutorial", parent: "tutorial rocks" } }, { id: "tutorial wall 1", z: 0, vertices: [{ x: 580, y: -330 }, { x: 290, y: -160 }, { x: -100, y: -310 }, { x: -390, y: -100 }, { x: -420, y: 250 }, { x: -250, y: 380 }], options: { open_loop: true, style: "tutorial", parent: "wall 1" } }, { id: "tutorial wall 2", z: 0, vertices: [{ x: -190, y: 440 }, { x: -130, y: 500 }, { x: 260, y: 430 }, { x: 420, y: 130 }, { x: 680, y: 240 }], options: { open_loop: true, style: "tutorial", parent: "wall 1" } }], icons: [] };
const TEST_MAP_ = {
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
export const STYLES = {
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
    tutorial_ceiling: {
        stroke: "#7f77ea00",
        stroke_opacity: 0,
        fill: "#544bdb",
        fill_opacity: 0.05,
    },
    start: {
        stroke: "#00ddff99",
    },
};
