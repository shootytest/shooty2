import { color } from "../util/color.js";
import { vector3 } from "../util/vector.js";
import { Shape } from "./shape.js";
import { Thing } from "./thing.js";

export class Player extends Thing {

  constructor() {
    super();
    const s = Shape.circle(30);
    s.thing = this;
    s.style.fill = color.red;
    this.shapes.push(s);
    this.create_all();
    this.position = vector3.create();
  }

};