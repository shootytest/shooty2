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
export const TEST_MAP = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢44u´y´¢1HW}÷¨options¨{¨style¨ß2¨contains¨|¨home main¨¨home inventory¨¨home shapestore¨÷¨room_id¨´´}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ßB¨room_connections¨|¨tutorial room 1¨÷¨is_room¨»ßA´´}}{ß1¨station¨ß3|{´x´¢1RC´y´¢1NU}÷ß4{ßC|¨station tutorial¨¨station streets¨¨tutorial room 5¨¨streets side room 1¨¨station home¨÷ß6|¨train¨ßG¨station tracks¨ßH¨station tracks particle¨¨station map train¨¨station map tracks 1¨¨station map tracks 2¨¨station map tracks 3¨¨station map tracks 4¨ßK÷ßA´´ßE»}}{ß1¨streets¨ß3|{´x´¢1f4´y´¢-D4}÷ß4{ßA´´ß6|¨streets room 1¨ßJ¨streets room 2¨÷}´z´£0.-84}{ß1¨tutorial¨ß3|{´x´¢-WG´y´º8}÷ß4{ß6|ßD¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨ßI÷ßA´´}}{ß1ß8ß3|{´x´¢3kk´y´¢HQ}÷ß4{ß5ß2ßA´´ßE»¨parent¨ß2ßC|ß7÷ß6|¨home inventory wall¨÷}}{ß1ß7ß3|{´x´¢3uQ´y´¢mE}÷ß4{ß5ß2ßA´´ßE»ßaß2ßC|ß8ßKß9÷ß6|¨home floor¨÷}}{ß1ß9ß3|{´x´¢4Ja´y´¢FA}÷ß4{ß5ß2ßA´´ßE»ßaß2ßC|ß7÷ß6|¨home shapestore wall¨¨home shapestore window¨÷}}{ß1ßKß3|{´x´¢3Zc´y´¢1BY}÷ß4{ßaßFßAßFßE»ßC|ßFßHß7÷ß6|¨station home wall 2¨¨station home wall 1¨¨station home floor¨÷}}{ß1ßPß3|¦´x´´y´‡¢T2¢12WºH¢13K¢mOºJºKºI—÷ß4{ßaßFßAßF¨is_map¨»¨make_id¨¨map_shape¨}}{ß1ßQß3|¦´x´´y´‡ºKºIºKºJ¢1L4ºJºLºI—÷ß4{ßaßFßAßFßi»ßjßk}}{ß1ßRß3|¦´x´´y´‡ºLºIºLºJ¢1vMºJºMºI—÷ß4{ßaßFßAßFßi»ßjßk}}{ß1ßSß3|¦´x´´y´‡ºMºIºMºJ¢29sºJºNºI—÷ß4{ßaßFßAßFßi»ßjßk}}{ß1ßOß3|¦´x´´y´‡¢Qc¢10uºO¢14w¢YgºQºRºP—÷ß4{ßaßFßAßFßi»ßjßk}}{ß1ßHß3|{´x´¢1dc´y´¢12g}÷ß4{ßaßFß6|¨station streets rock 1¨¨station streets rock 2¨¨station streets rock 3¨¨station streets sensor start¨¨station streets rock 0¨¨station streets sensor end¨¨station streets rock block¨¨station streets rock 4¨¨station streets rock 5¨¨station streets rock 6¨¨station streets rock 7¨¨station streets rock 8¨¨station streets floor 1¨¨station streets floor 1.5¨¨station streets floor 2¨¨station streets floor 2.5¨¨station streets floor 3¨¨station streets floor 3.5¨¨station streets wall 1¨¨station streets wall 2¨¨station streets wall 3¨¨station streets floor 0¨¨station streets floor 4¨¨station streets floor 5¨¨station streets floor 4.5¨¨station streets wall 5¨¨station streets wall 6¨¨station streets wall 7¨¨station streets wall 8¨¨station streets wall 9¨¨station streets wall 10¨¨station streets wall 11¨¨station streets wall 13¨¨station streets rocky 1¨¨station streets wall fake 1¨¨station streets wall 14¨¨station streets floor 4.1¨¨station streets wall 12¨¨station streets breakables 1¨¨station streets breakables 2¨¨station streets breakables 2.5¨¨station streets map shape 1¨¨station streets map shape 2¨¨station streets map shape 3¨¨station streets map shape 4¨¨station streets map shape 5¨¨station streets map shape 6¨¨station streets map shape 7¨÷ßAßFßE»ßC|ßFßUßJßGßK÷}´z´£0.-3E}{ß1ßMß3|¦´x´´y´‡ºHºI¢3U8ºIºUºJºHºJ—÷ß4{ßaßFßj¨floor_train_track¨ßAßF¨sensor_dont_set_room¨»}}{ß1ßNß3|¦´x´´y´‡ºHºIºHºJ—÷ß4{ßaßFßjß1XßAßFß1Y»}}{ß1ßGß3|{´x´¢VS´y´¢yA}÷ß4{ßaßFß6|¨station tutorial floor¨¨station tutorial sensor start¨¨station tutorial wall 1¨¨station tutorial wall 2¨¨station tutorial rock 1¨¨station tutorial rock 2¨¨station tutorial rock 3¨¨tutorial floor low¨¨station tutorial sensor end¨¨station tutorial map shape 1¨¨station tutorial map shape 2¨¨station tutorial map shape 3¨÷ßAßFßE»ßC|ßIßFßH÷}}{ß1ßUß3|{´x´¢1zO´y´¢rO}÷ß4{ßaßTßA´´ßE»ßC|ßHßV÷ß6|¨streets room 1 wall 2¨¨streets room 1 wall 1¨¨streets room 1 camera 1¨¨streets room 1 sensor start¨¨streets room 1 camera 2¨¨streets room 1 camera 0¨¨streets room 1 floor¨¨streets room 1 sensor end¨¨streets room 1 camera 3¨¨streets room 1 map shape 1¨÷}´z´Ý0}{ß1ßVß3|{´x´¢1w0´y´¢f8}÷ß4{ßaßTßA´´ßE»ßC|ßU÷ß6|¨streets room 2 rock¨¨streets room 2 sensor start¨¨streets room 2 floor¨¨home wow test wow¨¨streets room 2 map shape 1¨÷}´z´Ý0}{ß1ßJß3|{´x´¢1wo´y´¢1C2}÷ß4{ßaßTßA´´ßE»ßC|ßHßF÷ß6|¨streets side room 1 floor¨¨streets side room 1 wall 1¨¨streets side room 1 wall 2¨¨streets side room 1 wall fake 1¨¨streets side room 1 test¨¨streets side room 1 window 1¨¨streets side room 1 map shape 1¨¨streets side room 1 map shape 2¨¨streets side room 1 map shape 3¨÷}´z´£0.-6S}{ß1ßLß3|¦´x´´y´‡ºOºP¢TRºP—{´x´ºd´y´ºP´z´£0.4q}{´x´¢Vr´y´ºP´z´Ý3}{´x´ºe´y´ºP}{´x´ºR´y´ºP}{´x´ºR´y´ºP´z´£0.84}{´x´ºO´y´ºP´z´Ý4}÷ß4{ßaßFßj¨wall_train¨ß6|¨train floor broken¨¨train wall 1¨¨train wall 2¨¨train wall 3¨¨train ceiling¨¨train sensor¨¨train door right¨¨train door right path¨¨train door left¨¨train door left path¨¨train floor¨¨train floor broken top¨¨train floor broken bottom¨¨train floor broken middle¨÷¨seethrough¨»ßAßF}}{ß1ßDß3|{´x´¢-68´y´¢-50}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨¨tutorial room 1 floor¨¨tutorial room 1 map shape 1¨¨tutorial room 1 map shape 2¨¨tutorial room 1 map shape 3¨÷ßaßWßE»ßC|ßXßZßBßY÷ßA´´}}{ß1ßXß3|{´x´¢OW´y´¢-DO}÷ß4{ßaßWß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨tutorial room 2 floor¨¨tutorial room 2 floor platform¨¨tutorial room 2 map shape 1¨¨tutorial room 2 map shape 2¨¨tutorial room 2 map shape 3¨¨tutorial room 2 map shape 4¨¨tutorial room 2 map shape 5¨¨tutorial room 2 map shape 6¨¨tutorial room 2 map shape 7¨÷ßE»ßC|ßIßDßY÷ßA´´}}{ß1ßYß3|{´x´¢-JM´y´¢-Tg}÷ß4{ßaßWß6|¨tutorial window 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨¨tutorial room 3 floor¨¨tutorial room 3 enemy 1¨¨tutorial room 3 map shape 1¨¨tutorial room 3 map shape 2¨¨tutorial room 3 map shape 3¨¨tutorial room 3 map shape 4¨¨tutorial room 3 map shape 5¨÷ßE»ßC|ßYßZßXßD÷ßA´´}}{ß1ßZß3|{´x´¢-Z0´y´¢-Gc}÷ß4{ßaßWß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨¨tutorial room 4 floor¨¨tutorial room 4 map shape 1¨÷ßE»ßC|ßYßD÷ßA´´}}{ß1ßIß3|{´x´¢9t´y´¢GK}÷ß4{ßaßWß6|¨tutorial room 5 sensor boss¨¨tutorial room 5 door start¨¨tutorial room 5 sensor boss start¨¨tutorial room 5 boss¨¨tutorial room 5 floor¨¨tutorial room 5 door end¨¨tutorial wall 15¨¨tutorial wall 16¨¨tutorial rock 23¨¨tutorial room 5 enemy¨¨tutorial rock 24¨¨tutorial rock 25¨¨tutorial rock 26¨¨tutorial rock 27¨¨tutorial room 5 switch path¨¨tutorial room 5 sensor middle¨¨tutorial room 5 sensor boss end¨¨tutorial wall 14¨¨tutorial room 5 rocky 3¨¨tutorial fake wall 5¨¨tutorial room 5 map shape 1¨¨tutorial room 5 map shape 2¨¨tutorial room 5 map shape 3¨¨tutorial room 5 map shape 4¨¨tutorial room 5 map shape 5¨¨tutorial room 5 map shape 6¨¨tutorial room 5 map shape 7¨¨tutorial room 5 map shape 8¨÷ßE»ßC|ßXßGßF÷ßA´´}}{ß1ßcß3|¦´x´´y´‡¢4S8¢9M¢4FE¢-U¢3tS¢-2Q¢3e8¢3Y¢3Te¢Eq¢3QQ¤RaºU¤gu¢3jm¤oK¢438¤pw¢4Q2¤hs¢4XI¤OM—÷ß4{ßaß7ßj¨floor¨ßAß7}}{ß1ßbß3|¦´x´´y´‡¢3tI¤H6¢3sK¤DE¢3oI¤AU¢3jI¤9q¢3ec¤Bm¢3cW¤Gc¢3dA¤Lc¢3hqºh¢3ne¤OM¢3rg¤Lmº14¤H6—÷ß4{ßaß8ßj¨wall¨ßAß8¨open_loop¨»}}{ß1ßdß3|¦´x´´y´‡¢4Tuºyºpºq¢4NI¤5e¢4GC¤5y¢4B2ºq¢488¤F0¢49a¤KU¢4Eu¤OC¢4M0¤Og¢4Ro¤Lcº1Eºy—÷ß4{ßaß9ßjß3xßAß9ß3y»}}{ß1ßeß3|¦´x´´y´‡¢4Ac¤AA¢4HA¤Cu¢4My¤CQ¢4SI¤9qºpºqº1F¤5eº1G¤5yº1Hºqº1N¤AA—÷ß4{ßaß9ßj¨wall_window¨ßAß9ß3y»}}{ß1ß1yß3|{´x´¢28G´y´¤Qw}÷ß4{ßaßV¨spawn_enemy¨¨checkpoint¨¨is_spawner¨»¨spawn_repeat¨ÊßAßV}´z´Ý0}{ß1ßhß3|¦´x´´y´‡¢3no¤uS¢3Qu¤uS¢3Pc¤yUº1U¢17M¢3p6º1Vº1W¤yU—÷ß4{ßaßKßjß3wßAßK}}{ß1ßgß3|¦´x´´y´‡¢3h2¤yUº1T¤yUº1T¢106—÷ß4{ßaßKßjß3xßAßKß3y»}}{ß1ßfß3|¦´x´´y´‡º1T¢15kº1Tº1Vº1Xº1V—÷ß4{ßaßKßjß3xßAßKß3y»}}{ß1ß1Nß3|¦´x´´y´‡¢1Viºc¢1VE¢14c¢1RMº1Vº1d¤wY¢1cA¤sC¢1aE¤xM¢1VY¤yK¢1ZG¢114—÷ß4{ßaßHß40¨enemy_streets_bit¨ß43¤Kß42»ßAßH}´z´£0.-1c}{ß1ß1Oß3|{´x´¢1jG´y´¤vu´z´Ý1}{´x´¢1bM´y´¤ws}{´x´¢1co´y´¤s2}÷ß4{ßaßHß40ß44ß43Íß42»ßAßH}´z´Ý1}{ß1ß1Pß3|{´x´¢1fi´y´¢1CM´z´Ý1}{´x´¢1aO´y´¢1Cg}{´x´ºS´y´¢15a´z´Ý1}{´x´¢1bg´y´¢10k}{´x´¢1ic´y´¤zS}÷ß4{ßaßHß40ß44ß43Ðß42»ßAßH}´z´Ý1}{ß1ß16ß3|¦´x´´y´‡¢1Qi¤vuº1u¢1Aa¢1RWº1vº1w¤vu—÷ß4{ßaßHßjß3wßAßH}´z´Ý5}{ß1ßxß3|¦´x´´y´‡¢1Qs¤wOº1x¢18y¢1Uk¢1Fk¢1dI¤pc—÷ß4{ßaßHßjß3wßAßH¨safe_floor¨»ß5¨wall_floor¨}´z´Ý5}{ß1ßyß3|¦´x´´y´‡º21¤pcº1zº20—{´x´º1z´y´º20´z´Ý1}{´x´º21´y´¤pc´z´Ý1}÷ß4{ßaßHßjß46ßAßH}´z´Ý5}{ß1ßzß3|¦´x´´y´‡º21¤pcº1zº20¢1fOº20¢1ks¤pc—÷ß4{ßaßHßjß3wßAßHß45»ß5ß46}´z´Ý1}{ß1ß10ß3|¦´x´´y´‡º23¤pcº22º20—{´x´º22´y´º20´z´£0.-4q}{´x´º23´y´¤pc´z´Ý6}÷ß4{ßaßHßjß46ßAßH}´z´Ý1}{ß1ß11ß3|¦´x´´y´‡º23¤pcº22º20¢1xI¢1DK¢1us¤ri—÷ß4{ßaßHßjß3wßAßHß45»ß5ß46}´z´Ý6}{ß1ß12ß3|¦´x´´y´‡º26¤riº24º25—{´x´º24´y´º25´z´Ý2}{´x´º26´y´¤ri´z´Ý2}÷ß4{ßaßHßjß46ßAßH}´z´Ý6}{ß1ß17ß3|¦´x´´y´‡º26¤riº24º25—{´x´¢20g´y´¢1Ak´z´Ý2}{´x´¢21o´y´º1v´z´Ý2}{´x´¢202´y´¢1DU}{´x´¢27S´y´¢1De´z´Ý2}{´x´¢23u´y´¤uw}÷ß4{ßaßHßjß3wßAßHß45»}´z´Ý2}{ß1ß1Lß3|{´x´º2E´y´¤uw´z´Ý2}{´x´º2C´y´º2D}÷ß4{ßaßHßj¨wall_floor_halfwidth¨ßAßH}´z´Ý2}{ß1ß19ß3|¦´x´´y´‡º2E¤uwº2Cº2D—{´x´º2C´y´º2D´z´Ý0}{´x´º2E´y´¤uw´z´Ý0}÷ß4{ßaßHßjß46ßAßH}´z´Ý2}{ß1ß18ß3|{´x´º2E´y´¤uw´z´Ý0}{´x´º2C´y´º2D}{´x´¢2LA´y´¢12v´z´Ý0}{´x´¢294´y´¤uw}÷ß4{ßaßHßjß3wßAßHß45»}´z´Ý0}{ß1ß1Qß3|¦´x´´y´‡º1uº1yº1gº25¢1ce¤rYº1u¤wO—÷ß4{ßaßHßAßHßi»ßjßkß6|¨station streets map rock 1¨¨station streets map rock 2¨÷}}{ß1ß1Rß3|¦´x´´y´‡º1gº25¢1g2º1p¢1ja¤vkº2I¤rY—÷ß4{ßaßHßAßHßi»ßjßkß6|¨station streets map rock 3¨¨station streets map rock 4¨¨station streets map line 1¨÷}}{ß1ß1Sß3|¦´x´´y´‡º2Jº1p¢1oQ¢1Au¢1wyº1vºM¤w4¢1pi¤tUº2K¤vk—÷ß4{ßaßHßAßHßi»ßjßkß6|¨station streets map rock 5¨¨station streets map rock 6¨¨station streets map rock 7¨¨station streets map line 2¨÷}}{ß1ß1Tß3|¦´x´´y´‡º2Nº1v¢26o¢1AGº2E¤uwºM¤w4—÷ß4{ßaßHßAßHßi»ßjßkß6|¨station streets map rock 8¨¨station streets map rock 9¨¨station streets map line 3¨÷}}{ß1ß1Uß3|¦´x´´y´‡º2Pº2QºN¢19mºN¤zI¢2D6º1sº2S¤zIºN¤w4º2H¤uwº2C¤um¢25q¤umº2E¤uw—÷ß4{ßaßHßAßHßi»ßjßkß6|¨station streets map line 4¨÷}}{ß1ß1Vß3|¦´x´´y´‡ºNº2Rº2S¢16Yº2S¢156ºNº2U—÷ß4{ßaßHßAßHßi»ßjßk}}{ß1ß1Wß3|¦´x´´y´‡¢1ys¢10L¢21e¤yW¢1xy¤xw—÷ß4{ßaßHßAßHßi»ßjßk¨force_layer¨Ê}}{ß1ßpß3|¦´x´´y´‡¢1Uu¢15Qº1b¢19S¢1SU¢172—÷ß4{ßaßHßj¨rock¨ßAßH}´z´Ý5}{ß1ßlß3|¦´x´´y´‡¢1ZQ¤xq¢1YSº1Y—{´x´¢1WM´y´¤yU´z´Ý5}÷ß4{ßaßHßjß4MßAßH}´z´Ý5}{ß1ßmß3|¦´x´´y´‡¢1d8º1q¢1b2º2R—{´x´¢1Ym´y´¢15G´z´Ý1}÷ß4{ßaßHßjß4MßAßH}´z´Ý1}{ß1ßnß3|¦´x´´y´‡¢1fY¤zm¢1cK¢10GºS¤xW—÷ß4{ßaßHßjß4MßAßH}´z´Ý1}{ß1ßsß3|¦´x´´y´‡¢1nI¢16s¢1im¢19cº23º2b—÷ß4{ßaßHßjß4MßAßH}´z´Ý6}{ß1ßtß3|¦´x´´y´‡¢1scº1sº2p¢10Q¢1qW¤w4—÷ß4{ßaßHßjß4MßAßH}´z´Ý6}{ß1ßuß3|¦´x´´y´‡¢1uEº2b¢1tQ¢16iº2tº2l—÷ß4{ßaßHßjß4MßAßH}´z´Ý6}{ß1ßvß3|¦´x´´y´‡¢244¢1A6¢1yuº2c¢22Iº2b—÷ß4{ßaßHßjß4MßAßH}´z´Ý2}{ß1ßwß3|{´x´¢1xw´y´¤xq}{´x´º29´y´¤yU´z´Ý2}{´x´º31´y´º2u}÷ß4{ßaßHßjß4MßAßHß3y»}´z´Ý2}{ß1ßrß3|¦´x´´y´‡¢2Hwº2GºNº2UºN¤zI—÷ß4{ßaßHßjß4MßAßH}´z´Ý0}{ß1ß1Iß3|{´x´¢2CN´y´¢169}÷ß4{ßaßHß40¨enemy_streets_rocky_small¨ß42»ß43ÊßAßH¨spawn_permanent¨»}´z´Ý0}{ß1ßqß3|¦´x´´y´‡¢2Ei¤vGº37¢1CC¢1mUº38º39¤vG—÷ß4{ßaßHßj¨sensor¨ßAßH}´z´Ý0}{ß1ßoß3|¦´x´´y´‡¢1Ty¤v5¢1UGº25º1uº38º1x¤vG—÷ß4{ßaßHßjß4PßAßH}}{ß1ß13ß3|¦´x´´y´‡º2E¤uwºM¤w4—÷ß4{ß3y»ßaßHßjß3xßAßH}´z´Ý2}{ß1ß14ß3|{´x´º2I´y´¤rY}{´x´º1u´y´¤wO´z´Ý5}{´x´º1u´y´ºP}÷ß4{ß3y»ßaßHßjß3xßAßH}´z´Ý5}{ß1ß15ß3|¦´x´´y´‡º2K¤vkº2I¤rY—÷ß4{ß3y»ßaßHßjß3xßAßH}´z´Ý1}{ß1ß1Aß3|¦´x´´y´‡º1gº25º1uº1y—{´x´º1u´y´ºQ´z´Ý5}÷ß4{ß3y»ßaßHßjß3xßAßH}´z´Ý5}{ß1ß1Bß3|¦´x´´y´‡º2Jº1pº1gº25—÷ß4{ß3y»ßaßHßjß3xßAßH}´z´Ý1}{ß1ß1Cß3|{´x´º2N´y´º1v´z´Ý6}{´x´º2L´y´º2M}{´x´º2J´y´º1p}÷ß4{ß3y»ßaßHßjß3xßAßH}´z´Ý6}{ß1ß1Dß3|¦´x´´y´‡ºM¤w4º2O¤tUº2K¤vk—÷ß4{ß3y»ßaßHßjß3xßAßH}´z´Ý6}{ß1ß1Eß3|¦´x´´y´‡º1uºQº1uº1y—÷ß4{ß3y»ßaßHßjß3xßAßH}´z´Ý0}{ß1ß1Fß3|{´x´º1u´y´¤wO´z´Ý0}{´x´º1u´y´ºP}÷ß4{ß3y»ßaßHßjß3xßAßH}´z´Ý0}{ß1ß1Gß3|¦´x´´y´´z´‡º2Pº2QÝ2º29¢1AQÝ2¢1ya¢1FQÝ2—÷ß4{ß3y»ßaßHßjß3xßAßH}´z´Ý2}{ß1ß1Mß3|¦´x´´y´‡¢1weº3E¢1zsº2Mº2Nº1v—÷ß4{ß3y»ßaßHßjß3xßAßH}´z´Ý2}{ß1ß1Hß3|¦´x´´y´‡º2Sº2Vº2Sº2UºNº2Rº2Pº2Q—÷ß4{ß3y»ßaßHßjß3xßAßH}´z´Ý0}{ß1ß1Kß3|¦´x´´y´‡º2C¤umº2H¤uwºN¤w4—{´x´º2S´y´¤zI´z´Ý0}{´x´º2S´y´º1s}÷ß4{ß3y»ßaßHßjß3xßAßH}´z´Ý0}{ß1ß1Jß3|{´x´º33´y´¤xq}{´x´º31´y´º2u´z´Ý2}÷ß4{ßaßHßj¨wall_streets_fake¨ß3y»ß4O»ßAßH}´z´Ý2}{ß1ß1Zß3|¦´x´´y´‡¤am¤w4¤YM¤o0¤X4¤o0¤Y2¤rE¤Fo¤s2¤Gw¤yy¤Gwº1VºVº1VºV¢18e¤X4º3H¤X4º1V¤amº1V¤am¢130—÷ß4{ßaßGßjß3wß45»ßAßG}}{ß1ß1iß3|¦´x´´y´‡¤ZU¤w4¤RG¤w4¤Gw¤yy¤Gwº1V¤ZUº1V—÷ß4{ßaßGßAßGßi»ßjßk}}{ß1ß1jß3|¦´x´´y´‡¤ZYº1Z¤ZUº1Z¤ZUº1Y¤ZYº1Y¤ZY¤w4¤am¤w4¤amº1V¤ZYº1V—÷ß4{ßaßGßAßGßi»ßjßk}}{ß1ß1kß3|¦´x´´y´‡ºV¢17QºVº3H¤X4º3H¤X4º3J—÷ß4{ßaßGßAßGßi»ßjßk}}{ß1ß1dß3|¦´x´´y´‡¢14S¤tAº2e¤uw¢17g¤y0º2Vº2u¢11s¤zmº2o¤xC¢11O¤uI—÷ß4{ßaßGßjß4MßAßG}´z´Ý0}{ß1ß1eß3|¦´x´´y´‡¢1Emº2b¢1GO¢164¢1Giº3Lº20¢19I¢1Dy¢198¢1Cqº3Lº25º3Q—÷ß4{ßaßGßjß4MßAßG}´z´Ý0}{ß1ß1fß3|¦´x´´y´‡¢1K6¤xM¢1LE¤xq¢1LY¤yy¢1Kkº2u¢1J8º1Y¢1IK¤yo¢1Iy¤xg—÷ß4{ßaßGßjß4MßAßG}´z´Ý0}{ß1ß1hß3|¦´x´´y´‡º5¤vGº5º38¢1PQº38º3d¤vG—÷ß4{ßaßGßjß4PßAßG}}{ß1ß1aß3|¦´x´´y´‡ºH¤wY¤KK¤yy¤KKº2oºHº2o¤Ue¤zm¤WGº2o¤ZU¤wY—÷ß4{ßaßGßjß4P¨sensor_fov_mult¨ÊßAßG}}{ß1ß1bß3|¦´x´´y´‡¤RG¤w4¤Op¤wi—÷ß4{ß3y»ßaßGßjß3xßAßG}}{ß1ß1cß3|¦´x´´y´‡¤Mk¤xM¤Gw¤yy¤Gwº1V¤ZUº1V¤ZUº1Z—÷ß4{ß3y»ßaßGßjß3xßAßG}}{ß1ß1qß3|{´x´¢2CI´y´¤zS}÷ß4{ßaßUß40¨enemy_streets_camera_small¨ß42»ß43ÊßAßU}´z´Ý0}{ß1ß1nß3|{´x´¢24O´y´¤to}÷ß4{ßaßUß40ß4Sß42»ß43ÊßAßU}´z´Ý0}{ß1ß1pß3|{´x´¢27I´y´ºC}÷ß4{ßaßUß40ß4Sß42»ß43ÊßAßU}´z´Ý0}{ß1ß1tß3|{´x´¢252´y´¤fw}÷ß4{ßaßUß40ß4Sß42»ß43ÊßAßU}´z´Ý0}{ß1ß1rß3|¦´x´´y´‡º2E¤uw¢29O¤v6—{´x´º2C´y´¤nC´z´Ý0}{´x´¢2A2´y´¤iM}{´x´¢25C´y´¤iM}{´x´º32´y´¤nC}÷ß4{ßaßUßjß3wßAßUß45»}´z´Ý0}{ß1ß1uß3|¦´x´´y´‡º2T¤umº2C¤um¢28u¤uSº2C¤nCº3j¤iMº1R¤eK¢23Q¤eKº3k¤iMº32¤nC¢23k¤uS—÷ß4{ßaßUßAßUßi»ßjßk}}{ß1ß1sß3|{´x´¢22w´y´¤fS}{´x´º3o´y´¤ee´z´Ý0}{´x´º3i´y´¤ee´z´Ý0}{´x´º3i´y´¤fS}÷ß4{ßaßUßjß4PßAßUß4R£0.Cu}´z´Ý0}{ß1ß1oß3|{´x´º3m´y´¤te}{´x´º3m´y´¤sq´z´Ý0}{´x´ºN´y´¤sq´z´Ý0}{´x´ºN´y´¤te}÷ß4{ßaßUßjß4PßAßUß4RÝ7}´z´Ý0}{ß1ß1mß3|¦´x´´y´‡º1R¤Hkº3D¤Wkº3m¤eK—{´x´º3k´y´¤iM´z´Ý0}{´x´º32´y´¤nC}{´x´º2E´y´¤uw}{´x´º2T´y´¤um´z´Ý0}{´x´º3n´y´¤uS}÷ß4{ß3y»ßaßUßjß3xßAßU}´z´Ý0}{ß1ß1lß3|¦´x´´y´‡º1R¤Hkº34¤Wkº1R¤eKº3j¤iMº2C¤nCº3l¤uSº2C¤um—÷ß4{ß3y»ßaßUßjß3xßAßU}´z´Ý0}{ß1ß1xß3|¦´x´´y´´z´‡¢1s8¤gkÝ0º3k¤iMÝ0—{´x´º3j´y´¤iM}{´x´¢2OO´y´¤gk}{´x´º1R´y´¤Hk}÷ß4{ßaßVßjß3wßAßVß45»}´z´Ý0}{ß1ß1zß3|¦´x´´y´‡º1R¤eKº3m¤eKº3D¤Wkº1R¤Hkº34¤Wk—÷ß4{ßaßVßAßVßi»ßjßkß6|¨streets room 2 map rock 1¨÷}}{ß1ß1vß3|¦´x´´y´‡¢2B0¤X4º2E¤X4—{´x´º2T´y´¤b6´z´Ý0}÷ß4{ßaßVßjß4MßAßV}´z´Ý0}{ß1ß1wß3|{´x´¢1xm´y´¤X4}{´x´º3s´y´¤WG´z´Ý0}{´x´¢2Ik´y´¤WG´z´Ý0}{´x´º3t´y´¤X4}÷ß4{ßaßVßjß4PßAßVß4R£1.1c}´z´Ý0}{ß1ß20ß3|{´x´º3G´y´º2M}{´x´º29´y´º3C´z´Ý2}{´x´º2C´y´º2D´z´Ý2}{´x´º3l´y´¢1FG}{´x´º3l´y´¢1T8´z´Ý2}{´x´º3F´y´º3v}{´x´º3F´y´º3E}÷ß4{ßaßJßjß3wßAßJß45»}´z´Ý2}{ß1ß26ß3|¦´x´´y´‡º3Gº2Mº3Fº3Eº3Dº3Eº29º3Cº2Nº1v—÷ß4{ßaßJßAßJßi»ßjßk}}{ß1ß27ß3|¦´x´´y´‡¢21Aº1uº1Rº1uº1Rº3Pº3Dº3Eº3Fº3E—÷ß4{ßaßJßAßJßi»ßjßk}}{ß1ß28ß3|¦´x´´y´‡¢210º2D¢22Sº28¢26eº1v¢27cº3E¢26K¢1F6º2Tº3V¢22c¢1DAº3z¢1Faº3z¢1GEº3h¢1G4—÷ß4{ßaßJßAßJßi»ßjßk}}{ß1ß24ß3|{´x´¢20M´y´º3a´z´Ý2}÷ß4{ßaßJßAßJß42»ß6|¨streets side room 1 test 0¨¨streets side room 1 test 1¨÷}´z´Ý2}{ß1ß21ß3|¦´x´´y´‡º3wº1uº3Fº3E—÷ß4{ß3y»ßaßJßjß3xßAßJ}´z´Ý2}{ß1ß22ß3|¦´x´´y´´z´‡º3Dº3EÝ2º3hº47Ý2—{´x´º3x´y´º2D}{´x´º3y´y´º28}{´x´º3z´y´º1v}{´x´º40´y´º3E}{´x´º41´y´º42}{´x´º2T´y´º3V}{´x´º43´y´º44´z´Ý2}{´x´º3z´y´º45}{´x´º3z´y´º46}{´x´º1R´y´º3P}÷ß4{ß3y»ßaßJßjß3xßAßJ}´z´Ý2}{ß1ß23ß3|{´x´º3h´y´º47}{´x´º3z´y´º46´z´Ý2}÷ß4{ßaßJßjß4Qß3y»ß4O»ßAßJ}´z´Ý2}{ß1ß25ß3|¦´x´´y´´z´‡º3w¢1LsÝ2º3Dº3EÝ2—÷ß4{ß3y»ßaßJßjß3zßAßJ}´z´Ý2}{ß1ß2Eß3|¦´x´´y´‡ºRºPºOºPºOºQºRºQ—÷ß4{ßaßLßjß29ß3w»ßAßFß1Y»}´z´Ý4}{ß1ß2Iß3|¦´x´´y´‡¤SEºPºdºP—{´x´ºd´y´ºP´z´Ý3}{´x´¤SE´y´ºP´z´Ý3}÷ß4{ßaßLßjß29ßAßF}}{ß1ß2Jß3|¦´x´´y´‡ºdºP¤UeºP—÷ß4{ßaßLßj¨sensor_path¨ßAßF}}{ß1ß2Gß3|¦´x´´y´‡ºeºP¤X4ºP—{´x´¤X4´y´ºP´z´Ý3}{´x´ºe´y´ºP´z´Ý3}÷ß4{ßaßLßjß29ßAßF}}{ß1ß2Hß3|¦´x´´y´‡ºeºP¤UeºP—÷ß4{ßaßLßjß4WßAßF}}{ß1ß2Kß3|¦´x´´y´‡ºRºPºOºPºOºQºRºQ—÷ß4{ßaßLßj¨floor_train¨ßAßFß1Y»}}{ß1ß2Aß3|¦´x´´y´‡ºRºP¤SEºP¤Ru¢122¤SE¢13U¤SEºQºRºQ—÷ß4{ßaßLßjß4XßAßFß1Y»}}{ß1ß2Mß3|¦´x´´y´‡ºOºQ¤SEºQ¤SEº4BºO¢13A—÷ß4{ßaßLßjß4XßAßFß1Y»}}{ß1ß2Nß3|¦´x´´y´‡ºOº4C¤SEº4B¤Ruº4AºOºI—÷ß4{ßaßLßjß4XßAßFß1Y»}}{ß1ß2Lß3|¦´x´´y´‡ºOºI¤Ruº4A¤SEºPºOºP—÷ß4{ßaßLßjß4XßAßFß1Y»}}{ß1ß2Fß3|¦´x´´y´‡¤Qmº1i¤Qm¢14m¤YWº4D¤YWº1i—÷ß4{ßaßLßjß4PßAßFß1Y»}}{ß1ß2Bß3|{´x´ºR´y´ºP}{´x´ºR´y´ºP´z´Ý4}{´x´ºR´y´ºQ´z´Ý4}{´x´ºR´y´ºQ}÷ß4{ßaßLßjß29ßAßF}}{ß1ß2Cß3|{´x´ºO´y´ºP}{´x´ºO´y´ºP´z´Ý4}{´x´ºO´y´ºQ´z´Ý4}{´x´ºO´y´ºQ}÷ß4{ßaßLßjß29ßAßF}}{ß1ß2Dß3|¦´x´´y´‡ºOºQºRºQ—{´x´ºR´y´ºQ´z´Ý4}{´x´ºO´y´ºQ´z´Ý4}÷ß4{ßaßLßjß29ßAßF}}{ß1ß2kß3|¦´x´´y´‡¤Lm¤4q¤Ky¤84—÷ß4{ßaßXßj¨wall_tutorial_fake¨ß3y»ß4O»ßAßX}}{ß1ß3Rß3|¦´x´´y´‡¢-MQ¤-e¢-NY¤K—÷ß4{ßaßZßjß4Yß3y»ß4O»ßAßZ}}{ß1ß3nß3|¦´x´´y´‡¤AA¤g6¤By¤i0—÷ß4{ßaßIßjß4Yß3y»ß4O»ßAßI}}{ß1ß1gß3|{´x´º1u´y´¤wO´z´Ý0}{´x´º1u´y´º1y}{´x´¤ye´y´¢1Ec}{´x´¤yU´y´¤qQ}÷ß4{ßaßGßjß3wßAßG}´z´Ý0}{ß1ß3cß3|¦´x´´y´‡¤CQ¤ga¤DE¤gQ¤EM¤gu¤EW¤hs¤E2¤iM¤DO¤iW¤Ck¤iC—÷ß4{ßaßIßjß4Mß3y»ßAßI}}{ß1ß3eß3|¦´x´´y´‡¤SO¤oe¤TC¤pSºH¤qa¤S4¤qu¤Qw¤qaºO¤pS¤RG¤oU—÷ß4{ßaßIßjß4MßAßI}}{ß1ß3fß3|¦´x´´y´‡¤SiºYºH¤sM¤SY¤tA¤Ra¤tK¤Qw¤sg¤Qw¤ri¤Rk¤rE—÷ß4{ßaßIßjß4MßAßI}}{ß1ß3gß3|¦´x´´y´‡¤Ss¤tU¤Tq¤uS¤Tg¤vk¤Si¤wY¤Rk¤wE¤R6¤v6¤Ra¤ty—÷ß4{ßaßIßjß4MßAßI}}{ß1ß3hß3|¦´x´´y´‡¤OC¤vQ¤Og¤wE¤OM¤x2¤NO¤xM¤Ma¤ws¤MQ¤vu¤NE¤vG—÷ß4{ßaßIßjß4MßAßI}}{ß1ß2Rß3|{´x´ºu´y´º3}÷ß4{ßaßDß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷ßAßD}}{ß1ß2Tß3|¦´x´´y´‡¤6w¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßaßDß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßjß4Pß4R£0.EWßAßD}}{ß1ß2Xß3|¦´x´´y´‡¤D4¤-A¤C6¢-42¤5eºuº2ºg¢-6Iº2¢-6m¤42¢-9q¤50¢-Bm¤84¢-Bc¤BI¢-7Q¤D4¢-3Y¤B8¢-26¤84¤4C¤6w¤6c¤1S—÷ß4{ßaßDßjß3wß45»ßAßD}}{ß1ß2Yß3|¦´x´´y´‡¤5eºuº2ºgº4Kº2º4L¤42º4R¤84¤4C¤6w¤6c¤1S—÷ß4{ßaßDßAßDßi»ßjßkß6|¨tutorial room 1 map rock 1¨¨tutorial room 1 map rock 2¨¨tutorial room 1 map rock 3¨¨tutorial room 1 map rock 4¨÷}}{ß1ß2Zß3|¦´x´´y´‡¤C6º4J¤5eºu¤6c¤1S¤D4¤-A—÷ß4{ßaßDßAßDßi»ßjßk}}{ß1ß2aß3|¦´x´´y´‡¢-2v¤7M¢-47¤6K¢-4C¤6P¢-6u¤44º4M¤50º4N¤84º4O¤BIº4P¤D4º4Q¤B8—÷ß4{ßaßDßAßDßi»ßjßkß6|¨tutorial room 1 map rock 5¨¨tutorial room 1 map rock 6¨÷}}{ß1ß2Pß3|{´x´ºg´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß4p÷ßaßDßAßD}}{ß1ß2Sß3|¦´x´´y´‡¤5eºuº2ºgº4Kº2º4L¤42º4R¤84¤4C¤6w¤6c¤1S—÷ß4{ßaßDßjß4Pß4RÊßAßD}}{ß1ß2Vß3|{´x´¢-BI´y´¤4q}÷ß4{ß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßaßDßAßD}}{ß1ß2gß3|¦´x´´y´‡¤5e¢-CG¤4g¢-8O¤8Yº4P¤9Wº4X¤F9¢-HE¤9W¢-BS—÷ß4{ßaßXßjß4Pß4RÝ9ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷ßAßX}}{ß1ß2pß3|¦´x´´y´‡¤Gw¢-Ky¤EC¢-Lc¤BS¢-KU¤4M¢-Ca¤3O¢-8i¤C6º4J¤D4¤-A¤Bm¤8s¤E2¤G8¤H6¤GI¤Keºq¤WG¤84¤Wu¤2G¤Uy¢-Ay—÷ß4{ßaßXßjß3wß45»ßAßX}}{ß1ß2qß3|¦´x´´y´‡¤Wuº4U¤Waº4P—{´x´¤Vw´y´¢-5o´z´£0.3E}÷ß4{ßaßXßjß3wßAßX}´z´ÝA}{ß1ß2rß3|¦´x´´y´‡¤Wk¤2G¤Uyº4h¤NOº4N¤Lw¢-H6¤Gm¢-Is¤Bw¢-FU¤BS¢-Ao¤Aoº4h¤9q¢-76¤C6º4J¤D4¤-A¤Ck¤26¤M8¤3G¤WQ¤4C¤WV¤3k¤NO¤2u¤MG¤26¤N4¤eºh¤U¤Po¤18¤Py¤2Q¤Pe¤3EºO¤3E¤QI¤2Q¤QS¤18¤R6¤o¤S4¤18¤SO¤1w¤S4¤3O¤UAºw¤Ss¤1w¤Si¤e¤TM¤-K¤UU¤-o¤Vm¤-K¤Vw¤18¤WG¤42¤WQ¤4C—÷ß4{ßaßXßAßXßi»ßjßkß6|¨tutorial room 2 map rock 1¨¨tutorial room 2 map rock 2¨¨tutorial room 2 map rock 3¨¨tutorial room 2 map rock 4¨¨tutorial room 2 map rock 5¨¨tutorial room 2 map rock 6¨¨tutorial room 2 map rock 7¨¨tutorial room 2 map rock 8¨¨tutorial room 2 map rock 9¨¨tutorial room 2 map rock 10¨¨tutorial room 2 map rock 11¨÷}}{ß1ß2sß3|¦´x´´y´‡¤Gc¢-7a¤Gg¢-7e¤GN¢-92¤H8¢-AF¤IW¢-A6¤JR¢-9B¤J8¢-7T¤Hk¢-6r¤Hkº4L—÷ß4{ßaßXßAßXßi»ßjßkß4LÊ}}{ß1ß2tß3|¦´x´´y´‡¤Cu¢-G8¤Cq¢-GD¤Bq¢-FW¤AA¢-GS¤A0¢-IY¤Bcº4e¤E2¢-LS¤Gc¢-Ko¤Gm¢-Ix¤Do¢-Gs¤Ds¢-Gm—÷ß4{ßaßXßAßXßi»ßjßk}}{ß1ß2uß3|¦´x´´y´‡¤3Oº4g¤4Mº4f¤Aoº4h¤9qº4n—÷ß4{ßaßXßAßXßi»ßjßk}}{ß1ß2vß3|¦´x´´y´‡¤Ky¤84¤Lk¤4q¤WG¤4q¤WG¤84—÷ß4{ßaßXßAßXßi»ßjßk}}{ß1ß2wß3|¦´x´´y´‡¤EW¤C1¤Ha¤CG¤H6¤GI¤E2¤G8—÷ß4{ßaßXßAßXßi»ßjßk}}{ß1ß2xß3|¦´x´´y´‡¤M8¤3G¤Keºq¤Ha¤CG¤EW¤C1¤Bm¤8s¤Ck¤26—÷ß4{ßaßXßAßXßi»ßjßk}}{ß1ß2cß3|{´x´¤G8´y´º4Q}÷ß4{ßaßXß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷ßAßX}}{ß1ß2fß3|{´x´¤KA´y´¢-5A}÷ß4{ßaßXß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷ßAßX}}{ß1ß2lß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßaßXßjß4PßAßX}}{ß1ß2dß3|{´x´¤Ss´y´¤-y}÷ß4{ßaßXß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ßAßX}}{ß1ß2eß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßaßXßjß4Wß6|¨tutorial room 2 switch¨÷ßAßX}}{ß1ß2hß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGºu—÷ß4{ßaßXßj¨icon¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷ßAßX}´z´£0.1c}{ß1ß2jß3|{´x´¤AU´y´¢-K0}÷ß4{ßaßXß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷ßAßX}}{ß1ß2mß3|¦´x´´y´‡¤CQ¤y¤Ds¤FUºA¤FU¤FU¤y—÷ß4{ßaßXßjß4Pß4RÝ9ßAßX}}{ß1ß2zß3|¦´x´´y´‡¢-Lmº50¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßaßYßjß4Pß4R£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷ßAßY}}{ß1ß37ß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FKº4h¢-Ds¢-8s¢-Fe¢-8Yº5K¢-A0º5B¢-DY¢-Ke—÷ß4{ßaßYßjß4PßAßY}}{ß1ß3Aß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßaßYß40¨enemy_tutorial_easy¨ß42»ß43ÊßAßY}}{ß1ß30ß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßaßYß40ß5lß42»ß43ÊßAßY}}{ß1ß39ß3|¦´x´´y´‡¤3Oº4g¤4Mº4f¤e¢-GI¢-4Mº4e¢-84¢-Oq¢-EC¢-PAº5C¢-I4¢-OMº4lº4Eº5Sº4X¢-9Cº4Rº4n—÷ß4{ßaßYßjß3wß45»ßAßY}}{ß1ß3Bß3|¦´x´´y´‡º4Rº4n¢-5e¢-B8º57º5L¤eº5Y¤4Mº4f¤3Oº4g—÷ß4{ßaßYßAßYßi»ßjßkß6|¨tutorial room 3 map rock 1¨÷}}{ß1ß3Cß3|¦´x´´y´‡º4W¢-Cuº5A¢-Cr¤A¢-DU¤1O¢-Ch¤1i¢-BA¤J¢-9v¢-1P¢-9k¢-21¢-B7º4Rº5i—÷ß4{ßaßYßAßYßi»ßjßkß4LÊ}}{ß1ß3Dß3|¦´x´´y´‡º4Xº5g¢-HG¢-CQ¢-Jqº4wº5Cº5e¢-J2¢-JWº5cº5dº5aº5bº5Zº4eº57º5Lº5hº5i—÷ß4{ßaßYßAßYßi»ßjßkß6|¨tutorial room 3 map rock 2¨÷}}{ß1ß3Eß3|¦´x´´y´‡¢-Fu¢-IN¢-F6¢-FE¢-Az¢-Do¢-8m¢-Fh¢-8T¢-IM¢-A2¢-K7º5S¢-Kj—÷ß4{ßaßYßAßYßjßkßi»ß4LÊ}}{ß1ß3Fß3|¦´x´´y´‡º4Eº5Sº5vº4wº5Cº5eº5fº4l—÷ß4{ßaßYßAßYßi»ßjßk}}{ß1ß34ß3|¦´x´´y´‡º4Kº5a¤2F¢-5T¤4qº5M¢-3F¢-Hl—÷ß4{ßaßYßjß4Pß4RÝCß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷ßAßY}}{ß1ß3Kß3|{´x´¢-L4´y´¤49}÷ß4{ßaßZß40¨enemy_tutorial_rock_room4¨ß42»ß43ÊßAßZ}}{ß1ß3Sß3|¦´x´´y´‡º4Eº5Sº5fº4l¢-W6¢-Ck¢-Ygº56ºk¤Uº4F¤Kº4F¤7Gº4k¤7Gº4k¤34º4E¤-eº5w¢-3Oº5Kº4g—÷ß4{ßaßZßjß3wß45»ßAßZ}}{ß1ß3Hß3|{´x´¢-QI´y´¢-7G}÷ß4{ßaßZß40¨collect_gun_basic¨ß42»ß43Êß4O»ßAßZ}}{ß1ß3Iß3|{´x´º6J´y´º6K}÷ß4{ßaßZß40¨deco_gun_basic¨ß42»ß43ÊßAßZ}}{ß1ß3Tß3|¦´x´´y´‡º6Fº6Gº6Hº56ºk¤Uº4F¤Kº5wº6Iº5Kº4gº4Eº5Sº5fº4l—÷ß4{ßaßZßAßZßjßkßi»ß6|¨tutorial room 4 map rock 1¨¨tutorial room 4 map rock 2¨¨tutorial room 4 map rock 3¨÷}}{ß1ß3Oß3|¦´x´´y´‡¢-Kz¢-6wº6A¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßaßZßjß5bßAßZ}}{ß1ß3Jß3|{´x´¢-Ue´y´¢-C6}÷ß4{ßaßZß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷ßAßZ}}{ß1ß3Mß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßaßZß40¨enemy_tutorial_rocky¨ß42»ß43Êß4O»ßAßZ}}{ß1ß3Nß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßaßZß40ß5zß42»ß43Êß4O»ßAßZ}}{ß1ß3Gß3|¦´x´´y´‡¢-OK¢-Fkº8º5j¢-Yqº56¢-Tq¤e¢-NO¤Uº4k¢-3E¢-IEº5O—÷ß4{ßaßZßjß4Pß4R£1.4qßAßZ}}{ß1ß3Lß3|{´x´¢-Ic´y´¤16}÷ß4{ßaßZß40¨switch¨ß42»ß43ÊßAßZ}}{ß1ß3Xß3|{´x´¤Fy´y´¤TW}÷ß4{ßaßIß40¨enemy_tutorial_boss¨ß42»ß43ÊßAßIß4O»}}{ß1ß3Zß3|¦´x´´y´‡¤Pe¤fS¤Lw¤fc—÷ß4{ß3y»ßaßIß6|¨tutorial room 5 door end path¨÷ßAßIßj¨wall_door¨}}{ß1ß3Vß3|¦´x´´y´‡¤KU¤GSºA¤GI—÷ß4{ß3y»ßaßIß6|¨tutorial room 5 door start path¨÷ßAßIßjß63}}{ß1ß3dß3|{´x´¤Tx´y´¤gx}÷ß4{ßaßIß40¨enemy_tutorial_easy_static¨ß42»ß43ÊßAßI}}{ß1ß3Yß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºH¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fw¤Ue¤fw¤Vc¤jA¤Wu¤jA¤XO¤km¤W6¤km¤Y2¤rE¤Fo¤s2¤F0¤nC¤92¤h4ºq¤gG¤AA¤g6¤1w¤X4¤4q¤M6—÷ß4{ßaßIßjß3wß45»ßAßI}}{ß1ß3oß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MGºH¤Vw¤Lz¤fY¤Hu¤fi¤Hu¤fm¤EC¤fw¤EC¤fs¤A6¤g2¤26¤X4¤4q¤M6—÷ß4{ßaßIßAßIßi»ßjßk}}{ß1ß3pß3|¦´x´´y´‡¤EC¤fw¤Hu¤fm¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤RG¤w4ºO¤wE¤P1¤oQ¤SN¤o5¤RV¤l9¤GA¤mJ¤AI¤g6—÷ß4{ßaßIßAßIßi»ßjßkß6|¨tutorial room 5 map rock 1¨¨tutorial room 5 map rock 2¨¨tutorial room 5 map rock 3¨¨tutorial room 5 map rock 4¨÷}}{ß1ß3qß3|¦´x´´y´‡¤Ck¤iC¤Co¤i9¤DO¤iS¤E0¤iI¤ER¤hr¤EI¤gx¤DD¤gU¤CU¤gd¤CQ¤ga¤CG¤hY—÷ß4{ßaßIßAßIßi»ßjßkß4LÊ}}{ß1ß3rß3|¦´x´´y´‡¤X8¤o0¤YM¤o0¤am¤w4¤ZY¤w4—÷ß4{ßaßIßAßIßi»ßjßkß6|¨tutorial room 5 map shape 4.1¨÷}}{ß1ß3sß3|¦´x´´y´‡¤T6¤Vw¤UK¤Vw¤Uo¤Xs¤TW¤Xs¤Vw¤fs¤Uc¤ft¤Ps¤gL—÷ß4{ßaßIßAßIßi»ßjßk}}{ß1ß3tß3|¦´x´´y´‡ºO¤wE¤Qa¤w9¤Oo¤wd¤On¤wl¤Mj¤xL¤Mh¤xH¤Gu¤yu¤FK¤p8¤Gw¤p8¤Gy¤pF¤P1¤oQ—÷ß4{ßaßIßAßIßi»ßjßk}}{ß1ß3uß3|¦´x´´y´‡¤Gw¤p8¤G8ºK¤By¤i0¤C3¤hx¤AI¤g6ºq¤gG¤92¤h4¤F0¤nC¤FK¤p8—÷ß4{ßaßIßAßIßi»ßjßk}}{ß1ß3vß3|¦´x´´y´‡¤G8ºK¤Gw¤p8¤SE¤o0¤RQ¤lG—÷ß4{ßaßIßAßIßi»ßjßk}}{ß1ß3mß3|{´x´¤WV´y´¤jy}÷ß4{ßaßIß40¨enemy_tutorial_rocky_small¨ß42»ß43ÊßAßIß4O»}}{ß1ß3Uß3|¦´x´´y´‡¤1w¤Ko¤1w¤cEºH¤bQ¤TM¤LI—÷ß4{ßaßIßjß4PßAßI}}{ß1ß3kß3|¦´x´´y´‡¤8s¤eK¤9g¤fI¤MG¤eo¤N4¤dq—÷ß4{ßaßIßjß4Pß4RÝDßAßI}}{ß1ß3Wß3|¦´x´´y´‡¤DE¤Gm¤CGºA¤JC¤Hk¤IE¤H6—÷ß4{ßaßIßjß4Pß4RÝDßAßI}}{ß1ß3jß3|¦´x´´y´‡¤DE¤g6¤Eg¤gu¤Kr¤ga¤V1¤fk¤ZU¤um¤Gc¤um¤H6¤ye¤Qw¤vu¤aI¤vW¤VI¤fI—÷ß4{ßaßIßjß4Pß4RÊßAßI}}{ß1ß3iß3|¦´x´´y´‡¤NE¤vG¤MkºY—÷ß4{ßaßIßjß4WßAßI}}{ß1ß31ß3|¦´x´´y´‡º6Zº5gº7¢-9gº4Nº5i—÷ß4{ßaßYßj¨spike¨ßAßY}}{ß1ß32ß3|¦´x´´y´‡º4k¢-EWº5xº4lº5tº4w—÷ß4{ßaßYßjß6CßAßY}}{ß1ß33ß3|¦´x´´y´‡¢-Af¢-PH¢-Bw¢-PKº4Xº6i—÷ß4{ßaßYßjß6CßAßY}}{ß1ß3Pß3|¦´x´´y´‡¢-Iu¤5Sº4k¤34º4E¤-eº5wº6Iº5Kº4gº4Eº5S—÷ß4{ßaßZßjß3xß3y»ßAßZ}}{ß1ß2Qß3|¦´x´´y´‡¢-38¤7Aº4R¤84¤4C¤6w¤6c¤1S¤D4¤-A—÷ß4{ß3y»ßaßDßjß3xßAßD}}{ß1ß2Uß3|¦´x´´y´‡¢-6e¤2Yº4L¤42—÷ß4{ßaßDßjß3xß3y»ßAßD}}{ß1ß2bß3|¦´x´´y´‡¤Po¤gQºH¤Vw¤RG¤MG¤H6¤GI¤Ha¤CG¤Keºq¤Ky¤84¤WG¤84¤WG¤4q¤Lm¤4q¤M8¤3G¤WQ¤4C¤Wk¤2G¤Uyº4h¤NOº4N¤Lwº4j¤Gmº4k¤Dsº55—÷ß4{ß3y»ßaßXßjß3xßAßX}}{ß1ß2nß3|¦´x´´y´‡¤3Oº4g¤9qº4n¤C6º4J—÷ß4{ßaßXßjß3xß3y»ßAßX}}{ß1ß3Qß3|¦´x´´y´‡º4F¤6Iº4F¤Kºk¤Uº6Hº56º6Fº6Gº5fº4l—÷ß4{ßaßZßjß3xß3y»ßAßZ}}{ß1ß2iß3|¦´x´´y´‡¤Cuº4w¤Bwº4l¤BSº4m¤4Mº4f—÷ß4{ß3y»ßaßXßjß3xßAßX}}{ß1ß2Wß3|¦´x´´y´‡¤C6º4J¤5eºuº2ºgº4Kº2¢-6T¤U—÷ß4{ßaßDßjß3xß3y»ßAßD}}{ß1ß2oß3|¦´x´´y´‡¤D4¤-A¤Bm¤8s¤EW¤C1¤E2¤G8¤4q¤M6¤26¤X4¤AA¤g6¤EC¤fw—÷ß4{ß3y»ßaßXßjß3xßAßX}}{ß1ß36ß3|¦´x´´y´‡º4Eº5Sº5vº4wº5tº5uº4Xº5gº5hº5iº4Rº4n¤3Oº4g—÷ß4{ßaßYßjß3xß3y»ßAßY}}{ß1ß35ß3|¦´x´´y´‡º5fº4lº5Cº5eº5wº5xº5cº5dº5aº5bº5Zº4eº57º5L¤eº5Y¤4Mº4f—÷ß4{ßaßYßjß3xß3y»ßAßY}}{ß1ß3lß3|¦´x´´y´‡¤Hu¤fm¤Lw¤fcºH¤Vw—÷ß4{ß3y»ßaßIßjß3xßAßI}}{ß1ß3aß3|¦´x´´y´‡¤By¤i0¤G8ºK¤RQ¤lG¤SE¤o0¤Gw¤p8—÷ß4{ß3y»ßaßIßjß3xßAßI}}{ß1ß3bß3|¦´x´´y´‡¤Lw¤fc¤Ky¤gu¤Ue¤fw¤ZU¤w4¤ZUº1Y—÷ß4{ß3y»ßaßIßjß3xßAßI}}{ß1ß2yß3|¦´x´´y´‡¢-FAº6wº4hº5Gº4gº5Pº4Zº5Kº5R¢-KAº5Sº52º5Eº5Kº6wº6w—÷ß4{ßaßYßjß3zß3y»ßAßY}}{ß1ß38ß3|¦´x´´y´‡º6wº6wº4hº5Gº4gº5Pº4Zº5Kº5Rº6xº5Sº52º5Eº5Kº6wº6w—÷ß4{ßaßYßjß3zßAßY}}{ß1ß4Cß3|¦´x´´y´‡º1gº25º2I¤rY—÷ß4{ßaß1RßAßHßi»ßj¨map_line¨¨map_parent¨ß1R}}{ß1ß4Gß3|¦´x´´y´‡º2Jº1pº2K¤vk—÷ß4{ßaß1SßAßHßi»ßjß6Dß6Eß1S}}{ß1ß4Jß3|¦´x´´y´‡º2Nº1vºM¤w4—÷ß4{ßaß1TßAßHßi»ßjß6Dß6Eß1T}}{ß1ß4Kß3|¦´x´´y´‡º2Pº2Qº2E¤uw—÷ß4{ßaß1UßAßHßi»ßjß6Dß6Eß1U}}{ß1ß48ß3|¦´x´´y´‡º2f¤xqº2h¤yUº2gº1Y—÷ß4{ßaß1QßAßHßj¨map_inverse¨ßi»ß6Eß1Q}}{ß1ß49ß3|¦´x´´y´‡º2aº2bº2dº2eº1bº2c—÷ß4{ßaß1QßAßHßjß6Fßi»ß6Eß1Q}}{ß1ß4Aß3|¦´x´´y´‡ºS¤xWº2nº2oº2m¤zm—÷ß4{ßaß1RßAßHßjß6Fßi»ß6Eß1R}}{ß1ß4Bß3|¦´x´´y´‡º2kº2lº2jº2Rº2iº1q—÷ß4{ßaß1RßAßHßjß6Fßi»ß6Eß1R}}{ß1ß4Dß3|¦´x´´y´‡º2v¤w4º2pº2uº2tº1s—÷ß4{ßaß1SßAßHßjß6Fßi»ß6Eß1S}}{ß1ß4Eß3|¦´x´´y´‡º23º2bº2rº2sº2pº2q—÷ß4{ßaß1SßAßHßjß6Fßi»ß6Eß1S}}{ß1ß4Fß3|¦´x´´y´‡º2tº2lº2xº2yº2wº2b—÷ß4{ßaß1SßAßHßjß6Fßi»ß6Eß1S}}{ß1ß4Hß3|¦´x´´y´‡º33¤xqº31º2uº29¤yU—÷ß4{ßaß1TßAßHßjß6Fßi»ß6Eß1T}}{ß1ß4Iß3|¦´x´´y´‡º32º2bº31º2cº2zº30—÷ß4{ßaß1TßAßHßjß6Fßi»ß6Eß1T}}{ß1ß4Tß3|¦´x´´y´‡º2T¤b6º2E¤X4º3r¤X4—÷ß4{ßaß1zßAßVßjß6Fßi»ß6Eß1z}}{ß1ß4Uß3|¦´x´´y´´z´‡¢28D¢1HSÝ2º6y¢1LUÝ2—{´x´¢24B´y´º70}{´x´º71´y´º6z´z´Ý2}÷ß4{ßaß24ßAßJß42»}´z´Ý2}{ß1ß4Vß3|¦´x´´y´´z´‡¢21s¢1NpÝ2º72¢1RrÝ2¢1xqº74Ý2º75º73Ý2—÷ß4{ßaß24ßAßJß42»}´z´Ý2}{ß1ß5pß3|¦´x´´y´‡º4Wº5jº4Rº5i—÷ß4{ßaß34ßjß4Yß3y»ß4O»ßAßY}}{ß1ß5Tß3|¦´x´´y´‡¤Hkº4L¤Gcº4o—÷ß4{ßaß2fßjß4Yß3y»ß4O»ßAßX}}{ß1ß4lß3|¦´x´´y´‡¤-Kº6I¤Aº4I¤xº4Q¤1I¢-2u¤yºu¤K¢-2G¤-K¢-2a—÷ß4{ßaß2Pßjß4MßAßD}}{ß1ß4mß3|¦´x´´y´‡¤2G¤5A¤2a¤4W¤3O¤4C¤42¤4q¤42¤5o¤3E¤68¤2Q¤5y—÷ß4{ßaß2Pßjß4MßAßD}}{ß1ß4nß3|¦´x´´y´‡º4i¢-18º5hº2¢-4q¢-1wº5Z¢-1Sº5Z¤-oºgºs¢-5U¤-e—÷ß4{ßaß2Pßjß4MßAßD}}{ß1ß4oß3|¦´x´´y´‡º4I¤5K¢-34¤50º77¤50¢-1m¤5eº7B¤6cºu¤5y¢-4B¤6G—÷ß4{ßaß2Pßjß4MßAßD}}{ß1ß4pß3|¦´x´´y´‡º6v¤Uº6u¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßaß2Pßj¨wall_tutorial_rock_breakable¨ßAßD}}{ß1ß5Fß3|¦´x´´y´‡¤Muº6j¤P0º6I¤Pyº4U¤PUºf¤OCº58¤N4ºf¤MQºg—÷ß4{ßaß2fßjß4MßAßX}}{ß1ß5Gß3|¦´x´´y´‡¤Caº4J¤Dsº4Q¤Egº4U¤Eg¢-5K¤ECºf¤Ckºf¤C6ºg—÷ß4{ßaß2fßjß4MßAßX}}{ß1ß5Hß3|¦´x´´y´‡ºEº4J¤Gm¢-3s¤Hkº5Z¤Huº5h¤Gwº58¤FUºf¤F0º56—÷ß4{ßaß2fßjß4MßAßX}}{ß1ß5Iß3|¦´x´´y´‡¤J2º7K¤Kyº4Q¤Lwº7A¤Lmºf¤K0º4L¤Iiºf¤IOº7A—÷ß4{ßaß2fßjß4MßAßX}}{ß1ß5Jß3|¦´x´´y´‡¤Hkº4L¤JCº4P¤JWº5g¤IY¢-AA¤H6¢-AK¤GIº4q¤Gcº4o—÷ß4{ßaß2fßjß4Mß3y»ßAßX}}{ß1ß5Kß3|¦´x´´y´‡¤DEº5P¤Dsº4l¤ECº5J¤EMº4z¤Dsº55¤D8¢-Gn¤Cuº4w—÷ß4{ßaß2fßjß4MßAßX}}{ß1ß5Lß3|¦´x´´y´‡¤KUº5E¤Kyº5J¤Lcº5E¤Lmº4z¤LS¢-Gw¤Koº4j¤KKºm—÷ß4{ßaß2fßjß4MßAßX}}{ß1ß5oß3|¦´x´´y´‡º4Rº5iº7Cº6m¤Kº4M¤1mº5i¤1Sº6G¤Aº5Sº4Wº5j—÷ß4{ßaß34ßjß4Mß3y»ßAßY}}{ß1ß5wß3|¦´x´´y´‡¢-VIº6Z¢-V8º4f¢-UKº5jº6hº5uº6hº4N¢-UUº4b¢-Uyº4O—÷ß4{ßaß3Jßjß4MßAßZ}}{ß1ß5xß3|¦´x´´y´‡¢-OWº7B¢-O2º78¢-NEº4H¢-Maº77¢-Mkº4Wº4F¤-yº5fº79—÷ß4{ßaß3Jßjß4MßAßZ}}{ß1ß5yß3|¦´x´´y´‡¢-TMº4W¢-T2º7B¢-SEº77¢-RQº7F¢-RG¤-y¢-Ru¤-Kº7aºs—÷ß4{ßaß3Jßjß4MßAßZ}}{ß1ß5Mß3|¦´x´´y´‡¤Fe¤1m¤Gc¤1w¤HG¤1S¤H6¤U¤GS¤-A¤FK¤-A¤F0¤o—÷ß4{ßaß2fßjß4MßAßX}}{ß1ß5Nß3|¦´x´´y´‡¤I4¤1m¤J2¤1m¤JM¤18¤JC¤K¤IY¤-A¤Hk¤A¤Ha¤18—÷ß4{ßaß2fßjß4MßAßX}}{ß1ß5Oß3|¦´x´´y´‡¤Jq¤1m¤Ko¤2a¤Lm¤26¤MG¤e¤LS¤A¤KA¤A¤Jg¤e—÷ß4{ßaß2fßjß4MßAßX}}{ß1ß5Qß3|¦´x´´y´‡¤MG¤26¤NO¤2u¤P0¤34¤Py¤2Q¤Po¤18ºh¤U¤N4¤e—÷ß4{ßaß2fßjß4MßAßX}}{ß1ß5Rß3|¦´x´´y´‡¤QI¤2Q¤R6¤2k¤Ru¤2k¤SO¤1w¤S4¤18¤R6¤o¤QS¤18—÷ß4{ßaß2fßjß4MßAßX}}{ß1ß5Sß3|¦´x´´y´‡¤Ss¤1w¤Ue¤2G¤Vw¤18¤Vm¤-K¤UU¤-o¤TM¤-K¤Si¤e—÷ß4{ßaß2fßjß4MßAßX}}{ß1ß4Zß3|¦´x´´y´‡¤4X¤-T¤50¤-K¤4jÎ¤50¤-K¤3OÒ—÷ß4{ßaß2Rßjß5bß3y»ßAßD}´z´ÝB}{ß1ß4aß3|¦´x´´y´‡º4J¤-yº4Jº78º7Cº57ºsº4Uºsº7B¤1N¢-2L¤1Sº4Q¤5Kº77—÷ß4{ßaß2Rß40¨enemy_tutorial_bit¨ß42»ß43ÎßAßD}}{ß1ß4bß3|¦´x´´y´‡¢-4W¤5eº4K¤3sºf¤-yº7J¤-Aº7K¤-yº5Z¤3Eº6j¤4g—÷ß4{ßaß2Rß40ß6Hß42»ß43ÎßAßD}}{ß1ß4cß3|¦´x´´y´‡ºqº4W¤9s¤m—÷ß4{ß3y»ßaß2TßAßDßjß63}}{ß1ß4dß3|¦´x´´y´‡ºqº4W¤8q¢-3M—÷ß4{ßaß2Tß3y»ßAßDßjß63}}{ß1ß4eß3|¦´x´´y´‡¤8Eº7E¤9C¤o¤AU¤U¤9Wº6I—÷ß4{ßaß2Tßj¨deco¨ß5¨tutorial_door_floor¨ßAßD}}{ß1ß4fß3|¦´x´´y´‡¤yº4Q¤Aº4I¤-Kº6I¤-Kº78¤Kº77¤yºu¤1Iº76—÷ß4{ßaß2YßAßDßjß6Fßi»ß6Eß2Y}}{ß1ß4gß3|¦´x´´y´‡º5Zº7Cº7Aº7Bº5hº2º4iº79º7D¤-eºgºsº5Z¤-o—÷ß4{ßaß2YßAßDßi»ßjß6Fß6Eß2Y}}{ß1ß4hß3|¦´x´´y´‡º7F¤5eº77¤50º7E¤50º4I¤5K¢-3a¤6Aº76¤6cº7B¤6c—÷ß4{ßaß2YßAßDßi»ßjß6Fß6Eß2Y}}{ß1ß4iß3|¦´x´´y´‡¤42¤5o¤42¤4q¤3O¤4C¤2a¤4W¤2G¤5A¤2Q¤5y¤3E¤68—÷ß4{ßaß2YßAßDßi»ßjß6Fß6Eß2Y}}{ß1ß4jß3|¦´x´´y´‡º4I¤5Kº7G¤6Gº4T¤6Kº7i¤6A—÷ß4{ßaß2aßAßDßi»ßjß6Fß6Eß2a}}{ß1ß4kß3|¦´x´´y´‡º7i¤6Aº76¤6cº7B¤6cºu¤5y—÷ß4{ßaß2aßAßDßi»ßjßkß6Eß2a}}{ß1ß4rß3|{´x´º56´y´¤AA}÷ß4{ßaß2Vß40ß5zß42»ß43ÊßAßD}}{ß1ß4sß3|{´x´¢-9M´y´¤6w}÷ß4{ßaß2Vß40ß5zß42»ß43Êß4O»ßAßD}}{ß1ß4tß3|{´x´º6m´y´¤AA}÷ß4{ßaß2Vß40ß5zß42»ß43Êß4O»ßAßD}}{ß1ß4xß3|¦´x´´y´‡¤A6¢-9m¤9g¢-9Q¤A5¢-93¤9gº7l¤BM¢-9O—÷ß4{ßaß2gßjß5bß3y»ßAßX}´z´ÝB}{ß1ß4yß3|¦´x´´y´‡¤ER¢-5Z¤E8¢-56¤Dnº7o¤E8º7p¤E8º6u—÷ß4{ßaß2gßj¨icon_tutorial¨ß3y»ßAßX}´z´ÝB}{ß1ß4zß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßaß2gßjß6Kß3y»ßAßX}´z´ÝB}{ß1ß5Pß3|{´x´¤Dz´y´¤Y}÷ß4{ßaß2fß40¨enemy_tutorial_block¨ß42»ß43Êß4O»ßAßX}}{ß1ß5Uß3|¦´x´´y´‡¤Maº6j¤Lwº6j¤LIº6I¤M4¢-4c¤M5º7p¤M1¢-6A¤KKº4L¤NOº4L¤Mgº4K¤M8º7p¤M7º7q—÷ß4{ßaß2dß40ß6Hß42»ß43ÎßAßX}}{ß1ß5Vß3|¦´x´´y´‡ºHºs¤SO¤y¤RG¤U¤Py¤o¤SYº4W¤V8º4H¤Vcº4W—÷ß4{ßaß2dß40ß6Hß43Îß42»ßAßX}}{ß1ß5Wß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßaß2dß40ß6Hß42»ß43ÎßAßX}}{ß1ß5Yß3|¦´x´´y´‡¤Ha¤Bm¤EW¤Bc¤C6¤8s¤D4¤1S¤GS¤2QºA¤1w¤JW¤26¤Ko¤2u¤Lw¤2Q¤K0¤9W—÷ß4{ßaß2dß40ß6Hß43¤Cß42»ßAßX}}{ß1ß4vß3|¦´x´´y´‡¤76º4M¤6a¢-7m—÷ß4{ß3y»ßaß2gßAßXßjß63}}{ß1ß4wß3|¦´x´´y´‡¤76º4M¤7c¢-Bu—÷ß4{ß3y»ßaß2gßAßXßjß63}}{ß1ß4uß3|¦´x´´y´‡¤6wº6q¤5yº5a¤7G¢-7k¤8Eº4O—÷ß4{ßaß2gßjß6Iß5ß6JßAßX}}{ß1ß5Xß3|{´x´¤Hb´y´¢-C3}÷ß4{ßaß2dß40¨enemy_tutorial_4way¨ß42»ß43ÊßAßX}}{ß1ß5Zß3|{´x´¤R6´y´¤5o}÷ß4{ßaß2dß40¨enemy_tutorial_down¨ß42»ß43ÊßAßX}}{ß1ß50ß3|¦´x´´y´‡¤ECºf¤Ckºf¤C6ºg¤Caº4J¤Dsº4Q¤Egº4U¤Egº7J—÷ß4{ßaß2rßAßXßjß6Fßi»ß6Eß2r}}{ß1ß51ß3|¦´x´´y´‡¤Gwº58¤FUºf¤F0º56ºEº4J¤Gmº7K¤Hkº5Z¤Huº5h—÷ß4{ßaß2rßAßXßjß6Fßi»ß6Eß2r}}{ß1ß52ß3|¦´x´´y´‡¤K0º4L¤Iiºf¤IOº7A¤J2º7K¤Kyº4Q¤Lwº7A¤Lmºf—÷ß4{ßaß2rßAßXßjß6Fßi»ß6Eß2r}}{ß1ß53ß3|¦´x´´y´‡¤OCº58¤N4ºf¤MQºg¤Muº6j¤P0º6I¤Pyº4U¤PUºf—÷ß4{ßaß2rßAßXßjß6Fßi»ß6Eß2r}}{ß1ß54ß3|¦´x´´y´‡¤GS¤-A¤FK¤-A¤F0¤o¤Fe¤1m¤Gc¤1w¤HG¤1S¤H6¤U—÷ß4{ßaß2rßAßXßjß6Fßi»ß6Eß2r}}{ß1ß55ß3|¦´x´´y´‡¤IY¤-A¤Hk¤A¤Ha¤18¤I4¤1m¤J2¤1m¤JM¤18¤JC¤K—÷ß4{ßaß2rßAßXßjß6Fßi»ß6Eß2r}}{ß1ß56ß3|¦´x´´y´‡¤KA¤A¤Jg¤e¤Jq¤1m¤Ko¤2a¤Lm¤26¤MG¤e¤LS¤A—÷ß4{ßaß2rßAßXßjß6Fßi»ß6Eß2r}}{ß1ß57ß3|¦´x´´y´‡¤H6º7M¤GIº4q¤Gcº4o¤Hkº4L¤JCº4P¤JWº5g¤IYº7L—÷ß4{ßaß2rßAßXßjß6Fßi»ß6Eß2r}}{ß1ß58ß3|¦´x´´y´‡¤D8º7N¤Cuº4w¤DEº5P¤Dsº4l¤ECº5J¤EMº4z¤Dsº55—÷ß4{ßaß2rßAßXßjß6Fßi»ß6Eß2r}}{ß1ß59ß3|¦´x´´y´‡¤Koº4j¤KKºm¤KUº5E¤Kyº5J¤Lcº5E¤Lmº4z¤LSº7O—÷ß4{ßaß2rßAßXßjß6Fßi»ß6Eß2r}}{ß1ß5Aß3|¦´x´´y´‡¤EVÄ¤Do¤-G¤DG¤C¤DF¤u¤Do¤1L¤EV¤1B¤En¤Y—÷ß4{ßaß2rßAßXßjß6Fßi»ß6Eß2r¨map_hide_when¨ß2x}}{ß1ß5aß3|{´x´¤FM´y´¢-7V}÷ß4{ßaß2eß40ß60ß42»ß43ÊßAßX}}{ß1ß5cß3|¦´x´´y´‡¤E6¢-1h¤EBº5r—÷ß4{ßaß2hßjß5bß3y»ßAßX}´z´ÝB}{ß1ß5dß3|¦´x´´y´‡¤E4¢-1X¤E4º84—÷ß4{ßaß2hßjß5bß3y»ßAßX}´z´ÝB}{ß1ß5eß3|{´x´¤Eg´y´º5v}÷ß4{ßaß2jß40ß5zß42»ß43Êß4O»ßAßX}}{ß1ß5iß3|{´x´¤Bw´y´º5K}÷ß4{ßaß2jß40ß5zß42»ß43Êß4O»ßAßX}}{ß1ß5fß3|¦´x´´y´‡¤Bcº4l¤Gw¢-JC¤Gm¢-L8¤E2º5C¤BSº5T¤9g¢-Ii¤9qº5Y—÷ß4{ßaß2jßjß4Pß4R£0.BIßAßX}}{ß1ß5gß3|¦´x´´y´‡¤D8º7N¤EC¢-FN—÷ß4{ßaß2jßjß4WßAßX}}{ß1ß5jß3|¦´x´´y´‡º4c¢-Egº7Wº7O—÷ß4{ß3y»ßaß2zßAßYßjß63}}{ß1ß5kß3|¦´x´´y´‡¢-LIº6nº52º5L¢-Muº4jº6iºm—÷ß4{ßaß2zßjß6Iß5ß6JßAßY}}{ß1ß5mß3|¦´x´´y´‡º4Wº5jº4Rº5iº7Cº6m¤Kº4M¤1mº5i¤1Sº6G¤Aº5S—÷ß4{ßaß3BßAßYßjß6Fßi»ß6Eß3B}}{ß1ß5nß3|¦´x´´y´‡º5Eº5Kº6wº6wº4hº5Gº4gº5Pº4Zº5Kº5Rº6xº5Sº52—÷ß4{ßaß3DßAßYßjß6Fßi»ß6Eß3D}}{ß1ß5tß3|¦´x´´y´‡º7Pº6Zº7Qº4fº7Rº5jº6hº5uº6hº4Nº7Sº4bº7Tº4O—÷ß4{ßaß3Tßjß6FßAßZß6Eß3Tßi»}}{ß1ß5uß3|¦´x´´y´‡º7Zº4Wº7aº7Bº7bº77º7cº7Fº7d¤-yº7e¤-Kº7aºs—÷ß4{ßaß3Tßjß6FßAßZß6Eß3Tßi»}}{ß1ß5vß3|¦´x´´y´‡º7Uº7Bº7Vº78º7Wº4Hº7Xº77º7Yº4Wº4F¤-yº5fº79—÷ß4{ßaß3Tßjß6FßAßZß6Eß3Tßi»}}{ß1ß62ß3|¦´x´´y´‡¤Lw¤fc¤EC¤fw—÷ß4{ßaß3Zßjß4WßAßI}}{ß1ß64ß3|¦´x´´y´‡ºA¤GI¤E2¤G8—÷ß4{ßaß3Vßjß4WßAßI}}{ß1ß66ß3|¦´x´´y´‡¤DE¤gQ¤CQ¤ga¤CG¤hY¤Ck¤iC¤DO¤iW¤E2¤iM¤EW¤hs¤EM¤gu—÷ß4{ßaß3pßAßIßjß6Fßi»ß6Eß3p}}{ß1ß67ß3|¦´x´´y´‡¤RG¤oUºO¤pS¤Qw¤qa¤S4¤quºH¤qa¤TC¤pS¤SO¤oe—÷ß4{ßaß3pßAßIßjß6Fßi»ß6Eß3p}}{ß1ß68ß3|¦´x´´y´‡¤Rk¤rE¤Qw¤ri¤Qw¤sg¤Ra¤tK¤SY¤tAºH¤sM¤SiºY—÷ß4{ßaß3pßAßIßjß6Fßi»ß6Eß3p}}{ß1ß69ß3|¦´x´´y´‡¤Ss¤tU¤Ra¤ty¤R6¤v6¤Rk¤wE¤Si¤wY¤Tg¤vk¤Tq¤uS—÷ß4{ßaß3pßAßIßjß6Fßi»ß6Eß3p}}{ß1ß6Aß3|¦´x´´y´‡¤Vg¤jA¤Wu¤jA¤XO¤km¤WA¤km—÷ß4{ßaß3rßAßIßi»ßjßkß6Eß3r}}{ß1ß5Bß3|¦´x´´y´‡¤Gh¢-43¤G8ºu¤FPº4U—÷ß4{ßaß2cßjß6CßAßX}}{ß1ß5Cß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Keº2—÷ß4{ßaß2cßjß6CßAßX}}{ß1ß5Dß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Oj¢-5p¤P3¢-5i¤Td¢-67¤PE¢-4S¤OX¢-3f¤OCº4W¤N9º4Q—÷ß4{ßaß2cßjß6CßAßX}}{ß1ß5Eß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßaß2cßjß6CßAßX}}{ß1ß4qß3|¦´x´´y´‡º7G¤6Gº4L¤42º4M¤50º8M¤83º4O¤BIº4P¤D4º4Q¤B8º6t¤7A—÷ß4{ß3y»ßaß2Vßjß3xßAßD}}{ß1ß5hß3|¦´x´´y´‡¤Gmº4k¤Gcº52¤E2º51¤Bcº4e¤A0º50¤AAº4z¤Bwº4l—÷ß4{ß3y»ßaß2jßjß3xßAßX}}÷¨icons¨|÷}");
