export class Shoot {
    static cumulative_id = 0;
    thing;
    index = -1;
    active = false;
    time = 0;
    duration = 0;
    duration_time = 0;
    delay = 0;
    stats;
    constructor(thing, stats) {
        this.thing = thing;
        this.stats = stats;
    }
    shoot() {
    }
}
;
