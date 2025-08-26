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
        };
        for (const shape of map.shapes ?? []) {
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
                if (map.computed.room_map[room] == undefined)
                    map.computed.room_map[room] = [];
                map.computed.room_map[room].push(shape.id);
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
export const TEST_MAP = zipson.parse("{¨shapes¨|{¨id¨¨start¨´z´É¨vertices¨|{´x´¢-1c´y´¢1c}÷¨options¨{¨open_loop¨«¨style¨ß2}}{ß1¨test group¨´z´Éß3|{´x´¢5w´y´¢8v}÷ß4{¨contains¨|¨test 1¨÷ß5«ß6¨test¨}}{ß1¨tutorial¨´z´Éß3|{´x´¢-Ty´y´¢-Xn}÷ß4{ß6ßBß8|¨tutorial room 1¨¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨¨tutorial room 5¨÷}}{ß1ßC´z´Éß3|{´x´¢-6A´y´¢-4y}÷ß4{ß8|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial wall 6¨¨tutorial room 1.1¨÷¨parent¨ßBß6ßB}}{ß1ßF´z´Éß3|{´x´¢-XW´y´¢-I6}÷ß4{ßPßBß6ßBß8|¨tutorial room 4 sensor¨¨tutorial room 4 gun¨¨tutorial room 4 gun deco¨¨tutorial room 4 rocks¨¨tutorial room 4 block¨¨tutorial room 4 switch¨¨tutorial room 4 rocky 1¨¨tutorial room 4 rocky 2¨¨tutorial room 4 mouse¨÷}}{ß1ßD´z´Éß3|{´x´¢OW´y´¢-DP}÷ß4{ßPßBß6ßBß8|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨¨tutorial wall 8¨¨tutorial room 2.1¨¨tutorial fake wall 1¨¨tutorial room 2 secret sensor¨¨tutorial room 2.5 sensor¨÷}}{ß1ßE´z´Éß3|{´x´¢-L3´y´¢-SF}÷ß4{ßPßBß6ßBß8|¨tutorial wall 1¨¨tutorial window 1¨¨tutorial wall 7¨¨tutorial room 3 enemy 1¨¨tutorial rock 13¨¨tutorial room 3 sensor¨¨tutorial room 3 enemy 2¨¨tutorial window 1 deco¨¨tutorial curtain 1¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨¨tutorial fake wall 2¨÷}}{ß1ßG´z´Éß3|{´x´¢9t´y´¢GK}÷ß4{ßPßBß6ßBß8|¨tutorial room 5 sensor¨¨tutorial room 5 boss¨¨tutorial room 5 switch path¨¨tutorial room 5 door¨¨tutorial room 5 sensor 0¨÷}}{ß1ß9´z´Éß3|¦´x´´y´‡£5y.EK£5B.2e£7G.EK£9D.2e—÷ß4{ßPß7ß5»¨make_id¨¨wall¨ß6ßAß8|¨test 2¨÷}}{ß1ßO´z´Éß3|{´x´¢-BI´y´¢4q}÷ß4{ß6ßBß8|¨tutorial wall 2¨¨tutorial room 1.1 rocky 1¨¨tutorial room 1.1 rocky 2¨¨tutorial room 1.1 rocky 3¨÷ßPßC}}{ß1ßh´z´Éß3|{´x´¢AT´y´¢-Jz}÷ß4{ßPßDß6ßBß8|¨tutorial room 2.1 rocky 1¨¨tutorial room 2.1 sensor¨¨tutorial room 2.1 switch path¨¨tutorial wall 9¨¨tutorial room 2.1 rocky 2¨÷}}{ß1ß15´z´Éß3|¦´x´´y´‡£7J.5K£5v.CF£8F.5K£8y.CF—÷ß4{ßPß9ß5»ß13ß14ß6ßA}}{ß1ßH´z´Éß3|{´x´¢-50´y´¢-1I}÷ß4{ß8|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ß1J÷ßPßCß6ßB}}{ß1ßT´z´Éß3|{´x´¢-So´y´¢-GB}÷ß4{ßPßFß6ßBß8|¨tutorial rock 14¨¨tutorial rock 15¨¨tutorial rock 16¨÷}}{ß1ßd´z´Éß3|{´x´¢K7´y´¢-58}÷ß4{ßPßDß6ßBß8|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨¨tutorial rock 17¨¨tutorial rock 18¨¨tutorial rock 19¨¨tutorial room 2 block¨¨tutorial rock 20¨¨tutorial rock 21¨¨tutorial rock 22¨÷}}{ß1ßa´z´Éß3|{´x´¢G7´y´¢-3R}÷ß4{ßPßDß6ßBß8|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷}}{ß1ßW´z´Éß3|{´x´¢-Iy´y´¢-9y}÷ß4{ßPßF¨spawn_enemy¨¨enemy_tutorial_rocky¨¨is_spawner¨»¨spawn_repeat¨Ê¨spawn_permanent¨»}}{ß1ßX´z´Éß3|{´x´¢-U6´y´¢-6s}÷ß4{ßPßFß1fß1gß1h»ß1iÊß1j»}}{ß1ßJ´z´Éß3|{´x´¢-2Q´y´º1}÷ß4{ß6ßBßPßCß8|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷}}{ß1ßb´z´Éß3|{´x´¢Sl´y´¢-y}÷ß4{ßPßDß8|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨¨tutorial room 2 breakables 4¨¨tutorial room 2 enemy shooter 1¨÷ß6ßB}}{ß1ßK´z´Éß3|¦´x´´y´‡¢5eºWº0ºK¢-6Iº0¢-6m¢42¢-26¢84¢4C¢6w¢6c¢1S—÷ß4{ßPßCß13¨sensor¨¨sensor_fov_mult¨Ê}}{ß1ßl´z´Éß3|¦´x´´y´‡¢-J2¢34¢-HQº1¢-LB¢-1W¢-He¢-4x¢-Gy¢-A7¢-Ky¢-F0¢-Jq¢-G8£-HC.-Ac£-CN.-84£-BI.-Ac£-9D.-84£-5g.-Ac£-B5.-84¢-25¢-70¢3O¢-8i—÷ß4{ßPßEß13¨wall_tutorial¨ß5»}}{ß1ßn´z´Éß3|¦´x´´y´‡ºjºk¢-Lk¢-15¢-SH¢-14¢-XD¢-6i¢-Ui¢-EB¢-Mu¢-Gw¢-Jg¢-KA£-EF.-Ac£-PD.-84£-80.-Ac£-Os.-84£-4M.-Ac£-KY.-84£-4i.-Ac£-Ex.-84¤f¢-GM¤4M¢-Ca—÷ß4{ßPßEß13ß1vß5»}}{ß1ßN´z´Éß3|¦´x´´y´‡ºyºz¤9q¢-76¤C6¢-42ºZºWº0ºKºaº0¢-6T¤U—÷ß4{ßPßCß13ß1vß5»}}{ß1ßM´z´Éß3|¦´x´´y´‡¢-6e¤2Yºbºc—÷ß4{ßPßCß13ß1vß5»}}{ß1ßi´z´Éß3|¦´x´´y´‡¤LmºH¤Kyºe—÷ß4{ßPßDß13¨wall_tutorial_fake¨ß5»ß1j»}}{ß1ßx´z´Éß3|¦´x´´y´‡¢-1M¢-Csºw¢-BB—÷ß4{ßPßEß13ß1wß5»ß1j»}}{ß1ßI´z´Éß3|¦´x´´y´‡¢-38¤7Aºdºeºfºgºhºi¤D4¤-A¤Bm¤8s£EV.87£C1.3u¤E2¤G8¤4m¤M8¤23¤X3¤AB¤g0¤M9¤fQ—÷ß4{ß5»ßPßCß13ß1v}}{ß1ßL´z´Éß3|¦´x´´y´‡ºg¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßPßCß8|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ß13ß1tß1u£0.EW}}{ß1ße´z´Éß3|¦´x´´y´‡ºZ¢-CG¤4g¢-8O¤8Y¢-7Q¤9WºG¤F9¢-HE¤9W¢-BS—÷ß4{ßPßDß13ß1tß1uÝOß8|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨¨tutorial room 2 arrow 1¨¨tutorial room 2 arrow 2¨¨tutorial room 2 arrow 3¨÷}}{ß1ßj´z´Éß3|¦´x´´y´‡¤Lc¤4W¤Ke¤8O¤L8¤8O¤M6¤4W—÷ß4{ßPßDß13ß1t}}{ß1ßk´z´Éß3|¦´x´´y´‡¤CV¤11¤Dk¤Fa¤Hi¤FV¤FX¤12—÷ß4{ßPßDß13ß1tß1uÝO}}{ß1ßy´z´Éß3|¦´x´´y´‡¤6B¤Kc¤4y¤LR¤Qm¤Ld¤PA¤Kl—÷ß4{ßPßGß13ß1t}}{ß1ß12´z´Éß3|¦´x´´y´‡¤Cy¤GU¤Be¤HL¤JK¤HM¤I1¤Gc—÷ß4{ßPßGß13ß1tß1u£1.6S}}{ß1ßq´z´Éß3|¦´x´´y´‡¢-3B¢-Haº6¢-8j£-Li.-G£-Id.-Co£-Mv.-ER£-HO.-1l¢-KSºt¢-JK¢-Fz¢-6O¢-85¤2F¢-5T¤4k¢-FC—÷ß4{ßPßEß13ß1tß1u£1.2Q}}{ß1ßc´z´Éß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßPßDß13¨sensor_path¨ß8|¨tutorial room 2 switch¨÷}}{ß1ß10´z´Éß3|¦´x´´y´‡¤HQ¤GI¤E2¤G8—÷ß4{ßPßGß13ß26}}{ß1ßZ´z´Éß3|¦´x´´y´‡¤M0¤fR¤T2¤Vy¤RE¤MK¤H6¤GI¤Ha¤CG¤Ke¤9M¤Kyºe¤WGºe¤WGºH¤LmºH¤M6ºy¤WN¤48¤Wj¤2G¤Ut¢-Ax¤NN¢-Bh¤Ls¢-H8¤Gp¢-Ip¤Dr¢-Gp—÷ß4{ß5»ßPßDß13ß1v}}{ß1ßg´z´Éß3|¦´x´´y´‡¤Cv¢-G9¤Bt¢-FS¤BS¢-Ao¤4Mº1D—÷ß4{ß5»ßPßDß13ß1v}}{ß1ßf´z´£0.-1cß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGºW—÷ß4{ßPßDß13¨icon_tutorial¨ß8|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷}}{ß1ßY´z´Éß3|¦´x´´y´‡¢-Jnº1a¢-JN¢-8A¢-JW¢-7V£-JJ.-Au£-7Q.-DG£-JA.-A£-87.-31¢-Ir¢-7t¢-J5¢-90—÷ß4{ßPßFß13ß28}}{ß1ßm´z´Éß3|¦´x´´y´‡£-FC.-Ac£-F7.-84£-B0.-Ac£-Df.-84£-8k.-Ac£-Fi.-84£-8P.-Ac£-IR.-84£-9x.-Ac£-KF.-84£-DT.-Ac£-Kt.-84£-Fw.-Ac£-IK.-84ÝaÝb—÷ß4{ßPßEß13¨wall_tutorial_window¨ß5»}}{ß1ßs´z´Éß3|¦´x´´y´‡£-FC.-6p£-F7.-6h£-B0.-6p£-Df.-6h£-8k.-6p£-Fi.-6h£-8P.-6p£-IR.-6h£-9x.-6p£-KF.-6h£-DT.-6p£-Kt.-6h£-Fw.-6p£-IK.-6hÝoÝp—÷ß4{ßPßEß13ß2B¨decoration¨»}}{ß1ßt´z´Éß3|¦´x´´y´‡¢-KK¢-FU¢-Jp¢-Fw¢-Lw¢-I4¢-MQº1U—÷ß4{ßPßEß13¨wall_tutorial_curtain¨}}{ß1ßo´z´Éß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßPßEß1f¨enemy_tutorial_easy¨ß1h»ß1iÊ}}{ß1ßr´z´Éß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßPßEß1fß2Eß1h»ß1iÊ}}{ß1ßp´z´Éß3|¦´x´´y´‡ºwº1K¢-1T¢-9c¤N¢-9s¤1pº1Kºi¢-Cl¤C¢-Deº1Iº1J—÷ß4{ßPßEß13¨wall_tutorial_rock¨ß5»}}{ß1ßQ´z´Éß3|¦´x´´y´‡¢-NB¢-H5¢-V2¢-EV¢-Xk¢-6k¢-ST¤-k¢-LJ¢-13¢-HI¢-4o¢-GR¢-BA—÷ß4{ßPßFß13ß1tß1u£1.4q}}{ß1ßu´z´Éß3|¦´x´´y´‡¢-C2¢-9C£-D3.-A3£-9g.-9h¢-Bg¢-B7—÷ß4{ßPßEß13¨wall_tutorial_spike¨}}{ß1ßw´z´Éß3|¦´x´´y´‡¢-Ab¢-PI¢-Bt¢-PL¢-BH¢-NN—÷ß4{ßPßEß13ß2G}}{ß1ßv´z´Éß3|¦´x´´y´‡¢-J1¢-ET¢-Jh¢-FO¢-HFºv—÷ß4{ßPßEß13ß2G}}{ß1ßR´z´Éß3|{´x´¢-Oq´y´ºz}÷ß4{ßPßFß1f¨collect_gun_basic¨ß1h»ß1iÊß1j»}}{ß1ßS´z´Éß3|{´x´º2g´y´ºz}÷ß4{ßPßFß1f¨deco_gun_basic¨ß1h»ß1iÊ}}{ß1ßU´z´Éß3|{´x´¢-L1´y´¤-j}÷ß4{ßPßFß1f¨enemy_tutorial_rock_room4¨ß1h»ß1iÊ}}{ß1ßV´z´Éß3|{´x´¢-Ih´y´¤1p}÷ß4{ßPßFß1f¨switch¨ß1h»ß1iÊ}}{ß1ßz´z´Éß3|{´x´¤Fq´y´¤TU}÷ß4{ßPßGß1f¨enemy_tutorial_boss¨ß1h»ß1iÊ}}{ß1ß11´z´Éß3|¦´x´´y´‡¤KU¤GS¤HQ¤GI—÷ß4{ß5»ß6¨tutorial_door¨ßPßG}}{ß1ß16´z´Éß3|¦´x´´y´‡¢-4B¤6Gºbºc¢-9q¤50£-Bk.-9W£83.5x¢-Bc¤BIº1Q¤D4¢-3Y¤B8º1L¤7A—÷ß4{ß5»ßPßOß13ß1v}}{ß1ß17´z´Éß3|{´x´¢-5B´y´¤A9}÷ß4{ßPßOß1fß1gß1h»ß1iÊ}}{ß1ß19´z´Éß3|{´x´¢-9i´y´¤A7}÷ß4{ßPßOß1fß1gß1h»ß1iÊ}}{ß1ß18´z´Éß3|{´x´¢-9P´y´¤71}÷ß4{ßPßOß1fß1gß1h»ß1iÊ}}{ß1ß1X´z´Éß3|{´x´¤Dz´y´¤Y}÷ß4{ßPßdß1f¨enemy_tutorial_block¨ß1h»ß1iÊß1j»}}{ß1ß1D´z´Éß3|¦´x´´y´‡¤Gpº1i¤GZ¢-Kq¤E4¢-LR¤Bc¢-KQ¤A0¢-Ic¤A3¢-GT¤Btº1l—÷ß4{ß5»ßPßhß13ß1v}}{ß1ß1C´z´Éß3|¦´x´´y´‡¤D8¢-Gn¤EC¢-FN—÷ß4{ßPßhß13ß26}}{ß1ß1B´z´Éß3|¦´x´´y´‡¤Ba¢-FT¤H1¢-JI¤GlºC¤E4¢-Lp¤BS¢-Ki¤9f¢-Il¤9j¢-GL—÷ß4{ßPßhß13ß1tß1u£0.BI}}{ß1ß1A´z´Éß3|{´x´¤Ei´y´¢-Jr}÷ß4{ßPßhß1fß1gß1h»ß1iÊß1j»}}{ß1ß1E´z´Éß3|{´x´¤Bv´y´¢-IN}÷ß4{ßPßhß1fß1gß1h»ß1iÊß1j»}}{ß1ß29´z´ÝVß3|¦´x´´y´‡¤E6¢-1h¤EB¢-21—÷ß4{ßPßfß13ß28ß5»}}{ß1ß2A´z´ÝVß3|¦´x´´y´‡¤E4¢-1X¤E4º37—÷ß4{ßPßfß13ß28ß5»}}{ß1ß27´z´Éß3|{´x´¤FM´y´º1t}÷ß4{ßPßcß1fß2Kß1h»ß1iÊ}}{ß1ß1q´z´Éß3|{´x´¤Hb´y´¢-C3}÷ß4{ßPßbß1f¨enemy_tutorial_4way¨ß1h»ß1iÊ}}{ß1ß1s´z´Éß3|{´x´¤R6´y´¤5o}÷ß4{ßPßbß1f¨enemy_tutorial_down¨ß1h»ß1iÊ}}{ß1ß1R´z´Éß3|¦´x´´y´‡£Hj.9m£-6g.-Bz£JB.9m£-7P.-Bz£JU.9m£-9B.-Bz£IQ.9m£-A2.-Bz£H8.9m£-AI.-Bz£GI.9m£-95.-Bz£GY.9m£-7d.-Bz—÷ß4{ßPßdß13ß2F}}{ß1ß1Q´z´Éß3|¦´x´´y´‡¤Iw¢-3q¤Kv¢-3W¤Lp¢-4l¤Lk¢-67¤K1¢-6j¤IT¢-6D¤IA¢-4w—÷ß4{ßPßdß13ß2F}}{ß1ß1U´z´Éß3|¦´x´´y´‡¤Fd¤1h¤GZ¤1y¤HJ¤1R¤HJ¤R¤GT¤-G¤FH¤-F¤Ew¤m—÷ß4{ßPßdß13ß2F}}{ß1ß1V´z´Éß3|¦´x´´y´‡¤Hz¤1m¤J3¤1o¤JH¤19¤JA¤N¤IfÁ¤HlÒ¤Hb¤14—÷ß4{ßPßdß13ß2F}}{ß1ß1W´z´Éß3|¦´x´´y´‡£Jk.CG£1n.FD¤Km¤2V¤Lr¤22¤MF¤h¤LQÒ¤K4¤B¤JX¤c—÷ß4{ßPßdß13ß2F}}{ß1ß1Y´z´Éß3|¦´x´´y´‡¤MQ¤2G¤Ng¤3B¤PI¤3B¤Py¤2M£Pw.27£19.Bh¤Oa¤R¤My¤V—÷ß4{ßPßdß13ß2F}}{ß1ß1Z´z´Éß3|¦´x´´y´‡¤QR¤2D¤R7¤2m¤Rw¤2f¤SI¤1u¤S2¤16¤R7¤l¤QW¤18—÷ß4{ßPßdß13ß2F}}{ß1ß1a´z´Éß3|¦´x´´y´‡¤Sn¤1x¤Uf¤2J¤Vr¤17¤Vo¤-L¤UV¤-k¤TG¤-G¤Sf¤h—÷ß4{ßPßdß13ß2F}}{ß1ß1P´z´Éß3|¦´x´´y´‡¤F9¢-41¤Gp¢-3r¤Ho¢-4Q¤Hq¢-5c¤Gh¢-6V¤Fbº6¤Ew¢-59—÷ß4{ßPßdß13ß2F}}{ß1ß1O´z´Éß3|¦´x´´y´‡¤Cl¢-48¤Doº2m¤Ee¢-47¤Ee¢-5F¤E8º6¤Cjº6¤C8¢-52—÷ß4{ßPßdß13ß2F}}{ß1ß1S´z´Éß3|¦´x´´y´‡¤DD¢-FZ¤Dr¢-Fb¤EB¢-Fs¤EI¢-GO¤Drº1j¤D8º2v¤Cvº1k—÷ß4{ßPßdß13ß2F}}{ß1ß1T´z´Éß3|¦´x´´y´‡¤KZ¢-G2£L2.1S£-Fn.-b¤Lb¢-G0¤Lfº2P¤LJ¢-H1£Km.2x£-H1.-Ep¤KQ¢-GX—÷ß4{ßPßdß13ß2F}}{ß1ß1N´z´Éß3|¦´x´´y´‡¤Mn¢-3H¤Ox¢-3O¤Pu¢-4E¤PP¢-68¤OE¢-6W¤Mz¢-6F¤MK¢-4z—÷ß4{ßPßdß13ß2F}}{ß1ß1b´z´Éß3|¦´x´´y´‡¤Gh¢-43¤G2¢-2K¤FP¢-4C—÷ß4{ßPßaß13ß2G}}{ß1ß1d´z´Éß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Oj¢-5p¤P3¢-5i¤Tdº3C¤PE¢-4S¤OX¢-3f¤OH¢-1J¤N9º2m—÷ß4{ßPßaß13ß2G}}{ß1ß1c´z´Éß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Kf¢-1b—÷ß4{ßPßaß13ß2G}}{ß1ß1e´z´Éß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßPßaß13ß2G}}{ß1ß1l´z´Éß3|¦´x´´y´‡º1FºYº1F¢-2a¢-1Sº1d¤-Uº3h¤-U¢-1w£1M.9T£-2L.-2bºiº2m¤5K¢-2G—÷ß4{ßPßJß1f¨enemy_tutorial_bit¨ß1h»ß1iÎ}}{ß1ß1m´z´Éß3|¦´x´´y´‡¢-4WºZºa¤3sº3bºY¢-5K¤-A¢-3sºY¢-4M¤3E¢-3E¤4g—÷ß4{ßPßJß1fß2Qß1h»ß1iÎ}}{ß1ß1n´z´Éß3|¦´x´´y´‡¤MZ¢-3F¤Lx¢-3K¤LHºR¤M4¢-4c¤M5¢-56¤M1º6¤KK¢-6r¤NVº1H¤Mgºa¤M8º45¤M7º44—÷ß4{ßPßbß1fß2Qß1h»ß1iÎ}}{ß1ß1o´z´Éß3|¦´x´´y´‡£TB.1P£-S.-9i¤SI¤x¤RG¤X£Q0.96£i.68¤SY¢-1F¤Uy¢-2n¤VZ¢-1G—÷ß4{ßPßbß1fß2Qß1iÎß1h»}}{ß1ß1r´z´Éß3|¦´x´´y´‡¤Hb¤Bg¤EN¤BX¤CB¤8h¤D6¤1Q¤GP¤2Q£HL.CC£1w.9N£JU.Aq£23.CI¤Kk¤2q¤Lo¤2U¤Js¤9U—÷ß4{ßPßbß1fß2Qß1i¤Cß1h»}}{ß1ß1p´z´Éß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßPßbß1fß2Qß1h»ß1iÎ}}{ß1ß1z´z´Éß3|¦´x´´y´‡¤8E¢-34¤9C¤o¤AU¤U¤9Wº3Z—÷ß4{ßPßLß13¨floor_tutorial¨}}{ß1ß20´z´Éß3|¦´x´´y´‡ºg¢-Bw¤5y¢-84¤7G¢-7k¤8Eº2l—÷ß4{ßPßeß13ß2R}}{ß1ß1x´z´Éß3|¦´x´´y´‡¤9MºL¤9s¤m—÷ß4{ß5»ß6ß2MßPßL}}{ß1ß21´z´Éß3|¦´x´´y´‡¤76º2k¤6a¢-7m—÷ß4{ß5»ß6ß2MßPße}}{ß1ß22´z´Éß3|¦´x´´y´‡¤76º2k¤7c¢-Bu—÷ß4{ß5»ß6ß2MßPße}}{ß1ß1y´z´Éß3|¦´x´´y´‡¤9MºL¤8q¢-3M—÷ß4{ß6ß2MßPßLß5»}}{ß1ß1I´z´Éß3|¦´x´´y´‡£-3i.-9W£5J.8V£-34.-9W£4z.8V£-2G.-9WÝ1h£-1m.-9W£5d.8V£-1w.-9W£6b.8V£-2Q.-9W£5x.8Vº2j¤6G—÷ß4{ßPßHß13ß2F}}{ß1ß1J´z´Éß3|¦´x´´y´‡º1G¤Uº1H¤2Y¢-6f¤2Y¢-6U¤U—÷ß4{ßPßHß13¨wall_tutorial_rock_breakable¨}}{ß1ß1H´z´Éß3|¦´x´´y´‡£-5o.-9W£-18.-7d£-5e.-9W£-1c.-7d£-4q.-9W£-1w.-7d£-4M.-9W£-1S.-7dÝ1v£-o.-7d£-50.-9W£-U.-7d£-5U.-9W£-e.-7d—÷ß4{ßPßHß13ß2F}}{ß1ß1K´z´Éß3|¦´x´´y´‡¢-Tr¢-DW¢-Th¢-E0¢-St¢-EK¢-SP¢-Dqº4V¢-DC¢-T3º1J¢-TX¢-D2—÷ß4{ßPßTß13ß2F}}{ß1ß1G´z´Éß3|¦´x´´y´‡£2F.6c£59.8V£2Z.6c£4V.8V£3N.6c£4B.8V£41.6c£4p.8VÝ28£5n.8V£3D.6c£67.8V£2P.6cÝ1o—÷ß4{ßPßHß13ß2F}}{ß1ß1L´z´Éß3|¦´x´´y´‡¢-Ms¢-37¢-MO¢-3k¢-Lhº3z¢-L4¢-3Vº4g¢-2X¢-Ls¢-2D¢-Mg¢-2N—÷ß4{ßPßTß13ß2F}}{ß1ß1M´z´Éß3|¦´x´´y´‡¢-Rw¢-2h¢-RXº43¢-Qk¢-3e¢-Q1¢-3C¢-Pt¢-2U¢-QO¢-1kº4p¢-1x—÷ß4{ßPßTß13ß2F}}{ß1ß1F´z´Éß3|¦´x´´y´‡£-K.-9W£-3O.-7d£9.6c£-3i.-7d£x.6c£-3Y.-7d£1H.6c£-2u.-7d£w.2o£-2P.-K£I.2o£-2F.-K£-L.-DK£-2Z.-K—÷ß4{ßPßHß13ß2F}}{ß1ß1k´z´ÝVß3|¦´x´´y´‡¤4M¤-e¤50¤-K¤4i¤J¤50¤-K¤2Q¤K—÷ß4{ßPßJß13ß28ß5»}}{ß1ß23´z´ÝVß3|¦´x´´y´‡¤AL¢-9v¤9g¢-9Q¤AKº1x¤9gº50¤C0¢-9Z—÷ß4{ßPßeß13ß28ß5»}}{ß1ß24´z´ÝVß3|¦´x´´y´‡¤Ef¢-5j¤E8º45¤Dd¢-5k¤E8º45¤E6¢-75—÷ß4{ßPßeß13ß28ß5»}}{ß1ß25´z´ÝVß3|¦´x´´y´‡¤GI¤EA£Fi.3L£Em.3G¤FJ¤E4Ý2SÝ2T£Fu.3L£Cj.3G—÷ß4{ßPßeß13ß28ß5»}}÷¨icons¨|÷}");
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
