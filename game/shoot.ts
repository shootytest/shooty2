import { vector3_ } from "../util/vector";
import { Thing } from "./thing";


export class Shoot {
  
  static cumulative_id = 0;

  thing: Thing;
  index: number = -1;

  active = false;
  time = 0;
  duration = 0;
  duration_time = 0;
  delay = 0;

  stats: shoot_stats;

  constructor(thing: Thing, stats: shoot_stats) {
    this.thing = thing;
    this.stats = stats;
  }

  shoot() {

  }

};


export type shoot_stats = {
  parent?: string[];
  type?: string;
  size?: number;
  reload?: number;
  duration_reload?: number;
  speed?: number;
  spread?: number;
  spread_size?: number;
  spread_speed?: number;
  damage?: number;
  health?: number;
  time?: number;
  friction?: number;
  recoil?: number;
  delay?: number;
  offset?: vector3_;
  target_type?: string;
  boost_mult?: number;
  move?: boolean;
  always_shoot?: boolean;
};