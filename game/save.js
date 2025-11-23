import { config } from "../util/config.js";
import { math } from "../util/math.js";
import { clone_object } from "./make.js";
import { player } from "./player.js";
import { Thing } from "./thing.js";
;
;
;
;
export const save = {
    save: {
        version: config.game.version,
        player: {},
        map: {},
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
        return save.get_switch(id) > 0;
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
    get_map: (id) => {
        return save.save.map[id] ?? -1;
    },
    check_map: (id) => {
        return save.get_map(id) > 0;
    },
    visit_map: (id) => {
        if (!save.save.map[id])
            save.save.map[id] = 0;
        save.save.map[id]++;
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
    changed: (not_autosave = false, force = false) => {
        // todo autosave to slot
        if (player.enemy_can_see && !force) {
            // player.enemy_can_see = false; // hmmm
            return false;
        }
        // if (not_autosave) console.log("saving... ", save.save);
        save.save_to_slot(save.current_slot);
        save.save_to_storage();
        return true;
    },
    new_save: () => {
        return {
            version: config.game.version,
            player: {},
            map: {},
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
        // console.log(s);
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
    save_settings: () => {
        const o = {
            graphics: [
                Math.round(config.graphics.fps),
                math.round_to(config.graphics.resolution_mult, 0.1),
                config.graphics.debug_display,
                config.graphics.fullscreen,
            ],
        };
        localStorage.setItem("settings", zipson.stringify(o));
    },
    load_settings: () => {
        const raw = localStorage.getItem("settings");
        if (!raw) {
            save.save_settings();
            return;
        }
        const o = zipson.parse(raw);
        config.graphics.fps = o.graphics[0];
        config.graphics.resolution_mult = o.graphics[1];
        config.graphics.debug_display = o.graphics[2];
        config.graphics.fullscreen = o.graphics[3];
    },
};
