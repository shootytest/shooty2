import { config } from "../util/config.js";
import { clone_object } from "./make.js";
import { player } from "./player.js";
import { Thing } from "./thing.js";
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
    switch_times: {},
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
    get_switch_time: (id) => {
        const time = save.switch_times[id] ?? -1;
        return time === -1 ? -1 : (Thing.time - time);
    },
    set_switch_time: (id, time = -1) => {
        save.switch_times[id] = time;
    },
    get_currency: (name) => {
        return save.save.currencies[name] ?? 0;
    },
    add_currency: (name, number = 1) => {
        save.save.currencies[name] = (save.save.currencies[name] ?? 0) + number;
        player.stats.currencies_total[name] = (player.stats.currencies_total[name] ?? 0) + number;
        save.changed(true);
    },
    changed: (big = false, force = false) => {
        // todo autosave to slot
        if (player.enemy_can_see && !force) {
            // player.enemy_can_see = false; // hmmm
            return false;
        }
        // if (big) console.log("saving... ", save.save);
        save.save_to_slot(save.current_slot);
        save.save_to_storage();
        return true;
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
        save.save = s;
        save.current_slot = slot;
        player.load(s.player);
        console.log("loaded game from slot " + slot + "!");
    },
    load_from_storage: () => {
        const raw = localStorage.getItem("saves");
        if (!raw) {
            console.log("new game loaded!");
            player.load({});
            return;
        }
        const o = zipson.parse(raw);
        save.saves = o.saves;
        save.current_slot = o.slot;
        save.load_from_slot();
    },
};
