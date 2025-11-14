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
export const TEST_MAP = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢3Ng´y´¢WQ}÷¨options¨{¨style¨ß2¨contains¨|¨home floor¨÷¨room_id¨´´¨is_room¨»}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ßA¨room_connections¨|¨tutorial room 1¨÷ß9»ß8´´}}{ß1¨station¨ß3|{´x´¢1RC´y´¢1NU}÷ß4{ßB|¨station tutorial¨¨station streets¨¨tutorial room 5¨÷ß6|¨train¨ßE¨station tracks¨ßF¨station tracks particle¨÷ß8´´ß9»}}{ß1¨streets¨ß3|{´x´¢1f4´y´¢-D4}÷ß4{ß8´´ß6|¨streets room 1¨÷}}{ß1¨test group¨ß3|{´x´¢6x´y´¢7q}÷ß4{ß6|¨test 1¨÷¨open_loop¨«ß5¨test¨ßB|÷ß9»ß8´´}}{ß1¨tutorial¨ß3|{´x´¢-WG´y´ºA}÷ß4{ß6|ßC¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨ßG÷ß8´´}}{ß1ß7ß3|¦´x´´y´‡¢3sk¢Bs¢3Xu¢2m¢3FVºE¢30C¢6M¢2pO¢Gd¢2mE¢TN¢2py¢ip¢2zv¢sv—÷ß4{¨parent¨ß2¨make_id¨¨floor¨ß8ß2}}{ß1ßFß3|{´x´¢1cy´y´¢11i}÷ß4{ßUßDß6|¨station streets rock 1¨¨station streets rock 2¨¨station streets rock 3¨¨station streets sensor start¨¨station streets rock 0¨¨station streets sensor fall¨¨station streets rock block¨¨station streets rock 4¨¨station streets rock 5¨¨station streets rock 6¨¨station streets rock 7¨¨station streets rock 8¨¨station streets floor 1¨¨station streets floor 1.5¨¨station streets floor 2¨¨station streets floor 2.5¨¨station streets floor 3¨¨station streets floor 3.5¨¨station streets wall 1¨¨station streets wall 2¨¨station streets wall 3¨¨station streets floor 0¨¨station streets floor 4¨¨station streets floor 5¨¨station streets floor 4.5¨¨station streets wall 5¨¨station streets wall 6¨¨station streets wall 7¨¨station streets wall 8¨¨station streets wall 9¨¨station streets wall 10¨¨station streets wall 11¨¨station streets wall 13¨¨station streets rocky 1¨¨station streets floor 6¨¨station streets wall fake 1¨¨station streets wall 14¨÷ß8ßDß9»ßB|ßDßL÷}}{ß1ßIß3|¦´x´´y´‡¢T2¢12W¢3U8ºTºU¢13KºSºV—÷ß4{ßUßDßV¨floor_train_track¨ß8ßD¨sensor_dont_set_room¨»}}{ß1ßJß3|¦´x´´y´‡ºSºTºSºV—÷ß4{ßUßDßVß18ß8ßDß19»}}{ß1ßEß3|{´x´¢VS´y´¢yA}÷ß4{ßUßDß6|¨station tutorial floor¨¨station tutorial sensor start¨¨station tutorial wall 1¨¨station tutorial wall 2¨¨station tutorial rock 1¨¨station tutorial rock 2¨¨station tutorial rock 3¨¨tutorial floor low¨¨station tutorial sensor end¨÷ß8ßDß9»ßB|ßGßD÷}}{ß1ßLß3|{´x´¢1zO´y´¢rO}÷ß4{ßUßKß8´´ß9»ßB|ßF÷ß6|¨streets room 1 wall 2¨¨streets room 1 wall 1¨¨streets room 1 camera 1¨¨streets room 1 sensor start¨¨streets room 1 camera 2¨¨streets room 1 camera 0¨÷}´z´£0.-84}{ß1ßNß3|¦´x´´y´‡¢7c¢46¢8u¢88—÷ß4{ßUßMßO»ßV¨wall¨ß5ßPß6|¨test 2¨÷ß8ßM}}{ß1ßHß3|¦´x´´y´‡¢Qc¢10u¢TRºf—{´x´ºg´y´ºf´z´£0.4q}{´x´¢Vr´y´ºf´z´Ý1}{´x´ºh´y´ºf}{´x´¢Yg´y´ºf}{´x´ºi´y´ºf´z´£0.84}{´x´ºe´y´ºf´z´Ý2}÷ß4{ßUßDßV¨wall_train¨ß6|¨train floor broken¨¨train wall 1¨¨train wall 2¨¨train wall 3¨¨train ceiling¨¨train sensor¨¨train door right¨¨train door right path¨¨train door left¨¨train door left path¨¨train floor¨¨train floor broken top¨¨train floor broken bottom¨¨train floor broken middle¨÷¨seethrough¨»ß8ßD}}{ß1ßCß3|{´x´¢-68´y´¢-50}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨¨tutorial room 1 floor¨÷ßUßQß9»ßB|ßRßTßAßS÷ß8´´}}{ß1ßRß3|{´x´¢OW´y´¢-DO}÷ß4{ßUßQß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨home wow test wow¨¨tutorial room 2 floor¨¨tutorial room 2 floor platform¨÷ß9»ßB|ßGßCßS÷ß8´´}}{ß1ßSß3|{´x´¢-JM´y´¢-Tg}÷ß4{ßUßQß6|¨tutorial window 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨¨tutorial room 3 floor¨¨tutorial room 3 enemy 1¨÷ß9»ßB|ßSßTßRßC÷ß8´´}}{ß1ßTß3|{´x´¢-Z0´y´¢-Gc}÷ß4{ßUßQß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨¨tutorial room 4 floor¨÷ß9»ßB|ßSßC÷ß8´´}}{ß1ßGß3|{´x´¢9t´y´¢GK}÷ß4{ßUßQß6|¨tutorial room 5 sensor boss¨¨tutorial room 5 door start¨¨tutorial room 5 sensor boss start¨¨tutorial room 5 boss¨¨tutorial room 5 floor¨¨tutorial room 5 door end¨¨tutorial wall 15¨¨tutorial wall 16¨¨tutorial rock 23¨¨tutorial room 5 enemy¨¨tutorial rock 24¨¨tutorial rock 25¨¨tutorial rock 26¨¨tutorial rock 27¨¨tutorial room 5 switch path¨¨tutorial room 5 sensor middle¨¨tutorial room 5 sensor boss end¨¨tutorial wall 14¨¨tutorial room 5 rocky 3¨¨tutorial fake wall 5¨÷ß9»ßB|ßRßEßD÷ß8´´}}{ß1ß24ß3|{´x´¢Ii´y´¢3i}÷ß4{ßUßR¨spawn_enemy¨¨checkpoint¨¨is_spawner¨»¨spawn_repeat¨Êß8ßR}}{ß1ßsß3|¦´x´´y´‡¢1Qi¢vuºv¢1Aa¢1RWºxºyºw—÷ß4{ßUßFßVßWß8ßF}´z´£0.-1c}{ß1ßjß3|¦´x´´y´‡¢1Qs¤wOºz¢18y¢1Uk¢1Fk¢1dI¤pc—÷ß4{ßUßFßVßWß8ßF¨safe_floor¨»ß5¨wall_floor¨}´z´Ý3}{ß1ßkß3|¦´x´´y´‡º13¤pcº11º12—{´x´º11´y´º12´z´£0.-3E}{´x´º13´y´¤pc´z´Ý4}÷ß4{ßUßFßVß2wß8ßF}´z´Ý3}{ß1ßlß3|¦´x´´y´‡º13¤pcº11º12¢1fOº12¢1ks¤pc—÷ß4{ßUßFßVßWß8ßFß2v»ß5ß2w}´z´Ý4}{ß1ßmß3|¦´x´´y´‡º15¤pcº14º12—{´x´º14´y´º12´z´£0.-4q}{´x´º15´y´¤pc´z´Ý5}÷ß4{ßUßFßVß2wß8ßF}´z´Ý4}{ß1ßnß3|¦´x´´y´‡º15¤pcº14º12¢1xI¢1DK¢1us¤ri—÷ß4{ßUßFßVßWß8ßFß2v»ß5ß2w}´z´Ý5}{ß1ßoß3|¦´x´´y´‡º18¤riº16º17—{´x´º16´y´º17´z´£0.-6S}{´x´º18´y´¤ri´z´Ý6}÷ß4{ßUßFßVß2wß8ßF}´z´Ý5}{ß1ßtß3|¦´x´´y´‡º18¤riº16º17¢27S¢1De¢23u¤uw—÷ß4{ßUßFßVßWß8ßFß2v»ß5ß2w}´z´Ý6}{ß1ßvß3|¦´x´´y´‡º1B¤uwº19º1A—{´x´º19´y´º1A´z´Ý0}{´x´º1B´y´¤uw´z´Ý0}÷ß4{ßUßFßVß2wß8ßF}´z´Ý6}{ß1ßuß3|{´x´º1B´y´¤uw´z´Ý0}{´x´º19´y´º1A}{´x´¢2LA´y´¢12v´z´Ý0}{´x´¢294´y´¤uw}÷ß4{ßUßFßVßWß8ßFß2v»ß5ß2w}´z´Ý0}{ß1ß15ß3|¦´x´´y´‡º1B¤uw¢29O¤v6º19¤nC¢2B0¤gk—{´x´¢26K´y´¤ga´z´Ý0}{´x´¢22I´y´¤nC}÷ß4{ßUßFßVßWß8ßFß2v»}´z´Ý0}{ß1ßbß3|¦´x´´y´‡¢1Uu¢15Q¢1VE¢19S¢1SU¢172—÷ß4{ßUßFßV¨rock¨ß8ßF}´z´Ý3}{ß1ßXß3|¦´x´´y´‡¢1aE¤xq¢1ZJ¢105¢1XD¤yT—÷ß4{ßUßFßVß2xß8ßF}´z´Ý3}{ß1ßYß3|¦´x´´y´‡¢1d8¢15a¢1b5¢19l¢1Yp¢15F—÷ß4{ßUßFßVß2xß8ßF}´z´Ý4}{ß1ßZß3|¦´x´´y´‡¢1fb¤zl¢1cK¢10G¢1df¤xV—÷ß4{ßUßFßVß2xß8ßF}´z´Ý4}{ß1ßeß3|¦´x´´y´‡¢1nI¢16s¢1im¢19cº15º1K—÷ß4{ßUßFßVß2xß8ßF}´z´Ý5}{ß1ßfß3|¦´x´´y´‡¢1sc¢10kº1d¢10Q¢1qh¤vx—÷ß4{ßUßFßVß2xß8ßF}´z´Ý5}{ß1ßgß3|¦´x´´y´‡¢1uEº1K¢1tQ¢16iº1h¢15G—÷ß4{ßUßFßVß2xß8ßF}´z´Ý5}{ß1ßhß3|¦´x´´y´‡¢244¢19w¢1yu¢1A6º1Iº1K—÷ß4{ßUßFßVß2xß8ßF}´z´Ý6}{ß1ßiß3|{´x´¢1xw´y´¤xq}{´x´¢21o´y´¤yU´z´Ý6}{´x´º1r´y´º1j}÷ß4{ßUßFßVß2xß8ßFßO»}´z´Ý6}{ß1ßdß3|¦´x´´y´‡¢2Hwº1D¢29s¢16Yº1w¤zI—÷ß4{ßUßFßVß2xß8ßF}´z´Ý0}{ß1ß14ß3|{´x´¢2CN´y´¢169}÷ß4{ßUßFß2r¨enemy_streets_rocky_small¨ß2t»ß2uÊß8ßF¨spawn_permanent¨»}´z´Ý0}{ß1ßcß3|¦´x´´y´‡¢2Ei¤vGº20¢1CC¢1ouº21º22¤vG—÷ß4{ßUßFßV¨sensor¨ß8ßF}´z´Ý0}{ß1ßaß3|¦´x´´y´‡¢1Ty¤v5¢1UGº17ºvº21ºz¤vG—÷ß4{ßUßFßVß30ß8ßF}}{ß1ßpß3|¦´x´´y´‡º1B¤uw¢1vM¤w4—÷ß4{ßO»ßUßFßVß1Pß8ßF}´z´Ý6}{ß1ßqß3|{´x´¢1ce´y´¤rY}{´x´ºv´y´¤wO´z´Ý3}{´x´ºv´y´ºf}÷ß4{ßO»ßUßFßVß1Pß8ßF}´z´Ý3}{ß1ßrß3|¦´x´´y´‡¢1ja¤vkº26¤rY—÷ß4{ßO»ßUßFßVß1Pß8ßF}´z´Ý4}{ß1ßwß3|¦´x´´y´‡¢1VYº17ºvº10—{´x´ºv´y´¢14w´z´Ý3}÷ß4{ßO»ßUßFßVß1Pß8ßF}´z´Ý3}{ß1ßxß3|¦´x´´y´‡¢1g2¢1Cgº28º17—÷ß4{ßO»ßUßFßVß1Pß8ßF}´z´Ý4}{ß1ßyß3|{´x´¢1wy´y´ºx´z´Ý5}{´x´¢1oQ´y´¢1Au}{´x´º2A´y´º2B}÷ß4{ßO»ßUßFßVß1Pß8ßF}´z´Ý5}{ß1ßzß3|¦´x´´y´‡º25¤w4¢1pi¤tUº27¤vk—÷ß4{ßO»ßUßFßVß1Pß8ßF}´z´Ý5}{ß1ß10ß3|¦´x´´y´‡ºvº29ºvº10—÷ß4{ßO»ßUßFßVß1Pß8ßF}´z´Ý0}{ß1ß11ß3|{´x´ºv´y´¤wO´z´Ý0}{´x´ºv´y´ºf}÷ß4{ßO»ßUßFßVß1Pß8ßF}´z´Ý0}{ß1ß12ß3|{´x´¢26o´y´¢1AG´z´Ý6}{´x´¢21e´y´º2E}{´x´º2C´y´ºx}÷ß4{ßO»ßUßFßVß1Pß8ßF}´z´Ý6}{ß1ß13ß3|¦´x´´y´‡¢2D6¢156º2Jº1xº1w¢19mº2Gº2H—÷ß4{ßO»ßUßFßVß1Pß8ßF}´z´Ý0}{ß1ß17ß3|¦´x´´y´‡º19¤umº1E¤uwº1w¤w4—{´x´º2J´y´¤zI´z´Ý0}{´x´º2J´y´º1i}÷ß4{ßO»ßUßFßVß1Pß8ßF}´z´Ý0}{ß1ß16ß3|{´x´º1t´y´¤xq}{´x´º1r´y´º1j´z´Ý6}÷ß4{ßUßFßV¨wall_streets_fake¨ßO»ß2z»ß8ßF}´z´Ý6}{ß1ß1Aß3|¦´x´´y´‡¤am¤w4¤ZU¤w4¤RG¤w4¤Gw¤yy¤Gw¢17MºWº2MºW¢18e¤X4º2N¤X4º2M¤amº2M¤am¢130—÷ß4{ßUßEßVßWß2v»ß8ßE}}{ß1ß1Eß3|¦´x´´y´‡¢14S¤tAº1O¤uw¢17g¤y0º2Kº1j¢11s¤zmº1b¤xC¢11O¤uI—÷ß4{ßUßEßVß2xß8ßE}´z´Ý0}{ß1ß1Fß3|¦´x´´y´‡¢1Emº1K¢1GO¢164¢1Giº2Qº12¢19I¢1Dy¢198¢1Cqº2Qº17º2V—÷ß4{ßUßEßVß2xß8ßE}´z´Ý0}{ß1ß1Gß3|¦´x´´y´‡¢1K6¤xM¢1LE¤xq¢1LY¤yy¢1Kkº1j¢1J8¢106¢1IK¤yo¢1Iy¤xg—÷ß4{ßUßEßVß2xß8ßE}´z´Ý0}{ß1ß1Iß3|¦´x´´y´‡º5¤vGº5º21¢1PQº21º2j¤vG—÷ß4{ßUßEßVß30ß8ßE}}{ß1ß1Bß3|¦´x´´y´‡ºS¤wY¤KK¤yy¤KKº1bºSº1b¤Ue¤zm¤WGº1b¤ZU¤wY—÷ß4{ßUßEßVß30¨sensor_fov_mult¨Êß8ßE}}{ß1ß1Cß3|¦´x´´y´‡¤RG¤w4¤Op¤wi—÷ß4{ßO»ßUßEßVß1Pß8ßE}}{ß1ß1Dß3|¦´x´´y´‡¤Mk¤xM¤Gw¤yy¤Gwº2M¤ZUº2M¤ZU¢15k—÷ß4{ßO»ßUßEßVß1Pß8ßE}}{ß1ß1Oß3|{´x´¢2CI´y´¤zS}÷ß4{ßUßLß2r¨enemy_streets_camera_small¨ß2t»ß2uÊß8ßL}´z´Ý0}{ß1ß1Lß3|{´x´¢24O´y´¤to}÷ß4{ßUßLß2rß33ß2t»ß2uÊß8ßL}´z´Ý0}{ß1ß1Nß3|{´x´¢27I´y´¤mE}÷ß4{ßUßLß2rß33ß2t»ß2uÊß8ßL}´z´Ý0}{ß1ß1Mß3|{´x´¢23Q´y´¤te}{´x´º2o´y´¤sq´z´Ý0}{´x´º1w´y´¤sq´z´Ý0}{´x´º1w´y´¤te}÷ß4{ßUßLßVß30ß8ßLß32£0.Cu}´z´Ý0}{ß1ß1Kß3|¦´x´´y´‡¢25C¤iWº1I¤nCº1B¤uw—{´x´¢25q´y´¤um´z´Ý0}{´x´¢23k´y´¤uS}÷ß4{ßO»ßUßLßVß1Pß8ßL}´z´Ý0}{ß1ß1Jß3|¦´x´´y´‡¢2A2¤iWº19¤nC¢28u¤uSº19¤um—÷ß4{ßO»ßUßLßVß1Pß8ßL}´z´Ý0}{ß1ß1Qß3|¦´x´´y´‡¤8w¤4r¤9s¤7u—÷ß4{ßUßNßO»ßVß1Pß5ßPß8ßM}}{ß1ß1Wß3|¦´x´´y´‡ºiºfºeºfºeº29ºiº29—÷ß4{ßUßHßVß1RßW»ß8ßDß19»}´z´Ý2}{ß1ß1aß3|¦´x´´y´‡¤SEºfºgºf—{´x´ºg´y´ºf´z´Ý1}{´x´¤SE´y´ºf´z´Ý1}÷ß4{ßUßHßVß1Rß8ßD}}{ß1ß1bß3|¦´x´´y´‡ºgºf¤Ueºf—÷ß4{ßUßHßV¨sensor_path¨ß8ßD}}{ß1ß1Yß3|¦´x´´y´‡ºhºf¤X4ºf—{´x´¤X4´y´ºf´z´Ý1}{´x´ºh´y´ºf´z´Ý1}÷ß4{ßUßHßVß1Rß8ßD}}{ß1ß1Zß3|¦´x´´y´‡ºhºf¤Ueºf—÷ß4{ßUßHßVß34ß8ßD}}{ß1ß1cß3|¦´x´´y´‡ºiºfºeºfºeº29ºiº29—÷ß4{ßUßHßV¨floor_train¨ß8ßDß19»}}{ß1ß1Sß3|¦´x´´y´‡ºiºf¤SEºf¤Ru¢122¤SE¢13U¤SEº29ºiº29—÷ß4{ßUßHßVß35ß8ßDß19»}}{ß1ß1eß3|¦´x´´y´‡ºeº29¤SEº29¤SEº2vºe¢13A—÷ß4{ßUßHßVß35ß8ßDß19»}}{ß1ß1fß3|¦´x´´y´‡ºeº2w¤SEº2v¤Ruº2uºeºT—÷ß4{ßUßHßVß35ß8ßDß19»}}{ß1ß1dß3|¦´x´´y´‡ºeºT¤Ruº2u¤SEºfºeºf—÷ß4{ßUßHßVß35ß8ßDß19»}}{ß1ß1Xß3|¦´x´´y´‡¤Qm¢114¤Qm¢14m¤YWº2y¤YWº2x—÷ß4{ßUßHßVß30ß8ßDß19»}}{ß1ß1Tß3|{´x´ºi´y´ºf}{´x´ºi´y´ºf´z´Ý2}{´x´ºi´y´º29´z´Ý2}{´x´ºi´y´º29}÷ß4{ßUßHßVß1Rß8ßD}}{ß1ß1Uß3|{´x´ºe´y´ºf}{´x´ºe´y´ºf´z´Ý2}{´x´ºe´y´º29´z´Ý2}{´x´ºe´y´º29}÷ß4{ßUßHßVß1Rß8ßD}}{ß1ß1Vß3|¦´x´´y´‡ºeº29ºiº29—{´x´ºi´y´º29´z´Ý2}{´x´ºe´y´º29´z´Ý2}÷ß4{ßUßHßVß1Rß8ßD}}{ß1ß1zß3|¦´x´´y´‡¤Lm¤4q¤Ky¤84—÷ß4{ßUßRßV¨wall_tutorial_fake¨ßO»ß2z»ß8ßR}}{ß1ß2Vß3|¦´x´´y´‡¢-M6¤-U¢-NY¤K—÷ß4{ßUßTßVß36ßO»ß2z»ß8ßT}}{ß1ß2qß3|¦´x´´y´‡¤AA¤g6¤By¤i0—÷ß4{ßUßGßVß36ßO»ß2z»ß8ßG}}{ß1ß1Hß3|{´x´ºv´y´¤wO´z´Ý0}{´x´ºv´y´º10}{´x´¤ye´y´¢1Ec}{´x´¤yU´y´¤qQ}÷ß4{ßUßEßVßWß8ßE}´z´Ý0}{ß1ß2fß3|¦´x´´y´‡¤CQ¤ga¤DE¤gQ¤EM¤gu¤EW¤hs¤E2¤iM¤DO¤iW¤Ck¤iC—÷ß4{ßUßGßVß2xßO»ß8ßG}}{ß1ß2hß3|¦´x´´y´‡¤SO¤oe¤TC¤pSºS¤qa¤S4¤qu¤Qw¤qaºe¤pS¤RG¤oU—÷ß4{ßUßGßVß2xß8ßG}}{ß1ß2iß3|¦´x´´y´‡¤SiºZºS¤sM¤SY¤tA¤Ra¤tK¤Qw¤sg¤Qw¤ri¤Rk¤rE—÷ß4{ßUßGßVß2xß8ßG}}{ß1ß2jß3|¦´x´´y´‡¤Ss¤tU¤Tq¤uS¤Tg¤vk¤Si¤wY¤Rk¤wE¤R6¤v6¤Ra¤ty—÷ß4{ßUßGßVß2xß8ßG}}{ß1ß2kß3|¦´x´´y´‡¤OC¤vQ¤Og¤wE¤OM¤x2¤NO¤xM¤Ma¤ws¤MQºw¤NE¤vG—÷ß4{ßUßGßVß2xß8ßG}}{ß1ß1jß3|{´x´¢-2Q´y´º3}÷ß4{ßUßCß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷ß8ßC}}{ß1ß1lß3|¦´x´´y´‡¤6w¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßUßCß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßVß30ß32£0.EWß8ßC}}{ß1ß1pß3|¦´x´´y´‡¤D4¤-A¤C6¢-42¤5eº32º2ºk¢-6Iº2¢-6m¤42¢-9q¤50¢-Bm¤84¢-Bc¤BI¢-7Q¤D4¢-3Y¤B8¢-26¤84¤4C¤6w¤6c¤1S—÷ß4{ßUßCßVßWß2v»ß8ßC}}{ß1ß1hß3|{´x´ºk´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß3H÷ßUßCß8ßC}}{ß1ß1kß3|¦´x´´y´‡¤5eº32º2ºkº36º2º37¤42º3D¤84¤4C¤6w¤6c¤1S—÷ß4{ßUßCßVß30ß32Êß8ßC}}{ß1ß1nß3|{´x´¢-BI´y´¤4q}÷ß4{ß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßUßCß8ßC}}{ß1ß1vß3|¦´x´´y´‡¤5e¢-CG¤4g¢-8O¤8Yº3B¤9Wº3F¤F9¢-HE¤9W¢-BS—÷ß4{ßUßRßVß30ß32Ý8ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷ß8ßR}}{ß1ß25ß3|¦´x´´y´‡¤Gw¢-Ky¤EC¢-Lc¤BS¢-KU¤4M¢-Ca¤3O¢-8i¤C6º35¤D4¤-A¤Bm¤8s¤E2¤G8¤H6¤GI¤Ke¤9M¤WG¤84¤Wu¤2G¤Uy¢-Ay—÷ß4{ßUßRßVßWß2v»ß8ßR}}{ß1ß26ß3|¦´x´´y´‡¤Wu¢-4C¤Waº3B—{´x´¤Vw´y´¢-5o´z´£0.3E}÷ß4{ßUßRßVßWß8ßR}´z´Ý9}{ß1ß1rß3|{´x´¤G8´y´º3C}÷ß4{ßUßRß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷ß8ßR}}{ß1ß1uß3|{´x´¤KA´y´¢-5A}÷ß4{ßUßRß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷ß8ßR}}{ß1ß20ß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßUßRßVß30ß8ßR}}{ß1ß1sß3|{´x´¤Ss´y´¤-y}÷ß4{ßUßRß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ß8ßR}}{ß1ß1tß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßUßRßVß34ß6|¨tutorial room 2 switch¨÷ß8ßR}}{ß1ß1wß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGº32—÷ß4{ßUßRßV¨icon¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷ß8ßR}´z´£0.1c}{ß1ß1yß3|{´x´¤AU´y´¢-K0}÷ß4{ßUßRß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷ß8ßR}}{ß1ß21ß3|¦´x´´y´‡¤CQ¤y¤Ds¤FU¤HQ¤FU¤FU¤y—÷ß4{ßUßRßVß30ß32Ý8ß8ßR}}{ß1ß28ß3|¦´x´´y´‡¢-Lm¢-IY¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßUßSßVß30ß32£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷ß8ßS}}{ß1ß2Gß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FKº3P¢-Ds¢-8s¢-Fe¢-8Yº3h¢-A0º3X¢-DY¢-Ke—÷ß4{ßUßSßVß30ß8ßS}}{ß1ß2Jß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßUßSß2r¨enemy_tutorial_easy¨ß2t»ß2uÊß8ßS}}{ß1ß29ß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßUßSß2rß42ß2t»ß2uÊß8ßS}}{ß1ß2Iß3|¦´x´´y´‡¤3Oº3O¤4Mº3N¤e¢-GI¢-4Mº3M¢-84¢-Oq¢-EC¢-PAº3Y¢-I4¢-OM¢-FU¢-MQº3pº3F¢-9Cº3D¢-76—÷ß4{ßUßSßVßWß2v»ß8ßS}}{ß1ß2Dß3|¦´x´´y´‡º36º3x¤2F¢-5T¤4qº3j¢-3F¢-Hl—÷ß4{ßUßSßVß30ß32ÝBß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷ß8ßS}}{ß1ß2Oß3|{´x´¢-L4´y´¤49}÷ß4{ßUßTß2r¨enemy_tutorial_rock_room4¨ß2t»ß2uÊß8ßT}}{ß1ß2Wß3|¦´x´´y´‡º44º3pº42º43¢-W6¢-Ck¢-Ygº3Sºo¤Uº30¤Kº30¤7G¢-Is¤7Gº4E¤34º2z¤-U¢-J2¢-3Oº3hº3O—÷ß4{ßUßTßVßWß2v»ß8ßT}}{ß1ß2Lß3|{´x´¢-QI´y´¢-7G}÷ß4{ßUßTß2r¨collect_gun_basic¨ß2t»ß2uÊß2z»ß8ßT}}{ß1ß2Mß3|{´x´º4H´y´º4I}÷ß4{ßUßTß2r¨deco_gun_basic¨ß2t»ß2uÊß8ßT}}{ß1ß2Sß3|¦´x´´y´‡¢-Kz¢-6w¢-Kj¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßUßTßVß3sß8ßT}}{ß1ß2Nß3|{´x´¢-Ue´y´¢-C6}÷ß4{ßUßTß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷ß8ßT}}{ß1ß2Qß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßUßTß2r¨enemy_tutorial_rocky¨ß2t»ß2uÊß2z»ß8ßT}}{ß1ß2Rß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßUßTß2rß4Bß2t»ß2uÊß2z»ß8ßT}}{ß1ß2Kß3|¦´x´´y´‡¢-OK¢-FkºA¢-Cu¢-Yqº3S¢-Tq¤e¢-Ma¤Uº4E¢-3E¢-IEº3l—÷ß4{ßUßTßVß30ß32£1.4qß8ßT}}{ß1ß2Pß3|{´x´¢-Ic´y´¤16}÷ß4{ßUßTß2r¨switch¨ß2t»ß2uÊß8ßT}}{ß1ß2aß3|{´x´¤Fy´y´¤TW}÷ß4{ßUßGß2r¨enemy_tutorial_boss¨ß2t»ß2uÊß8ßGß2z»}}{ß1ß2cß3|¦´x´´y´‡¤Pe¤fS¤Lw¤fc—÷ß4{ßO»ß5¨tutorial_door¨ßUßGß6|¨tutorial room 5 door end path¨÷ß8ßG}}{ß1ß2Yß3|¦´x´´y´‡¤KU¤GS¤HQ¤GI—÷ß4{ßO»ß5ß4EßUßGß6|¨tutorial room 5 door start path¨÷ß8ßG}}{ß1ß2gß3|{´x´¤Tx´y´¤gx}÷ß4{ßUßGß2r¨enemy_tutorial_easy_static¨ß2t»ß2uÊß8ßG}}{ß1ß2bß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºS¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fw¤Ue¤fw¤Vc¤jA¤Wu¤jA¤XO¤km¤W6¤km¤X4¤o0¤YM¤o0¤am¤w4¤ZU¤wE¤RG¤w4¤Gw¤yy¤F0¤nC¤92¤h4¤9M¤gG¤AA¤g6¤1w¤X4¤4q¤M6—÷ß4{ßUßGßVßWß2v»ß8ßG}}{ß1ß2pß3|{´x´¤WV´y´¤jy}÷ß4{ßUßGß2r¨enemy_tutorial_rocky_small¨ß2t»ß2uÊß8ßGß2z»}}{ß1ß2Xß3|¦´x´´y´‡¤1w¤Ko¤1w¤cEºS¤bQ¤TM¤LI—÷ß4{ßUßGßVß30ß8ßG}}{ß1ß2nß3|¦´x´´y´‡¤8s¤eK¤9g¤fI¤MG¤eo¤N4¤dq—÷ß4{ßUßGßVß30ß32ÝCß8ßG}}{ß1ß2Zß3|¦´x´´y´‡¤DE¤Gm¤CG¤HQ¤JC¤Hk¤IE¤H6—÷ß4{ßUßGßVß30ß32ÝCß8ßG}}{ß1ß2mß3|¦´x´´y´‡¤DE¤g6¤Eg¤gu¤Kr¤ga¤V1¤fk¤ZU¤um¤Gc¤um¤H6¤ye¤Qwºw¤aI¤vW¤VI¤fI—÷ß4{ßUßGßVß30ß32Êß8ßG}}{ß1ß2lß3|¦´x´´y´‡¤NE¤vG¤MkºZ—÷ß4{ßUßGßVß34ß8ßG}}{ß1ß2Aß3|¦´x´´y´‡º4Yº45º7¢-9gº39¢-B8—÷ß4{ßUßSßV¨spike¨ß8ßS}}{ß1ß2Bß3|¦´x´´y´‡º4E¢-EW¢-JWº43¢-HG¢-G8—÷ß4{ßUßSßVß4Jß8ßS}}{ß1ß2Cß3|¦´x´´y´‡¢-Af¢-PH¢-Bw¢-PKº3F¢-NO—÷ß4{ßUßSßVß4Jß8ßS}}{ß1ß2Tß3|¦´x´´y´‡¢-Iu¤5Sº4E¤34º2z¤-Uº4Fº4Gº3hº3Oº44º3p—÷ß4{ßUßTßVß1PßO»ß8ßT}}{ß1ß1iß3|¦´x´´y´‡¢-38¤7Aº3D¤84¤4C¤6w¤6c¤1S¤D4¤-A—÷ß4{ßO»ßUßCßVß1Pß8ßC}}{ß1ß1mß3|¦´x´´y´‡¢-6e¤2Yº37¤42—÷ß4{ßUßCßVß1PßO»ß8ßC}}{ß1ß1qß3|¦´x´´y´‡¤Po¤gQºS¤Vw¤RG¤MG¤H6¤GI¤Ha¤CG¤Ke¤9M¤Ky¤84¤WG¤84¤WG¤4q¤Lm¤4q¤M8¤3G¤WN¤48¤Wj¤2G¤Ut¢-Ax¤NN¢-Bh¤Ls¢-H8¤Gp¢-Ip¤Dr¢-Gp—÷ß4{ßO»ßUßRßVß1Pß8ßR}}{ß1ß22ß3|¦´x´´y´‡¤3Oº3O¤9qº46¤C6º35—÷ß4{ßUßRßVß1PßO»ß8ßR}}{ß1ß2Uß3|¦´x´´y´‡º30¤6Iº30¤Kºo¤Uº4Dº3Sº4Bº4Cº42º43—÷ß4{ßUßTßVß1PßO»ß8ßT}}{ß1ß1xß3|¦´x´´y´‡¤Cvº3f¤Bt¢-FS¤BS¢-Ao¤4Mº3N—÷ß4{ßO»ßUßRßVß1Pß8ßR}}{ß1ß1oß3|¦´x´´y´‡¤C6º35¤5eº32º2ºkº36º2¢-6T¤U—÷ß4{ßUßCßVß1PßO»ß8ßC}}{ß1ß23ß3|¦´x´´y´‡¤D4¤-A¤Bm¤8s¤EW¤C1¤E2¤G8¤4q¤M6¤26¤X4¤AA¤g6¤EC¤fw—÷ß4{ßO»ßUßRßVß1Pß8ßR}}{ß1ß2Fß3|¦´x´´y´‡º44º3p¢-Jqº4rº4q¢-CQº3Fº45¢-5eº4nº3Dº46¤3Oº3O—÷ß4{ßUßSßVß1PßO»ß8ßS}}{ß1ß2Eß3|¦´x´´y´‡º42º43º3Yº41º4Fº4pº3zº40º3xº3yº3wº3Mº3Tº3i¤eº3v¤4Mº3N—÷ß4{ßUßSßVß1PßO»ß8ßS}}{ß1ß2oß3|¦´x´´y´‡¤Hu¤fm¤Lw¤fcºS¤Vw—÷ß4{ßO»ßUßGßVß1Pß8ßG}}{ß1ß2dß3|¦´x´´y´‡¤By¤i0¤G8¤mO¤RQ¤lG¤SE¤o0¤Gw¤p8—÷ß4{ßO»ßUßGßVß1Pß8ßG}}{ß1ß2eß3|¦´x´´y´‡¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤ZUº2g—÷ß4{ßO»ßUßGßVß1Pß8ßG}}{ß1ß27ß3|¦´x´´y´‡¢-FAº5Bº3Pº3dº3Oº3mº3Hº3hº3o¢-KAº3p¢-Koº3bº3hº5Bº5B—÷ß4{ßUßSßV¨wall_tutorial_window¨ßO»ß8ßS}}{ß1ß2Hß3|¦´x´´y´‡º5Bº5Bº3Pº3dº3Oº3mº3Hº3hº3oº5Cº3pº5Dº3bº3hº5Bº5B—÷ß4{ßUßSßVß4Kß8ßS}}{ß1ß44ß3|¦´x´´y´‡º3Eº4fº3Dº4n—÷ß4{ßUß2DßVß36ßO»ß2z»ß8ßS}}{ß1ß3kß3|¦´x´´y´‡¤Hkº37¤Gc¢-7a—÷ß4{ßUß1ußVß36ßO»ß2z»ß8ßR}}{ß1ß3Dß3|¦´x´´y´‡¤-Lº4GÒº34¤xº3C¤1H¢-2u¤w¢-2P¤I¢-2F¤-M¢-2Z—÷ß4{ßUß1hßVß2xß8ßC}}{ß1ß3Eß3|¦´x´´y´‡¤2F¤5A¤2Z¤4W¤3N¤4C¤41¤4q¤41¤5o¤3D¤68¤2P¤5y—÷ß4{ßUß1hßVß2xß8ßC}}{ß1ß3Fß3|¦´x´´y´‡¢-5p¢-18¢-5fº2¢-4r¢-1w¢-4N¢-1Sº5O¤-o¢-51¤-U¢-5V¤-e—÷ß4{ßUß1hßVß2xß8ßC}}{ß1ß3Gß3|¦´x´´y´‡¢-3j¤5K¢-35¤50¢-2H¤50¢-1n¤5e¢-1x¤6c¢-2R¤5y¢-4B¤6G—÷ß4{ßUß1hßVß2xß8ßC}}{ß1ß3Hß3|¦´x´´y´‡º57¤Uº4z¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßUß1hßV¨wall_tutorial_rock_breakable¨ß8ßC}}{ß1ß3Wß3|¦´x´´y´‡¤Mn¢-3H¤Oxº4G¤Pu¢-4E¤PPºj¤OEº4Q¤Mz¢-6F¤MK¢-4z—÷ß4{ßUß1ußVß2xß8ßR}}{ß1ß3Xß3|¦´x´´y´‡¤Cl¢-48¤Doº3C¤Ee¢-47¤Ee¢-5F¤E8¢-6A¤Cjº5i¤C8¢-52—÷ß4{ßUß1ußVß2xß8ßR}}{ß1ß3Yß3|¦´x´´y´‡¤F9¢-41¤Gm¢-3s¤Ho¢-4Q¤Hq¢-5c¤Gh¢-6V¤Fbº5i¤Ew¢-59—÷ß4{ßUß1ußVß2xß8ßR}}{ß1ß3Zß3|¦´x´´y´‡¤Iw¢-3q¤Kv¢-3W¤Lp¢-4l¤Lk¢-67¤K1¢-6j¤IT¢-6D¤IA¢-4w—÷ß4{ßUß1ußVß2xß8ßR}}{ß1ß3aß3|¦´x´´y´‡¤Hkº37¤JCº3B¤JVº45¤IR¢-A3¤H9¢-AJ¤GJ¢-96¤Gcº5E—÷ß4{ßUß1ußVß2xßO»ß8ßR}}{ß1ß3bß3|¦´x´´y´‡¤DD¢-FZ¤Dr¢-Fb¤EB¢-Fs¤EI¢-GO¤Drº54¤D8¢-Gn¤Cvº3f—÷ß4{ßUß1ußVß2xß8ßR}}{ß1ß3cß3|¦´x´´y´‡¤KZ¢-G2¤L2¢-Fn¤Lb¢-G0¤Lf¢-GR¤LJ¢-H1¤Km¢-H2¤KQ¢-GX—÷ß4{ßUß1ußVß2xß8ßR}}{ß1ß43ß3|¦´x´´y´‡º3Dº4nº5Pº4m¤Kº38¤1mº4n¤1Sº4C¤Aº3pº3Eº4f—÷ß4{ßUß2DßVß2xßO»ß8ßS}}{ß1ß48ß3|¦´x´´y´‡¢-VIº4Y¢-V8º3N¢-UKº4fº4hº59º4hº39¢-UUº3J¢-Uyº3A—÷ß4{ßUß2NßVß2xß8ßT}}{ß1ß49ß3|¦´x´´y´‡¢-OWº5N¢-O2¢-2V¢-NJ¢-2fº4i¢-2G¢-Mkº3Eº30¤-yº42º5K—÷ß4{ßUß2NßVß2xß8ßT}}{ß1ß4Aß3|¦´x´´y´‡¢-TMº3E¢-T2º5N¢-SEº6M¢-RQ¢-1m¢-RG¤-y¢-Ru¤-Kº6P¤-U—÷ß4{ßUß2NßVß2xß8ßT}}{ß1ß3dß3|¦´x´´y´‡¤Fd¤1h¤GZ¤1y¤HJ¤1R¤HJ¤R¤GT¤-G¤FH¤-F¤Ew¤m—÷ß4{ßUß1ußVß2xß8ßR}}{ß1ß3eß3|¦´x´´y´‡¤Hz¤1m¤J3¤1o¤JH¤19¤JA¤N¤IfÁ¤HlÒ¤Hb¤14—÷ß4{ßUß1ußVß2xß8ßR}}{ß1ß3fß3|¦´x´´y´‡¤Jl¤1o¤Km¤2V¤Lr¤22¤MF¤h¤LQÒ¤K4¤B¤JX¤c—÷ß4{ßUß1ußVß2xß8ßR}}{ß1ß3hß3|¦´x´´y´‡¤MQ¤2G¤NY¤2z¤PA¤2y¤Py¤2M¤Pw¤1A¤Oa¤R¤My¤V—÷ß4{ßUß1ußVß2xß8ßR}}{ß1ß3iß3|¦´x´´y´‡¤QR¤2D¤R7ºE¤Rw¤2f¤SI¤1u¤S2¤16¤R7¤l¤QW¤18—÷ß4{ßUß1ußVß2xß8ßR}}{ß1ß3jß3|¦´x´´y´‡¤Sn¤1x¤Uf¤2Jºh¤17¤Vo¤-L¤UV¤-k¤TG¤-G¤Sf¤h—÷ß4{ßUß1ußVß2xß8ßR}}{ß1ß37ß3|¦´x´´y´‡¤4X¤-T¤50¤-K¤4jÎ¤50¤-K¤3OÒ—÷ß4{ßUß1jßVß3sßO»ß8ßC}´z´ÝA}{ß1ß38ß3|¦´x´´y´‡º35¤-yº35¢-2aº5Pº3T¤-Uº3Q¤-Uº5N¤1N¢-2L¤1Sº3C¤5Kº6M—÷ß4{ßUß1jß2r¨enemy_tutorial_bit¨ß2t»ß2uÎß8ßC}}{ß1ß39ß3|¦´x´´y´‡¢-4W¤5eº36¤3sºj¤-y¢-5K¤-Aº5l¤-yº3w¤3Eº4j¤4g—÷ß4{ßUß1jß2rß4Mß2t»ß2uÎß8ßC}}{ß1ß3Aß3|¦´x´´y´‡¤9Mº3E¤9s¤m—÷ß4{ßO»ß5ß4EßUß1lß8ßC}}{ß1ß3Bß3|¦´x´´y´‡¤9Mº3E¤8q¢-3M—÷ß4{ß5ß4EßUß1lßO»ß8ßC}}{ß1ß3Cß3|¦´x´´y´‡¤8E¢-34¤9C¤o¤AU¤U¤9Wº4G—÷ß4{ßUß1lßV¨deco¨ß5¨tutorial_door_floor¨ß8ßC}}{ß1ß3Jß3|{´x´º3S´y´¤AA}÷ß4{ßUß1nß2rß4Bß2t»ß2uÊß8ßC}}{ß1ß3Kß3|{´x´¢-9M´y´¤6w}÷ß4{ßUß1nß2rß4Bß2t»ß2uÊß2z»ß8ßC}}{ß1ß3Lß3|{´x´º4m´y´¤AA}÷ß4{ßUß1nß2rß4Bß2t»ß2uÊß2z»ß8ßC}}{ß1ß3Pß3|¦´x´´y´‡¤A6¢-9m¤9g¢-9Q¤A5¢-93¤9gº6d¤BM¢-9O—÷ß4{ßUß1vßVß3sßO»ß8ßR}´z´ÝA}{ß1ß3Qß3|¦´x´´y´‡¤ER¢-5Z¤E8¢-56¤Dnº6g¤E8º6h¤E8º4z—÷ß4{ßUß1vßV¨icon_tutorial¨ßO»ß8ßR}´z´ÝA}{ß1ß3Rß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßUß1vßVß4PßO»ß8ßR}´z´ÝA}{ß1ß3gß3|{´x´¤Dz´y´¤Y}÷ß4{ßUß1uß2r¨enemy_tutorial_block¨ß2t»ß2uÊß2z»ß8ßR}}{ß1ß3lß3|¦´x´´y´‡¤Maº4j¤Lwº4j¤LIº4G¤M4¢-4c¤M5º6h¤M1º5i¤KKº37¤NOº37¤Mgº36¤M8º6h¤M7º6i—÷ß4{ßUß1sß2rß4Mß2t»ß2uÎß8ßR}}{ß1ß3mß3|¦´x´´y´‡ºS¤-U¤SO¤y¤RG¤U¤Py¤o¤SYº3E¤V8º33¤Vcº3E—÷ß4{ßUß1sß2rß4Mß2uÎß2t»ß8ßR}}{ß1ß3nß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßUß1sß2rß4Mß2t»ß2uÎß8ßR}}{ß1ß3pß3|¦´x´´y´‡¤Ha¤Bm¤EW¤Bc¤C6¤8s¤D4¤1S¤GS¤2Q¤HQ¤1w¤JW¤26¤Ko¤2u¤Lw¤2Q¤K0¤9W—÷ß4{ßUß1sß2rß4Mß2u¤Cß2t»ß8ßR}}{ß1ß3Nß3|¦´x´´y´‡¤76º38¤6a¢-7m—÷ß4{ßO»ß5ß4EßUß1vß8ßR}}{ß1ß3Oß3|¦´x´´y´‡¤76º38ºa¢-Bu—÷ß4{ßO»ß5ß4EßUß1vß8ßR}}{ß1ß3Mß3|¦´x´´y´‡¤6wº4u¤5yº3x¤7G¢-7k¤8Eº3A—÷ß4{ßUß1vßVß4Nß5ß4Oß8ßR}}{ß1ß3oß3|{´x´¤Hb´y´¢-C3}÷ß4{ßUß1sß2r¨enemy_tutorial_4way¨ß2t»ß2uÊß8ßR}}{ß1ß3qß3|{´x´¤R6´y´¤5o}÷ß4{ßUß1sß2r¨enemy_tutorial_down¨ß2t»ß2uÊß8ßR}}{ß1ß3rß3|{´x´¤FM´y´¢-7V}÷ß4{ßUß1tß2rß4Cß2t»ß2uÊß8ßR}}{ß1ß3tß3|¦´x´´y´‡¤E6¢-1h¤EB¢-21—÷ß4{ßUß1wßVß3sßO»ß8ßR}´z´ÝA}{ß1ß3uß3|¦´x´´y´‡¤E4¢-1X¤E4º6w—÷ß4{ßUß1wßVß3sßO»ß8ßR}´z´ÝA}{ß1ß3vß3|{´x´¤Eg´y´º58}÷ß4{ßUß1yß2rß4Bß2t»ß2uÊß2z»ß8ßR}}{ß1ß3zß3|{´x´¤Bw´y´º3h}÷ß4{ßUß1yß2rß4Bß2t»ß2uÊß2z»ß8ßR}}{ß1ß3wß3|¦´x´´y´‡¤Ba¢-FT¤H1¢-JI¤Gl¢-L3¤E4¢-Lp¤BS¢-Ki¤9f¢-Il¤9j¢-GL—÷ß4{ßUß1yßVß30ß32£0.BIß8ßR}}{ß1ß3xß3|¦´x´´y´‡¤D8º64¤EC¢-FN—÷ß4{ßUß1yßVß34ß8ßR}}{ß1ß40ß3|¦´x´´y´‡º3K¢-Eg¢-NE¢-Gw—÷ß4{ßO»ß5ß4EßUß28ß8ßS}}{ß1ß41ß3|¦´x´´y´‡¢-LIº4oº5Dº3i¢-Mu¢-H6º4wºq—÷ß4{ßUß28ßVß4Nß5ß4Oß8ßS}}{ß1ß4Fß3|¦´x´´y´‡¤Lw¤fc¤EC¤fw—÷ß4{ßUß2cßVß34ß8ßG}}{ß1ß4Gß3|¦´x´´y´‡¤HQ¤GI¤E2¤G8—÷ß4{ßUß2YßVß34ß8ßG}}{ß1ß3Sß3|¦´x´´y´‡¤Gh¢-43¤G8º32¤FPº3Q—÷ß4{ßUß1rßVß4Jß8ßR}}{ß1ß3Tß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Keº2—÷ß4{ßUß1rßVß4Jß8ßR}}{ß1ß3Uß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Ojº5J¤P3¢-5i¤Tdº5t¤PE¢-4S¤OX¢-3f¤OCº3E¤N9º3C—÷ß4{ßUß1rßVß4Jß8ßR}}{ß1ß3Vß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßUß1rßVß4Jß8ßR}}{ß1ß3Iß3|¦´x´´y´‡º5Y¤6Gº37¤42º38¤50º7J¤83º3A¤BIº3B¤D4º3C¤B8º4y¤7A—÷ß4{ßO»ßUß1nßVß1Pß8ßC}}{ß1ß3yß3|¦´x´´y´‡¤Gpº53¤GZº4N¤E4¢-LR¤Bcº4Z¤A0º4l¤A3¢-GT¤Btº55—÷ß4{ßO»ßUß1yßVß1Pß8ßR}}÷¨icons¨|÷}");
