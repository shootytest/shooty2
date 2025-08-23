import { clone_object, make, maketype, override_object } from "../game/make.js";
import { vector, vector3, vector3_, AABB, AABB3 } from "./vector.js";

export interface map_shape_type {
  id: string,
  z: number,
  vertices: vector3_[],
  // all other stuff
  // todo move style into options
  options: map_shape_options_type,
  // computed attributes, not part of definition
  computed?: map_shape_compute_type,
};

export interface map_shape_compute_type {
  aabb: AABB,
  aabb3: AABB3,
  mean: vector3,
  vertices: vector3[],
  screen_vertices?: vector3[],
  on_screen?: boolean,
  distance2?: number,
  depth?: number,
  options?: map_shape_options_type,
};

export interface map_shape_options_type extends maketype {  
  // important options
  parent?: string,
  contains?: string[],
  make_id?: string,
  
  // actual shape options
  open_loop?: boolean, // is the shape loop not closed? (e.g. this is true if the vertices are actually a list of 1d walls instead of a 2d shape)
  merge?: boolean, // merge shape with its parent? (use the same thing object)

  // sensor options
  sensor_fov_mult?: number,
  
  // spawner options
  is_spawner?: boolean,
  spawn_enemy?: string,
  spawn_repeat?: number,
  spawn_delay?: number,
  spawn_repeat_delay?: number,
  spawn_permanent?: boolean,
};

export interface map_icon_type {
  icon: string,
  color: string,
};

export interface map_computed_type {
  shape_map: { [key: string]: map_shape_type },
};

export interface map_type {

  shapes: map_shape_type[],
  icons?: map_icon_type[],
  computed?: map_computed_type,

};

export interface map_vertex_type {
  // for map maker ui
  shape: map_shape_type,
  vertex: vector3,
  vertex_old: vector3_[],
  id: string,
  index: number,
  new: boolean,
};

export interface style_type {
  stroke?: string,
  fill?: string,
  health?: string,
  width?: number,
  opacity?: number,
  stroke_opacity?: number,
  fill_opacity?: number,
  health_opacity?: number,
};

export type styles_type = {
  [key: string]: style_type,
};

export const map_serialiser = {

  initial_state: "",
  undo_states: [] as string[],

  compute: (map: map_type) => {

    map.computed = {
      shape_map: {},
    };

    if (map.shapes != undefined) {
      for (const shape of map.shapes) {
        map.computed.shape_map[shape.id] = shape;
        // debug, this shouldn't happen normally i hope
        if (shape.options.contains?.includes(shape.id)) console.error("[map_serialiser/compute] why does '" + shape.id + "' contain itself?");
        if (shape.id === "start") delete shape.options.contains;
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
      for (const shape of map.shapes) {
        if (shape.computed == undefined || shape.computed.depth) continue;
        if ((shape.options.parent?.length ?? 0) > 0 && shape.options.parent !== "all") {
          let s = shape;
          let depth = 1;
          while ((s?.computed?.depth ?? 0) === 0 && (s.options.parent?.length ?? 0) > 0 && s.options.parent !== "all" && depth < 100) {
            const parent_id = s.options.parent!;
            s = map.computed.shape_map[parent_id];
            if (s == undefined) console.error(`[map_serialiser/compute] (${shape.id}) why is '${parent_id}' not in the computed shape map?`);
            depth++;
          }
          shape.computed.depth = depth + (s.computed?.depth ?? 0);
        } else {
          shape.computed.depth = 1;
        }
      }
      // now sort shapes by depth
      map.shapes.sort((s1, s2) => (s1.computed?.depth ?? 0) - (s2.computed?.depth ?? 0));
    }

  },

  compute_options: (shape: map_shape_type) => {
    if (shape.computed == undefined) return undefined;
    const options: map_shape_options_type = {};
    const make_options = make[shape.options.make_id ?? "default"] ?? make.default;
    if (shape.options.make_id) override_object(options, make_options);
    override_object(options, shape.options);
    shape.computed.options = options;
    // console.log("[map_serializer/compute_options] calculating for " + shape.id, options.sensor);
    return options;
  },

  clone_shape: (shape: map_shape_type) => {
    return {
      id: shape.id,
      z: shape.z,
      vertices: vector3.clone_list_(shape.vertices),
      options: clone_object(shape.options),
    };
  },

  clone_style: (style: style_type): style_type => {
    return clone_object(style);
  },

  stringify_: (map: map_type): object => {
    const m: map_type = {
      shapes: [],
      icons: [],
    };
    for (const s of map.shapes ?? []) {
      if (s.options.parent === "all") delete s.options.parent;
      m.shapes!.push({ id: s.id, z: s.z, vertices: s.vertices, options: s.options });
    }
    for (const i of map.icons ?? []) {
      m.icons!.push({ icon: i.icon, color: i.color });
    }
    return m;
  },

  stringify: (map: map_type): string => {
    return zipson.stringify(map_serialiser.stringify_(map));
  },

  parse: (raw_string: string): map_type => {
    const m = zipson.parse(raw_string);
    const map: map_type = {
      shapes: m.shapes ?? [],
      icons: m.icons ?? [],
    };
    map_serialiser.compute(map);
    return map;
  },

  save: (slot: string, map: map_type): string => {
    const raw_string = map_serialiser.stringify(map);
    localStorage.setItem("map_" + slot, raw_string);
    if (slot !== "auto") console.log("saved current map to slot \"" + slot + "\"!");
    return raw_string;
  },

  load: (slot: string): map_type => {
    const raw_string = localStorage.getItem("map_" + slot);
    if (raw_string == null || !raw_string) {
      console.error("map slot \"" + slot + "\" doesn't exist!");
      return { shapes: [] };
    } else {
      console.log("loaded current map from slot \"" + slot + "\"!");
    }
    const map = map_serialiser.parse(raw_string);
    return map;
  },

  delete: (slot: string): map_type => {
    const map = map_serialiser.load(slot);
    localStorage.removeItem("map_" + slot);
    console.log("deleted current map from slot \"" + slot + "\"!");
    return map;
  },

  special_stringify(o: any): string {
    if (typeof o !== "object") {
      return JSON.stringify(o);
    } else if (Array.isArray(o)) {
      if (o.length <= 0) return "[]";
      let s = "[";
      for (const p of o) {
        s += map_serialiser.special_stringify(p) + ",";
      }
      return s.substring(0, s.length - 1) + "]";
    } else {
      const s = Object.keys(o).map(
        key => `${key}:${map_serialiser.special_stringify(o[key])}`
      ).join(",");
      return `{${s}}`;
    }
  },

  copy: (map: map_type): void => {
    const s = `zipson.parse("${map_serialiser.stringify(map)}");`; // map_serialiser.special_stringify(map_serialiser.stringify_(map));
    navigator.clipboard.writeText(s);
  },

  save_undo_state: (raw_string: string) => {
    if (map_serialiser.undo_states.length <= 0) map_serialiser.initial_state = raw_string;
    map_serialiser.undo_states.push(raw_string);
    while (map_serialiser.undo_states.length > 10) map_serialiser.undo_states.shift();
  },

  undo: (): map_type | undefined => {
    if (map_serialiser.undo_states.length <= 1) return undefined;
    map_serialiser.undo_states.pop();
    // if (raw_string === undefined) return undefined;
    return map_serialiser.parse(map_serialiser.undo_states[map_serialiser.undo_states.length - 1]);
  },

};


// just realised it's possible to paste the zipped JSON
export const TEST_MAP: map_type = zipson.parse("{¨shapes¨|{¨id¨¨start¨´z´É¨vertices¨|{´x´¢-1c´y´¢1c}÷¨options¨{¨open_loop¨«¨style¨ß2}}{ß1¨test group¨´z´Éß3|{´x´¢BU´y´¢5c}÷ß4{¨contains¨|¨test 1¨÷ß5«ß6¨test¨}}{ß1¨tutorial¨´z´Éß3|{´x´¢-Ty´y´¢-Xn}÷ß4{ß6ßBß8|¨tutorial room 1¨¨tutorial room 1.1¨¨tutorial room 2¨¨tutorial room 3¨¨tutorial room 4¨÷}}{ß1ßD´z´Éß3|{´x´¢-BI´y´¢4q}÷ß4{ß6ßBß8|¨tutorial wall 2¨¨tutorial room 1.1 enemy¨÷¨parent¨ßB}}{ß1ßC´z´Éß3|{´x´¢-6A´y´¢-4y}÷ß4{ß8|¨tutorial room 1 rocks¨¨tutorial wall 3¨¨tutorial room 1 deco¨¨tutorial room 1 sensor¨¨tutorial room 1 door sensor¨¨tutorial wall 4¨¨tutorial wall 6¨÷ßJßBß6ßB}}{ß1ßG´z´Éß3|{´x´¢-XW´y´¢-I6}÷ß4{ßJßBß6ßBß8|¨tutorial room 4 sensor¨÷}}{ß1ßE´z´Éß3|{´x´¢D1´y´¢-Hh}÷ß4{ßJßBß6ßBß8|¨tutorial wall 5¨¨tutorial room 2 obstacles¨¨tutorial room 2 spawners¨¨tutorial room 2 switch path¨¨tutorial room 2 rocks¨¨tutorial room 2 door sensor¨¨tutorial room 2 warning¨÷}}{ß1ßF´z´Éß3|{´x´¢-L3´y´¢-SF}÷ß4{ßJßBß6ßBß8|¨tutorial wall 1¨¨tutorial window 1¨¨tutorial wall 7¨¨tutorial room 3 enemy 1¨¨tutorial rock 13¨¨tutorial room 3 start sensor¨¨tutorial room 3 enemy 2¨¨tutorial window deco¨¨tutorial curtain 1¨¨tutorial spike 5¨¨tutorial spike 6¨¨tutorial spike 7¨÷}}{ß1ß9´z´Éß3|¦´x´´y´‡£BX.2o£1s.78£Cp.2o£5u.78—÷ß4{ßJß7ß5»¨make_id¨¨wall¨ß6ßAß8|¨test 2¨÷}}{ß1ßn´z´Éß3|¦´x´´y´‡£Cr.9w£2d.b£Dn.9w£5g.b—÷ß4{ßJß9ß5»ßlßmß6ßA}}{ß1ßH´z´Éß3|¦´x´´y´‡¢-4B¢6G¢-6m¢42¢-9q¢50£-Bk.-9W£83.5x¢-Bc¢BI¢-7Q¢D4¢-3Y¢B8¢-38¢7A—÷ß4{ß5»ßJßDßl¨wall_tutorial¨}}{ß1ßK´z´Éß3|{´x´¢-50´y´¢-1I}÷ß4{ß8|¨tutorial rock 1¨¨tutorial rock 2¨¨tutorial rock 3¨¨tutorial rock 4¨¨tutorial rock 5¨ßt÷ßJßCß6ßB}}{ß1ßW´z´Éß3|{´x´¢K7´y´¢-58}÷ß4{ßJßEß6ßBß8|¨tutorial rock 6¨¨tutorial rock 7¨¨tutorial rock 8¨¨tutorial rock 9¨¨tutorial rock 10¨¨tutorial rock 11¨¨tutorial rock 12¨÷}}{ß1ßT´z´Éß3|{´x´¢G7´y´¢-3R}÷ß4{ßJßEß6ßBß8|¨tutorial spike 1¨¨tutorial spike 2¨¨tutorial spike 3¨¨tutorial spike 4¨÷}}{ß1ßI´z´Éß3|{´x´£-9f.-CJ´y´£AV.4n}÷ß4{ßJßD¨spawn_enemy¨¨enemy_tutorial_block¨¨is_spawner¨»¨spawn_repeat¨Ê}}{ß1ßM´z´Éß3|{´x´¢-2Q´y´º1}÷ß4{ß5«ß6ßBßJßCß8|¨tutorial room 1 arrow¨¨tutorial room 1 breakables 1¨¨tutorial room 1 breakables 2¨÷¨decoration¨»}}{ß1ßU´z´Éß3|{´x´¢TA´y´¢-e}÷ß4{ßJßEß8|¨tutorial room 2 breakables 1¨¨tutorial room 2 breakables 2¨¨tutorial room 2 breakables 3¨¨tutorial room 2 enemy shooter¨÷ß6ßB}}{ß1ßN´z´Éß3|¦´x´´y´‡¢5eºaº0ºU¢-6Iº0ºIºJ¢-26¢84¢4C¢6w¢6c¢1S—÷ß4{ßJßCßl¨sensor¨¨sensor_fov_mult¨Ê}}{ß1ßZ´z´Éß3|¦´x´´y´‡¢-KKºc¢-Gl¢-4u¢-GO¢-Am¢-Ky¢-F0¢-Jq¢-G8£-HC.-Ac£-CN.-84£-BI.-Ac£-9D.-84£-5g.-Ac£-B5.-84¢-25¢-70¢3O¢-8i—÷ß4{ßJßFßlßoß5»}}{ß1ßb´z´Éß3|¦´x´´y´‡ºlºc¢-SH¢-14¢-XD¢-6i¢-Ui¢-EB¢-Mu¢-Gw¢-Jg¢-KA£-EF.-Ac£-PD.-84£-80.-Ac£-Os.-84£-4M.-Ac£-KY.-84£-4i.-Ac£-Ex.-84¤f¢-GM¤4M¢-Ca—÷ß4{ßJßFßlßoß5»}}{ß1ßQ´z´Éß3|¦´x´´y´‡ºwºx¤9q¢-76¤C6¢-42ºdºaº0ºUºeº0¢-6T¤U—÷ß4{ßJßCßlßoß5»}}{ß1ßP´z´Éß3|¦´x´´y´‡¢-6e¤2YºIºJ—÷ß4{ßJßCßlßoß5»}}{ß1ßL´z´Éß3|¦´x´´y´‡ºSºTºfºgºhºiºjºkºP¤-A—÷ß4{ß5»ßJßCßlßo}}{ß1ßO´z´Éß3|¦´x´´y´‡ºi¢-2k¤7u¤18¤Bm¤A¤Ao¢-3i—÷ß4{ßJßCß8|¨tutorial room 1 door 1¨¨tutorial room 1 door 2¨¨tutorial room 1 door floor¨÷ßlß1Hß1I£0.EW}}{ß1ßX´z´Éß3|¦´x´´y´‡ºd¢-CG¤4g¢-8O¤8YºO¤9Wº6—÷ß4{ßJßEßlß1Hß1IÝQß8|¨tutorial room 2 door floor¨¨tutorial room 2 door 1¨¨tutorial room 2 door 2¨÷}}{ß1ße´z´Éß3|¦´x´´y´‡¢-3B¢-Haº8¢-8j£-Li.-G£-Id.-Co£-Mv.-ER£-HO.-1l¢-KSºr¢-JK¢-Fz¢-6O¢-85¤2F¢-5T¤4k¢-FC—÷ß4{ßJßFßlß1Hß1I£1.2Q}}{ß1ßV´z´Éß3|¦´x´´y´‡¤Bc¢-4g¤AK¢-6S—÷ß4{ßJßEßl¨sensor_path¨ß8|¨tutorial room 2 switch¨÷}}{ß1ßS´z´Éß3|¦´x´´y´‡ºP¤-A¤Lh¤J¤Sa¤1R¤WB¢-1a¤Ut¢-Ax¤NN¢-Bh¤Ls¢-H8¤Gp¢-Ip¤Bt¢-FS¤BS¢-Ao¤4Mº19—÷ß4{ß5»ßJßEßlßo}}{ß1ßY´z´£0.-1cß3|¦´x´´y´‡¤DS¢-1Q¤EZ¢-1D¤EGºa—÷ß4{ßJßEßl¨icon_tutorial¨ß8|¨tutorial room 2 warning 1¨¨tutorial room 2 warning 2¨÷}}{ß1ßa´z´Éß3|¦´x´´y´‡£-FC.-Ac£-F7.-84£-B0.-Ac£-Df.-84£-8k.-Ac£-Fi.-84£-8P.-Ac£-IR.-84£-9x.-Ac£-KF.-84£-DT.-Ac£-Kt.-84£-Fw.-Ac£-IK.-84ÝXÝY—÷ß4{ßJßFßl¨wall_tutorial_window¨ß5»}}{ß1ßg´z´Éß3|¦´x´´y´‡£-FC.-6p£-F7.-6h£-B0.-6p£-Df.-6h£-8k.-6p£-Fi.-6h£-8P.-6p£-IR.-6h£-9x.-6p£-KF.-6h£-DT.-6p£-Kt.-6h£-Fw.-6p£-IK.-6hÝlÝm—÷ß4{ßJßFßlß1Uß1C»}}{ß1ßh´z´Éß3|¦´x´´y´‡ºl¢-FU¢-Jp¢-Fw¢-Lw¢-I4¢-MQº1J—÷ß4{ßJßFßl¨wall_tutorial_curtain¨}}{ß1ßc´z´Éß3|{´x´¢-AW´y´¢-GZ}÷ß4{ßJßFß15¨enemy_tutorial_easy¨ß17»ß18Ê¨spawn_permanent¨»}}{ß1ßf´z´Éß3|{´x´¢-Dg´y´¢-Hr}÷ß4{ßJßFß15ß1Wß17»ß18Êß1X»}}{ß1ßd´z´Éß3|¦´x´´y´‡¢-1T¢-9c¤N¢-9s¤1p¢-BBºk¢-Cl¤C¢-De¢-1M¢-Cs¢-21¢-B4—÷ß4{ßJßFßl¨wall_tutorial_rock¨}}{ß1ßR´z´Éß3|¦´x´´y´‡¢-NA¢-HD¢-V2¢-EV¢-Xk¢-6k¢-ST¤-k¢-K6¤-L¢-GW¢-4i¢-Fs¢-Ac—÷ß4{ßJßGßlß1Hß1I£1.4q}}{ß1ßi´z´Éß3|¦´x´´y´‡¢-C2¢-9C£-D3.-A3£-9g.-9h¢-Bg¢-B7—÷ß4{ßJßFßl¨wall_tutorial_spike¨}}{ß1ßk´z´Éß3|¦´x´´y´‡¢-Ab¢-PI¢-Bt¢-PL¢-BH¢-NN—÷ß4{ßJßFßlß1Z}}{ß1ßj´z´Éß3|¦´x´´y´‡¢-J1¢-ET¢-Jh¢-FO¢-HFºt—÷ß4{ßJßFßlß1Z}}{ß1ß1S´z´ÝWß3|¦´x´´y´‡¤E6¢-1h¤EBº1v—÷ß4{ßJßYßlß1Rß5»}}{ß1ß1T´z´ÝWß3|¦´x´´y´‡¤E4¢-1X¤E4º2P—÷ß4{ßJßYßlß1Rß5»}}{ß1ß1Q´z´Éß3|{´x´¤FM´y´¢-7V}÷ß4{ßJßVß15¨switch¨ß17»ß18Ê}}{ß1ß1G´z´Éß3|{´x´¤Hb´y´¢-C3}÷ß4{ßJßUß15¨enemy_tutorial_4way¨ß17»ß18Êß1X»}}{ß1ßy´z´Éß3|¦´x´´y´‡£Hj.9m£-6g.-Bz£JB.9m£-7P.-Bz£JU.9m£-9B.-Bz£IQ.9m£-A2.-Bz£H8.9m£-AI.-Bz£GI.9m£-95.-Bz£GY.9m£-7d.-Bz—÷ß4{ßJßWßlß1Y}}{ß1ßx´z´Éß3|¦´x´´y´‡¤Iw¢-3q¤Kv¢-3W¤Lp¢-4l¤Lk¢-67¤K1¢-6j¤IT¢-6D¤IA¢-4w—÷ß4{ßJßWßlß1Y}}{ß1ßw´z´Éß3|¦´x´´y´‡¤F9¢-41¤Gp¢-3r¤Ho¢-4Q¤Hq¢-5c¤Gh¢-6V¤Fbº8¤Ew¢-59—÷ß4{ßJßWßlß1Y}}{ß1ßv´z´Éß3|¦´x´´y´‡¤Cl¢-48¤DoºQ¤Ee¢-47¤Ee¢-5F¤E8º8¤Cjº8¤C8¢-52—÷ß4{ßJßWßlß1Y}}{ß1ßz´z´Éß3|¦´x´´y´‡¤DZ¢-F6¤ED¢-F8¤EX¢-FP¤Ee¢-Fv¤EDº18¤DU¢-GK¤DH¢-Fg—÷ß4{ßJßWßlß1Y}}{ß1ß10´z´Éß3|¦´x´´y´‡¤KZ¢-G2£L2.1S£-Fn.-b¤Lb¢-G0¤Lf¢-GR¤LJ¢-H1£Km.2x£-H1.-Ep¤KQ¢-GX—÷ß4{ßJßWßlß1Y}}{ß1ßu´z´Éß3|¦´x´´y´‡¤Mn¢-3H¤Ox¢-3O¤Pu¢-4E¤PP¢-68¤OE¢-6W¤Mz¢-6F¤MK¢-4z—÷ß4{ßJßWßlß1Y}}{ß1ß11´z´Éß3|¦´x´´y´‡¤Gh¢-43¤G8º1v¤FP¢-4C—÷ß4{ßJßTßlß1Z}}{ß1ß13´z´Éß3|¦´x´´y´‡¤NO¢-62¤OZ¢-88¤Oj¢-5p¤P3¢-5i¤Tdº2V¤PE¢-4S¤OX¢-3f¤OQº1U¤N9ºQ—÷ß4{ßJßTßlß1Z}}{ß1ß12´z´Éß3|¦´x´´y´‡¤LP¤Y¤KH¤T¤Ke¢-1H—÷ß4{ßJßTßlß1Z}}{ß1ß14´z´Éß3|¦´x´´y´‡¤Oy¢-9n¤OX¢-C0¤QC¢-Bl—÷ß4{ßJßTßlß1Z}}{ß1ß1A´z´Éß3|¦´x´´y´‡º1B¤-yº1B¢-2a¢-1Sº1S¤-Uº32¤-U¢-1w£1M.9T£-2L.-2bºkºQ¤5K¢-2G—÷ß4{ßJßMß15¨enemy_tutorial_bit¨ß17»ß18¤A}}{ß1ß1B´z´Éß3|¦´x´´y´‡¢-4Wºdºe¤3sº2x¤-y¢-5K¤-A¢-3s¤-y¢-4M¤3E¢-3E¤4g—÷ß4{ßJßMß15ß1cß17»ß18¤A}}{ß1ß1D´z´Éß3|¦´x´´y´‡¤MZ¢-3F¤Lx¢-3K¤LHºZ¤M4¢-4c¤M5¢-56¤M1º8¤KK¢-6r¤NVº1D¤Mgºe¤M8º3P¤M7º3O—÷ß4{ßJßUß15ß1cß17»ß18Î}}{ß1ß1E´z´Éß3|¦´x´´y´‡£SQ.C6£17.FN¤Pw¤r¤Sgº1n¤Vh¢-2g¤Vu¢-1d—÷ß4{ßJßUß15ß1cß18Îß17»}}{ß1ß1F´z´Éß3|¦´x´´y´‡¤SP¢-AH¤QL¢-AX¤QK¢-BD¤Ud¢-Aj¤V3¢-8H¤TP¢-8n—÷ß4{ßJßUß15ß1cß17»ß18Î}}{ß1ß1L´z´Éß3|¦´x´´y´‡¤8E¢-34¤9C¤o¤AU¤U¤9Wº2v—÷ß4{ßJßOßl¨floor_tutorial¨}}{ß1ß1M´z´Éß3|¦´x´´y´‡ºi¢-Bw¤5y¢-84¤7G¢-7k¤8EºM—÷ß4{ßJßXßlß1d}}{ß1ß1J´z´Éß3|¦´x´´y´‡¤9MºV¤9s¤m—÷ß4{ß5»ß6¨tutorial_door¨ßJßO}}{ß1ß1N´z´Éß3|¦´x´´y´‡¤76ºK¤6a¢-7m—÷ß4{ß5»ß6ß1eßJßX}}{ß1ß1O´z´Éß3|¦´x´´y´‡¤76ºK¤7c¢-Bu—÷ß4{ß5»ß6ß1eßJßX}}{ß1ß1K´z´Éß3|¦´x´´y´‡¤9MºV¤8q¢-3M—÷ß4{ß5»ß6ß1eßJßO}}{ß1ßs´z´Éß3|¦´x´´y´‡£-3i.-9W£5J.8V£-34.-9W£4z.8V£-2G.-9WÝ1R£-1m.-9W£5d.8V£-1w.-9W£6b.8V£-2Q.-9W£5x.8VºGºH—÷ß4{ßJßKßlß1Y}}{ß1ßt´z´Éß3|¦´x´´y´‡º1C¤Uº1D¤2Y¢-6h¤2Yº2y¤U—÷ß4{ßJßKßl¨wall_tutorial_rock_breakable¨}}{ß1ßr´z´Éß3|¦´x´´y´‡£-5o.-9W£-18.-7d£-5e.-9W£-1c.-7d£-4q.-9W£-1w.-7d£-4M.-9W£-1S.-7dÝ1f£-o.-7d£-50.-9W£-U.-7d£-5U.-9W£-e.-7d—÷ß4{ßJßKßlß1Y}}{ß1ßq´z´Éß3|¦´x´´y´‡£2F.6c£59.8V£2Z.6c£4V.8V£3N.6c£4B.8V£41.6c£4p.8VÝ1s£5n.8V£3D.6c£67.8V£2P.6cÝ1Y—÷ß4{ßJßKßlß1Y}}{ß1ßp´z´Éß3|¦´x´´y´‡£-K.-9W£-3O.-7d£9.6c£-3i.-7d£x.6c£-3Y.-7d£1H.6c£-2u.-7d£w.2o£-2P.-K£I.2o£-2F.-K£-L.-DK£-2Z.-K—÷ß4{ßJßKßlß1Y}}{ß1ß19´z´ÝWß3|¦´x´´y´‡¤4MºcºL¤-K¤4p¤EºL¤-K¤2Q¤K—÷ß4{ßJßMßlß1Rß5»}}÷¨icons¨|÷}");

const TEST_MAP_: map_type = {
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