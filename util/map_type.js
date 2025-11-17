import { clone_object, make, override_object } from "../game/make.js";
import { vector, vector3 } from "./vector.js";
;
;
;
;
;
;
;
;
export const map_serialiser = {
    initial_state: "",
    bytesize: 0,
    undo_states: [],
    compute: (map) => {
        map.computed = {
            shape_map: {},
            room_map: {},
            shape_room: {},
        };
        for (const shape of map.shapes ?? []) {
            if (shape.z == undefined)
                shape.z = 0;
            map.computed.shape_map[shape.id] = shape;
            map.computed.shape_room[shape.id] = "";
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
            map_serialiser.compute_options(shape);
        }
        for (const shape of map.shapes ?? []) {
            if (shape.computed == undefined || shape.computed.depth)
                continue;
            // make room connections 2-way
            for (const c of shape.options.room_connections ?? []) {
                const s = map.computed.shape_map[c];
                if (s.options.room_connections == undefined)
                    s.options.room_connections = [];
                if (!s.options.room_connections.includes(shape.id))
                    s.options.room_connections.push(shape.id);
            }
            if ((shape.options.parent?.length ?? 0) > 0 && shape.options.parent !== "all") {
                let s = shape;
                let depth = 1;
                let room = "";
                while ((s?.computed?.depth ?? 0) === 0 && (s.options.parent?.length ?? 0) > 0 && s.options.parent !== "all" && depth < 100) {
                    const parent_id = s.options.parent;
                    s = map.computed.shape_map[parent_id];
                    if (s == undefined)
                        console.error(`[map_serialiser/compute] (${shape.id}) why is '${parent_id}' not in the computed shape map?`);
                    if (s.options.is_room)
                        room = s.id;
                    depth++;
                }
                if (!room && map.computed.shape_room[s.id])
                    room = map.computed.shape_room[s.id];
                if (map.computed.room_map[room] == undefined)
                    map.computed.room_map[room] = [];
                map.computed.room_map[room].push(shape.id);
                map.computed.shape_room[shape.id] = room;
                shape.computed.depth = depth + (s.computed?.depth ?? 0);
            }
            else {
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
    compute_options: (shape) => {
        if (shape.computed == undefined)
            return undefined;
        const options = {};
        const make_options = make[shape.options.make_id ?? "default"] ?? make.default;
        if (shape.options.make_id)
            override_object(options, make_options);
        override_object(options, shape.options);
        shape.computed.options = options;
        // console.log("[map_serializer/compute_options] calculating for " + shape.id, options.sensor);
        return options;
    },
    clone_shape: (shape) => {
        return {
            id: shape.id,
            z: shape.z,
            vertices: vector3.clone_list_(shape.vertices),
            options: clone_object(shape.options),
        };
    },
    clone_style: (style) => {
        return clone_object(style);
    },
    stringify_: (map) => {
        const m = {
            shapes: [],
            icons: [],
        };
        for (const s of map.shapes ?? []) {
            if (s.options.parent === "all")
                delete s.options.parent;
            const o = { id: s.id, vertices: vector3.round_list(s.vertices, 1, 0.1), options: s.options };
            if (s.z !== 0)
                o.z = s.z;
            m.shapes.push(o);
        }
        for (const i of map.icons ?? []) {
            m.icons.push({ icon: i.icon, color: i.color });
        }
        return m;
    },
    stringify: (map) => {
        const result = zipson.stringify(map_serialiser.stringify_(map));
        map_serialiser.bytesize = result.length;
        return result;
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
        if (raw_string == null || !raw_string) {
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
        const s = `zipson.parse("${map_serialiser.stringify(map)}");`; // map_serialiser.special_stringify(map_serialiser.stringify_(map));
        navigator.clipboard.writeText(s);
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
export const TEST_MAP = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢3Ng´y´¢WQ}÷¨options¨{¨style¨ß2¨contains¨|¨home floor¨÷¨room_id¨´´¨is_room¨»}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ßA¨room_connections¨|¨tutorial room 1¨÷ß9»ß8´´}}{ß1¨station¨ß3|{´x´¢1RC´y´¢1NU}÷ß4{ßB|¨station tutorial¨¨station streets¨¨tutorial room 5¨÷ß6|¨train¨ßE¨station tracks¨ßF¨station tracks particle¨÷ß8´´ß9»}}{ß1¨streets¨ß3|{´x´¢1f4´y´¢-D4}÷ß4{ß8´´ß6|¨streets room 1¨÷}}{ß1¨test group¨ß3|{´x´¢6x´y´¢7q}÷ß4{ß6|¨test 1¨÷¨open_loop¨«ß5¨test¨ßB|÷ß9»ß8´´}}{ß1¨tutorial¨ß3|{´x´¢-WG´y´ºA}÷ß4{ß6|ßC¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨ßG÷ß8´´}}{ß1ß7ß3|¦´x´´y´‡¢3sk¢Bs¢3Xu¢2m¢3FVºE¢30C¢6M¢2pO¢Gd¢2mE¢TN¢2py¢ip¢2zv¢sv—÷ß4{¨parent¨ß2¨make_id¨¨floor¨ß8ß2}}{ß1ßFß3|{´x´¢1cy´y´¢11i}÷ß4{ßUßDß6|¨station streets rock 1¨¨station streets rock 2¨¨station streets rock 3¨¨station streets sensor start¨¨station streets rock 0¨¨station streets sensor end¨¨station streets rock block¨¨station streets rock 4¨¨station streets rock 5¨¨station streets rock 6¨¨station streets rock 7¨¨station streets rock 8¨¨station streets floor 1¨¨station streets floor 1.5¨¨station streets floor 2¨¨station streets floor 2.5¨¨station streets floor 3¨¨station streets floor 3.5¨¨station streets wall 1¨¨station streets wall 2¨¨station streets wall 3¨¨station streets floor 0¨¨station streets floor 4¨¨station streets floor 5¨¨station streets floor 4.5¨¨station streets wall 5¨¨station streets wall 6¨¨station streets wall 7¨¨station streets wall 8¨¨station streets wall 9¨¨station streets wall 10¨¨station streets wall 11¨¨station streets wall 13¨¨station streets rocky 1¨¨station streets floor 6¨¨station streets wall fake 1¨¨station streets wall 14¨¨station streets wall 12¨÷ß8ßDß9»ßB|ßDßL÷}}{ß1ßIß3|¦´x´´y´‡¢T2¢12W¢3U8ºTºU¢13KºSºV—÷ß4{ßUßDßV¨floor_train_track¨ß8ßD¨sensor_dont_set_room¨»}}{ß1ßJß3|¦´x´´y´‡ºSºTºSºV—÷ß4{ßUßDßVß19ß8ßDß1A»}}{ß1ßEß3|{´x´¢VS´y´¢yA}÷ß4{ßUßDß6|¨station tutorial floor¨¨station tutorial sensor start¨¨station tutorial wall 1¨¨station tutorial wall 2¨¨station tutorial rock 1¨¨station tutorial rock 2¨¨station tutorial rock 3¨¨tutorial floor low¨¨station tutorial sensor end¨÷ß8ßDß9»ßB|ßGßD÷}}{ß1ßLß3|{´x´¢1zO´y´¢rO}÷ß4{ßUßKß8´´ß9»ßB|ßF÷ß6|¨streets room 1 wall 2¨¨streets room 1 wall 1¨¨streets room 1 camera 1¨¨streets room 1 sensor start¨¨streets room 1 camera 2¨¨streets room 1 camera 0¨÷}´z´£0.-84}{ß1ßNß3|¦´x´´y´‡¢7c¢46¢8u¢88—÷ß4{ßUßMßO»ßV¨wall¨ß5ßPß6|¨test 2¨÷ß8ßM}}{ß1ßHß3|¦´x´´y´‡¢Qc¢10u¢TRºf—{´x´ºg´y´ºf´z´£0.4q}{´x´¢Vr´y´ºf´z´Ý1}{´x´ºh´y´ºf}{´x´¢Yg´y´ºf}{´x´ºi´y´ºf´z´£0.84}{´x´ºe´y´ºf´z´Ý2}÷ß4{ßUßDßV¨wall_train¨ß6|¨train floor broken¨¨train wall 1¨¨train wall 2¨¨train wall 3¨¨train ceiling¨¨train sensor¨¨train door right¨¨train door right path¨¨train door left¨¨train door left path¨¨train floor¨¨train floor broken top¨¨train floor broken bottom¨¨train floor broken middle¨÷¨seethrough¨»ß8ßD}}{ß1ßCß3|{´x´¢-68´y´¢-50}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨¨tutorial room 1 floor¨÷ßUßQß9»ßB|ßRßTßAßS÷ß8´´}}{ß1ßRß3|{´x´¢OW´y´¢-DO}÷ß4{ßUßQß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨home wow test wow¨¨tutorial room 2 floor¨¨tutorial room 2 floor platform¨÷ß9»ßB|ßGßCßS÷ß8´´}}{ß1ßSß3|{´x´¢-JM´y´¢-Tg}÷ß4{ßUßQß6|¨tutorial window 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨¨tutorial room 3 floor¨¨tutorial room 3 enemy 1¨÷ß9»ßB|ßSßTßRßC÷ß8´´}}{ß1ßTß3|{´x´¢-Z0´y´¢-Gc}÷ß4{ßUßQß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨¨tutorial room 4 floor¨÷ß9»ßB|ßSßC÷ß8´´}}{ß1ßGß3|{´x´¢9t´y´¢GK}÷ß4{ßUßQß6|¨tutorial room 5 sensor boss¨¨tutorial room 5 door start¨¨tutorial room 5 sensor boss start¨¨tutorial room 5 boss¨¨tutorial room 5 floor¨¨tutorial room 5 door end¨¨tutorial wall 15¨¨tutorial wall 16¨¨tutorial rock 23¨¨tutorial room 5 enemy¨¨tutorial rock 24¨¨tutorial rock 25¨¨tutorial rock 26¨¨tutorial rock 27¨¨tutorial room 5 switch path¨¨tutorial room 5 sensor middle¨¨tutorial room 5 sensor boss end¨¨tutorial wall 14¨¨tutorial room 5 rocky 3¨¨tutorial fake wall 5¨÷ß9»ßB|ßRßEßD÷ß8´´}}{ß1ß25ß3|{´x´¢Ii´y´¢3i}÷ß4{ßUßR¨spawn_enemy¨¨checkpoint¨¨is_spawner¨»¨spawn_repeat¨Êß8ßR}}{ß1ßsß3|¦´x´´y´‡¢1Qi¢vuºv¢1Aa¢1RWºxºyºw—÷ß4{ßUßFßVßWß8ßF}´z´£0.-1c}{ß1ßjß3|¦´x´´y´‡¢1Qs¤wOºz¢18y¢1Uk¢1Fk¢1dI¤pc—÷ß4{ßUßFßVßWß8ßF¨safe_floor¨»ß5¨wall_floor¨}´z´Ý3}{ß1ßkß3|¦´x´´y´‡º13¤pcº11º12—{´x´º11´y´º12´z´£0.-3E}{´x´º13´y´¤pc´z´Ý4}÷ß4{ßUßFßVß2xß8ßF}´z´Ý3}{ß1ßlß3|¦´x´´y´‡º13¤pcº11º12¢1fOº12¢1ks¤pc—÷ß4{ßUßFßVßWß8ßFß2w»ß5ß2x}´z´Ý4}{ß1ßmß3|¦´x´´y´‡º15¤pcº14º12—{´x´º14´y´º12´z´£0.-4q}{´x´º15´y´¤pc´z´Ý5}÷ß4{ßUßFßVß2xß8ßF}´z´Ý4}{ß1ßnß3|¦´x´´y´‡º15¤pcº14º12¢1xI¢1DK¢1us¤ri—÷ß4{ßUßFßVßWß8ßFß2w»ß5ß2x}´z´Ý5}{ß1ßoß3|¦´x´´y´‡º18¤riº16º17—{´x´º16´y´º17´z´£0.-6S}{´x´º18´y´¤ri´z´Ý6}÷ß4{ßUßFßVß2xß8ßF}´z´Ý5}{ß1ßtß3|¦´x´´y´‡º18¤riº16º17¢27S¢1De¢23u¤uw—÷ß4{ßUßFßVßWß8ßFß2w»ß5ß2x}´z´Ý6}{ß1ßvß3|¦´x´´y´‡º1B¤uwº19º1A—{´x´º19´y´º1A´z´Ý0}{´x´º1B´y´¤uw´z´Ý0}÷ß4{ßUßFßVß2xß8ßF}´z´Ý6}{ß1ßuß3|{´x´º1B´y´¤uw´z´Ý0}{´x´º19´y´º1A}{´x´¢2LA´y´¢12v´z´Ý0}{´x´¢294´y´¤uw}÷ß4{ßUßFßVßWß8ßFß2w»ß5ß2x}´z´Ý0}{ß1ß15ß3|¦´x´´y´‡º1B¤uw¢29O¤v6º19¤nC—{´x´¢2OO´y´¤nC´z´Ý0}{´x´¢28G´y´¤OC}{´x´¢1s8´y´¤nC´z´Ý0}{´x´¢22I´y´¤nC}÷ß4{ßUßFßVßWß8ßFß2w»}´z´Ý0}{ß1ßbß3|¦´x´´y´‡¢1Uu¢15Q¢1VE¢19S¢1SU¢172—÷ß4{ßUßFßV¨rock¨ß8ßF}´z´Ý3}{ß1ßXß3|¦´x´´y´‡¢1aE¤xq¢1ZJ¢105¢1XD¤yT—÷ß4{ßUßFßVß2yß8ßF}´z´Ý3}{ß1ßYß3|¦´x´´y´‡¢1d8¢15a¢1b5¢19l¢1Yp¢15F—÷ß4{ßUßFßVß2yß8ßF}´z´Ý4}{ß1ßZß3|¦´x´´y´‡¢1fb¤zl¢1cK¢10G¢1df¤xV—÷ß4{ßUßFßVß2yß8ßF}´z´Ý4}{ß1ßeß3|¦´x´´y´‡¢1nI¢16s¢1im¢19cº15º1L—÷ß4{ßUßFßVß2yß8ßF}´z´Ý5}{ß1ßfß3|¦´x´´y´‡¢1sc¢10kº1e¢10Q¢1qh¤vx—÷ß4{ßUßFßVß2yß8ßF}´z´Ý5}{ß1ßgß3|¦´x´´y´‡¢1uEº1L¢1tQ¢16iº1i¢15G—÷ß4{ßUßFßVß2yß8ßF}´z´Ý5}{ß1ßhß3|¦´x´´y´‡¢244¢1A6¢1yuº1Nº1Jº1L—÷ß4{ßUßFßVß2yß8ßF}´z´Ý6}{ß1ßiß3|{´x´¢1xw´y´¤xq}{´x´¢21o´y´¤yU´z´Ý6}{´x´º1s´y´º1k}÷ß4{ßUßFßVß2yß8ßFßO»}´z´Ý6}{ß1ßdß3|¦´x´´y´‡¢2Hwº1D¢29s¢16Yº1w¤zI—÷ß4{ßUßFßVß2yß8ßF}´z´Ý0}{ß1ß14ß3|{´x´¢2CN´y´¢169}÷ß4{ßUßFß2s¨enemy_streets_rocky_small¨ß2u»ß2vÊß8ßF¨spawn_permanent¨»}´z´Ý0}{ß1ßcß3|¦´x´´y´‡¢2Ei¤vGº20¢1CC¢1mUº21º22¤vG—÷ß4{ßUßFßV¨sensor¨ß8ßF}´z´Ý0}{ß1ßaß3|¦´x´´y´‡¢1Ty¤v5¢1UGº17ºvº21ºz¤vG—÷ß4{ßUßFßVß31ß8ßF}}{ß1ßpß3|¦´x´´y´‡º1B¤uw¢1vM¤w4—÷ß4{ßO»ßUßFßVß1Qß8ßF}´z´Ý6}{ß1ßqß3|{´x´¢1ce´y´¤rY}{´x´ºv´y´¤wO´z´Ý3}{´x´ºv´y´ºf}÷ß4{ßO»ßUßFßVß1Qß8ßF}´z´Ý3}{ß1ßrß3|¦´x´´y´‡¢1ja¤vkº26¤rY—÷ß4{ßO»ßUßFßVß1Qß8ßF}´z´Ý4}{ß1ßwß3|¦´x´´y´‡¢1VYº17ºvº10—{´x´ºv´y´¢14w´z´Ý3}÷ß4{ßO»ßUßFßVß1Qß8ßF}´z´Ý3}{ß1ßxß3|¦´x´´y´‡¢1g2¢1Cgº28º17—÷ß4{ßO»ßUßFßVß1Qß8ßF}´z´Ý4}{ß1ßyß3|{´x´¢1wy´y´ºx´z´Ý5}{´x´¢1oQ´y´¢1Au}{´x´º2A´y´º2B}÷ß4{ßO»ßUßFßVß1Qß8ßF}´z´Ý5}{ß1ßzß3|¦´x´´y´‡º25¤w4¢1pi¤tUº27¤vk—÷ß4{ßO»ßUßFßVß1Qß8ßF}´z´Ý5}{ß1ß10ß3|¦´x´´y´‡ºvº29ºvº10—÷ß4{ßO»ßUßFßVß1Qß8ßF}´z´Ý0}{ß1ß11ß3|{´x´ºv´y´¤wO´z´Ý0}{´x´ºv´y´ºf}÷ß4{ßO»ßUßFßVß1Qß8ßF}´z´Ý0}{ß1ß12ß3|{´x´¢26o´y´¢1AG´z´Ý6}{´x´º1u´y´¢1AQ}÷ß4{ßO»ßUßFßVß1Qß8ßF}´z´Ý6}{ß1ß18ß3|¦´x´´y´‡¢1tk¢1Ak¢1wo¢1EI¢1zsº2Eº2Cºx—÷ß4{ßO»ßUßFßVß1Qß8ßF}´z´Ý6}{ß1ß13ß3|¦´x´´y´‡¢2D6¢156º2Oº1xº1w¢19mº2Gº2H—÷ß4{ßO»ßUßFßVß1Qß8ßF}´z´Ý0}{ß1ß17ß3|¦´x´´y´‡º19¤umº1E¤uwº1w¤w4—{´x´º2O´y´¤zI´z´Ý0}{´x´º2O´y´º1j}÷ß4{ßO»ßUßFßVß1Qß8ßF}´z´Ý0}{ß1ß16ß3|{´x´º1t´y´¤xq}{´x´º1s´y´º1k´z´Ý6}÷ß4{ßUßFßV¨wall_streets_fake¨ßO»ß30»ß8ßF}´z´Ý6}{ß1ß1Bß3|¦´x´´y´‡¤am¤w4¤ZU¤w4¤RG¤w4¤Gw¤yy¤Gw¢17MºWº2RºW¢18e¤X4º2S¤X4º2R¤amº2R¤am¢130—÷ß4{ßUßEßVßWß2w»ß8ßE}}{ß1ß1Fß3|¦´x´´y´‡¢14S¤tAº1P¤uw¢17g¤y0º2Pº1k¢11s¤zmº1c¤xC¢11O¤uI—÷ß4{ßUßEßVß2yß8ßE}´z´Ý0}{ß1ß1Gß3|¦´x´´y´‡¢1Emº1L¢1GO¢164¢1Giº2Vº12¢19I¢1Dy¢198¢1Cqº2Vº17º2a—÷ß4{ßUßEßVß2yß8ßE}´z´Ý0}{ß1ß1Hß3|¦´x´´y´‡¢1K6¤xM¢1LE¤xq¢1LY¤yy¢1Kkº1k¢1J8¢106¢1IK¤yo¢1Iy¤xg—÷ß4{ßUßEßVß2yß8ßE}´z´Ý0}{ß1ß1Jß3|¦´x´´y´‡º5¤vGº5º21¢1PQº21º2o¤vG—÷ß4{ßUßEßVß31ß8ßE}}{ß1ß1Cß3|¦´x´´y´‡ºS¤wY¤KK¤yy¤KKº1cºSº1c¤Ue¤zm¤WGº1c¤ZU¤wY—÷ß4{ßUßEßVß31¨sensor_fov_mult¨Êß8ßE}}{ß1ß1Dß3|¦´x´´y´‡¤RG¤w4¤Op¤wi—÷ß4{ßO»ßUßEßVß1Qß8ßE}}{ß1ß1Eß3|¦´x´´y´‡¤Mk¤xM¤Gw¤yy¤Gwº2R¤ZUº2R¤ZU¢15k—÷ß4{ßO»ßUßEßVß1Qß8ßE}}{ß1ß1Pß3|{´x´¢2CI´y´¤zS}÷ß4{ßUßLß2s¨enemy_streets_camera_small¨ß2u»ß2vÊß8ßL}´z´Ý0}{ß1ß1Mß3|{´x´¢24O´y´¤to}÷ß4{ßUßLß2sß34ß2u»ß2vÊß8ßL}´z´Ý0}{ß1ß1Oß3|{´x´¢27I´y´¤mE}÷ß4{ßUßLß2sß34ß2u»ß2vÊß8ßL}´z´Ý0}{ß1ß1Nß3|{´x´¢23Q´y´¤te}{´x´º2t´y´¤sq´z´Ý0}{´x´º1w´y´¤sq´z´Ý0}{´x´º1w´y´¤te}÷ß4{ßUßLßVß31ß8ßLß33£0.Cu}´z´Ý0}{ß1ß1Lß3|¦´x´´y´‡¢25C¤iWº1J¤nCº1B¤uw—{´x´¢25q´y´¤um´z´Ý0}{´x´¢23k´y´¤uS}÷ß4{ßO»ßUßLßVß1Qß8ßL}´z´Ý0}{ß1ß1Kß3|¦´x´´y´‡¢2EY¤ga¢2A2¤iWº19¤nC¢28u¤uSº19¤um—÷ß4{ßO»ßUßLßVß1Qß8ßL}´z´Ý0}{ß1ß1Rß3|¦´x´´y´‡¤8w¤4r¤9s¤7u—÷ß4{ßUßNßO»ßVß1Qß5ßPß8ßM}}{ß1ß1Xß3|¦´x´´y´‡ºiºfºeºfºeº29ºiº29—÷ß4{ßUßHßVß1SßW»ß8ßDß1A»}´z´Ý2}{ß1ß1bß3|¦´x´´y´‡¤SEºfºgºf—{´x´ºg´y´ºf´z´Ý1}{´x´¤SE´y´ºf´z´Ý1}÷ß4{ßUßHßVß1Sß8ßD}}{ß1ß1cß3|¦´x´´y´‡ºgºf¤Ueºf—÷ß4{ßUßHßV¨sensor_path¨ß8ßD}}{ß1ß1Zß3|¦´x´´y´‡ºhºf¤X4ºf—{´x´¤X4´y´ºf´z´Ý1}{´x´ºh´y´ºf´z´Ý1}÷ß4{ßUßHßVß1Sß8ßD}}{ß1ß1aß3|¦´x´´y´‡ºhºf¤Ueºf—÷ß4{ßUßHßVß35ß8ßD}}{ß1ß1dß3|¦´x´´y´‡ºiºfºeºfºeº29ºiº29—÷ß4{ßUßHßV¨floor_train¨ß8ßDß1A»}}{ß1ß1Tß3|¦´x´´y´‡ºiºf¤SEºf¤Ru¢122¤SE¢13U¤SEº29ºiº29—÷ß4{ßUßHßVß36ß8ßDß1A»}}{ß1ß1fß3|¦´x´´y´‡ºeº29¤SEº29¤SEº31ºe¢13A—÷ß4{ßUßHßVß36ß8ßDß1A»}}{ß1ß1gß3|¦´x´´y´‡ºeº32¤SEº31¤Ruº30ºeºT—÷ß4{ßUßHßVß36ß8ßDß1A»}}{ß1ß1eß3|¦´x´´y´‡ºeºT¤Ruº30¤SEºfºeºf—÷ß4{ßUßHßVß36ß8ßDß1A»}}{ß1ß1Yß3|¦´x´´y´‡¤Qm¢114¤Qm¢14m¤YWº34¤YWº33—÷ß4{ßUßHßVß31ß8ßDß1A»}}{ß1ß1Uß3|{´x´ºi´y´ºf}{´x´ºi´y´ºf´z´Ý2}{´x´ºi´y´º29´z´Ý2}{´x´ºi´y´º29}÷ß4{ßUßHßVß1Sß8ßD}}{ß1ß1Vß3|{´x´ºe´y´ºf}{´x´ºe´y´ºf´z´Ý2}{´x´ºe´y´º29´z´Ý2}{´x´ºe´y´º29}÷ß4{ßUßHßVß1Sß8ßD}}{ß1ß1Wß3|¦´x´´y´‡ºeº29ºiº29—{´x´ºi´y´º29´z´Ý2}{´x´ºe´y´º29´z´Ý2}÷ß4{ßUßHßVß1Sß8ßD}}{ß1ß20ß3|¦´x´´y´‡¤Lm¤4q¤Ky¤84—÷ß4{ßUßRßV¨wall_tutorial_fake¨ßO»ß30»ß8ßR}}{ß1ß2Wß3|¦´x´´y´‡¢-M6¤-U¢-NY¤K—÷ß4{ßUßTßVß37ßO»ß30»ß8ßT}}{ß1ß2rß3|¦´x´´y´‡¤AA¤g6¤By¤i0—÷ß4{ßUßGßVß37ßO»ß30»ß8ßG}}{ß1ß1Iß3|{´x´ºv´y´¤wO´z´Ý0}{´x´ºv´y´º10}{´x´¤ye´y´¢1Ec}{´x´¤yU´y´¤qQ}÷ß4{ßUßEßVßWß8ßE}´z´Ý0}{ß1ß2gß3|¦´x´´y´‡¤CQ¤ga¤DE¤gQ¤EM¤gu¤EW¤hs¤E2¤iM¤DO¤iW¤Ck¤iC—÷ß4{ßUßGßVß2yßO»ß8ßG}}{ß1ß2iß3|¦´x´´y´‡¤SO¤oe¤TC¤pSºS¤qa¤S4¤qu¤Qw¤qaºe¤pS¤RG¤oU—÷ß4{ßUßGßVß2yß8ßG}}{ß1ß2jß3|¦´x´´y´‡¤SiºZºS¤sM¤SY¤tA¤Ra¤tK¤Qw¤sg¤Qw¤ri¤Rk¤rE—÷ß4{ßUßGßVß2yß8ßG}}{ß1ß2kß3|¦´x´´y´‡¤Ss¤tU¤Tq¤uS¤Tg¤vk¤Si¤wY¤Rk¤wE¤R6¤v6¤Ra¤ty—÷ß4{ßUßGßVß2yß8ßG}}{ß1ß2lß3|¦´x´´y´‡¤OC¤vQ¤Og¤wE¤OM¤x2¤NO¤xM¤Ma¤ws¤MQºw¤NE¤vG—÷ß4{ßUßGßVß2yß8ßG}}{ß1ß1kß3|{´x´¢-2Q´y´º3}÷ß4{ßUßCß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷ß8ßC}}{ß1ß1mß3|¦´x´´y´‡¤6w¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßUßCß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßVß31ß33£0.EWß8ßC}}{ß1ß1qß3|¦´x´´y´‡¤D4¤-A¤C6¢-42¤5eº38º2ºk¢-6Iº2¢-6m¤42¢-9q¤50¢-Bm¤84¢-Bc¤BI¢-7Q¤D4¢-3Y¤B8¢-26¤84¤4C¤6w¤6c¤1S—÷ß4{ßUßCßVßWß2w»ß8ßC}}{ß1ß1iß3|{´x´ºk´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß3I÷ßUßCß8ßC}}{ß1ß1lß3|¦´x´´y´‡¤5eº38º2ºkº3Cº2º3D¤42º3J¤84¤4C¤6w¤6c¤1S—÷ß4{ßUßCßVß31ß33Êß8ßC}}{ß1ß1oß3|{´x´¢-BI´y´¤4q}÷ß4{ß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßUßCß8ßC}}{ß1ß1wß3|¦´x´´y´‡¤5e¢-CG¤4g¢-8O¤8Yº3H¤9Wº3L¤F9¢-HE¤9W¢-BS—÷ß4{ßUßRßVß31ß33Ý8ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷ß8ßR}}{ß1ß26ß3|¦´x´´y´‡¤Gw¢-Ky¤EC¢-Lc¤BS¢-KU¤4M¢-Ca¤3O¢-8i¤C6º3B¤D4¤-A¤Bm¤8s¤E2¤G8¤H6¤GI¤Ke¤9M¤WG¤84¤Wu¤2G¤Uy¢-Ay—÷ß4{ßUßRßVßWß2w»ß8ßR}}{ß1ß27ß3|¦´x´´y´‡¤Wu¢-4C¤Waº3H—{´x´¤Vw´y´¢-5o´z´£0.3E}÷ß4{ßUßRßVßWß8ßR}´z´Ý9}{ß1ß1sß3|{´x´¤G8´y´º3I}÷ß4{ßUßRß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷ß8ßR}}{ß1ß1vß3|{´x´¤KA´y´¢-5A}÷ß4{ßUßRß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷ß8ßR}}{ß1ß21ß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßUßRßVß31ß8ßR}}{ß1ß1tß3|{´x´¤Ss´y´¤-y}÷ß4{ßUßRß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ß8ßR}}{ß1ß1uß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßUßRßVß35ß6|¨tutorial room 2 switch¨÷ß8ßR}}{ß1ß1xß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGº38—÷ß4{ßUßRßV¨icon¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷ß8ßR}´z´£0.1c}{ß1ß1zß3|{´x´¤AU´y´¢-K0}÷ß4{ßUßRß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷ß8ßR}}{ß1ß22ß3|¦´x´´y´‡¤CQ¤y¤Ds¤FU¤HQ¤FU¤FU¤y—÷ß4{ßUßRßVß31ß33Ý8ß8ßR}}{ß1ß29ß3|¦´x´´y´‡¢-Lm¢-IY¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßUßSßVß31ß33£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷ß8ßS}}{ß1ß2Hß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FKº3V¢-Ds¢-8s¢-Fe¢-8Yº3n¢-A0º3d¢-DY¢-Ke—÷ß4{ßUßSßVß31ß8ßS}}{ß1ß2Kß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßUßSß2s¨enemy_tutorial_easy¨ß2u»ß2vÊß8ßS}}{ß1ß2Aß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßUßSß2sß43ß2u»ß2vÊß8ßS}}{ß1ß2Jß3|¦´x´´y´‡¤3Oº3U¤4Mº3T¤e¢-GI¢-4Mº3S¢-84¢-Oq¢-EC¢-PAº3e¢-I4¢-OM¢-FU¢-MQº3vº3L¢-9Cº3J¢-76—÷ß4{ßUßSßVßWß2w»ß8ßS}}{ß1ß2Eß3|¦´x´´y´‡º3Cº43¤2F¢-5T¤4qº3p¢-3F¢-Hl—÷ß4{ßUßSßVß31ß33ÝBß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷ß8ßS}}{ß1ß2Pß3|{´x´¢-L4´y´¤49}÷ß4{ßUßTß2s¨enemy_tutorial_rock_room4¨ß2u»ß2vÊß8ßT}}{ß1ß2Xß3|¦´x´´y´‡º4Aº3vº48º49¢-W6¢-Ck¢-Ygº3Yºo¤Uº36¤Kº36¤7G¢-Is¤7Gº4K¤34º35¤-U¢-J2¢-3Oº3nº3U—÷ß4{ßUßTßVßWß2w»ß8ßT}}{ß1ß2Mß3|{´x´¢-QI´y´¢-7G}÷ß4{ßUßTß2s¨collect_gun_basic¨ß2u»ß2vÊß30»ß8ßT}}{ß1ß2Nß3|{´x´º4N´y´º4O}÷ß4{ßUßTß2s¨deco_gun_basic¨ß2u»ß2vÊß8ßT}}{ß1ß2Tß3|¦´x´´y´‡¢-Kz¢-6w¢-Kj¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßUßTßVß3tß8ßT}}{ß1ß2Oß3|{´x´¢-Ue´y´¢-C6}÷ß4{ßUßTß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷ß8ßT}}{ß1ß2Rß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßUßTß2s¨enemy_tutorial_rocky¨ß2u»ß2vÊß30»ß8ßT}}{ß1ß2Sß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßUßTß2sß4Cß2u»ß2vÊß30»ß8ßT}}{ß1ß2Lß3|¦´x´´y´‡¢-OK¢-FkºA¢-Cu¢-Yqº3Y¢-Tq¤e¢-Ma¤Uº4K¢-3E¢-IEº3r—÷ß4{ßUßTßVß31ß33£1.4qß8ßT}}{ß1ß2Qß3|{´x´¢-Ic´y´¤16}÷ß4{ßUßTß2s¨switch¨ß2u»ß2vÊß8ßT}}{ß1ß2bß3|{´x´¤Fy´y´¤TW}÷ß4{ßUßGß2s¨enemy_tutorial_boss¨ß2u»ß2vÊß8ßGß30»}}{ß1ß2dß3|¦´x´´y´‡¤Pe¤fS¤Lw¤fc—÷ß4{ßO»ß5¨tutorial_door¨ßUßGß6|¨tutorial room 5 door end path¨÷ß8ßG}}{ß1ß2Zß3|¦´x´´y´‡¤KU¤GS¤HQ¤GI—÷ß4{ßO»ß5ß4FßUßGß6|¨tutorial room 5 door start path¨÷ß8ßG}}{ß1ß2hß3|{´x´¤Tx´y´¤gx}÷ß4{ßUßGß2s¨enemy_tutorial_easy_static¨ß2u»ß2vÊß8ßG}}{ß1ß2cß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºS¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fw¤Ue¤fw¤Vc¤jA¤Wu¤jA¤XO¤km¤W6¤km¤X4¤o0¤YM¤o0¤am¤w4¤ZU¤wE¤RG¤w4¤Gw¤yy¤F0¤nC¤92¤h4¤9M¤gG¤AA¤g6¤1w¤X4¤4q¤M6—÷ß4{ßUßGßVßWß2w»ß8ßG}}{ß1ß2qß3|{´x´¤WV´y´¤jy}÷ß4{ßUßGß2s¨enemy_tutorial_rocky_small¨ß2u»ß2vÊß8ßGß30»}}{ß1ß2Yß3|¦´x´´y´‡¤1w¤Ko¤1w¤cEºS¤bQ¤TM¤LI—÷ß4{ßUßGßVß31ß8ßG}}{ß1ß2oß3|¦´x´´y´‡¤8s¤eK¤9g¤fI¤MG¤eo¤N4¤dq—÷ß4{ßUßGßVß31ß33ÝCß8ßG}}{ß1ß2aß3|¦´x´´y´‡¤DE¤Gm¤CG¤HQ¤JC¤Hk¤IE¤H6—÷ß4{ßUßGßVß31ß33ÝCß8ßG}}{ß1ß2nß3|¦´x´´y´‡¤DE¤g6¤Eg¤gu¤Kr¤ga¤V1¤fk¤ZU¤um¤Gc¤um¤H6¤ye¤Qwºw¤aI¤vW¤VI¤fI—÷ß4{ßUßGßVß31ß33Êß8ßG}}{ß1ß2mß3|¦´x´´y´‡¤NE¤vG¤MkºZ—÷ß4{ßUßGßVß35ß8ßG}}{ß1ß2Bß3|¦´x´´y´‡º4eº4Bº7¢-9gº3F¢-B8—÷ß4{ßUßSßV¨spike¨ß8ßS}}{ß1ß2Cß3|¦´x´´y´‡º4K¢-EW¢-JWº49¢-HG¢-G8—÷ß4{ßUßSßVß4Kß8ßS}}{ß1ß2Dß3|¦´x´´y´‡¢-Af¢-PH¢-Bw¢-PKº3L¢-NO—÷ß4{ßUßSßVß4Kß8ßS}}{ß1ß2Uß3|¦´x´´y´‡¢-Iu¤5Sº4K¤34º35¤-Uº4Lº4Mº3nº3Uº4Aº3v—÷ß4{ßUßTßVß1QßO»ß8ßT}}{ß1ß1jß3|¦´x´´y´‡¢-38¤7Aº3J¤84¤4C¤6w¤6c¤1S¤D4¤-A—÷ß4{ßO»ßUßCßVß1Qß8ßC}}{ß1ß1nß3|¦´x´´y´‡¢-6e¤2Yº3D¤42—÷ß4{ßUßCßVß1QßO»ß8ßC}}{ß1ß1rß3|¦´x´´y´‡¤Po¤gQºS¤Vw¤RG¤MG¤H6¤GI¤Ha¤CG¤Ke¤9M¤Ky¤84¤WG¤84¤WG¤4q¤Lm¤4q¤M8¤3G¤WN¤48¤Wj¤2G¤Ut¢-Ax¤NN¢-Bh¤Ls¢-H8¤Gp¢-Ip¤Dr¢-Gp—÷ß4{ßO»ßUßRßVß1Qß8ßR}}{ß1ß23ß3|¦´x´´y´‡¤3Oº3U¤9qº4C¤C6º3B—÷ß4{ßUßRßVß1QßO»ß8ßR}}{ß1ß2Vß3|¦´x´´y´‡º36¤6Iº36¤Kºo¤Uº4Jº3Yº4Hº4Iº48º49—÷ß4{ßUßTßVß1QßO»ß8ßT}}{ß1ß1yß3|¦´x´´y´‡¤Cvº3l¤Bt¢-FS¤BS¢-Ao¤4Mº3T—÷ß4{ßO»ßUßRßVß1Qß8ßR}}{ß1ß1pß3|¦´x´´y´‡¤C6º3B¤5eº38º2ºkº3Cº2¢-6T¤U—÷ß4{ßUßCßVß1QßO»ß8ßC}}{ß1ß24ß3|¦´x´´y´‡¤D4¤-A¤Bm¤8s¤EW¤C1¤E2¤G8¤4q¤M6¤26¤X4¤AA¤g6¤EC¤fw—÷ß4{ßO»ßUßRßVß1Qß8ßR}}{ß1ß2Gß3|¦´x´´y´‡º4Aº3v¢-Jqº4xº4w¢-CQº3Lº4B¢-5eº4tº3Jº4C¤3Oº3U—÷ß4{ßUßSßVß1QßO»ß8ßS}}{ß1ß2Fß3|¦´x´´y´‡º48º49º3eº47º4Lº4vº45º46º43º44º42º3Sº3Zº3o¤eº41¤4Mº3T—÷ß4{ßUßSßVß1QßO»ß8ßS}}{ß1ß2pß3|¦´x´´y´‡¤Hu¤fm¤Lw¤fcºS¤Vw—÷ß4{ßO»ßUßGßVß1Qß8ßG}}{ß1ß2eß3|¦´x´´y´‡¤By¤i0¤G8¤mO¤RQ¤lG¤SE¤o0¤Gw¤p8—÷ß4{ßO»ßUßGßVß1Qß8ßG}}{ß1ß2fß3|¦´x´´y´‡¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤ZUº2l—÷ß4{ßO»ßUßGßVß1Qß8ßG}}{ß1ß28ß3|¦´x´´y´‡¢-FAº5Hº3Vº3jº3Uº3sº3Nº3nº3u¢-KAº3v¢-Koº3hº3nº5Hº5H—÷ß4{ßUßSßV¨wall_tutorial_window¨ßO»ß8ßS}}{ß1ß2Iß3|¦´x´´y´‡º5Hº5Hº3Vº3jº3Uº3sº3Nº3nº3uº5Iº3vº5Jº3hº3nº5Hº5H—÷ß4{ßUßSßVß4Lß8ßS}}{ß1ß45ß3|¦´x´´y´‡º3Kº4lº3Jº4t—÷ß4{ßUß2EßVß37ßO»ß30»ß8ßS}}{ß1ß3lß3|¦´x´´y´‡¤Hkº3D¤Gc¢-7a—÷ß4{ßUß1vßVß37ßO»ß30»ß8ßR}}{ß1ß3Eß3|¦´x´´y´‡¤-Lº4MÒº3A¤xº3I¤1H¢-2u¤w¢-2P¤I¢-2F¤-M¢-2Z—÷ß4{ßUß1ißVß2yß8ßC}}{ß1ß3Fß3|¦´x´´y´‡¤2F¤5A¤2Z¤4W¤3N¤4C¤41¤4q¤41¤5o¤3D¤68¤2P¤5y—÷ß4{ßUß1ißVß2yß8ßC}}{ß1ß3Gß3|¦´x´´y´‡¢-5p¢-18¢-5fº2¢-4r¢-1w¢-4N¢-1Sº5U¤-o¢-51¤-U¢-5V¤-e—÷ß4{ßUß1ißVß2yß8ßC}}{ß1ß3Hß3|¦´x´´y´‡¢-3j¤5K¢-35¤50¢-2H¤50¢-1n¤5e¢-1x¤6c¢-2R¤5y¢-4B¤6G—÷ß4{ßUß1ißVß2yß8ßC}}{ß1ß3Iß3|¦´x´´y´‡º5D¤Uº55¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßUß1ißV¨wall_tutorial_rock_breakable¨ß8ßC}}{ß1ß3Xß3|¦´x´´y´‡¤Mn¢-3H¤Oxº4M¤Pu¢-4E¤PPºj¤OEº4W¤Mz¢-6F¤MK¢-4z—÷ß4{ßUß1vßVß2yß8ßR}}{ß1ß3Yß3|¦´x´´y´‡¤Cl¢-48¤Doº3I¤Ee¢-47¤Ee¢-5F¤E8¢-6A¤Cjº5o¤C8¢-52—÷ß4{ßUß1vßVß2yß8ßR}}{ß1ß3Zß3|¦´x´´y´‡¤F9¢-41¤Gm¢-3s¤Ho¢-4Q¤Hq¢-5c¤Gh¢-6V¤Fbº5o¤Ew¢-59—÷ß4{ßUß1vßVß2yß8ßR}}{ß1ß3aß3|¦´x´´y´‡¤Iw¢-3q¤Kv¢-3W¤Lp¢-4l¤Lk¢-67¤K1¢-6j¤IT¢-6D¤IA¢-4w—÷ß4{ßUß1vßVß2yß8ßR}}{ß1ß3bß3|¦´x´´y´‡¤Hkº3D¤JCº3H¤JVº4B¤IR¢-A3¤H9¢-AJ¤GJ¢-96¤Gcº5K—÷ß4{ßUß1vßVß2yßO»ß8ßR}}{ß1ß3cß3|¦´x´´y´‡¤DD¢-FZ¤Dr¢-Fb¤EB¢-Fs¤EI¢-GO¤Drº5A¤D8¢-Gn¤Cvº3l—÷ß4{ßUß1vßVß2yß8ßR}}{ß1ß3dß3|¦´x´´y´‡¤KZ¢-G2¤L2¢-Fn¤Lb¢-G0¤Lf¢-GR¤LJ¢-H1¤Km¢-H2¤KQ¢-GX—÷ß4{ßUß1vßVß2yß8ßR}}{ß1ß44ß3|¦´x´´y´‡º3Jº4tº5Vº4s¤Kº3E¤1mº4t¤1Sº4I¤Aº3vº3Kº4l—÷ß4{ßUß2EßVß2yßO»ß8ßS}}{ß1ß49ß3|¦´x´´y´‡¢-VIº4e¢-V8º3T¢-UKº4lº4nº5Fº4nº3F¢-UUº3P¢-Uyº3G—÷ß4{ßUß2OßVß2yß8ßT}}{ß1ß4Aß3|¦´x´´y´‡¢-OWº5T¢-O2¢-2V¢-NJ¢-2fº4o¢-2G¢-Mkº3Kº36¤-yº48º5Q—÷ß4{ßUß2OßVß2yß8ßT}}{ß1ß4Bß3|¦´x´´y´‡¢-TMº3K¢-T2º5T¢-SEº6S¢-RQ¢-1m¢-RG¤-y¢-Ru¤-Kº6V¤-U—÷ß4{ßUß2OßVß2yß8ßT}}{ß1ß3eß3|¦´x´´y´‡¤Fd¤1h¤GZ¤1y¤HJ¤1R¤HJ¤R¤GT¤-G¤FH¤-F¤Ew¤m—÷ß4{ßUß1vßVß2yß8ßR}}{ß1ß3fß3|¦´x´´y´‡¤Hz¤1m¤J3¤1o¤JH¤19¤JA¤N¤IfÁ¤HlÒ¤Hb¤14—÷ß4{ßUß1vßVß2yß8ßR}}{ß1ß3gß3|¦´x´´y´‡¤Jl¤1o¤Km¤2V¤Lr¤22¤MF¤h¤LQÒ¤K4¤B¤JX¤c—÷ß4{ßUß1vßVß2yß8ßR}}{ß1ß3iß3|¦´x´´y´‡¤MQ¤2G¤NY¤2z¤PA¤2y¤Py¤2M¤Pw¤1A¤Oa¤R¤My¤V—÷ß4{ßUß1vßVß2yß8ßR}}{ß1ß3jß3|¦´x´´y´‡¤QR¤2D¤R7ºE¤Rw¤2f¤SI¤1u¤S2¤16¤R7¤l¤QW¤18—÷ß4{ßUß1vßVß2yß8ßR}}{ß1ß3kß3|¦´x´´y´‡¤Sn¤1x¤Uf¤2Jºh¤17¤Vo¤-L¤UV¤-k¤TG¤-G¤Sf¤h—÷ß4{ßUß1vßVß2yß8ßR}}{ß1ß38ß3|¦´x´´y´‡¤4X¤-T¤50¤-K¤4jÎ¤50¤-K¤3OÒ—÷ß4{ßUß1kßVß3tßO»ß8ßC}´z´ÝA}{ß1ß39ß3|¦´x´´y´‡º3B¤-yº3B¢-2aº5Vº3Z¤-Uº3W¤-Uº5T¤1N¢-2L¤1Sº3I¤5Kº6S—÷ß4{ßUß1kß2s¨enemy_tutorial_bit¨ß2u»ß2vÎß8ßC}}{ß1ß3Aß3|¦´x´´y´‡¢-4W¤5eº3C¤3sºj¤-y¢-5K¤-Aº5r¤-yº42¤3Eº4p¤4g—÷ß4{ßUß1kß2sß4Nß2u»ß2vÎß8ßC}}{ß1ß3Bß3|¦´x´´y´‡¤9Mº3K¤9s¤m—÷ß4{ßO»ß5ß4FßUß1mß8ßC}}{ß1ß3Cß3|¦´x´´y´‡¤9Mº3K¤8q¢-3M—÷ß4{ß5ß4FßUß1mßO»ß8ßC}}{ß1ß3Dß3|¦´x´´y´‡¤8E¢-34¤9C¤o¤AU¤U¤9Wº4M—÷ß4{ßUß1mßV¨deco¨ß5¨tutorial_door_floor¨ß8ßC}}{ß1ß3Kß3|{´x´º3Y´y´¤AA}÷ß4{ßUß1oß2sß4Cß2u»ß2vÊß8ßC}}{ß1ß3Lß3|{´x´¢-9M´y´¤6w}÷ß4{ßUß1oß2sß4Cß2u»ß2vÊß30»ß8ßC}}{ß1ß3Mß3|{´x´º4s´y´¤AA}÷ß4{ßUß1oß2sß4Cß2u»ß2vÊß30»ß8ßC}}{ß1ß3Qß3|¦´x´´y´‡¤A6¢-9m¤9g¢-9Q¤A5¢-93¤9gº6j¤BM¢-9O—÷ß4{ßUß1wßVß3tßO»ß8ßR}´z´ÝA}{ß1ß3Rß3|¦´x´´y´‡¤ER¢-5Z¤E8¢-56¤Dnº6m¤E8º6n¤E8º55—÷ß4{ßUß1wßV¨icon_tutorial¨ßO»ß8ßR}´z´ÝA}{ß1ß3Sß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßUß1wßVß4QßO»ß8ßR}´z´ÝA}{ß1ß3hß3|{´x´¤Dz´y´¤Y}÷ß4{ßUß1vß2s¨enemy_tutorial_block¨ß2u»ß2vÊß30»ß8ßR}}{ß1ß3mß3|¦´x´´y´‡¤Maº4p¤Lwº4p¤LIº4M¤M4¢-4c¤M5º6n¤M1º5o¤KKº3D¤NOº3D¤Mgº3C¤M8º6n¤M7º6o—÷ß4{ßUß1tß2sß4Nß2u»ß2vÎß8ßR}}{ß1ß3nß3|¦´x´´y´‡ºS¤-U¤SO¤y¤RG¤U¤Py¤o¤SYº3K¤V8º39¤Vcº3K—÷ß4{ßUß1tß2sß4Nß2vÎß2u»ß8ßR}}{ß1ß3oß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßUß1tß2sß4Nß2u»ß2vÎß8ßR}}{ß1ß3qß3|¦´x´´y´‡¤Ha¤Bm¤EW¤Bc¤C6¤8s¤D4¤1S¤GS¤2Q¤HQ¤1w¤JW¤26¤Ko¤2u¤Lw¤2Q¤K0¤9W—÷ß4{ßUß1tß2sß4Nß2v¤Cß2u»ß8ßR}}{ß1ß3Oß3|¦´x´´y´‡¤76º3E¤6a¢-7m—÷ß4{ßO»ß5ß4FßUß1wß8ßR}}{ß1ß3Pß3|¦´x´´y´‡¤76º3Eºa¢-Bu—÷ß4{ßO»ß5ß4FßUß1wß8ßR}}{ß1ß3Nß3|¦´x´´y´‡¤6wº50¤5yº43¤7G¢-7k¤8Eº3G—÷ß4{ßUß1wßVß4Oß5ß4Pß8ßR}}{ß1ß3pß3|{´x´¤Hb´y´¢-C3}÷ß4{ßUß1tß2s¨enemy_tutorial_4way¨ß2u»ß2vÊß8ßR}}{ß1ß3rß3|{´x´¤R6´y´¤5o}÷ß4{ßUß1tß2s¨enemy_tutorial_down¨ß2u»ß2vÊß8ßR}}{ß1ß3sß3|{´x´¤FM´y´¢-7V}÷ß4{ßUß1uß2sß4Dß2u»ß2vÊß8ßR}}{ß1ß3uß3|¦´x´´y´‡¤E6¢-1h¤EB¢-21—÷ß4{ßUß1xßVß3tßO»ß8ßR}´z´ÝA}{ß1ß3vß3|¦´x´´y´‡¤E4¢-1X¤E4º72—÷ß4{ßUß1xßVß3tßO»ß8ßR}´z´ÝA}{ß1ß3wß3|{´x´¤Eg´y´º5E}÷ß4{ßUß1zß2sß4Cß2u»ß2vÊß30»ß8ßR}}{ß1ß40ß3|{´x´¤Bw´y´º3n}÷ß4{ßUß1zß2sß4Cß2u»ß2vÊß30»ß8ßR}}{ß1ß3xß3|¦´x´´y´‡¤Ba¢-FT¤H1¢-JI¤Gl¢-L3¤E4¢-Lp¤BS¢-Ki¤9f¢-Il¤9j¢-GL—÷ß4{ßUß1zßVß31ß33£0.BIß8ßR}}{ß1ß3yß3|¦´x´´y´‡¤D8º6A¤EC¢-FN—÷ß4{ßUß1zßVß35ß8ßR}}{ß1ß41ß3|¦´x´´y´‡º3Q¢-Eg¢-NE¢-Gw—÷ß4{ßO»ß5ß4FßUß29ß8ßS}}{ß1ß42ß3|¦´x´´y´‡¢-LIº4uº5Jº3o¢-Mu¢-H6º52ºq—÷ß4{ßUß29ßVß4Oß5ß4Pß8ßS}}{ß1ß4Gß3|¦´x´´y´‡¤Lw¤fc¤EC¤fw—÷ß4{ßUß2dßVß35ß8ßG}}{ß1ß4Hß3|¦´x´´y´‡¤HQ¤GI¤E2¤G8—÷ß4{ßUß2ZßVß35ß8ßG}}{ß1ß3Tß3|¦´x´´y´‡¤Gh¢-43¤G8º38¤FPº3W—÷ß4{ßUß1sßVß4Kß8ßR}}{ß1ß3Uß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Keº2—÷ß4{ßUß1sßVß4Kß8ßR}}{ß1ß3Vß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Ojº5P¤P3¢-5i¤Tdº5z¤PE¢-4S¤OX¢-3f¤OCº3K¤N9º3I—÷ß4{ßUß1sßVß4Kß8ßR}}{ß1ß3Wß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßUß1sßVß4Kß8ßR}}{ß1ß3Jß3|¦´x´´y´‡º5e¤6Gº3D¤42º3E¤50º7P¤83º3G¤BIº3H¤D4º3I¤B8º54¤7A—÷ß4{ßO»ßUß1oßVß1Qß8ßC}}{ß1ß3zß3|¦´x´´y´‡¤Gpº59¤GZº4T¤E4¢-LR¤Bcº4f¤A0º4r¤A3¢-GT¤Btº5B—÷ß4{ßO»ßUß1zßVß1Qß8ßR}}÷¨icons¨|÷}");
