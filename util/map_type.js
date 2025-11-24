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
            // do parent stuff
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
        // calculate map_parent
        for (const shape of map.shapes ?? []) {
            if (shape.options.is_map && shape.options.parent) {
                const parent_shape = map.computed?.shape_map[shape.options.parent];
                if (parent_shape?.options?.is_map) {
                    shape.options.map_parent = parent_shape.options.map_parent ?? parent_shape.id;
                }
                else {
                    delete shape.options.map_parent;
                }
            }
            else {
                delete shape.options.map_parent;
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
export const TEST_MAP = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢3Ng´y´¢WQ}÷¨options¨{¨style¨ß2¨contains¨|¨home floor¨÷¨room_id¨´´¨is_room¨»}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ßA¨room_connections¨|¨tutorial room 1¨÷ß9»ß8´´}}{ß1¨station¨ß3|{´x´¢1RC´y´¢1NU}÷ß4{ßB|¨station tutorial¨¨station streets¨¨tutorial room 5¨¨streets side room 1¨÷ß6|¨train¨ßE¨station tracks¨ßF¨station tracks particle¨¨station map train¨¨station map tracks 1¨¨station map tracks 2¨¨station map tracks 3¨¨station map tracks 4¨÷ß8´´ß9»}}{ß1¨streets¨ß3|{´x´¢1f4´y´¢-D4}÷ß4{ß8´´ß6|¨streets room 1¨ßH¨streets room 2¨÷}}{ß1¨test group¨ß3|{´x´¢6x´y´¢7q}÷ß4{ß6|¨test 1¨÷¨open_loop¨«ß5¨test¨ßB|÷ß9»ß8´´}}{ß1¨tutorial¨ß3|{´x´¢-WG´y´ºA}÷ß4{ß6|ßC¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨ßG÷ß8´´}}{ß1ß7ß3|¦´x´´y´‡¢3sk¢Bs¢3Xu¢2m¢3FVºE¢30C¢6M¢2pO¢Gd¢2mE¢TN¢2py¢ip¢2zv¢sv—÷ß4{¨parent¨ß2¨make_id¨¨floor¨ß8ß2}}{ß1ßMß3|¦´x´´y´‡¢T2¢12WºQ¢13K¢mOºSºTºR—÷ß4{ßbßDß8ßD¨is_map¨»ßc¨map_shape¨}}{ß1ßNß3|¦´x´´y´‡ºTºRºTºS¢1L4ºSºUºR—÷ß4{ßbßDß8ßDße»ßcßf}}{ß1ßOß3|¦´x´´y´‡ºUºRºUºS¢1vMºSºVºR—÷ß4{ßbßDß8ßDße»ßcßf}}{ß1ßPß3|¦´x´´y´‡ºVºRºVºS¢29sºSºWºR—÷ß4{ßbßDß8ßDße»ßcßf}}{ß1ßLß3|¦´x´´y´‡¢Qc¢10uºX¢14w¢YgºZºaºY—÷ß4{ßbßDß8ßDße»ßcßf¨force_above¨»}}{ß1ßFß3|{´x´¢1dc´y´¢12g}÷ß4{ßbßDß6|¨station streets rock 1¨¨station streets rock 2¨¨station streets rock 3¨¨station streets sensor start¨¨station streets rock 0¨¨station streets sensor end¨¨station streets rock block¨¨station streets rock 4¨¨station streets rock 5¨¨station streets rock 6¨¨station streets rock 7¨¨station streets rock 8¨¨station streets floor 1¨¨station streets floor 1.5¨¨station streets floor 2¨¨station streets floor 2.5¨¨station streets floor 3¨¨station streets floor 3.5¨¨station streets wall 1¨¨station streets wall 2¨¨station streets wall 3¨¨station streets floor 0¨¨station streets floor 4¨¨station streets floor 5¨¨station streets floor 4.5¨¨station streets wall 5¨¨station streets wall 6¨¨station streets wall 7¨¨station streets wall 8¨¨station streets wall 9¨¨station streets wall 10¨¨station streets wall 11¨¨station streets wall 13¨¨station streets rocky 1¨¨station streets wall fake 1¨¨station streets wall 14¨¨station streets floor 4.1¨¨station streets wall 12¨¨station streets breakables 1¨¨station streets breakables 2¨¨station streets breakables 2.5¨¨station streets map shape 1¨¨station streets map shape 2¨¨station streets map shape 3¨¨station streets map shape 4¨¨station streets map shape 5¨¨station streets map shape 6¨¨station streets map shape 7¨÷ß8ßDß9»ßB|ßDßRßHßE÷}´z´£0.-3E}{ß1ßJß3|¦´x´´y´‡ºQºR¢3U8ºRºdºSºQºS—÷ß4{ßbßDßc¨floor_train_track¨ß8ßD¨sensor_dont_set_room¨»}}{ß1ßKß3|¦´x´´y´‡ºQºRºQºS—÷ß4{ßbßDßcß1Tß8ßDß1U»}}{ß1ßEß3|{´x´¢VS´y´¢yA}÷ß4{ßbßDß6|¨station tutorial floor¨¨station tutorial sensor start¨¨station tutorial wall 1¨¨station tutorial wall 2¨¨station tutorial rock 1¨¨station tutorial rock 2¨¨station tutorial rock 3¨¨tutorial floor low¨¨station tutorial sensor end¨¨station tutorial map shape 1¨¨station tutorial map shape 2¨¨station tutorial map shape 3¨÷ß8ßDß9»ßB|ßGßDßF÷}}{ß1ßRß3|{´x´¢1zO´y´¢rO}÷ß4{ßbßQß8´´ß9»ßB|ßFßS÷ß6|¨streets room 1 wall 2¨¨streets room 1 wall 1¨¨streets room 1 camera 1¨¨streets room 1 sensor start¨¨streets room 1 camera 2¨¨streets room 1 camera 0¨¨streets room 1 floor¨¨streets room 1 sensor end¨¨streets room 1 camera 3¨¨streets room 1 map shape 1¨÷}´z´£0.-84}{ß1ßSß3|{´x´¢1w0´y´¢f8}÷ß4{ßbßQß8´´ß9»ßB|ßR÷ß6|¨streets room 2 rock¨¨streets room 2 sensor start¨¨streets room 2 floor¨¨home wow test wow¨¨streets room 2 map shape 1¨÷}´z´Ý1}{ß1ßHß3|{´x´¢1wo´y´¢1C2}÷ß4{ßbßQß8´´ß9»ßB|ßFßD÷ß6|¨streets side room 1 floor¨¨streets side room 1 wall 1¨¨streets side room 1 wall 2¨¨streets side room 1 wall fake 1¨¨streets side room 1 test¨¨streets side room 1 window 1¨¨streets side room 1 map shape 1¨¨streets side room 1 map shape 2¨¨streets side room 1 map shape 3¨÷}´z´£0.-6S}{ß1ßUß3|¦´x´´y´‡¢7c¢46¢8u¢88—÷ß4{ßbßTßV»ßc¨wall¨ß5ßWß6|¨test 2¨÷ß8ßT}}{ß1ßIß3|¦´x´´y´‡ºXºY¢TRºY—{´x´ºq´y´ºY´z´£0.4q}{´x´¢Vr´y´ºY´z´Ý3}{´x´ºr´y´ºY}{´x´ºa´y´ºY}{´x´ºa´y´ºY´z´£0.84}{´x´ºX´y´ºY´z´Ý4}÷ß4{ßbßDßc¨wall_train¨ß6|¨train floor broken¨¨train wall 1¨¨train wall 2¨¨train wall 3¨¨train ceiling¨¨train sensor¨¨train door right¨¨train door right path¨¨train door left¨¨train door left path¨¨train floor¨¨train floor broken top¨¨train floor broken bottom¨¨train floor broken middle¨÷¨seethrough¨»ß8ßD}}{ß1ßCß3|{´x´¢-68´y´¢-50}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨¨tutorial room 1 floor¨¨tutorial room 1 map shape 1¨¨tutorial room 1 map shape 2¨¨tutorial room 1 map shape 3¨÷ßbßXß9»ßB|ßYßaßAßZ÷ß8´´}}{ß1ßYß3|{´x´¢OW´y´¢-DO}÷ß4{ßbßXß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨tutorial room 2 floor¨¨tutorial room 2 floor platform¨¨tutorial room 2 map shape 1¨¨tutorial room 2 map shape 2¨¨tutorial room 2 map shape 3¨¨tutorial room 2 map shape 4¨¨tutorial room 2 map shape 5¨¨tutorial room 2 map shape 6¨¨tutorial room 2 map shape 7¨÷ß9»ßB|ßGßCßZ÷ß8´´}}{ß1ßZß3|{´x´¢-JM´y´¢-Tg}÷ß4{ßbßXß6|¨tutorial window 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨¨tutorial room 3 floor¨¨tutorial room 3 enemy 1¨¨tutorial room 3 map shape 1¨¨tutorial room 3 map shape 2¨¨tutorial room 3 map shape 3¨¨tutorial room 3 map shape 4¨¨tutorial room 3 map shape 5¨÷ß9»ßB|ßZßaßYßC÷ß8´´}}{ß1ßaß3|{´x´¢-Z0´y´¢-Gc}÷ß4{ßbßXß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨¨tutorial room 4 floor¨¨tutorial room 4 map shape 1¨÷ß9»ßB|ßZßC÷ß8´´}}{ß1ßGß3|{´x´¤9t´y´¤GK}÷ß4{ßbßXß6|¨tutorial room 5 sensor boss¨¨tutorial room 5 door start¨¨tutorial room 5 sensor boss start¨¨tutorial room 5 boss¨¨tutorial room 5 floor¨¨tutorial room 5 door end¨¨tutorial wall 15¨¨tutorial wall 16¨¨tutorial rock 23¨¨tutorial room 5 enemy¨¨tutorial rock 24¨¨tutorial rock 25¨¨tutorial rock 26¨¨tutorial rock 27¨¨tutorial room 5 switch path¨¨tutorial room 5 sensor middle¨¨tutorial room 5 sensor boss end¨¨tutorial wall 14¨¨tutorial room 5 rocky 3¨¨tutorial fake wall 5¨¨tutorial room 5 map shape 1¨¨tutorial room 5 map shape 2¨¨tutorial room 5 map shape 3¨¨tutorial room 5 map shape 4¨¨tutorial room 5 map shape 5¨¨tutorial room 5 map shape 6¨¨tutorial room 5 map shape 7¨¨tutorial room 5 map shape 8¨÷ß9»ßB|ßYßEßD÷ß8´´}}{ß1ß1uß3|{´x´¢28G´y´¤Qw}÷ß4{ßbßS¨spawn_enemy¨¨checkpoint¨¨is_spawner¨»¨spawn_repeat¨Êß8ßS}´z´Ý1}{ß1ß1Jß3|¦´x´´y´‡¢1Viºl¢1VE¢14c¢1RM¢17Mº14¤wY¢1cA¤sC¢1aE¤xM¢1VY¤yK¢1ZG¢114—÷ß4{ßbßFß3u¨enemy_streets_bit¨ß3x¤Kß3w»ß8ßF}´z´£0.-1c}{ß1ß1Kß3|{´x´¢1jG´y´¤vu´z´Ý0}{´x´¢1bM´y´¤ws}{´x´¢1co´y´¤s2}÷ß4{ßbßFß3uß3yß3xÍß3w»ß8ßF}´z´Ý0}{ß1ß1Lß3|{´x´¢1fi´y´¢1CM´z´Ý0}{´x´¢1aO´y´¢1Cg}{´x´ºb´y´¢15a´z´Ý0}{´x´¢1bg´y´¢10k}{´x´¢1ic´y´¤zS}÷ß4{ßbßFß3uß3yß3xÐß3w»ß8ßF}´z´Ý0}{ß1ß12ß3|¦´x´´y´‡¢1Qi¤vuº1M¢1Aa¢1RWº1Nº1O¤vu—÷ß4{ßbßFßcßdß8ßF}´z´Ý5}{ß1ßtß3|¦´x´´y´‡¢1Qs¤wOº1P¢18y¢1Uk¢1Fk¢1dI¤pc—÷ß4{ßbßFßcßdß8ßF¨safe_floor¨»ß5¨wall_floor¨}´z´Ý5}{ß1ßuß3|¦´x´´y´‡º1T¤pcº1Rº1S—{´x´º1R´y´º1S´z´Ý0}{´x´º1T´y´¤pc´z´Ý0}÷ß4{ßbßFßcß40ß8ßF}´z´Ý5}{ß1ßvß3|¦´x´´y´‡º1T¤pcº1Rº1S¢1fOº1S¢1ks¤pc—÷ß4{ßbßFßcßdß8ßFß3z»ß5ß40}´z´Ý0}{ß1ßwß3|¦´x´´y´‡º1V¤pcº1Uº1S—{´x´º1U´y´º1S´z´£0.-4q}{´x´º1V´y´¤pc´z´Ý6}÷ß4{ßbßFßcß40ß8ßF}´z´Ý0}{ß1ßxß3|¦´x´´y´‡º1V¤pcº1Uº1S¢1xI¢1DK¢1us¤ri—÷ß4{ßbßFßcßdß8ßFß3z»ß5ß40}´z´Ý6}{ß1ßyß3|¦´x´´y´‡º1Y¤riº1Wº1X—{´x´º1W´y´º1X´z´Ý2}{´x´º1Y´y´¤ri´z´Ý2}÷ß4{ßbßFßcß40ß8ßF}´z´Ý6}{ß1ß13ß3|¦´x´´y´‡º1Y¤riº1Wº1X—{´x´¢20g´y´¢1Ak´z´Ý2}{´x´¢21o´y´º1N´z´Ý2}{´x´¢202´y´¢1DU}{´x´¢27S´y´¢1De´z´Ý2}{´x´¢23u´y´¤uw}÷ß4{ßbßFßcßdß8ßFß3z»}´z´Ý2}{ß1ß1Hß3|{´x´º1g´y´¤uw´z´Ý2}{´x´º1e´y´º1f}÷ß4{ßbßFßc¨wall_floor_halfwidth¨ß8ßF}´z´Ý2}{ß1ß15ß3|¦´x´´y´‡º1g¤uwº1eº1f—{´x´º1e´y´º1f´z´Ý1}{´x´º1g´y´¤uw´z´Ý1}÷ß4{ßbßFßcß40ß8ßF}´z´Ý2}{ß1ß14ß3|{´x´º1g´y´¤uw´z´Ý1}{´x´º1e´y´º1f}{´x´¢2LA´y´¢12v´z´Ý1}{´x´¢294´y´¤uw}÷ß4{ßbßFßcßdß8ßFß3z»}´z´Ý1}{ß1ß1Mß3|¦´x´´y´‡º1Mº1Qº18º1X¢1ce¤rYº1M¤wO—÷ß4{ßbßFß8ßFße»ßcßfß6|¨station streets map rock 1¨¨station streets map rock 2¨÷}}{ß1ß1Nß3|¦´x´´y´‡º18º1X¢1g2º1H¢1ja¤vkº1k¤rY—÷ß4{ßbßFß8ßFße»ßcßfß6|¨station streets map rock 3¨¨station streets map rock 4¨÷}}{ß1ß1Oß3|¦´x´´y´‡º1lº1H¢1oQ¢1Au¢1wyº1NºV¤w4¢1pi¤tUº1m¤vk—÷ß4{ßbßFß8ßFße»ßcßfß6|¨station streets map rock 5¨¨station streets map rock 6¨¨station streets map rock 7¨÷}}{ß1ß1Pß3|¦´x´´y´‡º1pº1N¢26o¢1AGº1g¤uwºV¤w4—÷ß4{ßbßFß8ßFße»ßcßfß6|¨station streets map rock 8¨¨station streets map rock 9¨÷}}{ß1ß1Qß3|¦´x´´y´‡º1rº1sºW¢19mºW¤zI¢2D6º1Kº1u¤zIºW¤w4º1j¤uwº1e¤um¢25q¤umº1g¤uw—÷ß4{ßbßFß8ßFße»ßcßf}}{ß1ß1Rß3|¦´x´´y´‡ºWº1tº1u¢16Yº1u¢156ºWº1w—÷ß4{ßbßFß8ßFße»ßcßf}}{ß1ß1Sß3|¦´x´´y´‡¢1ys¢10L¢21e¤yW¢1xy¤xw—÷ß4{ßbßFß8ßFße»ßcßfßg»}}{ß1ßlß3|¦´x´´y´‡¢1Uu¢15Qº12¢19S¢1SU¢172—÷ß4{ßbßFßc¨rock¨ß8ßF}´z´Ý5}{ß1ßhß3|¦´x´´y´‡¢1ZQ¤xq¢1YS¢106—{´x´¢1WM´y´¤yU´z´Ý5}÷ß4{ßbßFßcß4Bß8ßF}´z´Ý5}{ß1ßiß3|¦´x´´y´‡¢1d8º1I¢1b2º1t—{´x´¢1Ym´y´¢15G´z´Ý0}÷ß4{ßbßFßcß4Bß8ßF}´z´Ý0}{ß1ßjß3|¦´x´´y´‡¢1fY¤zm¢1cK¢10Gºb¤xW—÷ß4{ßbßFßcß4Bß8ßF}´z´Ý0}{ß1ßoß3|¦´x´´y´‡¢1nI¢16s¢1im¢19cº1Vº23—÷ß4{ßbßFßcß4Bß8ßF}´z´Ý6}{ß1ßpß3|¦´x´´y´‡¢1scº1Kº2I¢10Q¢1qW¤w4—÷ß4{ßbßFßcß4Bß8ßF}´z´Ý6}{ß1ßqß3|¦´x´´y´‡¢1uEº23¢1tQ¢16iº2Mº2E—÷ß4{ßbßFßcß4Bß8ßF}´z´Ý6}{ß1ßrß3|¦´x´´y´‡¢244¢1A6¢1yuº24¢22Iº23—÷ß4{ßbßFßcß4Bß8ßF}´z´Ý2}{ß1ßsß3|{´x´¢1xw´y´¤xq}{´x´º1b´y´¤yU´z´Ý2}{´x´º2U´y´º2N}÷ß4{ßbßFßcß4Bß8ßFßV»}´z´Ý2}{ß1ßnß3|¦´x´´y´‡¢2Hwº1iºWº1wºW¤zI—÷ß4{ßbßFßcß4Bß8ßF}´z´Ý1}{ß1ß1Eß3|{´x´¢2CN´y´¢169}÷ß4{ßbßFß3u¨enemy_streets_rocky_small¨ß3w»ß3xÊß8ßF¨spawn_permanent¨»}´z´Ý1}{ß1ßmß3|¦´x´´y´‡¢2Ei¤vGº2a¢1CC¢1mUº2bº2c¤vG—÷ß4{ßbßFßc¨sensor¨ß8ßF}´z´Ý1}{ß1ßkß3|¦´x´´y´‡¢1Ty¤v5¢1UGº1Xº1Mº2bº1P¤vG—÷ß4{ßbßFßcß4Eß8ßF}}{ß1ßzß3|¦´x´´y´‡º1g¤uwºV¤w4—÷ß4{ßV»ßbßFßcß25ß8ßF}´z´Ý2}{ß1ß10ß3|{´x´º1k´y´¤rY}{´x´º1M´y´¤wO´z´Ý5}{´x´º1M´y´ºY}÷ß4{ßV»ßbßFßcß25ß8ßF}´z´Ý5}{ß1ß11ß3|¦´x´´y´‡º1m¤vkº1k¤rY—÷ß4{ßV»ßbßFßcß25ß8ßF}´z´Ý0}{ß1ß16ß3|¦´x´´y´‡º18º1Xº1Mº1Q—{´x´º1M´y´ºZ´z´Ý5}÷ß4{ßV»ßbßFßcß25ß8ßF}´z´Ý5}{ß1ß17ß3|¦´x´´y´‡º1lº1Hº18º1X—÷ß4{ßV»ßbßFßcß25ß8ßF}´z´Ý0}{ß1ß18ß3|{´x´º1p´y´º1N´z´Ý6}{´x´º1n´y´º1o}{´x´º1l´y´º1H}÷ß4{ßV»ßbßFßcß25ß8ßF}´z´Ý6}{ß1ß19ß3|¦´x´´y´‡ºV¤w4º1q¤tUº1m¤vk—÷ß4{ßV»ßbßFßcß25ß8ßF}´z´Ý6}{ß1ß1Aß3|¦´x´´y´‡º1MºZº1Mº1Q—÷ß4{ßV»ßbßFßcß25ß8ßF}´z´Ý1}{ß1ß1Bß3|{´x´º1M´y´¤wO´z´Ý1}{´x´º1M´y´ºY}÷ß4{ßV»ßbßFßcß25ß8ßF}´z´Ý1}{ß1ß1Cß3|¦´x´´y´´z´‡º1rº1sÝ2º1b¢1AQÝ2¢1ya¢1FQÝ2—÷ß4{ßV»ßbßFßcß25ß8ßF}´z´Ý2}{ß1ß1Iß3|¦´x´´y´‡¢1weº2h¢1zsº1oº1pº1N—÷ß4{ßV»ßbßFßcß25ß8ßF}´z´Ý2}{ß1ß1Dß3|¦´x´´y´‡º1uº1xº1uº1wºWº1tº1rº1s—÷ß4{ßV»ßbßFßcß25ß8ßF}´z´Ý1}{ß1ß1Gß3|¦´x´´y´‡º1e¤umº1j¤uwºW¤w4—{´x´º1u´y´¤zI´z´Ý1}{´x´º1u´y´º1K}÷ß4{ßV»ßbßFßcß25ß8ßF}´z´Ý1}{ß1ß1Fß3|{´x´º2W´y´¤xq}{´x´º2U´y´º2N´z´Ý2}÷ß4{ßbßFßc¨wall_streets_fake¨ßV»ß4D»ß8ßF}´z´Ý2}{ß1ß1Vß3|¦´x´´y´‡¤am¤w4¤YM¤o0¤X4¤o0¤Y2¤rE¤Fo¤s2¤Gw¤yy¤Gwº15ºeº15ºe¢18e¤X4º2k¤X4º15¤amº15¤am¢130—÷ß4{ßbßEßcßdß3z»ß8ßE}}{ß1ß1eß3|¦´x´´y´‡¤ZU¤w4¤RG¤w4¤Gw¤yy¤Gwº15¤ZUº15—÷ß4{ßbßEß8ßEße»ßcßf}}{ß1ß1fß3|¦´x´´y´‡¤ZY¢15k¤ZUº2m¤ZUº29¤ZYº29¤ZY¤w4¤am¤w4¤amº15¤ZYº15—÷ß4{ßbßEß8ßEße»ßcßf}}{ß1ß1gß3|¦´x´´y´‡ºe¢17Qºeº2k¤X4º2k¤X4º2n—÷ß4{ßbßEß8ßEße»ßcßf}}{ß1ß1Zß3|¦´x´´y´‡¢14S¤tAº26¤uw¢17g¤y0º1xº2N¢11s¤zmº2H¤xC¢11O¤uI—÷ß4{ßbßEßcß4Bß8ßE}´z´Ý1}{ß1ß1aß3|¦´x´´y´‡¢1Emº23¢1GO¢164¢1Giº2pº1S¢19I¢1Dy¢198¢1Cqº2pº1Xº2u—÷ß4{ßbßEßcß4Bß8ßE}´z´Ý1}{ß1ß1bß3|¦´x´´y´‡¢1K6¤xM¢1LE¤xq¢1LY¤yy¢1Kkº2N¢1J8º29¢1IK¤yo¢1Iy¤xg—÷ß4{ßbßEßcß4Bß8ßE}´z´Ý1}{ß1ß1dß3|¦´x´´y´‡º5¤vGº5º2b¢1PQº2bº37¤vG—÷ß4{ßbßEßcß4Eß8ßE}}{ß1ß1Wß3|¦´x´´y´‡ºQ¤wY¤KK¤yy¤KKº2HºQº2H¤Ue¤zm¤WGº2H¤ZU¤wY—÷ß4{ßbßEßcß4E¨sensor_fov_mult¨Êß8ßE}}{ß1ß1Xß3|¦´x´´y´‡¤RG¤w4¤Op¤wi—÷ß4{ßV»ßbßEßcß25ß8ßE}}{ß1ß1Yß3|¦´x´´y´‡¤Mk¤xM¤Gw¤yy¤Gwº15¤ZUº15¤ZUº2m—÷ß4{ßV»ßbßEßcß25ß8ßE}}{ß1ß1mß3|{´x´¢2CI´y´¤zS}÷ß4{ßbßRß3u¨enemy_streets_camera_small¨ß3w»ß3xÊß8ßR}´z´Ý1}{ß1ß1jß3|{´x´¢24O´y´¤to}÷ß4{ßbßRß3uß4Hß3w»ß3xÊß8ßR}´z´Ý1}{ß1ß1lß3|{´x´¢27I´y´¤mE}÷ß4{ßbßRß3uß4Hß3w»ß3xÊß8ßR}´z´Ý1}{ß1ß1pß3|{´x´¢252´y´¤fw}÷ß4{ßbßRß3uß4Hß3w»ß3xÊß8ßR}´z´Ý1}{ß1ß1nß3|¦´x´´y´‡º1g¤uw¢29O¤v6—{´x´º1e´y´¤nC´z´Ý1}{´x´¢2A2´y´¤iM}{´x´¢25C´y´¤iM}{´x´º2V´y´¤nC}÷ß4{ßbßRßcßdß8ßRß3z»}´z´Ý1}{ß1ß1qß3|¦´x´´y´‡º1v¤umº1e¤um¢28u¤uSº1e¤nCº3D¤iMº10¤eK¢23Q¤eKº3E¤iMº2V¤nC¢23k¤uS—÷ß4{ßbßRß8ßRße»ßcßf}}{ß1ß1oß3|{´x´¢22w´y´¤fS}{´x´º3I´y´¤ee´z´Ý1}{´x´º3C´y´¤ee´z´Ý1}{´x´º3C´y´¤fS}÷ß4{ßbßRßcß4Eß8ßRß4G£0.Cu}´z´Ý1}{ß1ß1kß3|{´x´º3G´y´¤te}{´x´º3G´y´¤sq´z´Ý1}{´x´ºW´y´¤sq´z´Ý1}{´x´ºW´y´¤te}÷ß4{ßbßRßcß4Eß8ßRß4GÝ7}´z´Ý1}{ß1ß1iß3|¦´x´´y´‡º10¤Hkº2g¤Wkº3G¤eK—{´x´º3E´y´¤iM´z´Ý1}{´x´º2V´y´¤nC}{´x´º1g´y´¤uw}{´x´º1v´y´¤um´z´Ý1}{´x´º3H´y´¤uS}÷ß4{ßV»ßbßRßcß25ß8ßR}´z´Ý1}{ß1ß1hß3|¦´x´´y´‡º10¤Hkº2X¤Wkº10¤eKº3D¤iMº1e¤nCº3F¤uSº1e¤um—÷ß4{ßV»ßbßRßcß25ß8ßR}´z´Ý1}{ß1ß1tß3|¦´x´´y´´z´‡¢1s8¤gkÝ1º3E¤iMÝ1—{´x´º3D´y´¤iM}{´x´¢2OO´y´¤gk}{´x´º10´y´¤Hk}÷ß4{ßbßSßcßdß8ßSß3z»}´z´Ý1}{ß1ß1vß3|¦´x´´y´‡º10¤eKº3G¤eKº2g¤Wkº10¤Hkº2X¤Wk—÷ß4{ßbßSß8ßSße»ßcßfß6|¨streets room 2 map rock 1¨÷}}{ß1ß1rß3|¦´x´´y´‡¢2B0¤X4º1g¤X4—{´x´º1v´y´¤b6´z´Ý1}÷ß4{ßbßSßcß4Bß8ßS}´z´Ý1}{ß1ß1sß3|{´x´¢1xm´y´¤X4}{´x´º3M´y´¤WG´z´Ý1}{´x´¢2Ik´y´¤WG´z´Ý1}{´x´º3N´y´¤X4}÷ß4{ßbßSßcß4Eß8ßSß4G£1.1c}´z´Ý1}{ß1ß1wß3|{´x´º2j´y´º1o}{´x´º1b´y´º2f´z´Ý2}{´x´º1e´y´º1f´z´Ý2}{´x´º3F´y´¢1FG}{´x´º3F´y´¢1T8´z´Ý2}{´x´º2i´y´º3P}{´x´º2i´y´º2h}÷ß4{ßbßHßcßdß8ßHß3z»}´z´Ý2}{ß1ß22ß3|¦´x´´y´‡º2jº1oº2iº2hº2gº2hº1bº2fº1pº1N—÷ß4{ßbßHß8ßHße»ßcßf}}{ß1ß23ß3|¦´x´´y´‡¢21Aº1Mº10º1Mº10º2tº2gº2hº2iº2h—÷ß4{ßbßHß8ßHße»ßcßf}}{ß1ß24ß3|¦´x´´y´‡¢210º1f¢22Sº1a¢26eº1N¢27cº2h¢26K¢1F6º1vº2z¢22c¢1DAº3T¢1Faº3T¢1GEº3B¢1G4—÷ß4{ßbßHß8ßHße»ßcßf}}{ß1ß20ß3|{´x´¢20M´y´º34´z´Ý2}÷ß4{ßbßHß8ßHß3w»ß6|¨streets side room 1 test 0¨¨streets side room 1 test 1¨÷}´z´Ý2}{ß1ß1xß3|¦´x´´y´‡º3Qº1Mº2iº2h—÷ß4{ßV»ßbßHßcß25ß8ßH}´z´Ý2}{ß1ß1yß3|¦´x´´y´´z´‡º2gº2hÝ2º3Bº3bÝ2—{´x´º3R´y´º1f}{´x´º3S´y´º1a}{´x´º3T´y´º1N}{´x´º3U´y´º2h}{´x´º3V´y´º3W}{´x´º1v´y´º2z}{´x´º3X´y´º3Y´z´Ý2}{´x´º3T´y´º3Z}{´x´º3T´y´º3a}{´x´º10´y´º2t}÷ß4{ßV»ßbßHßcß25ß8ßH}´z´Ý2}{ß1ß1zß3|{´x´º3B´y´º3b}{´x´º3T´y´º3a´z´Ý2}÷ß4{ßbßHßcß4FßV»ß4D»ß8ßH}´z´Ý2}{ß1ß21ß3|¦´x´´y´´z´‡º3Q¢1LsÝ2º2gº2hÝ2—÷ß4{ßV»ßbßHßc¨wall_window¨ß8ßH}´z´Ý2}{ß1ß26ß3|¦´x´´y´‡¤8w¤4r¤9s¤7u—÷ß4{ßbßUßV»ßcß25ß5ßWß8ßT}}{ß1ß2Cß3|¦´x´´y´‡ºaºYºXºYºXºZºaºZ—÷ß4{ßbßIßcß27ßd»ß8ßDß1U»}´z´Ý4}{ß1ß2Gß3|¦´x´´y´‡¤SEºYºqºY—{´x´ºq´y´ºY´z´Ý3}{´x´¤SE´y´ºY´z´Ý3}÷ß4{ßbßIßcß27ß8ßD}}{ß1ß2Hß3|¦´x´´y´‡ºqºY¤UeºY—÷ß4{ßbßIßc¨sensor_path¨ß8ßD}}{ß1ß2Eß3|¦´x´´y´‡ºrºY¤X4ºY—{´x´¤X4´y´ºY´z´Ý3}{´x´ºr´y´ºY´z´Ý3}÷ß4{ßbßIßcß27ß8ßD}}{ß1ß2Fß3|¦´x´´y´‡ºrºY¤UeºY—÷ß4{ßbßIßcß4Mß8ßD}}{ß1ß2Iß3|¦´x´´y´‡ºaºYºXºYºXºZºaºZ—÷ß4{ßbßIßc¨floor_train¨ß8ßDß1U»}}{ß1ß28ß3|¦´x´´y´‡ºaºY¤SEºY¤Ru¢122¤SE¢13U¤SEºZºaºZ—÷ß4{ßbßIßcß4Nß8ßDß1U»}}{ß1ß2Kß3|¦´x´´y´‡ºXºZ¤SEºZ¤SEº3fºX¢13A—÷ß4{ßbßIßcß4Nß8ßDß1U»}}{ß1ß2Lß3|¦´x´´y´‡ºXº3g¤SEº3f¤Ruº3eºXºR—÷ß4{ßbßIßcß4Nß8ßDß1U»}}{ß1ß2Jß3|¦´x´´y´‡ºXºR¤Ruº3e¤SEºYºXºY—÷ß4{ßbßIßcß4Nß8ßDß1U»}}{ß1ß2Dß3|¦´x´´y´‡¤Qmº1A¤Qm¢14m¤YWº3h¤YWº1A—÷ß4{ßbßIßcß4Eß8ßDß1U»}}{ß1ß29ß3|{´x´ºa´y´ºY}{´x´ºa´y´ºY´z´Ý4}{´x´ºa´y´ºZ´z´Ý4}{´x´ºa´y´ºZ}÷ß4{ßbßIßcß27ß8ßD}}{ß1ß2Aß3|{´x´ºX´y´ºY}{´x´ºX´y´ºY´z´Ý4}{´x´ºX´y´ºZ´z´Ý4}{´x´ºX´y´ºZ}÷ß4{ßbßIßcß27ß8ßD}}{ß1ß2Bß3|¦´x´´y´‡ºXºZºaºZ—{´x´ºa´y´ºZ´z´Ý4}{´x´ºX´y´ºZ´z´Ý4}÷ß4{ßbßIßcß27ß8ßD}}{ß1ß2iß3|¦´x´´y´‡¤Lm¤4q¤Ky¤84—÷ß4{ßbßYßc¨wall_tutorial_fake¨ßV»ß4D»ß8ßY}}{ß1ß3Pß3|¦´x´´y´‡¢-MQ¤-e¢-NY¤K—÷ß4{ßbßaßcß4OßV»ß4D»ß8ßa}}{ß1ß3lß3|¦´x´´y´‡¤AA¤g6¤By¤i0—÷ß4{ßbßGßcß4OßV»ß4D»ß8ßG}}{ß1ß1cß3|{´x´º1M´y´¤wO´z´Ý1}{´x´º1M´y´º1Q}{´x´¤ye´y´¢1Ec}{´x´¤yU´y´¤qQ}÷ß4{ßbßEßcßdß8ßE}´z´Ý1}{ß1ß3aß3|¦´x´´y´‡¤CQ¤ga¤DE¤gQ¤EM¤gu¤EW¤hs¤E2¤iM¤DO¤iW¤Ck¤iC—÷ß4{ßbßGßcß4BßV»ß8ßG}}{ß1ß3cß3|¦´x´´y´‡¤SO¤oe¤TC¤pSºQ¤qa¤S4¤qu¤Qw¤qaºX¤pS¤RG¤oU—÷ß4{ßbßGßcß4Bß8ßG}}{ß1ß3dß3|¦´x´´y´‡¤SiºhºQ¤sM¤SY¤tA¤Ra¤tK¤Qw¤sg¤Qw¤ri¤Rk¤rE—÷ß4{ßbßGßcß4Bß8ßG}}{ß1ß3eß3|¦´x´´y´‡¤Ss¤tU¤Tq¤uS¤Tg¤vk¤Si¤wY¤Rk¤wE¤R6¤v6¤Ra¤ty—÷ß4{ßbßGßcß4Bß8ßG}}{ß1ß3fß3|¦´x´´y´‡¤OC¤vQ¤Og¤wE¤OM¤x2¤NO¤xM¤Ma¤ws¤MQ¤vu¤NE¤vG—÷ß4{ßbßGßcß4Bß8ßG}}{ß1ß2Pß3|{´x´¢-2Q´y´º3}÷ß4{ßbßCß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷ß8ßC}}{ß1ß2Rß3|¦´x´´y´‡¤6w¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßbßCß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßcß4Eß4G£0.EWß8ßC}}{ß1ß2Vß3|¦´x´´y´‡¤D4¤-A¤C6¢-42¤5eº3lº2ºt¢-6Iº2¢-6m¤42¢-9q¤50¢-Bm¤84¢-Bc¤BI¢-7Q¤D4¢-3Y¤B8¢-26¤84¤4C¤6w¤6c¤1S—÷ß4{ßbßCßcßdß3z»ß8ßC}}{ß1ß2Wß3|¦´x´´y´‡¤5eº3lº2ºtº3pº2º3q¤42º3w¤84¤4C¤6w¤6c¤1S—÷ß4{ßbßCß8ßCße»ßcßfß6|¨tutorial room 1 map rock 1¨¨tutorial room 1 map rock 2¨¨tutorial room 1 map rock 3¨¨tutorial room 1 map rock 4¨÷}}{ß1ß2Xß3|¦´x´´y´‡¤C6º3o¤5eº3l¤6c¤1S¤D4¤-A—÷ß4{ßbßCß8ßCße»ßcßf}}{ß1ß2Yß3|¦´x´´y´‡¢-2v¤7M¢-47¤6K¢-4C¤6P¢-6u¤44º3r¤50º3s¤84º3t¤BIº3u¤D4º3v¤B8—÷ß4{ßbßCß8ßCße»ßcßfß6|¨tutorial room 1 map rock 5¨¨tutorial room 1 map rock 6¨÷}}{ß1ß2Nß3|{´x´ºt´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß4f÷ßbßCß8ßC}}{ß1ß2Qß3|¦´x´´y´‡¤5eº3lº2ºtº3pº2º3q¤42º3w¤84¤4C¤6w¤6c¤1S—÷ß4{ßbßCßcß4Eß4GÊß8ßC}}{ß1ß2Tß3|{´x´¢-BI´y´¤4q}÷ß4{ß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßbßCß8ßC}}{ß1ß2eß3|¦´x´´y´‡¤5e¢-CG¤4g¢-8O¤8Yº3u¤9Wº42¤F9¢-HE¤9W¢-BS—÷ß4{ßbßYßcß4Eß4GÝ9ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷ß8ßY}}{ß1ß2nß3|¦´x´´y´‡¤Gw¢-Ky¤EC¢-Lc¤BS¢-KU¤4M¢-Ca¤3O¢-8i¤C6º3o¤D4¤-A¤Bm¤8s¤E2¤G8¤H6¤GI¤Ke¤9M¤WG¤84¤Wu¤2G¤Uy¢-Ay—÷ß4{ßbßYßcßdß3z»ß8ßY}}{ß1ß2oß3|¦´x´´y´‡¤Wuº3z¤Waº3u—{´x´¤Vw´y´¢-5o´z´£0.3E}÷ß4{ßbßYßcßdß8ßY}´z´ÝA}{ß1ß2pß3|¦´x´´y´‡¤Wk¤2G¤Uyº4C¤NOº3s¤Lw¢-H6¤Gm¢-Is¤Bw¢-FU¤BS¢-Ao¤Aoº4C¤9q¢-76¤C6º3o¤D4¤-A¤Ck¤26¤M8¤3Gº1¤4C¤WV¤3k¤NO¤2u¤MG¤26¤N4¤eºu¤U¤Po¤18¤Py¤2Q¤Pe¤3EºX¤3E¤QI¤2Q¤QS¤18¤R6¤o¤S4¤18¤SO¤1w¤S4¤3O¤UA¤3Y¤Ss¤1w¤Si¤e¤TM¤-K¤UU¤-o¤Vm¤-K¤Vw¤18¤WG¤42º1¤4C—÷ß4{ßbßYß8ßYße»ßcßfß6|¨tutorial room 2 map rock 1¨¨tutorial room 2 map rock 2¨¨tutorial room 2 map rock 3¨¨tutorial room 2 map rock 4¨¨tutorial room 2 map rock 5¨¨tutorial room 2 map rock 6¨¨tutorial room 2 map rock 7¨¨tutorial room 2 map rock 8¨¨tutorial room 2 map rock 9¨¨tutorial room 2 map rock 10¨¨tutorial room 2 map rock 11¨÷}}{ß1ß2qß3|¦´x´´y´‡¤Gc¢-7a¤Gg¢-7e¤GN¢-92¤H8¢-AF¤IW¢-A6¤JR¢-9B¤J8¢-7T¤Hk¢-6r¤Hkº3q—÷ß4{ßbßYß8ßYße»ßcßfßg»}}{ß1ß2rß3|¦´x´´y´‡¤Cu¢-G8¤Cq¢-GD¤Bq¢-FW¤AA¢-GS¤A0¢-IY¤Bcº49¤E2¢-LS¤Gc¢-Ko¤Gm¢-Ix¤Do¢-Gs¤Ds¢-Gm—÷ß4{ßbßYß8ßYße»ßcßf}}{ß1ß2sß3|¦´x´´y´‡¤3Oº4B¤4Mº4A¤Aoº4C¤9qº4I—÷ß4{ßbßYß8ßYße»ßcßf}}{ß1ß2tß3|¦´x´´y´‡¤Ky¤84¤Lk¤4q¤WG¤4q¤WG¤84—÷ß4{ßbßYß8ßYße»ßcßf}}{ß1ß2uß3|¦´x´´y´‡¤EW¤C1¤Ha¤CG¤H6¤GI¤E2¤G8—÷ß4{ßbßYß8ßYße»ßcßf}}{ß1ß2vß3|¦´x´´y´‡¤M8¤3G¤Ke¤9M¤Ha¤CG¤EW¤C1¤Bm¤8s¤Ck¤26—÷ß4{ßbßYß8ßYße»ßcßf}}{ß1ß2aß3|{´x´¤G8´y´º3v}÷ß4{ßbßYß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷ß8ßY}}{ß1ß2dß3|{´x´¤KA´y´¢-5A}÷ß4{ßbßYß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷ß8ßY}}{ß1ß2jß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßbßYßcß4Eß8ßY}}{ß1ß2bß3|{´x´¤Ss´y´¤-y}÷ß4{ßbßYß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ß8ßY}}{ß1ß2cß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßbßYßcß4Mß6|¨tutorial room 2 switch¨÷ß8ßY}}{ß1ß2fß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGº3l—÷ß4{ßbßYßc¨icon¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷ß8ßY}´z´£0.1c}{ß1ß2hß3|{´x´¤AU´y´¢-K0}÷ß4{ßbßYß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷ß8ßY}}{ß1ß2kß3|¦´x´´y´‡¤CQ¤y¤Ds¤FU¤HQ¤FU¤FU¤y—÷ß4{ßbßYßcß4Eß4GÝ9ß8ßY}}{ß1ß2xß3|¦´x´´y´‡¢-Lmº4V¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßbßZßcß4Eß4G£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷ß8ßZ}}{ß1ß35ß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FKº4C¢-Ds¢-8s¢-Fe¢-8Yº4p¢-A0º4g¢-DY¢-Ke—÷ß4{ßbßZßcß4Eß8ßZ}}{ß1ß38ß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßbßZß3u¨enemy_tutorial_easy¨ß3w»ß3xÊß8ßZ}}{ß1ß2yß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßbßZß3uß5bß3w»ß3xÊß8ßZ}}{ß1ß37ß3|¦´x´´y´‡¤3Oº4B¤4Mº4A¤e¢-GI¢-4Mº49¢-84¢-Oq¢-EC¢-PAº4h¢-I4¢-OMº4Gº3iº4xº42¢-9Cº3wº4I—÷ß4{ßbßZßcßdß3z»ß8ßZ}}{ß1ß39ß3|¦´x´´y´‡º3wº4I¢-5e¢-B8º4cº4q¤eº53¤4Mº4A¤3Oº4B—÷ß4{ßbßZß8ßZße»ßcßfß6|¨tutorial room 3 map rock 1¨÷}}{ß1ß3Aß3|¦´x´´y´‡º41¢-Cuº4f¢-Cr¤A¢-DU¤1O¢-Ch¤1i¢-BA¤J¢-9v¢-1P¢-9k¢-21¢-B7º3wº5D—÷ß4{ßbßZß8ßZße»ßcßfßg»}}{ß1ß3Bß3|¦´x´´y´‡º42º5B¢-HG¢-CQ¢-Jqº4Rº4hº59¢-J2¢-JWº57º58º55º56º54º49º4cº4qº5Cº5D—÷ß4{ßbßZß8ßZße»ßcßfß6|¨tutorial room 3 map rock 2¨÷}}{ß1ß3Cß3|¦´x´´y´‡¢-Fu¢-IN¢-F6¢-FE¢-Az¢-Do¢-8m¢-Fh¢-8T¢-IM¢-A2¢-K7º4x¢-Kj—÷ß4{ßbßZß8ßZßcßfße»ßg»}}{ß1ß3Dß3|¦´x´´y´‡º3iº4xº5Qº4Rº4hº59º5Aº4G—÷ß4{ßbßZß8ßZße»ßcßf}}{ß1ß32ß3|¦´x´´y´‡º3pº55¤2F¢-5T¤4qº4r¢-3F¢-Hl—÷ß4{ßbßZßcß4Eß4GÝCß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷ß8ßZ}}{ß1ß3Iß3|{´x´¢-L4´y´¤49}÷ß4{ßbßaß3u¨enemy_tutorial_rock_room4¨ß3w»ß3xÊß8ßa}}{ß1ß3Qß3|¦´x´´y´‡º3iº4xº5Aº4G¢-W6¢-Ck¢-Ygº4bºx¤Uº3j¤Kº3j¤7Gº4F¤7Gº4F¤34º3i¤-eº5R¢-3Oº4pº4B—÷ß4{ßbßaßcßdß3z»ß8ßa}}{ß1ß3Fß3|{´x´¢-QI´y´¢-7G}÷ß4{ßbßaß3u¨collect_gun_basic¨ß3w»ß3xÊß4D»ß8ßa}}{ß1ß3Gß3|{´x´º5o´y´º5p}÷ß4{ßbßaß3u¨deco_gun_basic¨ß3w»ß3xÊß8ßa}}{ß1ß3Rß3|¦´x´´y´‡º5kº5lº5mº4bºx¤Uº3j¤Kº5Rº5nº4pº4Bº3iº4xº5Aº4G—÷ß4{ßbßaß8ßaßcßfße»ß6|¨tutorial room 4 map rock 1¨¨tutorial room 4 map rock 2¨¨tutorial room 4 map rock 3¨÷}}{ß1ß3Mß3|¦´x´´y´‡¢-Kz¢-6wº5f¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßbßaßcß5Rß8ßa}}{ß1ß3Hß3|{´x´¢-Ue´y´¢-C6}÷ß4{ßbßaß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷ß8ßa}}{ß1ß3Kß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßbßaß3u¨enemy_tutorial_rocky¨ß3w»ß3xÊß4D»ß8ßa}}{ß1ß3Lß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßbßaß3uß5pß3w»ß3xÊß4D»ß8ßa}}{ß1ß3Eß3|¦´x´´y´‡¢-OK¢-FkºAº5E¢-Yqº4b¢-Tq¤e¢-NO¤Uº4F¢-3E¢-IEº4t—÷ß4{ßbßaßcß4Eß4G£1.4qß8ßa}}{ß1ß3Jß3|{´x´¢-Ic´y´¤16}÷ß4{ßbßaß3u¨switch¨ß3w»ß3xÊß8ßa}}{ß1ß3Vß3|{´x´¤Fy´y´¤TW}÷ß4{ßbßGß3u¨enemy_tutorial_boss¨ß3w»ß3xÊß8ßGß4D»}}{ß1ß3Xß3|¦´x´´y´‡¤Pe¤fS¤Lw¤fc—÷ß4{ßV»ß5¨tutorial_door¨ßbßGß6|¨tutorial room 5 door end path¨÷ß8ßG}}{ß1ß3Tß3|¦´x´´y´‡¤KU¤GS¤HQ¤GI—÷ß4{ßV»ß5ß5sßbßGß6|¨tutorial room 5 door start path¨÷ß8ßG}}{ß1ß3bß3|{´x´¤Tx´y´¤gx}÷ß4{ßbßGß3u¨enemy_tutorial_easy_static¨ß3w»ß3xÊß8ßG}}{ß1ß3Wß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºQ¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fw¤Ue¤fw¤Vc¤jA¤Wu¤jA¤XO¤km¤W6¤km¤Y2¤rE¤Fo¤s2¤F0¤nC¤92¤h4¤9M¤gG¤AA¤g6¤1w¤X4¤4q¤M6—÷ß4{ßbßGßcßdß3z»ß8ßG}}{ß1ß3mß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºQ¤Vw¤Lz¤fY¤Hu¤fi¤Hu¤fm¤EC¤fw¤EC¤fs¤A6¤g2¤26¤X4¤4q¤M6—÷ß4{ßbßGß8ßGße»ßcßf}}{ß1ß3nß3|¦´x´´y´‡¤EC¤fw¤Hu¤fm¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤RG¤w4ºX¤wE¤P0¤oK¤SE¤o0¤RQ¤lG¤G8ºT¤AA¤g6—÷ß4{ßbßGß8ßGße»ßcßfß6|¨tutorial room 5 map rock 1¨¨tutorial room 5 map rock 2¨¨tutorial room 5 map rock 3¨¨tutorial room 5 map rock 4¨÷}}{ß1ß3oß3|¦´x´´y´‡¤Ck¤iC¤Co¤i9¤DO¤iS¤E0¤iI¤ER¤hr¤EI¤gx¤DD¤gU¤CU¤gd¤CQ¤ga¤CG¤hY—÷ß4{ßbßGß8ßGße»ßcßfßg»}}{ß1ß3pß3|¦´x´´y´‡¤X8¤o0¤YM¤o0¤am¤w4¤ZY¤w4—÷ß4{ßbßGß8ßGße»ßcßfß6|¨tutorial room 5 map shape 4.1¨÷}}{ß1ß3qß3|¦´x´´y´‡¤T6¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fs¤Uc¤ft¤Ps¤gL—÷ß4{ßbßGß8ßGße»ßcßf}}{ß1ß3rß3|¦´x´´y´‡ºX¤wE¤Gw¤yy¤FK¤p8¤Gw¤p8¤P0¤oK—÷ß4{ßbßGß8ßGße»ßcßf}}{ß1ß3sß3|¦´x´´y´‡¤Gw¤p8¤G8ºT¤AA¤g6¤9M¤gG¤92¤h4¤F0¤nC¤FK¤p8—÷ß4{ßbßGß8ßGße»ßcßf}}{ß1ß3tß3|¦´x´´y´‡¤G8ºT¤Gw¤p8¤SE¤o0¤RQ¤lG—÷ß4{ßbßGß8ßGße»ßcßf}}{ß1ß3kß3|{´x´¤WV´y´¤jy}÷ß4{ßbßGß3u¨enemy_tutorial_rocky_small¨ß3w»ß3xÊß8ßGß4D»}}{ß1ß3Sß3|¦´x´´y´‡¤1w¤Ko¤1w¤cEºQ¤bQ¤TM¤LI—÷ß4{ßbßGßcß4Eß8ßG}}{ß1ß3iß3|¦´x´´y´‡¤8s¤eK¤9g¤fI¤MG¤eo¤N4¤dq—÷ß4{ßbßGßcß4Eß4GÝDß8ßG}}{ß1ß3Uß3|¦´x´´y´‡¤DE¤Gm¤CG¤HQ¤JC¤Hk¤IE¤H6—÷ß4{ßbßGßcß4Eß4GÝDß8ßG}}{ß1ß3hß3|¦´x´´y´‡¤DE¤g6¤Eg¤gu¤Kr¤ga¤V1¤fk¤ZU¤um¤Gc¤um¤H6¤ye¤Qw¤vu¤aI¤vW¤VI¤fI—÷ß4{ßbßGßcß4Eß4GÊß8ßG}}{ß1ß3gß3|¦´x´´y´‡¤NE¤vG¤Mkºh—÷ß4{ßbßGßcß4Mß8ßG}}{ß1ß2zß3|¦´x´´y´‡º64º5Bº7¢-9gº3sº5D—÷ß4{ßbßZßc¨spike¨ß8ßZ}}{ß1ß30ß3|¦´x´´y´‡º4F¢-EWº5Sº4Gº5Oº4R—÷ß4{ßbßZßcß62ß8ßZ}}{ß1ß31ß3|¦´x´´y´‡¢-Af¢-PH¢-Bw¢-PKº42º6D—÷ß4{ßbßZßcß62ß8ßZ}}{ß1ß3Nß3|¦´x´´y´‡¢-Iu¤5Sº4F¤34º3i¤-eº5Rº5nº4pº4Bº3iº4x—÷ß4{ßbßaßcß25ßV»ß8ßa}}{ß1ß2Oß3|¦´x´´y´‡¢-38¤7Aº3w¤84¤4C¤6w¤6c¤1S¤D4¤-A—÷ß4{ßV»ßbßCßcß25ß8ßC}}{ß1ß2Sß3|¦´x´´y´‡¢-6e¤2Yº3q¤42—÷ß4{ßbßCßcß25ßV»ß8ßC}}{ß1ß2Zß3|¦´x´´y´‡¤Po¤gQºQ¤Vw¤RG¤MG¤H6¤GI¤Ha¤CG¤Ke¤9M¤Ky¤84¤WG¤84¤WG¤4q¤Lm¤4q¤M8¤3Gº1¤4C¤Wk¤2G¤Uyº4C¤NOº3s¤Lwº4E¤Gmº4F¤Dsº4a—÷ß4{ßV»ßbßYßcß25ß8ßY}}{ß1ß2lß3|¦´x´´y´‡¤3Oº4B¤9qº4I¤C6º3o—÷ß4{ßbßYßcß25ßV»ß8ßY}}{ß1ß3Oß3|¦´x´´y´‡º3j¤6Iº3j¤Kºx¤Uº5mº4bº5kº5lº5Aº4G—÷ß4{ßbßaßcß25ßV»ß8ßa}}{ß1ß2gß3|¦´x´´y´‡¤Cuº4R¤Bwº4G¤BSº4H¤4Mº4A—÷ß4{ßV»ßbßYßcß25ß8ßY}}{ß1ß2Uß3|¦´x´´y´‡¤C6º3o¤5eº3lº2ºtº3pº2¢-6T¤U—÷ß4{ßbßCßcß25ßV»ß8ßC}}{ß1ß2mß3|¦´x´´y´‡¤D4¤-A¤Bm¤8s¤EW¤C1¤E2¤G8¤4q¤M6¤26¤X4¤AA¤g6¤EC¤fw—÷ß4{ßV»ßbßYßcß25ß8ßY}}{ß1ß34ß3|¦´x´´y´‡º3iº4xº5Qº4Rº5Oº5Pº42º5Bº5Cº5Dº3wº4I¤3Oº4B—÷ß4{ßbßZßcß25ßV»ß8ßZ}}{ß1ß33ß3|¦´x´´y´‡º5Aº4Gº4hº59º5Rº5Sº57º58º55º56º54º49º4cº4q¤eº53¤4Mº4A—÷ß4{ßbßZßcß25ßV»ß8ßZ}}{ß1ß3jß3|¦´x´´y´‡¤Hu¤fm¤Lw¤fcºQ¤Vw—÷ß4{ßV»ßbßGßcß25ß8ßG}}{ß1ß3Yß3|¦´x´´y´‡¤By¤i0¤G8ºT¤RQ¤lG¤SE¤o0¤Gw¤p8—÷ß4{ßV»ßbßGßcß25ß8ßG}}{ß1ß3Zß3|¦´x´´y´‡¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤ZUº29—÷ß4{ßV»ßbßGßcß25ß8ßG}}{ß1ß2wß3|¦´x´´y´‡¢-FAº6Rº4Cº4lº4Bº4uº44º4pº4w¢-KAº4xº4Xº4jº4pº6Rº6R—÷ß4{ßbßZßcß4LßV»ß8ßZ}}{ß1ß36ß3|¦´x´´y´‡º6Rº6Rº4Cº4lº4Bº4uº44º4pº4wº6Sº4xº4Xº4jº4pº6Rº6R—÷ß4{ßbßZßcß4Lß8ßZ}}{ß1ß42ß3|¦´x´´y´‡º27¤xqº2A¤yUº28º29—÷ß4{ßbß1Mß8ßFßc¨map_inverse¨ße»¨map_parent¨ß1M}}{ß1ß43ß3|¦´x´´y´‡º22º23º25º26º12º24—÷ß4{ßbß1Mß8ßFßcß63ße»ß64ß1M}}{ß1ß44ß3|¦´x´´y´‡ºb¤xWº2Gº2Hº2F¤zm—÷ß4{ßbß1Nß8ßFßcß63ße»ß64ß1N}}{ß1ß45ß3|¦´x´´y´‡º2Dº2Eº2Cº1tº2Bº1I—÷ß4{ßbß1Nß8ßFßcß63ße»ß64ß1N}}{ß1ß46ß3|¦´x´´y´‡º2O¤w4º2Iº2Nº2Mº1K—÷ß4{ßbß1Oß8ßFßcß63ße»ß64ß1O}}{ß1ß47ß3|¦´x´´y´‡º1Vº23º2Kº2Lº2Iº2J—÷ß4{ßbß1Oß8ßFßcß63ße»ß64ß1O}}{ß1ß48ß3|¦´x´´y´‡º2Mº2Eº2Qº2Rº2Pº23—÷ß4{ßbß1Oß8ßFßcß63ße»ß64ß1O}}{ß1ß49ß3|¦´x´´y´‡º2W¤xqº2Uº2Nº1b¤yU—÷ß4{ßbß1Pß8ßFßcß63ße»ß64ß1P}}{ß1ß4Aß3|¦´x´´y´‡º2Vº23º2Uº24º2Sº2T—÷ß4{ßbß1Pß8ßFßcß63ße»ß64ß1P}}{ß1ß4Iß3|¦´x´´y´‡º1v¤b6º1g¤X4º3L¤X4—÷ß4{ßbß1vß8ßSßcß63ße»ß64ß1v}}{ß1ß4Jß3|¦´x´´y´´z´‡¢28D¢1HSÝ2º6T¢1LUÝ2—{´x´¢24B´y´º6V}{´x´º6W´y´º6U´z´Ý2}÷ß4{ßbß20ß8ßHß3w»}´z´Ý2}{ß1ß4Kß3|¦´x´´y´´z´‡¢21s¢1NpÝ2º6X¢1RrÝ2¢1xqº6ZÝ2º6aº6YÝ2—÷ß4{ßbß20ß8ßHß3w»}´z´Ý2}{ß1ß5fß3|¦´x´´y´‡º41º5Eº3wº5D—÷ß4{ßbß32ßcß4OßV»ß4D»ß8ßZ}}{ß1ß5Jß3|¦´x´´y´‡¤Hkº3q¤Gcº4J—÷ß4{ßbß2dßcß4OßV»ß4D»ß8ßY}}{ß1ß4bß3|¦´x´´y´‡¤-Kº5n¤Aº3n¤xº3v¤1I¢-2u¤yº3l¤K¢-2G¤-K¢-2a—÷ß4{ßbß2Nßcß4Bß8ßC}}{ß1ß4cß3|¦´x´´y´‡¤2G¤5A¤2a¤4W¤3O¤4C¤42¤4q¤42¤5o¤3E¤68¤2Q¤5y—÷ß4{ßbß2Nßcß4Bß8ßC}}{ß1ß4dß3|¦´x´´y´‡º4D¢-18º5Cº2¢-4q¢-1wº54¢-1Sº54¤-oºt¤-U¢-5U¤-e—÷ß4{ßbß2Nßcß4Bß8ßC}}{ß1ß4eß3|¦´x´´y´‡º3n¤5K¢-34¤50º6c¤50¢-1m¤5eº6g¤6cº3l¤5y¢-4B¤6G—÷ß4{ßbß2Nßcß4Bß8ßC}}{ß1ß4fß3|¦´x´´y´‡º6Q¤Uº6P¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßbß2Nßc¨wall_tutorial_rock_breakable¨ß8ßC}}{ß1ß55ß3|¦´x´´y´‡¤Muº6E¤P0º5n¤Pyº3z¤PUºs¤OCº4d¤N4ºs¤MQºt—÷ß4{ßbß2dßcß4Bß8ßY}}{ß1ß56ß3|¦´x´´y´‡¤Caº3o¤Dsº3v¤Egº3z¤Eg¢-5K¤ECºs¤Ckºs¤C6ºt—÷ß4{ßbß2dßcß4Bß8ßY}}{ß1ß57ß3|¦´x´´y´‡¤FAº3o¤Gm¢-3s¤Hkº54¤Huº5C¤Gwº4d¤FUºs¤F0º4b—÷ß4{ßbß2dßcß4Bß8ßY}}{ß1ß58ß3|¦´x´´y´‡¤J2º6p¤Kyº3v¤Lwº6f¤Lmºs¤K0º3q¤Iiºs¤IOº6f—÷ß4{ßbß2dßcß4Bß8ßY}}{ß1ß59ß3|¦´x´´y´‡¤Hkº3q¤JCº3u¤JWº5B¤IY¢-AA¤H6¢-AK¤GIº4L¤Gcº4J—÷ß4{ßbß2dßcß4BßV»ß8ßY}}{ß1ß5Aß3|¦´x´´y´‡¤DEº4u¤Dsº4G¤ECº4o¤EMº4U¤Dsº4a¤D8¢-Gn¤Cuº4R—÷ß4{ßbß2dßcß4Bß8ßY}}{ß1ß5Bß3|¦´x´´y´‡¤KUº4j¤Kyº4o¤Lcº4j¤Lmº4U¤LS¢-Gw¤Koº4E¤KKºz—÷ß4{ßbß2dßcß4Bß8ßY}}{ß1ß5eß3|¦´x´´y´‡º3wº5Dº6hº6H¤Kº3r¤1mº5D¤1Sº5l¤Aº4xº41º5E—÷ß4{ßbß32ßcß4BßV»ß8ßZ}}{ß1ß5mß3|¦´x´´y´‡¢-VIº64¢-V8º4A¢-UKº5Eº6Cº5Pº6Cº3s¢-UUº46¢-Uyº3t—÷ß4{ßbß3Hßcß4Bß8ßa}}{ß1ß5nß3|¦´x´´y´‡¢-OWº6g¢-O2º6d¢-NEº3m¢-Maº6c¢-Mkº41º3j¤-yº5Aº6e—÷ß4{ßbß3Hßcß4Bß8ßa}}{ß1ß5oß3|¦´x´´y´‡¢-TMº41¢-T2º6g¢-SEº6c¢-RQº6k¢-RG¤-y¢-Ru¤-Kº75¤-U—÷ß4{ßbß3Hßcß4Bß8ßa}}{ß1ß5Cß3|¦´x´´y´‡¤Fe¤1m¤Gc¤1w¤HG¤1S¤H6¤U¤GS¤-A¤FK¤-A¤F0¤o—÷ß4{ßbß2dßcß4Bß8ßY}}{ß1ß5Dß3|¦´x´´y´‡¤I4¤1m¤J2¤1m¤JM¤18¤JC¤K¤IY¤-A¤Hk¤A¤Ha¤18—÷ß4{ßbß2dßcß4Bß8ßY}}{ß1ß5Eß3|¦´x´´y´‡¤Jq¤1m¤Ko¤2a¤Lm¤26¤MG¤e¤LS¤A¤KA¤A¤Jg¤e—÷ß4{ßbß2dßcß4Bß8ßY}}{ß1ß5Gß3|¦´x´´y´‡¤MG¤26¤NO¤2u¤P0¤34¤Py¤2Q¤Po¤18ºu¤U¤N4¤e—÷ß4{ßbß2dßcß4Bß8ßY}}{ß1ß5Hß3|¦´x´´y´‡¤QI¤2Q¤R6¤2k¤Ru¤2k¤SO¤1w¤S4¤18¤R6¤o¤QS¤18—÷ß4{ßbß2dßcß4Bß8ßY}}{ß1ß5Iß3|¦´x´´y´‡¤Ss¤1w¤Ue¤2G¤Vw¤18¤Vm¤-K¤UU¤-o¤TM¤-K¤Si¤e—÷ß4{ßbß2dßcß4Bß8ßY}}{ß1ß4Pß3|¦´x´´y´‡¤4X¤-T¤50¤-K¤4jÎ¤50¤-K¤3OÒ—÷ß4{ßbß2Pßcß5RßV»ß8ßC}´z´ÝB}{ß1ß4Qß3|¦´x´´y´‡º3o¤-yº3oº6dº6hº4c¤-Uº3z¤-Uº6g¤1N¢-2L¤1Sº3v¤5Kº6c—÷ß4{ßbß2Pß3u¨enemy_tutorial_bit¨ß3w»ß3xÎß8ßC}}{ß1ß4Rß3|¦´x´´y´‡¢-4W¤5eº3p¤3sºs¤-yº6o¤-Aº6p¤-yº54¤3Eº6E¤4g—÷ß4{ßbß2Pß3uß66ß3w»ß3xÎß8ßC}}{ß1ß4Sß3|¦´x´´y´‡¤9Mº41¤9s¤m—÷ß4{ßV»ß5ß5sßbß2Rß8ßC}}{ß1ß4Tß3|¦´x´´y´‡¤9Mº41¤8q¢-3M—÷ß4{ß5ß5sßbß2RßV»ß8ßC}}{ß1ß4Uß3|¦´x´´y´‡¤8Eº6j¤9C¤o¤AU¤U¤9Wº5n—÷ß4{ßbß2Rßc¨deco¨ß5¨tutorial_door_floor¨ß8ßC}}{ß1ß4Vß3|¦´x´´y´‡¤yº3v¤Aº3n¤-Kº5n¤-Kº6d¤Kº6c¤yº3l¤1Iº6b—÷ß4{ßbß2Wß8ßCßcß63ße»ß64ß2W}}{ß1ß4Wß3|¦´x´´y´‡º54º6hº6fº6gº5Cº2º4Dº6eº6i¤-eºt¤-Uº54¤-o—÷ß4{ßbß2Wß8ßCße»ßcß63ß64ß2W}}{ß1ß4Xß3|¦´x´´y´‡º6k¤5eº6c¤50º6j¤50º3n¤5K¢-3a¤6Aº6b¤6cº6g¤6c—÷ß4{ßbß2Wß8ßCße»ßcß63ß64ß2W}}{ß1ß4Yß3|¦´x´´y´‡¤42¤5o¤42¤4q¤3O¤4C¤2a¤4W¤2G¤5A¤2Q¤5y¤3E¤68—÷ß4{ßbß2Wß8ßCße»ßcß63ß64ß2W}}{ß1ß4Zß3|¦´x´´y´‡º3n¤5Kº6l¤6Gº3y¤6Kº7D¤6A—÷ß4{ßbß2Yß8ßCße»ßcß63ß64ß2Y}}{ß1ß4aß3|¦´x´´y´‡º7D¤6Aº6b¤6cº6g¤6cº3l¤5y—÷ß4{ßbß2Yß8ßCße»ßcßfß64ß2Y}}{ß1ß4hß3|{´x´º4b´y´¤AA}÷ß4{ßbß2Tß3uß5pß3w»ß3xÊß8ßC}}{ß1ß4iß3|{´x´¢-9M´y´¤6w}÷ß4{ßbß2Tß3uß5pß3w»ß3xÊß4D»ß8ßC}}{ß1ß4jß3|{´x´º6H´y´¤AA}÷ß4{ßbß2Tß3uß5pß3w»ß3xÊß4D»ß8ßC}}{ß1ß4nß3|¦´x´´y´‡¤A6¢-9m¤9g¢-9Q¤A5¢-93¤9gº7G¤BM¢-9O—÷ß4{ßbß2eßcß5RßV»ß8ßY}´z´ÝB}{ß1ß4oß3|¦´x´´y´‡¤ER¢-5Z¤E8¢-56¤Dnº7J¤E8º7K¤E8º6P—÷ß4{ßbß2eßc¨icon_tutorial¨ßV»ß8ßY}´z´ÝB}{ß1ß4pß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßbß2eßcß69ßV»ß8ßY}´z´ÝB}{ß1ß5Fß3|{´x´¤Dz´y´¤Y}÷ß4{ßbß2dß3u¨enemy_tutorial_block¨ß3w»ß3xÊß4D»ß8ßY}}{ß1ß5Kß3|¦´x´´y´‡¤Maº6E¤Lwº6E¤LIº5n¤M4¢-4c¤M5º7K¤M1¢-6A¤KKº3q¤NOº3q¤Mgº3p¤M8º7K¤M7º7L—÷ß4{ßbß2bß3uß66ß3w»ß3xÎß8ßY}}{ß1ß5Lß3|¦´x´´y´‡ºQ¤-U¤SO¤y¤RG¤U¤Py¤o¤SYº41¤V8º3m¤Vcº41—÷ß4{ßbß2bß3uß66ß3xÎß3w»ß8ßY}}{ß1ß5Mß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßbß2bß3uß66ß3w»ß3xÎß8ßY}}{ß1ß5Oß3|¦´x´´y´‡¤Ha¤Bm¤EW¤Bc¤C6¤8s¤D4¤1S¤GS¤2Q¤HQ¤1w¤JW¤26¤Ko¤2u¤Lw¤2Q¤K0¤9W—÷ß4{ßbß2bß3uß66ß3x¤Cß3w»ß8ßY}}{ß1ß4lß3|¦´x´´y´‡¤76º3r¤6a¢-7m—÷ß4{ßV»ß5ß5sßbß2eß8ßY}}{ß1ß4mß3|¦´x´´y´‡¤76º3rºm¢-Bu—÷ß4{ßV»ß5ß5sßbß2eß8ßY}}{ß1ß4kß3|¦´x´´y´‡¤6wº6L¤5yº55¤7G¢-7k¤8Eº3t—÷ß4{ßbß2eßcß67ß5ß68ß8ßY}}{ß1ß5Nß3|{´x´¤Hb´y´¢-C3}÷ß4{ßbß2bß3u¨enemy_tutorial_4way¨ß3w»ß3xÊß8ßY}}{ß1ß5Pß3|{´x´¤R6´y´¤5o}÷ß4{ßbß2bß3u¨enemy_tutorial_down¨ß3w»ß3xÊß8ßY}}{ß1ß4qß3|¦´x´´y´‡¤ECºs¤Ckºs¤C6ºt¤Caº3o¤Dsº3v¤Egº3z¤Egº6o—÷ß4{ßbß2pß8ßYßcß63ße»ß64ß2p}}{ß1ß4rß3|¦´x´´y´‡¤Gwº4d¤FUºs¤F0º4b¤FAº3o¤Gmº6p¤Hkº54¤Huº5C—÷ß4{ßbß2pß8ßYßcß63ße»ß64ß2p}}{ß1ß4sß3|¦´x´´y´‡¤K0º3q¤Iiºs¤IOº6f¤J2º6p¤Kyº3v¤Lwº6f¤Lmºs—÷ß4{ßbß2pß8ßYßcß63ße»ß64ß2p}}{ß1ß4tß3|¦´x´´y´‡¤OCº4d¤N4ºs¤MQºt¤Muº6E¤P0º5n¤Pyº3z¤PUºs—÷ß4{ßbß2pß8ßYßcß63ße»ß64ß2p}}{ß1ß4uß3|¦´x´´y´‡¤GS¤-A¤FK¤-A¤F0¤o¤Fe¤1m¤Gc¤1w¤HG¤1S¤H6¤U—÷ß4{ßbß2pß8ßYßcß63ße»ß64ß2p}}{ß1ß4vß3|¦´x´´y´‡¤IY¤-A¤Hk¤A¤Ha¤18¤I4¤1m¤J2¤1m¤JM¤18¤JC¤K—÷ß4{ßbß2pß8ßYßcß63ße»ß64ß2p}}{ß1ß4wß3|¦´x´´y´‡¤KA¤A¤Jg¤e¤Jq¤1m¤Ko¤2a¤Lm¤26¤MG¤e¤LS¤A—÷ß4{ßbß2pß8ßYßcß63ße»ß64ß2p}}{ß1ß4xß3|¦´x´´y´‡¤H6º6r¤GIº4L¤Gcº4J¤Hkº3q¤JCº3u¤JWº5B¤IYº6q—÷ß4{ßbß2pß8ßYßcß63ße»ß64ß2p}}{ß1ß4yß3|¦´x´´y´‡¤D8º6s¤Cuº4R¤DEº4u¤Dsº4G¤ECº4o¤EMº4U¤Dsº4a—÷ß4{ßbß2pß8ßYßcß63ße»ß64ß2p}}{ß1ß4zß3|¦´x´´y´‡¤Koº4E¤KKºz¤KUº4j¤Kyº4o¤Lcº4j¤Lmº4U¤LSº6t—÷ß4{ßbß2pß8ßYßcß63ße»ß64ß2p}}{ß1ß50ß3|¦´x´´y´‡¤EW¤-A¤Di¤-G¤DC¤M¤DL¤17¤E2¤1S¤Ei¤15¤Eu¤U—÷ß4{ßbß2pß8ßYßcß63ße»ß64ß2p¨map_hide_when¨ß2v}}{ß1ß5Qß3|{´x´¤FM´y´¢-7V}÷ß4{ßbß2cß3uß5qß3w»ß3xÊß8ßY}}{ß1ß5Sß3|¦´x´´y´‡¤E6¢-1h¤EBº5M—÷ß4{ßbß2fßcß5RßV»ß8ßY}´z´ÝB}{ß1ß5Tß3|¦´x´´y´‡¤E4¢-1X¤E4º7Z—÷ß4{ßbß2fßcß5RßV»ß8ßY}´z´ÝB}{ß1ß5Uß3|{´x´¤Eg´y´º5Q}÷ß4{ßbß2hß3uß5pß3w»ß3xÊß4D»ß8ßY}}{ß1ß5Yß3|{´x´¤Bw´y´º4p}÷ß4{ßbß2hß3uß5pß3w»ß3xÊß4D»ß8ßY}}{ß1ß5Vß3|¦´x´´y´‡¤Bcº4G¤Gw¢-JC¤Gm¢-L8¤E2º4h¤BSº4y¤9g¢-Ii¤9qº53—÷ß4{ßbß2hßcß4Eß4G£0.BIß8ßY}}{ß1ß5Wß3|¦´x´´y´‡¤D8º6s¤EC¢-FN—÷ß4{ßbß2hßcß4Mß8ßY}}{ß1ß5Zß3|¦´x´´y´‡º47¢-Egº71º6t—÷ß4{ßV»ß5ß5sßbß2xß8ßZ}}{ß1ß5aß3|¦´x´´y´‡¢-LIº6Iº4Xº4q¢-Muº4Eº6Dºz—÷ß4{ßbß2xßcß67ß5ß68ß8ßZ}}{ß1ß5cß3|¦´x´´y´‡º41º5Eº3wº5Dº6hº6H¤Kº3r¤1mº5D¤1Sº5l¤Aº4x—÷ß4{ßbß39ß8ßZßcß63ße»ß64ß39}}{ß1ß5dß3|¦´x´´y´‡º4jº4pº6Rº6Rº4Cº4lº4Bº4uº44º4pº4wº6Sº4xº4X—÷ß4{ßbß3Bß8ßZßcß63ße»ß64ß3B}}{ß1ß5jß3|¦´x´´y´‡º6uº64º6vº4Aº6wº5Eº6Cº5Pº6Cº3sº6xº46º6yº3t—÷ß4{ßbß3Rßcß63ß8ßaß64ß3Rße»}}{ß1ß5kß3|¦´x´´y´‡º74º41º75º6gº76º6cº77º6kº78¤-yº79¤-Kº75¤-U—÷ß4{ßbß3Rßcß63ß8ßaß64ß3Rße»}}{ß1ß5lß3|¦´x´´y´‡º6zº6gº70º6dº71º3mº72º6cº73º41º3j¤-yº5Aº6e—÷ß4{ßbß3Rßcß63ß8ßaß64ß3Rße»}}{ß1ß5tß3|¦´x´´y´‡¤Lw¤fc¤EC¤fw—÷ß4{ßbß3Xßcß4Mß8ßG}}{ß1ß5uß3|¦´x´´y´‡¤HQ¤GI¤E2¤G8—÷ß4{ßbß3Tßcß4Mß8ßG}}{ß1ß5wß3|¦´x´´y´‡¤DE¤gQ¤CQ¤ga¤CG¤hY¤Ck¤iC¤DO¤iW¤E2¤iM¤EW¤hs¤EM¤gu—÷ß4{ßbß3nß8ßGßcß63ße»ß64ß3n}}{ß1ß5xß3|¦´x´´y´‡¤RG¤oUºX¤pS¤Qw¤qa¤S4¤quºQ¤qa¤TC¤pS¤SO¤oe—÷ß4{ßbß3nß8ßGßcß63ße»ß64ß3n}}{ß1ß5yß3|¦´x´´y´‡¤Rk¤rE¤Qw¤ri¤Qw¤sg¤Ra¤tK¤SY¤tAºQ¤sM¤Siºh—÷ß4{ßbß3nß8ßGßcß63ße»ß64ß3n}}{ß1ß5zß3|¦´x´´y´‡¤Ss¤tU¤Ra¤ty¤R6¤v6¤Rk¤wE¤Si¤wY¤Tg¤vk¤Tq¤uS—÷ß4{ßbß3nß8ßGßcß63ße»ß64ß3n}}{ß1ß60ß3|¦´x´´y´‡¤Vg¤jA¤Wu¤jA¤XO¤km¤WA¤km—÷ß4{ßbß3pß8ßGße»ßcßfß64ß3p}}{ß1ß51ß3|¦´x´´y´‡¤Gh¢-43¤G8º3l¤FPº3z—÷ß4{ßbß2aßcß62ß8ßY}}{ß1ß52ß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Keº2—÷ß4{ßbß2aßcß62ß8ßY}}{ß1ß53ß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Oj¢-5p¤P3¢-5i¤Td¢-67¤PE¢-4S¤OX¢-3f¤OCº41¤N9º3v—÷ß4{ßbß2aßcß62ß8ßY}}{ß1ß54ß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßbß2aßcß62ß8ßY}}{ß1ß4gß3|¦´x´´y´‡º6l¤6Gº3q¤42º3r¤50º7r¤83º3t¤BIº3u¤D4º3v¤B8º6O¤7A—÷ß4{ßV»ßbß2Tßcß25ß8ßC}}{ß1ß5Xß3|¦´x´´y´‡¤Gmº4F¤Gcº4X¤E2º4W¤Bcº49¤A0º4V¤AAº4U¤Bwº4G—÷ß4{ßV»ßbß2hßcß25ß8ßY}}÷¨icons¨|÷}");
