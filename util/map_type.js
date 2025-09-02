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
            const o = { id: s.id, vertices: s.vertices, options: s.options };
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
export const TEST_MAP = zipson.parse("{¨shapes¨|{¨id¨¨start¨¨vertices¨|{´x´¢-1c´y´¢1c}÷¨options¨{¨style¨ß2¨room_connections¨|¨tutorial room 1¨÷¨is_room¨»}}{ß1¨test group¨ß3|{´x´¢5w´y´¢8v}÷ß4{¨contains¨|¨test 1¨÷¨open_loop¨«ß5¨test¨ß8»}}{ß1¨tutorial¨ß3|{´x´¢-Ty´y´¢-Xn}÷ß4{ß5ßEßA|ß7¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨¨tutorial room 5¨÷}}{ß1¨home¨ß3|{´x´¢2bI´y´É}÷ß4{}}{ß1ß7ß3|{´x´¢-6A´y´¢-4y}÷ß4{ßA|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial room 1.1¨¨tutorial wall 10¨÷¨parent¨ßEß5ßEß8»ß6|ßFßHß2ßG÷}}{ß1ßHß3|{´x´¢-Yy´y´¢-Ge}÷ß4{ßSßEß5ßEßA|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨¨tutorial wall 1¨¨tutorial wall 7¨÷ß8»ß6|ßGß7÷}}{ß1ßFß3|{´x´¢OW´y´¢-DP}÷ß4{ßSßEß5ßEßA|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨¨tutorial wall 6¨¨tutorial wall 11¨÷ß8»ß6|ßIß7ßG÷}}{ß1ßGß3|{´x´¢-L3´y´¢-SF}÷ß4{ßSßEß5ßEßA|¨tutorial window 1¨¨tutorial room 3 enemy 1¨¨tutorial room 3 door sensor¨¨tutorial room 3 enemy 2¨¨tutorial window 1 deco¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial room 3 start sensor¨¨tutorial wall 13¨¨tutorial wall 12¨÷ß8»ß6|ßGßHßFß7÷}}{ß1ßIß3|{´x´¢9t´y´¢GK}÷ß4{ßSßEß5ßEßA|¨tutorial room 5 sensor¨¨tutorial room 5 switch path¨¨tutorial room 5 door¨¨tutorial room 5 sensor start¨¨tutorial room 5 boss¨÷ß8»ß6|ßF÷}}{ß1ßBß3|¦´x´´y´‡£5y.EK£5B.2e£7G.EK£9D.2e—÷ß4{ßSß9ßC»¨make_id¨¨wall¨ß5ßDßA|¨test 2¨÷}}{ß1ßQß3|{´x´¢-BI´y´¢4q}÷ß4{ß5ßEßA|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßSß7}}{ß1ßmß3|{´x´¢AT´y´¢-Jz}÷ß4{ßSßFß5ßEßA|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷}}{ß1ß1Aß3|¦´x´´y´‡£7J.5K£5v.CF£8F.5K£8y.CF—÷ß4{ßSßBßC»ß18ß19ß5ßD}}{ß1ßKß3|{´x´¢-50´y´¢-1I}÷ß4{ßA|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß1O÷ßSß7ß5ßE}}{ß1ßWß3|{´x´£-UG.-3T´y´£-Ei.-BG}÷ß4{ßSßHß5ßEßA|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷}}{ß1ßiß3|{´x´¢K7´y´¢-58}÷ß4{ßSßFß5ßEßA|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨÷}}{ß1ßfß3|{´x´¢G7´y´¢-3R}÷ß4{ßSßFß5ßEßA|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷}}{ß1ßZß3|{´x´£-KQ.-3T´y´£-8V.-BG}÷ß4{ßSßH¨spawn_enemy¨¨enemy_tutorial_rocky¨¨is_spawner¨»¨spawn_repeat¨Ê¨spawn_permanent¨»}}{ß1ßaß3|{´x´£-VY.-3T´y´£-5P.-BG}÷ß4{ßSßHß1kß1lß1m»ß1nÊß1o»}}{ß1ßMß3|{´x´¢-2Q´y´º1}÷ß4{ß5ßEßSß7ßA|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷}}{ß1ßgß3|{´x´¢Sl´y´¢-y}÷ß4{ßSßFßA|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ß5ßE}}{ß1ßNß3|¦´x´´y´‡¢5eºRº0ºL¢-6Iº0¢-6m¢42¢-26¢84¢4C¢6w¢6c¢1S—÷ß4{ßSß7ß18¨sensor¨¨sensor_fov_mult¨Ê}}{ß1ßcß3|¦´x´´y´‡£-KU.-3T£4W.4s£-Is.-3T£34.4s£-Md.-3T£-3.-BG£-J6.-3T£-3U.-BG£-IQ.-3T£-8e.-BG£-MQ.-3T£-DX.-BG—÷ß4{ßSßHß18¨wall_tutorial¨ßC»}}{ß1ß11ß3|¦´x´´y´‡¢-OM¢-FU¢-Lm¢-I4¢-J5¢-JS£-EF.-Ac£-PD.-84£-80.-Ac£-Os.-84£-4M.-Ac£-KY.-84£-4i.-Ac£-Ex.-84¤f¢-GM¢4M¢-Ca—÷ß4{ßSßGß18ß20ßC»}}{ß1ßqß3|¦´x´´y´‡¢3O¢-8i¢9q¢-76¢C6¢-42—÷ß4{ßSßFß18ß20ßC»}}{ß1ßRß3|¦´x´´y´‡ºrºsºUºRº0ºLºVº0¢-6T¤U—÷ß4{ßSß7ß18ß20ßC»}}{ß1ßPß3|¦´x´´y´‡¢-6e¢2YºWºX—÷ß4{ßSß7ß18ß20ßC»}}{ß1ßnß3|¦´x´´y´‡¢LmºI¢KyºZ—÷ß4{ßSßFß18¨wall_tutorial_fake¨ßC»ß1o»}}{ß1ßLß3|¦´x´´y´‡¢-38¢7AºYºZºaºbºcºd¤D4¤-A—÷ß4{ßC»ßSß7ß18ß20}}{ß1ßrß3|¦´x´´y´‡¤D4¤-A¤Bm¤8s£EV.87£C1.3u¤E2¤G8¤4m¤M8¤23¤X3¤AB¤g0¤M9¤fQ—÷ß4{ßC»ßSßFß18ß20}}{ß1ßOß3|¦´x´´y´‡ºb¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßSß7ßA|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ß18ß1yß1z£0.EW}}{ß1ßjß3|¦´x´´y´‡ºU¢-CG¤4g¢-8O¤8Y¢-7Q¤9WºH¤F9¢-HE¤9W¢-BS—÷ß4{ßSßFß18ß1yß1zÝaßA|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷}}{ß1ßoß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßSßFß18ß1y}}{ß1ßpß3|¦´x´´y´‡¤CV¤11¤Dk¤Fa¤Hi¤FV¤FX¤12—÷ß4{ßSßFß18ß1yß1zÝa}}{ß1ß13ß3|¦´x´´y´‡¤6B¤Kc¤4y¤LR¤Qm¤Ld¤PA¤Kl—÷ß4{ßSßIß18ß1y}}{ß1ß16ß3|¦´x´´y´‡¤Cy¤GU¤Be¤HL¤JK¤HM¤I1¤Gc—÷ß4{ßSßIß18ß1yß1z£1.6S}}{ß1ßuß3|¦´x´´y´‡ºg¢-IY¢-OC¢-Fy¢-Lw¢-Di¢-JN¢-G9—÷ß4{ßSßGß18ß1yß1z£1.2QßA|¨tutorial room 3 door¨¨tutorial room 3 door floor¨÷}}{ß1ß10ß3|¦´x´´y´‡£-6K.-3r£-87.-8B¤2F¢-5T¤4k¢-FC¢-3B¢-Hl—÷ß4{ßSßGß18ß1yß1zÝcßA|¨tutorial rock 13¨¨tutorial fake wall 2¨÷}}{ß1ßhß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßSßFß18¨sensor_path¨ßA|¨tutorial room 2 switch¨÷}}{ß1ß14ß3|¦´x´´y´‡¤HQ¤GI¤E2¤G8—÷ß4{ßSßIß18ß2F}}{ß1ßeß3|¦´x´´y´‡¤M0¤fR¤T2¤Vy¤RE¤MK¤H6¤GI¤Ha¤CG¤Ke¤9MºxºZ¤WGºZ¤WGºIºwºI¤M8¤3G¤WN¤48¤Wj¤2G¤Ut¢-Ax¤NN¢-Bh¤Ls¢-H8¤Gp¢-Ip¤Dr¢-Gp—÷ß4{ßC»ßSßFß18ß20}}{ß1ßlß3|¦´x´´y´‡¤Cvº1D¤Bt¢-FS¤BS¢-Aoºlºm—÷ß4{ßC»ßSßFß18ß20}}{ß1ßkß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGºR—÷ß4{ßSßFß18¨icon_tutorial¨ßA|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷}´z´£0.-1c}{ß1ßbß3|¦´x´´y´‡£-Kz.-3T£-6v.-BG£-Kj.-3T£-70.-BG£-Kq.-3T£-6X.-BG£-Kg.-3T£-6V.-BG£-Ka.-3T£-6y.-BG£-KP.-3T£-6m.-BG£-KX.-3T£-7X.-BG—÷ß4{ßSßHß18ß2H}}{ß1ßsß3|¦´x´´y´‡£-FC.-Ac£-F7.-84£-B0.-Ac£-Df.-84£-8k.-Ac£-Fi.-84£-8P.-Ac£-IR.-84£-9x.-Ac£-KF.-84£-DT.-Ac£-Kt.-84£-Fw.-Ac£-IK.-84ÝuÝv—÷ß4{ßSßGß18¨wall_tutorial_window¨ßC»}}{ß1ßwß3|¦´x´´y´‡£-FC.-6p£-F7.-6h£-B0.-6p£-Df.-6h£-8k.-6p£-Fi.-6h£-8P.-6p£-IR.-6h£-9x.-6p£-KF.-6h£-DT.-6p£-Kt.-6h£-Fw.-6p£-IK.-6hÝ18Ý19—÷ß4{ßSßGß18ß2K¨decoration¨»}}{ß1ßtß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßSßGß1k¨enemy_tutorial_easy¨ß1m»ß1nÊ}}{ß1ßvß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßSßGß1kß2Mß1m»ß1nÊ}}{ß1ßTß3|¦´x´´y´‡¢-OK¢-Fk£-WU.-3T£-D2.-BG£-ZC.-3T£-5H.-BG£-Tv.-3T£i.4s£-Ml.-3T£P.4s£-Ik.-3T£-3L.-BG¢-I6¢-8s—÷ß4{ßSßHß18ß1yß1z£1.4q}}{ß1ßxß3|¦´x´´y´‡¢-C2¢-9C£-D3.-A3£-9g.-9h¢-Bg¢-B7—÷ß4{ßSßGß18¨wall_tutorial_spike¨}}{ß1ßzß3|¦´x´´y´‡¢-Ab¢-PI¢-Bt¢-PL¢-BH¢-NN—÷ß4{ßSßGß18ß2N}}{ß1ßyß3|¦´x´´y´‡¢-J1¢-ET¢-Jh¢-FO¢-HF¢-G8—÷ß4{ßSßGß18ß2N}}{ß1ßUß3|{´x´£-QI.-3T´y´£-7F.-BG}÷ß4{ßSßHß1k¨collect_gun_basic¨ß1m»ß1nÊß1o»}}{ß1ßVß3|{´x´Ý1Z´y´Ý1a}÷ß4{ßSßHß1k¨deco_gun_basic¨ß1m»ß1nÊ}}{ß1ßXß3|{´x´£-MT.-3T´y´£j.4s}÷ß4{ßSßHß1k¨enemy_tutorial_rock_room4¨ß1m»ß1nÊ}}{ß1ßYß3|{´x´£-K9.-3T´y´£3H.4s}÷ß4{ßSßHß1k¨switch¨ß1m»ß1nÊ}}{ß1ß17ß3|{´x´¤Fq´y´¤TU}÷ß4{ßSßIß1k¨enemy_tutorial_boss¨ß1m»ß1nÊ}}{ß1ß15ß3|¦´x´´y´‡¤KU¤GS¤HQ¤GI—÷ß4{ßC»ß5¨tutorial_door¨ßSßI}}{ß1ß12ß3|¦´x´´y´‡¢-MQ¢-DY¢-Jqº1q£-HC.-Ac£-CN.-84£-BI.-Ac£-9D.-84£-5g.-Ac£-B5.-84¢-25¢-70ºnºo—÷ß4{ßSßGß18ß20ßC»}}{ß1ßdß3|¦´x´´y´‡ÝEÝF£-NC.-3T£N.4s£-Tj.-3T£O.4s£-Yf.-3T£-5F.-BG£-WA.-3T£-Ci.-BG£-OM.-3T£-FT.-BG—÷ß4{ßSßHß18ß20ßC»}}{ß1ß2Eß3|¦´x´´y´‡¢-1M¢-Csº1u¢-BB—÷ß4{ßSß10ß18ß21ßC»ß1o»}}{ß1ß2Dß3|¦´x´´y´‡º1uº1y¢-1T¢-9c¤N¢-9s¤1pº1yºd¢-Cl¤C¢-Deº1wº1x—÷ß4{ßSß10ß18¨wall_tutorial_rock¨ßC»}}{ß1ß2Cß3|¦´x´´y´‡¢-LI¢-EW¢-Ko¢-F0¢-Mu¢-H6¢-NO¢-Gc—÷ß4{ßSßuß18¨floor_tutorial¨}}{ß1ß2Bß3|¦´x´´y´‡¢-Ky¢-Eg¢-NE¢-Gw—÷ß4{ßC»ß5ß2TßSßu}}{ß1ß1Bß3|¦´x´´y´‡¢-4B¤6GºWºX¢-9q¤50£-Bk.-9W£83.5x¢-Bc¤BIº14¤D4¢-3Y¤B8ºyºz—÷ß4{ßC»ßSßQß18ß20}}{ß1ß1Cß3|{´x´¢-5B´y´¤A9}÷ß4{ßSßQß1kß1lß1m»ß1nÊ}}{ß1ß1Eß3|{´x´¢-9i´y´¤A7}÷ß4{ßSßQß1kß1lß1m»ß1nÊ}}{ß1ß1Dß3|{´x´¢-9P´y´¤71}÷ß4{ßSßQß1kß1lß1m»ß1nÊ}}{ß1ß1cß3|{´x´¤Dz´y´¤Y}÷ß4{ßSßiß1k¨enemy_tutorial_block¨ß1m»ß1nÊß1o»}}{ß1ß1Iß3|¦´x´´y´‡¤Gpº1N¤GZ¢-Kq¤E4¢-LR¤Bc¢-KQ¤A0¢-Ic¤A3¢-GT¤Btº1P—÷ß4{ßC»ßSßmß18ß20}}{ß1ß1Hß3|¦´x´´y´‡¤D8¢-Gn¤EC¢-FN—÷ß4{ßSßmß18ß2F}}{ß1ß1Gß3|¦´x´´y´‡¤Ba¢-FT¤H1¢-JI¤GlºD¤E4¢-Lp¤BS¢-Ki¤9f¢-Il¤9j¢-GL—÷ß4{ßSßmß18ß1yß1z£0.BI}}{ß1ß1Fß3|{´x´¤Ei´y´¢-Jr}÷ß4{ßSßmß1kß1lß1m»ß1nÊß1o»}}{ß1ß1Jß3|{´x´¤Bv´y´¢-IN}÷ß4{ßSßmß1kß1lß1m»ß1nÊß1o»}}{ß1ß2Iß3|¦´x´´y´‡¤E6¢-1h¤EB¢-21—÷ß4{ßSßkß18ß2HßC»}´z´Ýf}{ß1ß2Jß3|¦´x´´y´‡¤E4¢-1X¤E4º2e—÷ß4{ßSßkß18ß2HßC»}´z´Ýf}{ß1ß2Gß3|{´x´¤FM´y´¢-7V}÷ß4{ßSßhß1kß2Rß1m»ß1nÊ}}{ß1ß1vß3|{´x´¤Hb´y´¢-C3}÷ß4{ßSßgß1k¨enemy_tutorial_4way¨ß1m»ß1nÊ}}{ß1ß1xß3|{´x´¤R6´y´¤5o}÷ß4{ßSßgß1k¨enemy_tutorial_down¨ß1m»ß1nÊ}}{ß1ß1Wß3|¦´x´´y´‡£Hj.9m£-6g.-Bz£JB.9m£-7P.-Bz£JU.9m£-9B.-Bz£IQ.9m£-A2.-Bz£H8.9m£-AI.-Bz£GI.9m£-95.-Bz£GY.9m£-7d.-Bz—÷ß4{ßSßiß18ß2U}}{ß1ß1Vß3|¦´x´´y´‡¤Iw¢-3q¤Kv¢-3W¤Lp¢-4l¤Lk¢-67¤K1¢-6j¤IT¢-6D¤IA¢-4w—÷ß4{ßSßiß18ß2U}}{ß1ß1Zß3|¦´x´´y´‡¤Fd¤1h¤GZ¤1y¤HJ¤1R¤HJ¤R¤GT¤-G¤FH¤-F¤Ew¤m—÷ß4{ßSßiß18ß2U}}{ß1ß1aß3|¦´x´´y´‡¤Hz¤1m¤J3¤1o¤JH¤19¤JA¤N¤IfÁ¤HlÒ¤Hb¤14—÷ß4{ßSßiß18ß2U}}{ß1ß1bß3|¦´x´´y´‡£Jk.CG£1n.FD¤Km¤2V¤Lr¤22¤MF¤h¤LQÒ¤K4¤B¤JX¤c—÷ß4{ßSßiß18ß2U}}{ß1ß1dß3|¦´x´´y´‡¤MQ¤2G¤NY¤2z¤PA¤2y¤Py¤2M£Pw.27£19.Bh¤Oa¤R¤My¤V—÷ß4{ßSßiß18ß2U}}{ß1ß1eß3|¦´x´´y´‡¤QR¤2D¤R7¤2m¤Rw¤2f¤SI¤1u¤S2¤16¤R7¤l¤QW¤18—÷ß4{ßSßiß18ß2U}}{ß1ß1fß3|¦´x´´y´‡¤Sn¤1x¤Uf¤2J¤Vr¤17¤Vo¤-L¤UV¤-k¤TG¤-G¤Sf¤h—÷ß4{ßSßiß18ß2U}}{ß1ß1Uß3|¦´x´´y´‡¤F9¢-41¤Gp¢-3r¤Ho¢-4Q¤Hq¢-5c¤Gh¢-6V¤Fbº7¤Ew¢-59—÷ß4{ßSßiß18ß2U}}{ß1ß1Tß3|¦´x´´y´‡¤Cl¢-48¤Doº2J¤Ee¢-47¤Ee¢-5F¤E8º7¤Cjº7¤C8¢-52—÷ß4{ßSßiß18ß2U}}{ß1ß1Xß3|¦´x´´y´‡¤DD¢-FZ¤Dr¢-Fb¤EB¢-Fs¤EI¢-GO¤Drº1O¤D8º2S¤Cvº1D—÷ß4{ßSßiß18ß2U}}{ß1ß1Yß3|¦´x´´y´‡¤KZ¢-G2£L2.1S£-Fn.-b¤Lb¢-G0¤Lf¢-GR¤LJ¢-H1£Km.2x£-H1.-Ep¤KQ¢-GX—÷ß4{ßSßiß18ß2U}}{ß1ß1Sß3|¦´x´´y´‡¤Mn¢-3H¤Ox¢-3O¤Pu¢-4E¤PP¢-68¤OE¢-6W¤Mz¢-6F¤MK¢-4z—÷ß4{ßSßiß18ß2U}}{ß1ß1gß3|¦´x´´y´‡¤Gh¢-43¤G2¢-2K¤FP¢-4C—÷ß4{ßSßfß18ß2N}}{ß1ß1iß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Oj¢-5p¤P3¢-5i¤Tdº2k¤PE¢-4S¤OX¢-3f¤OH¢-1J¤N9º2J—÷ß4{ßSßfß18ß2N}}{ß1ß1hß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Kf¢-1b—÷ß4{ßSßfß18ß2N}}{ß1ß1jß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßSßfß18ß2N}}{ß1ß1qß3|¦´x´´y´‡ºsºTºs¢-2a¢-1Sº1I¤-Uº3G¤-U¢-1w£1M.9T£-2L.-2bºdº2J¤5K¢-2G—÷ß4{ßSßMß1k¨enemy_tutorial_bit¨ß1m»ß1nÎ}}{ß1ß1rß3|¦´x´´y´‡¢-4WºUºV¤3sº3AºT¢-5K¤-A¢-3sºT¢-4M¤3E¢-3E¤4g—÷ß4{ßSßMß1kß2Zß1m»ß1nÎ}}{ß1ß1sß3|¦´x´´y´‡¤MZ¢-3F¤Lx¢-3K¤LHºQ¤M4¢-4c¤M5¢-56¤M1º7¤KK¢-6r¤NVºu¤MgºV¤M8º3e¤M7º3d—÷ß4{ßSßgß1kß2Zß1m»ß1nÎ}}{ß1ß1tß3|¦´x´´y´‡£TB.1P£-S.-9i¤SI¤x¤RG¤X£Q0.96£i.68¤SY¢-1F¤Uy¢-2n¤VZ¢-1G—÷ß4{ßSßgß1kß2Zß1nÎß1m»}}{ß1ß1wß3|¦´x´´y´‡¤Hb¤Bg¤EN¤BX¤CB¤8h¤D6¤1Q¤GP¤2Q£HL.CC£1w.9N£JU.Aq£23.CI¤Kk¤2q¤Lo¤2U¤Js¤9U—÷ß4{ßSßgß1kß2Zß1n¤Cß1m»}}{ß1ß1uß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßSßgß1kß2Zß1m»ß1nÎ}}{ß1ß24ß3|¦´x´´y´‡¤8E¢-34¤9C¤o¤AU¤U¤9Wº38—÷ß4{ßSßOß18ß2V}}{ß1ß25ß3|¦´x´´y´‡ºb¢-Bw¤5y¢-84¤7G¢-7k¤8Eº2I—÷ß4{ßSßjß18ß2V}}{ß1ß22ß3|¦´x´´y´‡¤9MºM¤9s¤m—÷ß4{ßC»ß5ß2TßSßO}}{ß1ß26ß3|¦´x´´y´‡¤76º2H¤6a¢-7m—÷ß4{ßC»ß5ß2TßSßj}}{ß1ß27ß3|¦´x´´y´‡¤76º2H¤7c¢-Bu—÷ß4{ßC»ß5ß2TßSßj}}{ß1ß23ß3|¦´x´´y´‡¤9MºM¤8q¢-3M—÷ß4{ß5ß2TßSßOßC»}}{ß1ß1Nß3|¦´x´´y´‡£-3i.-9W£5J.8V£-34.-9W£4z.8V£-2G.-9WÝ2X£-1m.-9W£5d.8V£-1w.-9W£6b.8V£-2Q.-9W£5x.8Vº2G¤6G—÷ß4{ßSßKß18ß2U}}{ß1ß1Oß3|¦´x´´y´‡ºt¤Uºuºv¢-6fºv¢-6U¤U—÷ß4{ßSßKß18¨wall_tutorial_rock_breakable¨}}{ß1ß1Mß3|¦´x´´y´‡£-5o.-9W£-18.-7d£-5e.-9W£-1c.-7d£-4q.-9W£-1w.-7d£-4M.-9W£-1S.-7dÝ2l£-o.-7d£-50.-9W£-U.-7d£-5U.-9W£-e.-7d—÷ß4{ßSßKß18ß2U}}{ß1ß1Pß3|¦´x´´y´‡£-VJ.-3T£-C3.-BG£-V9.-3T£-CX.-BG£-UL.-3T£-Cr.-BG£-Tr.-3T£-CN.-BGÝ2y£-Bj.-BG£-UV.-3T£-BP.-BG£-Uz.-3T£-BZ.-BG—÷ß4{ßSßWß18ß2U}}{ß1ß1Lß3|¦´x´´y´‡£2F.6c£59.8V£2Z.6c£4V.8V£3N.6c£4B.8V£41.6c£4p.8VÝ3B£5n.8V£3D.6c£67.8V£2P.6cÝ2e—÷ß4{ßSßKß18ß2U}}{ß1ß1Qß3|¦´x´´y´‡£-OK.-3T£-1e.-BG£-Nq.-3T£-2H.-BG£-N9.-3T£-2P.-BG£-MW.-3T£-22.-BGÝ3N£-14.-BG£-NK.-3T£-k.-BG£-O8.-3T£-u.-BG—÷ß4{ßSßWß18ß2U}}{ß1ß1Rß3|¦´x´´y´‡£-TO.-3T£-1E.-BG£-Sz.-3T£-1r.-BG£-SC.-3T£-2B.-BG£-RT.-3T£-1j.-BG£-RL.-3T£-11.-BG£-Rq.-3T£-H.-BGÝ3W£-U.-BG—÷ß4{ßSßWß18ß2U}}{ß1ß1Kß3|¦´x´´y´‡£-K.-9W£-3O.-7d£9.6c£-3i.-7d£x.6c£-3Y.-7d£1H.6c£-2u.-7d£w.2o£-2P.-K£I.2o£-2F.-K£-L.-DK£-2Z.-K—÷ß4{ßSßKß18ß2U}}{ß1ß1pß3|¦´x´´y´‡ºl¤-e¤50¤-K¤4i¤J¤50¤-K¤2Q¤K—÷ß4{ßSßMß18ß2HßC»}´z´Ýf}{ß1ß28ß3|¦´x´´y´‡¤AL¢-9v¤9g¢-9Q¤AK¢-90¤9gº3z¤C0¢-9Z—÷ß4{ßSßjß18ß2HßC»}´z´Ýf}{ß1ß29ß3|¦´x´´y´‡¤Ef¢-5j¤E8º3e¤Dd¢-5k¤E8º3e¤E6¢-75—÷ß4{ßSßjß18ß2HßC»}´z´Ýf}{ß1ß2Aß3|¦´x´´y´‡¤GI¤EA£Fi.3L£Em.3G¤FJ¤E4Ý3vÝ3w£Fu.3L£Cj.3G—÷ß4{ßSßjß18ß2HßC»}´z´Ýf}÷¨icons¨|÷}");
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
