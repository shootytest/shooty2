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
                if (map.computed.shape_room[s.id])
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
        map.shapes?.sort((s1, s2) => (s1.computed?.depth ?? 0) - (s2.computed?.depth ?? 0));
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
            const o = { id: s.id, vertices: vector3.round_list(s.vertices, 1), options: s.options };
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
export const TEST_MAP = zipson.parse("{¨shapes¨|{¨id¨¨home¨¨vertices¨|{´x´¢5Ca´y´É}÷¨options¨{¨style¨ß2¨contains¨|¨home wall 1¨÷}}{ß1¨start¨ß3|{´x´¢-1c´y´¢1c}÷ß4{ß5ß8¨room_connections¨|¨tutorial room 1¨÷¨is_room¨»}}{ß1¨test group¨ß3|{´x´¢6x´y´¢7q}÷ß4{ß6|¨test 1¨÷¨open_loop¨«ß5¨test¨ß9|÷ßB»}}{ß1¨tutorial¨ß3|{´x´¢-Ty´y´¢-Xn}÷ß4{ß5ßGß6|ßA¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨¨tutorial room 5¨÷}}{ß1ß7ß3|¦´x´´y´‡¢5iB¢-Kb¢5NL¢-Th¢54wºA¢4pd¢-Q7¢4ep¢-Fq¢4bf¢-36¢4fP¢CM¢4pM¢MS—÷ß4{ßE»¨parent¨ß2¨make_id¨¨wall_home¨}}{ß1ßDß3|¦´x´´y´‡¢7c¢46¢8u¢88—÷ß4{ßLßCßE»ßM¨wall¨ß5ßFß6|¨test 2¨÷}}{ß1ßAß3|{´x´¢-6A´y´¢-4y}÷ß4{ß6|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨¨tutorial room 1 floor¨÷ßLßGß5ßGßB»ß9|ßHßJß8ßI÷}}{ß1ßHß3|{´x´¢OW´y´¢-DP}÷ß4{ßLßGß5ßGß6|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨¨home wow test wow¨¨tutorial room 2 floor¨÷ßB»ß9|ßKßAßI÷}}{ß1ßIß3|{´x´¢-JV´y´¢-Te}÷ß4{ßLßGß5ßGß6|¨tutorial window 1¨¨tutorial room 3 enemy 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨¨tutorial room 3 end sensor¨¨tutorial window 1 deco¨¨tutorial room 3 floor¨÷ßB»ß9|ßIßJßHßA÷}}{ß1ßJß3|{´x´¢-Yy´y´¢-Ge}÷ß4{ßLßGß5ßGß6|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨¨tutorial fake wall 3¨¨tutorial room 4 floor¨÷ßB»ß9|ßIßA÷}}{ß1ßKß3|{´x´¢9t´y´¢GK}÷ß4{ßLßGß5ßGß6|¨tutorial room 5 sensor¨¨tutorial room 5 switch path¨¨tutorial room 5 door¨¨tutorial room 5 sensor start¨¨tutorial room 5 boss¨¨tutorial room 5 floor¨÷ßB»ß9|ßH÷}}{ß1ßnß3|{´x´¢Ii´y´¢3i}÷ß4{ßLßH¨spawn_enemy¨¨checkpoint¨¨is_spawner¨»¨spawn_repeat¨Ê}}{ß1ßPß3|¦´x´´y´‡¢8w¢4r¢9s¢7u—÷ß4{ßLßDßE»ßMßOß5ßF}}{ß1ßiß3|¦´x´´y´‡¢Lm¢4q¢Ky¢84—÷ß4{ßLßHßM¨wall_tutorial_fake¨ßE»¨spawn_permanent¨»}}{ß1ß1Dß3|¦´x´´y´‡¢-M6¢-U¢-NY¤K—÷ß4{ßLßJßMß1PßE»ß1Q»}}{ß1ßSß3|{´x´¢-2Q´y´º2}÷ß4{ß5ßGßLßAß6|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷}}{ß1ßUß3|¦´x´´y´‡¢6w¢-2kºf¢18¢Bm¤A¢Ao¢-3i—÷ß4{ßLßAß6|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßM¨sensor¨¨sensor_fov_mult¨£0.EW}}{ß1ßYß3|¦´x´´y´‡¢D4¢-A¢C6¢-42¢5eºnº1¢-50¢-6Iº1¢-6m¤42¢-9q¤50¢-Bmºj¢-Bc¤BI¢-7Qºu¢-3Y¤B8¢-26ºj¤4Cºo¤6c¤1S—÷ß4{ßLßAßM¨floor_tutorial¨¨safe_floor¨»}}{ß1ßQß3|{´x´ºz´y´¢-1I}÷ß4{ß6|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß1f÷ßLßAß5ßG}}{ß1ßTß3|¦´x´´y´‡ºyºnº1ºzº10º1º11¤42º17ºj¤4Cºo¤6c¤1S—÷ß4{ßLßAßMß1Xß1YÊ}}{ß1ßWß3|{´x´¢-BI´y´ºh}÷ß4{ß5ßGß6|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßLßA}}{ß1ßeß3|¦´x´´y´‡ºy¢-CG¤4g¢-8O¤8Yº15¤9Wº19¤F9¢-HE¤9W¢-BS—÷ß4{ßLßHßMß1Xß1YÝ0ß6|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷}}{ß1ßoß3|¦´x´´y´‡¤Gw¢-Ky¤EC¢-Lc¤BS¢-KU¤4M¢-Ca¤3O¢-8iºwºxºuºvºr¤8s¤E2¤G8¤H6¤GI¤Ke¤9M¤WGºj¤Wu¤2G¤Uy¢-Ay—÷ß4{ßLßHßMß1Zß1a»}}{ß1ßaß3|{´x´¤G8´y´º16}÷ß4{ßLßHß5ßGß6|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷}}{ß1ßdß3|{´x´¤K7´y´¢-58}÷ß4{ßLßHß5ßGß6|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨¨tutorial fake wall 4¨÷}}{ß1ßjß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßLßHßMß1X}}{ß1ßbß3|{´x´¤Sl´y´¤-y}÷ß4{ßLßHß6|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ß5ßG}}{ß1ßcß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßLßHßM¨sensor_path¨ß6|¨tutorial room 2 switch¨÷}}{ß1ßfß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGºn—÷ß4{ßLßHßM¨icon_tutorial¨ß6|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷}´z´£0.1c}{ß1ßhß3|{´x´¤AT´y´¢-Jz}÷ß4{ßLßHß5ßGß6|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷}}{ß1ßkß3|¦´x´´y´‡¤CQ¤y¤Di¤FU¤Hk¤FU¤FU¤y—÷ß4{ßLßHßMß1Xß1YÝ0}}{ß1ßrß3|¦´x´´y´‡¢-Lm¢-IY¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßLßIßMß1Xß1Y£1.2Qß6|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷}}{ß1ßzß3|¦´x´´y´‡¢-Fo¢-IO¢-F0¢-FKº1J¢-Ds¢-8s¢-Fe¢-8Yº1Z¢-A0¢-K0¢-DY¢-Ke—÷ß4{ßLßIßMß1X}}{ß1ßqß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßLßIß1L¨enemy_tutorial_easy¨ß1N»ß1OÊ}}{ß1ßsß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßLßIß1Lß2Rß1N»ß1OÊ}}{ß1ß11ß3|¦´x´´y´‡¤3Oº1I¤4Mº1H¤e¢-GI¢-4Mº1G¢-84¢-Oq¢-EC¢-PAº1Q¢-I4¢-OM¢-FU¢-MQº1iº19¢-9Cº17¢-76—÷ß4{ßLßIßMß1Zß1a»}}{ß1ßwß3|¦´x´´y´‡º10º1q¤2F¢-5Tºhº1b¢-3F¢-Hl—÷ß4{ßLßIßMß1Xß1YÝ2ß6|¨tutorial rock 13¨¨tutorial fake wall 2¨÷}}{ß1ß16ß3|{´x´¢-L4´y´¤49}÷ß4{ßLßJß1L¨enemy_tutorial_rock_room4¨ß1N»ß1OÊ}}{ß1ß1Eß3|¦´x´´y´‡º1xº1iº1vº1w¢-W6¢-Ck¢-Yg¢-5A¢-Tg¤Uºm¤Kºm¤7G¢-Is¤7Gº29¤34ºkºl¢-J2¢-3Oº1Zº1I—÷ß4{ßLßJßMß1Zß1a»}}{ß1ß13ß3|{´x´¢-QI´y´¢-7G}÷ß4{ßLßJß1L¨collect_gun_basic¨ß1N»ß1OÊß1Q»}}{ß1ß14ß3|{´x´º2C´y´º2D}÷ß4{ßLßJß1L¨deco_gun_basic¨ß1N»ß1OÊ}}{ß1ß1Aß3|¦´x´´y´‡¢-Kz¢-6w¢-Kj¢-71¢-Kq¢-6Y¢-Kg¢-6W¢-Ka¢-6z¢-KP¢-6n¢-KX¢-7Y—÷ß4{ßLßJßMß2H}}{ß1ß15ß3|{´x´¢-UG´y´¢-Ej}÷ß4{ßLßJß5ßGß6|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷}}{ß1ß18ß3|{´x´¢-KQ´y´¢-8W}÷ß4{ßLßJß1L¨enemy_tutorial_rocky¨ß1N»ß1OÊß1Q»}}{ß1ß19ß3|{´x´¢-VY´y´¢-5Q}÷ß4{ßLßJß1Lß2aß1N»ß1OÊß1Q»}}{ß1ß12ß3|¦´x´´y´‡¢-OK¢-Fk¢-WG¢-Cu¢-Yqº27¢-Tq¤e¢-Ma¤Uº29¢-3E¢-IEº1d—÷ß4{ßLßJßMß1Xß1Y£1.4q}}{ß1ß17ß3|{´x´¢-Ic´y´¤16}÷ß4{ßLßJß1L¨switch¨ß1N»ß1OÊ}}{ß1ß1Jß3|{´x´¤Fq´y´¤TU}÷ß4{ßLßKß1L¨enemy_tutorial_boss¨ß1N»ß1OÊ}}{ß1ß1Hß3|¦´x´´y´‡¤KU¤GS¤HQ¤GI—÷ß4{ßE»ß5¨tutorial_door¨ßLßK}}{ß1ß1Kß3|¦´x´´y´‡¤E2¤G8¤H6¤GI¤RG¤MG¤T2¤Vw¤Lw¤fc¤AA¤g6¤25¤X4ºh¤M6—÷ß4{ßLßKßMß1Zß1a»}}{ß1ß1Fß3|¦´x´´y´‡¤1w¤Ko¤1w¤ci¤Tg¤ci¤TM¤Ke—÷ß4{ßLßKßMß1X}}{ß1ß1Iß3|¦´x´´y´‡¤Cu¤GS¤Bc¤HQ¤JM¤HQ¤IE¤GS—÷ß4{ßLßKßMß1Xß1Y£1.6S}}{ß1ß1Gß3|¦´x´´y´‡¤HQ¤GI¤E2¤G8—÷ß4{ßLßKßMß2F}}{ß1ßtß3|¦´x´´y´‡¢-C6º1y¢-D4¢-9gº13¢-B8—÷ß4{ßLßIßM¨wall_tutorial_spike¨}}{ß1ßuß3|¦´x´´y´‡º29¢-EW¢-JWº1w¢-HG¢-G8—÷ß4{ßLßIßMß2e}}{ß1ßvß3|¦´x´´y´‡¢-Af¢-PH¢-Bw¢-PKº19¢-NO—÷ß4{ßLßIßMß2e}}{ß1ß1Bß3|¦´x´´y´‡¢-Iu¤5Sº29¤34ºkºlº2Aº2Bº1Zº1Iº1xº1i—÷ß4{ßLßJßM¨wall_tutorial¨ßE»}}{ß1ßRß3|¦´x´´y´‡¢-38¤7Aº17ºj¤4Cºo¤6c¤1Sºuºv—÷ß4{ßE»ßLßAßMß2f}}{ß1ßVß3|¦´x´´y´‡¢-6e¤2Yº11¤42—÷ß4{ßLßAßMß2fßE»}}{ß1ßZß3|¦´x´´y´‡¤Lw¤fc¤T2¤Vw¤RG¤MG¤H6¤GI¤Ha¤CG¤Ke¤9Mºiºj¤WGºj¤WGºhºgºh¤M8¤3G¤WN¤48¤Wj¤2G¤Ut¢-Ax¤NN¢-Bh¤Ls¢-H8¤Gp¢-Ip¤Dr¢-Gp—÷ß4{ßE»ßLßHßMß2f}}{ß1ßlß3|¦´x´´y´‡¤3Oº1I¤9qº1zºwºx—÷ß4{ßLßHßMß2fßE»}}{ß1ß1Cß3|¦´x´´y´‡ºm¤6Iºm¤Kº28¤Uº26º27º24º25º1vº1w—÷ß4{ßLßJßMß2fßE»}}{ß1ßgß3|¦´x´´y´‡¤Cvº1X¤Bt¢-FS¤BS¢-Ao¤4Mº1H—÷ß4{ßE»ßLßHßMß2f}}{ß1ßXß3|¦´x´´y´‡ºwºxºyºnº1ºzº10º1¢-6T¤U—÷ß4{ßLßAßMß2fßE»}}{ß1ßmß3|¦´x´´y´‡ºuºvºr¤8s¤EW¤C1¤E2¤G8ºh¤M6¤26¤X4¤AA¤g6¤Lw¤fc—÷ß4{ßE»ßLßHßMß2f}}{ß1ßyß3|¦´x´´y´‡º1xº1i¢-Jqº2pº2o¢-CQº19º1y¢-5eº2lº17º1z¤3Oº1I—÷ß4{ßLßIßMß2fßE»}}{ß1ßxß3|¦´x´´y´‡º1vº1wº1Qº1uº2Aº2nº1sº1tº1qº1rº1pº1Gº1Lº1a¤eº1o¤4Mº1H—÷ß4{ßLßIßMß2fßE»}}{ß1ßpß3|¦´x´´y´‡¢-FAº39º1Jº1Vº1Iº1eº1Bº1Zº1g¢-KAº1i¢-Koº1Tº1Zº39º39—÷ß4{ßLßIßM¨wall_tutorial_window¨ßE»}}{ß1ß10ß3|¦´x´´y´‡º39º39º1Jº1Vº1Iº1eº1Bº1Zº1gº3Aº1iº3Bº1Tº1Zº39º39—÷ß4{ßLßIßMß2g}}{ß1ß2Tß3|¦´x´´y´‡º18º2bº17º2l—÷ß4{ßLßwßMß1PßE»ß1Q»}}{ß1ß28ß3|¦´x´´y´‡¤Hkº11¤Gc¢-7a—÷ß4{ßLßdßMß1PßE»ß1Q»}}{ß1ß1bß3|¦´x´´y´‡¤-Lº2BÒºt¤xº16¤1H¢-2u¤w¢-2P¤I¢-2F¤-M¢-2Z—÷ß4{ßLßQßM¨wall_tutorial_rock¨}}{ß1ß1cß3|¦´x´´y´‡¤2F¤5A¤2Z¤4W¤3N¤4C¤41ºh¤41¤5o¤3D¤68¤2P¤5y—÷ß4{ßLßQßMß2h}}{ß1ß1dß3|¦´x´´y´‡¢-5p¢-18¢-5fº1¢-4r¢-1w¢-4N¢-1Sº3M¤-o¢-51ºl¢-5V¤-e—÷ß4{ßLßQßMß2h}}{ß1ß1eß3|¦´x´´y´‡¢-3j¤5K¢-35¤50¢-2H¤50¢-1nºy¢-1x¤6c¢-2R¤5y¢-4B¤6G—÷ß4{ßLßQßMß2h}}{ß1ß1fß3|¦´x´´y´‡º35¤Uº2x¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßLßQßM¨wall_tutorial_rock_breakable¨}}{ß1ß1uß3|¦´x´´y´‡¤Mn¢-3H¤Oxº2B¤Pu¢-4E¤PP¢-68¤OEº2L¤Mz¢-6F¤MK¢-4z—÷ß4{ßLßdßMß2h}}{ß1ß1vß3|¦´x´´y´‡¤Cl¢-48¤Doº16¤Ee¢-47¤Ee¢-5F¤E8ºQ¤CjºQ¤C8¢-52—÷ß4{ßLßdßMß2h}}{ß1ß1wß3|¦´x´´y´‡¤F9¢-41¤Gm¢-3s¤Ho¢-4Q¤Hq¢-5c¤Gh¢-6V¤FbºQ¤Ew¢-59—÷ß4{ßLßdßMß2h}}{ß1ß1xß3|¦´x´´y´‡¤Iw¢-3q¤Kv¢-3W¤Lp¢-4l¤Lk¢-67¤K1¢-6j¤IT¢-6D¤IA¢-4w—÷ß4{ßLßdßMß2h}}{ß1ß1yß3|¦´x´´y´‡¤Hkº11¤JCº15¤JVº1y¤IR¢-A3¤H9¢-AJ¤GJ¢-96¤Gcº3C—÷ß4{ßLßdßMß2hßE»}}{ß1ß1zß3|¦´x´´y´‡¤DD¢-FZ¤Dr¢-Fb¤EB¢-Fs¤EI¢-GO¤Drº32¤D8¢-Gn¤Cvº1X—÷ß4{ßLßdßMß2h}}{ß1ß20ß3|¦´x´´y´‡¤KZ¢-G2¤L2¢-Fn¤Lb¢-G0¤Lf¢-GR¤LJ¢-H1¤Km¢-H2¤KQ¢-GX—÷ß4{ßLßdßMß2h}}{ß1ß2Sß3|¦´x´´y´‡º17º2lº3Nº2k¤Kº12¤1mº2l¤1Sº25¤Aº1iº18º2b—÷ß4{ßLßwßMß2hßE»}}{ß1ß2Xß3|¦´x´´y´‡¢-VIº2i¢-V8º1H¢-UKº2bº2dº37º2dº13¢-UUº1D¢-Uyº14—÷ß4{ßLß15ßMß2h}}{ß1ß2Yß3|¦´x´´y´‡¢-OWº3L¢-O2¢-2V¢-NJ¢-2fº2e¢-2G¢-Mkº18ºm¤-yº1vº3I—÷ß4{ßLß15ßMß2h}}{ß1ß2Zß3|¦´x´´y´‡¢-TMº18¢-T2º3L¢-SEº4K¢-RQ¢-1m¢-RG¤-y¢-Ru¤-Kº4Nºl—÷ß4{ßLß15ßMß2h}}{ß1ß21ß3|¦´x´´y´‡¤Fd¤1h¤GZ¤1y¤HJ¤1R¤HJ¤R¤GT¤-G¤FH¤-F¤Ew¤m—÷ß4{ßLßdßMß2h}}{ß1ß22ß3|¦´x´´y´‡¤Hz¤1m¤J3¤1o¤JH¤19¤JA¤N¤IfÁ¤HlÒ¤Hb¤14—÷ß4{ßLßdßMß2h}}{ß1ß23ß3|¦´x´´y´‡¤Jl¤1o¤Km¤2V¤Lr¤22¤MF¤h¤LQÒ¤K4¤B¤JX¤c—÷ß4{ßLßdßMß2h}}{ß1ß25ß3|¦´x´´y´‡¤MQ¤2G¤NY¤2z¤PA¤2y¤Py¤2M¤Pw¤1A¤Oa¤R¤My¤V—÷ß4{ßLßdßMß2h}}{ß1ß26ß3|¦´x´´y´‡¤QR¤2D¤R7¤2m¤Rw¤2f¤SI¤1u¤S2¤16¤R7¤l¤QWºq—÷ß4{ßLßdßMß2h}}{ß1ß27ß3|¦´x´´y´‡¤Sn¤1x¤Uf¤2J¤Vr¤17¤Vo¤-L¤UV¤-k¤TG¤-G¤Sf¤h—÷ß4{ßLßdßMß2h}}{ß1ß1Rß3|¦´x´´y´‡¤4X¤-T¤50¤-K¤4jÎ¤50¤-K¤3OÒ—÷ß4{ßLßSßMß2HßE»}´z´Ý1}{ß1ß1Sß3|¦´x´´y´‡ºx¤-yºx¢-2aº3Nº1Lºl¢-4Cºlº3L¤1N¢-2L¤1Sº16¤5Kº4K—÷ß4{ßLßSß1L¨enemy_tutorial_bit¨ß1N»ß1OÎ}}{ß1ß1Tß3|¦´x´´y´‡¢-4Wºyº10¤3sº3b¤-y¢-5Kºvº3j¤-yº1p¤3Eº2f¤4g—÷ß4{ßLßSß1Lß2jß1N»ß1OÎ}}{ß1ß1Uß3|¦´x´´y´‡¤9Mº18ºe¤m—÷ß4{ßE»ß5ß2dßLßU}}{ß1ß1Vß3|¦´x´´y´‡¤9Mº18¤8q¢-3M—÷ß4{ß5ß2dßLßUßE»}}{ß1ß1Wß3|¦´x´´y´‡¤8E¢-34¤9C¤o¤AU¤U¤9Wº2B—÷ß4{ßLßUßM¨deco¨ß5¨tutorial_door_floor¨}}{ß1ß1hß3|{´x´¢-5B´y´¤A9}÷ß4{ßLßWß1Lß2aß1N»ß1OÊ}}{ß1ß1iß3|{´x´¢-9P´y´¤71}÷ß4{ßLßWß1Lß2aß1N»ß1OÊß1Q»}}{ß1ß1jß3|{´x´¢-9i´y´¤A7}÷ß4{ßLßWß1Lß2aß1N»ß1OÊß1Q»}}{ß1ß1nß3|¦´x´´y´‡¤A6¢-9m¤9g¢-9Q¤A5¢-93¤9gº4e¤BM¢-9O—÷ß4{ßLßeßMß2HßE»}´z´Ý1}{ß1ß1oß3|¦´x´´y´‡¤ER¢-5Z¤E8¢-56¤Dnº4h¤E8º4i¤E8º2x—÷ß4{ßLßeßMß2HßE»}´z´Ý1}{ß1ß1pß3|¦´x´´y´‡¤GI¤EA¤Fi¤Em¤FJ¤E4¤Fi¤Em¤Fu¤Cj—÷ß4{ßLßeßMß2HßE»}´z´Ý1}{ß1ß24ß3|{´x´¤Dz´y´¤Y}÷ß4{ßLßdß1L¨enemy_tutorial_block¨ß1N»ß1OÊß1Q»}}{ß1ß29ß3|¦´x´´y´‡¤MZº21¤Lx¢-3K¤LH¢-3R¤M4¢-4c¤M5º4i¤M1ºQ¤KK¢-6r¤NVº2x¤Mgº10¤M8º4i¤M7º4l—÷ß4{ßLßbß1Lß2jß1N»ß1OÎ}}{ß1ß2Aß3|¦´x´´y´‡¤TB¤-T¤SI¤x¤RG¤X¤Q1¤i¤SY¢-1F¤Uy¢-2n¤VZ¢-1G—÷ß4{ßLßbß1Lß2jß1OÎß1N»}}{ß1ß2Bß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßLßbß1Lß2jß1N»ß1OÎ}}{ß1ß2Dß3|¦´x´´y´‡¤Haºr¤EW¤Bcºw¤8sºu¤1S¤GS¤2Q¤HQ¤1w¤JW¤26¤Ko¤2u¤Lw¤2Q¤K0¤9W—÷ß4{ßLßbß1Lß2jß1O¤Cß1N»}}{ß1ß1lß3|¦´x´´y´‡¤76º12¤6a¢-7m—÷ß4{ßE»ß5ß2dßLße}}{ß1ß1mß3|¦´x´´y´‡¤76º12ºM¢-Bu—÷ß4{ßE»ß5ß2dßLße}}{ß1ß1kß3|¦´x´´y´‡ºoº2s¤5yº1q¤7G¢-7k¤8Eº14—÷ß4{ßLßeßMß2kß5ß2l}}{ß1ß2Cß3|{´x´¤Hb´y´¢-C3}÷ß4{ßLßbß1L¨enemy_tutorial_4way¨ß1N»ß1OÊ}}{ß1ß2Eß3|{´x´¤R6´y´¤5o}÷ß4{ßLßbß1L¨enemy_tutorial_down¨ß1N»ß1OÊ}}{ß1ß2Gß3|{´x´¤FM´y´¢-7V}÷ß4{ßLßcß1Lß2bß1N»ß1OÊ}}{ß1ß2Iß3|¦´x´´y´‡¤E6¢-1h¤EB¢-21—÷ß4{ßLßfßMß2HßE»}´z´Ý1}{ß1ß2Jß3|¦´x´´y´‡¤E4¢-1X¤E4º53—÷ß4{ßLßfßMß2HßE»}´z´Ý1}{ß1ß2Kß3|{´x´¤Ei´y´¢-Jr}÷ß4{ßLßhß1Lß2aß1N»ß1OÊß1Q»}}{ß1ß2Oß3|{´x´¤Bv´y´¢-IN}÷ß4{ßLßhß1Lß2aß1N»ß1OÊß1Q»}}{ß1ß2Lß3|¦´x´´y´‡¤Ba¢-FT¤H1¢-JI¤Gl¢-L3¤E4¢-Lp¤BS¢-Ki¤9f¢-Il¤9j¢-GL—÷ß4{ßLßhßMß1Xß1Y£0.BI}}{ß1ß2Mß3|¦´x´´y´‡¤D8º42¤EC¢-FN—÷ß4{ßLßhßMß2F}}{ß1ß2Pß3|¦´x´´y´‡º1E¢-Eg¢-NE¢-Gw—÷ß4{ßE»ß5ß2dßLßr}}{ß1ß2Qß3|¦´x´´y´‡¢-LIº2mº3Bº1a¢-Mu¢-H6º2u¢-Gc—÷ß4{ßLßrßMß2kß5ß2l}}{ß1ß1qß3|¦´x´´y´‡¤Gh¢-43¤G8ºn¤FPº4U—÷ß4{ßLßaßMß2e}}{ß1ß1rß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Keº1—÷ß4{ßLßaßMß2e}}{ß1ß1sß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Ojº3H¤P3¢-5i¤Tdº3r¤PE¢-4S¤OX¢-3f¤OCº18¤N9º16—÷ß4{ßLßaßMß2e}}{ß1ß1tß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßLßaßMß2e}}{ß1ß1gß3|¦´x´´y´‡º3W¤6Gº11¤42º12¤50º5T¤83º14¤BIº15ºuº16¤B8º2w¤7A—÷ß4{ßE»ßLßWßMß2f}}{ß1ß2Nß3|¦´x´´y´‡¤Gpº31¤GZº2I¤E4¢-LR¤Bcº2U¤A0º2h¤A3¢-GT¤Btº33—÷ß4{ßE»ßLßhßMß2f}}÷¨icons¨|÷}");
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
