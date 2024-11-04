import Matter from "../matter.js";
import { Shape } from "./shape.js";

/**
 * the thing class... i don't know anymore i have made like 5 of these already... maybe more
 * this covers all things (which interact with each other)
 * maybe this is everything
 */
export class Thing {

  static things: Thing[] = [];
  
  static cumulative_id = 0;

  static tick_things = () => {
    for (const thing of Thing.things) {
      // thing.tick();
    }
  }
  
  id: number = ++Thing.cumulative_id;

  body?: Body = undefined; // physics body
  shapes: Shape[] = [];

  constructor() {
    
  }

}