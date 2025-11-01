
// all colours are in 6-long hex format

import type { styles_type } from "./map_type";

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
  start: "#00ddff99",

  coin: "#fff200",
  sensor: "#00ddff",

  tutorial_main: "#7f77ea",
  tutorial_alt: "#778eea",
  tutorial_dark: "#544bdb",
  tutorial_dark2: "#4e47af",

};

export const STYLES: styles_type = {
  error: {
    stroke: color.error,
    fill: color.error,
  },
  test: {
    stroke: color.test + "99",
    fill: color.test + "99",
    fill_opacity: 0.8,
  },
  player: {
    stroke: color.white,
    stroke_opacity: 1,
    fill: color.white,
    fill_opacity: 0.4,
  },
  home: {
    stroke: "#eeeeee",
    stroke_opacity: 1,
  },
  tutorial: {
    stroke: color.tutorial_main,
    stroke_opacity: 1,
  },
  tutorial_filled: {
    stroke: color.tutorial_main,
    stroke_opacity: 1,
    fill: color.tutorial_dark,
    fill_opacity: 0.7,
  },
  tutorial_window: {
    stroke: color.tutorial_alt,
    fill: color.tutorial_alt,
    fill_opacity: 0.2,
  },
  tutorial_curtain: {
    stroke: color.tutorial_dark2,
    stroke_opacity: 0,
    fill: color.tutorial_dark2,
    fill_opacity: 0.3,
  },
  tutorial_breakable: {
    stroke: color.tutorial_alt,
    stroke_opacity: 0.45,
  },
  tutorial_boss: {
    stroke: "#d75f19",
    fill: "#d75f19",
    health: color.tutorial_alt,
    fill_opacity: 0.4,
    health_opacity: 0.6,
  },
  tutorial_enemy: {
    stroke: "#d7193f",
    fill: "#d7193f",
    health: color.tutorial_alt,
    fill_opacity: 0.4,
    health_opacity: 0.6,
  },
  tutorial_spike: {
    stroke: "#d7193f",
    fill: "#d7193f",
    health: color.tutorial_alt,
    fill_opacity: 0.4,
    health_opacity: 0.6,
  },
  tutorial_enemy_2: {
    stroke: color.tutorial_alt,
    fill: color.tutorial_alt,
    health: "#d7193f",
    fill_opacity: 0.4,
    health_opacity: 0.25,
  },
  tutorial_enemy_coin: {
    stroke: color.tutorial_alt,
    fill: color.tutorial_alt,
    health: color.coin,
    fill_opacity: 0.4,
    health_opacity: 0.3,
  },
  tutorial_door: {
    stroke: color.tutorial_dark2,
  },
  tutorial_door_floor: {
    stroke: color.tutorial_main,
    stroke_opacity: 0,
    fill: color.tutorial_dark2,
    fill_opacity: 0.3,
  },
  tutorial_floor: {
    stroke_opacity: 0,
    fill: color.tutorial_dark2,
    fill_opacity: 1,
  },
  start: {
    stroke: color.start,
  },
  coin_rock: {
    stroke: color.coin,
    stroke_opacity: 0.5,
    fill: color.coin,
    fill_opacity: 0.1,
  },
  collect_coin: {
    stroke: color.coin,
    stroke_opacity: 1,
    width: 0.5,
    fill: color.coin,
    fill_opacity: 0.1,
  },
  collect_gun: {
    stroke: "#a6ff00",
    stroke_opacity: 1,
    fill: "#a6ff00",
    fill_opacity: 0.2,
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
    fill: "#af4747",
    fill_opacity: 0.3,
  },
};