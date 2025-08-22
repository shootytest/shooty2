import { config } from "../util/config.js";
import { clone_object } from "./make.js";
;
export const save = {
    save: {
        version: config.game.version,
        switches: {},
        currencies: {},
    },
    saves: [],
    check_switch: (id) => {
        return save.save.switches[id] >= 0;
    },
    activate_switch: (id) => {
        save.save.switches[id] = 1;
    },
    get_currency: (name) => {
        return save.save.currencies[name] ?? 0;
    },
    new_save: () => {
        return {
            version: config.game.version,
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
