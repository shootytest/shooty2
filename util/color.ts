import { clone_object, make_rooms } from "../game/make.js";
import { style_type } from "./map_type.js";

// all colours are in 6-long hex format

export const color/*: { [key: string]: `#${string}` }*/ = {

  // legacy colours

  purewhite: "#ffffff",
  pureblack: "#000000",
  white: "#eeeeee",
  black: "#111111",
  blackground: "#122334",
  offblack: "#404040",
  lightgrey: "#CCCCCC",
  grey: "#999999",
  darkgrey: "#666666",
  dimgrey: "#333333",

  pink: "#ff33c9",
  pink_bullet: "#fc77ea",

  red: "#ff4733",
  enemy_bullet: "#fc7777",
  red_health: "#bf0000",
  red_dark: "#990f00",

  orange: "#ffaa33",
  orange_bullet: "#fcc578",
  orangered: "#ff7733",
  orangered_bullet: "#fca478",

  gold: "#ffcf33",
  yellow: "#fff133",
  yellow_bullet: "#fcfa77",

  lightning_yellow: "#f9ff42",

  green: "#96ff33",
  green_bullet: "#b7fc77",
  green_health: "#5dbf00",
  green_dark: "#4a9900",

  blue: "#336dff",
  bright_blue: "#33a7ff",
  neon_blue: "#00ddff",
  sky_blue: "#b0efff",
  storm_blue: "#055063",
  player_bullet: "#779dfc",

  lightning_blue: "#4249ff",

  purple: "#b833ff",
  purple_bullet: "#ce78fc",

  background: "#000000",
  camo: "#FFFFFF11",

  message_text: "#ff9999",
  message_text_red: "#ff9999",
  message_text_green: "#99ff9c",
  message_text_aqua: "#99ffce",
  message_text_gold: "#ffdd99",
  message_text_tutorial: "#c4a1ff",

  joystick_left: "#99ffce",
  joystick_right: "#ff9999",

  transparent: "#00000000",

  // new colours

  error: "#ff0000",
  test: "#abcdef",
  testy: "#123456",
  start: "#00ddff",
  player: "#eeeeee",

  home: "#cadbca",
  home_floor: "#445544",

  train: "#baabaa",
  train_floor: "#3b3636",

  coin: "#eff200",
  sensor: "#00ddff",
  spawner: "#af4747",

  enemy_main: "#d7193f",
  enemy_alt: "#d75f19",

  tutorial_main: "#7f77ea",
  tutorial_alt: "#778eea",
  tutorial_dark: "#544bdb",
  tutorial_dark2: "#4e47af",
  tutorial_floor: "#29264e",

  streets_main: "#77adea",
  streets_alt: "#77dfea",
  streets_dark: "#4b98db",
  streets_dark2: "#478baf",
  streets_floor: "#263e4e",

};

export interface color_theme {

  uid: number,

  main: string,
  alt?: string,
  dark: string,
  dark2?: string,
  floor: string,

  enemy?: string,
  enemy2?: string,
  coin?: string,
  shadow?: string,

};

export const THEMES/*: { [key: string]: color_theme }*/ = {

  default: {
    uid: 1,
    main: "#ff0000",
    alt: "#ff0000",
    dark: "#ff0000",
    dark2: "#ff0000",
    floor: "#ff0000",
    enemy: "#d7193f",
    enemy2: "#d75f19",
    coin: "#eff200",
  },
  home: {
    uid: 2,
    main: "#cadbca",
    alt: "#adfbcd",
    dark: "#829882",
    floor: "#445544",
  },
  train: {
    uid: 3,
    main: "#baabaa",
    dark: "#756564",
    floor: "#3b3636",
  },
  station_tutorial: {
    uid: 7.5,
    main: "#7f77ea",
    dark: "#544bdb",
    floor: "#29264e",
  },
  tutorial: {
    uid: 7,
    main: "#7f77ea",
    alt: "#778eea",
    dark: "#544bdb",
    dark2: "#4e47af",
    floor: "#22203c",
  },
  streets: {
    uid: 8,
    main: "#77adea",
    alt: "#7977ea",
    dark: "#4b98db",
    dark2: "#478baf",
    floor: "#21323d",
  },

};

// export const THEMES_: { [key: string]: color_theme } = THEMES;

export const THEMES_UID_MAX = Object.values(THEMES as { [key: string]: color_theme }).map((t) => t.uid).reduce((id1, id2) => Math.max(id1, id2)); // i don't normally put everything in 1 line lol

export const current_theme: color_theme = clone_object(THEMES.default) as color_theme;


export const color2hex = (c: string) => {
  return "" + ((current_theme as any)[c] ?? (THEMES.default as any)[c] ?? c);
};

export const color2hex_map = (c: string, theme_string: string) => {
  if (!(theme_string in THEMES)) {
    theme_string = make_rooms[theme_string]?.theme;
  }
  const t = (theme_string ? (THEMES[theme_string as keyof typeof THEMES] ?? THEMES.default) : current_theme) as any;
  const tc = t[c] ?? (THEMES.default as any)[c];
  if (tc) return "" + tc;
  else return c;
};


const mix_lookup: { [key: string]: string } = {};

export const color_mix = (c1: string, c2: string, amount: number) => {
  if (amount < 0.001) return c1;
  else if (amount > 0.999) return c2;
  const s = c1 + "|" + c2 + "|" + amount.toFixed(3);
  if (mix_lookup[s]) return mix_lookup[s];
  const result = chroma.mix(c1, c2, amount, "lab").hex();
  mix_lookup[s] = result;
  return result;
};


export const STYLES/*: { [key: string]: style_type }*/ = {

  // test colours
  error: {
    stroke: color.error,
    fill: color.error,
  } as style_type,
  test: {
    stroke: color.test + "99",
    fill: color.test + "99",
    fill_opacity: 0.8,
  },

  // map maker styles
  start: {
    stroke: color.start + "99",
  },
  switch: {
    stroke: color.sensor,
    stroke_opacity: 1,
    fill: color.sensor,
    fill_opacity: 0.2,
  },
  sensor: {
    stroke: color.sensor,
    stroke_opacity: 0,
    fill: color.sensor,
    fill_opacity: 0.2,
  },
  sensor_path: {
    stroke: color.sensor,
    stroke_opacity: 0.7,
  },
  spawner: {
    stroke_opacity: 0,
    fill: color.spawner,
    fill_opacity: 0.3,
  },
  room: {
    fill: color.start,
    stroke: color.start,
  },
  map: {
    fill: "main",
    stroke: "main",
    fill_opacity: 0.3,
    stroke_opacity: 0,
  },
  map_inverse: {
    fill: color.black,
    stroke: "main",
    fill_opacity: 1,
    stroke_opacity: 0,
  },
  map_line: {
    fill: color.black,
    stroke: "main",
    fill_opacity: 0,
    stroke_opacity: 0.5,
  },
  map_line_dark: {
    fill: color.black,
    stroke: "dark",
    fill_opacity: 0,
    stroke_opacity: 0.5,
  },

  // collectible colours
  coin_rock_1: {
    stroke: "alt",
    fill: "alt",
    fill_opacity: 0.4,
    health: "coin",
    health_opacity: 0.3,
  },
  coin_rock_2: {
    stroke: "coin",
    stroke_opacity: 0.5,
    fill: "coin",
    fill_opacity: 0.1,
    health: "main",
    health_opacity: 1,
  },
  collect_coin: {
    stroke: "coin",
    stroke_opacity: 1,
    width: 0.5,
    fill: "coin",
    fill_opacity: 0.1,
  },
  collect_gun: {
    stroke: "#a6ff00",
    stroke_opacity: 1,
    fill: "#a6ff00",
    fill_opacity: 0.2,
  },

  // the one
  player: {
    stroke: color.white,
    stroke_opacity: 1,
    fill: color.white,
    fill_opacity: 0.4,
  },


  train: {
    stroke: color.train,
    stroke_opacity: 1,
    fill: color.train,
    fill_opacity: 0.5,
  },
  train_floor: {
    stroke_opacity: 0,
    fill: color.train_floor,
    fill_opacity: 0.8,
  },
  train_track: {
    width: 3,
    stroke: color.train_floor,
    stroke_opacity: 0.7,
  },


  main: {
    stroke: "main",
    stroke_opacity: 1,
  },
  wall: {
    stroke: "main",
    stroke_opacity: 1,
  },
  wall_filled: {
    stroke: "main",
    stroke_opacity: 1,
    fill: "dark",
    fill_opacity: 0.7,
  },
  wall_floor: {
    stroke: "dark",
    stroke_opacity: 0.7,
    fill: "floor",
    fill_opacity: 1,
  },
  wall_window: {
    stroke: "alt",
    fill: "alt",
    fill_opacity: 0.2,
  },
  tutorial_curtain: {
    stroke: "dark2",
    stroke_opacity: 0,
    fill: "dark2",
    fill_opacity: 0.3,
  },
  door: {
    stroke: "dark2",
  },
  tutorial_door_floor: {
    stroke: "main",
    stroke_opacity: 0,
    fill: "dark2",
    fill_opacity: 0.3,
  },
  floor: {
    stroke_opacity: 0,
    fill: "floor",
    fill_opacity: 1,
  },
  breakable: {
    stroke: "alt",
    stroke_opacity: 0.45,
  },
  enemy: {
    stroke: "enemy",
    fill: "enemy",
    health: "alt",
    fill_opacity: 0.4,
    health_opacity: 0.6,
  },
  enemy2: {
    stroke: "enemy2",
    fill: "enemy2",
    health: "alt",
    fill_opacity: 0.4,
    health_opacity: 0.25,
  },
  enemy_camera: {
    stroke: "alt",
    stroke_opacity: 1,
    health: "enemy",
    fill: "alt",
    fill_opacity: 0.5,
  },
  particle: {
    fill: "main",
    fill_opacity: 1,
  },

  shapey_base: {
    stroke: "dark",
    stroke_opacity: 0,
    fill: "dark",
    fill_opacity: 0.5,
  },

};

export const STYLES_ = STYLES as { [key: string]: style_type };