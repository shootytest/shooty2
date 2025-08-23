import { config } from "../util/config.js";
import { clone_object } from "./make.js";
;
;
export const save = {
    save: {
        version: config.game.version,
        player: {},
        switches: {},
        currencies: {},
    },
    saves: [],
    get_switch: (id) => {
        return save.save.switches[id] ?? -1;
    },
    check_switch: (id) => {
        return save.save.switches[id] > 0;
    },
    set_switch: (id, number = 1) => {
        save.save.switches[id] = number;
        save.changed(true);
    },
    get_currency: (name) => {
        return save.save.currencies[name] ?? 0;
    },
    add_currency: (name, number = 1) => {
        save.save.currencies[name] += number;
        save.changed(true);
    },
    changed: (big = false) => {
        // todo autosave to slot
        if (big)
            console.log("saving... ", save.save);
    },
    new_save: () => {
        return {
            version: config.game.version,
            player: {},
            switches: {},
            currencies: {},
        };
    },
    save_to_slot: (slot) => {
        while (save.saves.length < slot) {
            save.saves.push(save.new_save());
        }
        save.saves[slot] = clone_object(save.save);
    },
};
