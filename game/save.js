import { config } from "../util/config.js";
import { clone_object } from "./make.js";
import { player } from "./player.js";
;
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
    current_slot: 0,
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
        save.save.currencies[name] = (save.save.currencies[name] ?? 0) + number;
        player.stats.currencies_total[name] = (player.stats.currencies_total[name] ?? 0) + number;
        save.changed(true);
    },
    changed: (big = false) => {
        // todo autosave to slot
        if (player.enemy_can_see) {
            player.enemy_can_see = false;
            return false;
        }
        if (big)
            console.log("saving... ", save.save);
        save.save_to_slot(save.current_slot);
        save.save_to_storage();
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
        while (save.saves.length <= slot) {
            save.saves.push(save.new_save());
        }
        save.saves[slot] = clone_object(save.save);
    },
    save_to_storage: () => {
        const raw = zipson.stringify({
            saves: save.saves,
            slot: save.current_slot,
        });
        localStorage.setItem("saves", raw);
    },
    load_from_slot: (slot) => {
        if (slot === undefined)
            slot = save.current_slot;
        const s = save.saves[slot];
        player.load(s.player);
        save.save = s;
        save.current_slot = slot;
        console.log("loaded game from slot " + slot + "!");
    },
    load_from_storage: () => {
        const raw = localStorage.getItem("saves");
        if (!raw) {
            console.log("new game loaded!");
            return;
        }
        const o = zipson.parse(raw);
        save.saves = o.saves;
        save.current_slot = o.slot;
        save.load_from_slot();
    },
};
