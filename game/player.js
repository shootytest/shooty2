import { Shape } from "./shape.js";
import { Thing } from "./thing.js";
export class Player extends Thing {
    constructor() {
        super();
        this.shapes.push(Shape.circle(30));
    }
}
