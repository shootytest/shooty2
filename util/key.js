import { canvas } from "./canvas.js";
import { vector } from "./vector.js";
export const keys = {};
const key_listeners = {};
const keydown_listeners = [];
const keyup_listeners = [];
let key_changed = false;
const update_mouse = (buttons) => {
    keys["Mouse"] = (buttons & 1) !== 0;
    keys["MouseLeft"] = (buttons & 1) !== 0;
    keys["MouseRight"] = (buttons & 2) !== 0;
    keys["MouseWheel"] = (buttons & 4) !== 0;
};
export const mouse = {
    x: 0,
    y: 0,
    scroll: 0,
    double_click: false,
    old: vector.create(),
    d: vector.create(),
    buttons: [false, false, false],
    down_buttons: [false, false, false],
    up_buttons: [false, false, false],
    down_position: [vector.create(), vector.create(), vector.create()],
    up_position: [vector.create(), vector.create(), vector.create()],
    drag_vector: [vector.create(), vector.create(), vector.create()],
    drag_vector_old: [vector.create(), vector.create(), vector.create()],
    drag_change: [vector.create(), vector.create(), vector.create()],
    old_touches: {},
    // run this tick right at the end!
    tick: () => {
        mouse.down_buttons = [false, false, false];
        mouse.up_buttons = [false, false, false];
        for (let b = 0; b < 3; b++) {
            if (mouse.drag_vector[b] != false && mouse.drag_vector_old[b] != false) {
                mouse.drag_change[b] = vector.sub(mouse.drag_vector[b] || vector.create(), mouse.drag_vector_old[b] || vector.create());
            }
            else {
                mouse.drag_change[b] = vector.create();
            }
            mouse.drag_vector_old[b] = mouse.drag_vector[b];
        }
        mouse.scroll = 0;
        mouse.double_click = false;
    },
};
export const key = {
    init: () => {
        window.addEventListener("keydown", function (event) {
            key_changed = true;
            if (["Tab"].includes(event.code)) {
                event.preventDefault();
            }
            const key = event.code;
            keys[key] = true;
            if (!event.repeat) {
                if (key_listeners[key] != null) {
                    for (const f of key_listeners[key]) {
                        f();
                    }
                }
            }
            for (const f of keydown_listeners) {
                f(event);
            }
        });
        window.addEventListener("keypress", function (event) {
            key_changed = true;
            if (["Tab"].includes(event.code)) {
                event.preventDefault();
            }
            const key = event.code;
            keys[key] = true;
        });
        window.addEventListener("keyup", function (event) {
            key_changed = true;
            const key = event.code;
            keys[key] = false;
            for (const f of keyup_listeners) {
                f(event);
            }
        });
        window.addEventListener("focus", function (event) {
            key_changed = true;
            for (const key in keys) {
                keys[key] = false;
            }
        });
        window.addEventListener("mousemove", function (event) {
            key_changed = true;
            mouse.x = event.clientX;
            mouse.y = event.clientY;
            mouse.d.x = event.movementX;
            mouse.d.y = event.movementY;
            for (let b = 0; b < 3; b++) {
                if (mouse.buttons[b] && mouse.down_position[b]) {
                    const new_mousedrag = vector.sub(vector.create(mouse.x, mouse.y), mouse.down_position[b]);
                    mouse.drag_vector[b] = new_mousedrag;
                }
            }
        });
        const mousedown = (event) => {
            if (event instanceof TouchEvent) {
                mouse.old_touches = event.touches;
            }
            let b = event instanceof MouseEvent ? event.button : 0;
            if (b === 0) {
                if (keys.AltLeft)
                    b = 2;
                else if (keys.AltRight)
                    b = 1;
            }
            mouse.down_buttons[b] = true;
            mouse.buttons[b] = true;
            mouse.down_position[b] = vector.create(mouse.x, mouse.y);
            mouse.drag_vector[b] = false;
            mouse.drag_vector_old[b] = false;
        };
        canvas.addEventListener("mousedown", function (event) {
            key_changed = true;
            mousedown(event);
            event.preventDefault();
            update_mouse(event.buttons);
        });
        canvas.addEventListener("touchstart", function (event) {
            key_changed = true;
            mousedown(event);
            event.preventDefault();
        });
        canvas.addEventListener("contextmenu", function (event) {
            key_changed = true;
            event.preventDefault();
            update_mouse(event.buttons);
        });
        const mouseup = (event) => {
            if (event instanceof TouchEvent) {
                mouse.old_touches = {};
            }
            let b = event instanceof MouseEvent ? event.button : 0;
            if (b === 0) {
                if (keys.AltLeft)
                    b = 2;
                else if (keys.AltRight)
                    b = 1;
            }
            mouse.up_buttons[b] = true;
            mouse.buttons[b] = false;
            mouse.up_position[b] = vector.create(mouse.x, mouse.y);
            mouse.drag_vector[b] = false;
            mouse.drag_vector_old[b] = false;
        };
        canvas.addEventListener("mouseup", function (event) {
            key_changed = true;
            mouseup(event);
            event.preventDefault();
            update_mouse(event.buttons);
        });
        canvas.addEventListener("touchend", function (event) {
            key_changed = true;
            mouseup(event);
            event.preventDefault();
        });
        function wheel(event) {
            event.preventDefault();
            mouse.scroll = event.deltaY;
            return false;
        }
        ;
        function dblclick(event) {
            event.preventDefault();
            mouse.double_click = true;
            return false;
        }
        ;
        canvas.addEventListener("wheel", function (event) {
            wheel(event);
        }, {
            passive: false,
        });
        canvas.addEventListener("dblclick", function (event) {
            dblclick(event);
        });
    },
    update_controls: {},
    shift: () => {
        return (keys.ShiftLeft || keys.ShiftRight);
    },
    ctrl: () => {
        return (keys.ControlLeft || keys.ControlRight);
    },
    alt: () => {
        return (keys.AltLeft || keys.AltRight);
    },
    meta: () => {
        return (keys.MetaLeft || keys.MetaRight);
    },
    add_key_listener: (key, f) => {
        if (key_listeners[key] == null)
            key_listeners[key] = [];
        key_listeners[key].push(f);
    },
    remove_key_listeners: (key) => {
        key_listeners[key] = [];
    },
    add_keydown_listener: (f) => {
        keydown_listeners.push(f);
    },
    remove_keydown_listeners: () => {
        keydown_listeners.length = 0;
    },
    check_keys: function (key_array) {
        if (!Array.isArray(key_array)) {
            key_array = [key_array];
        }
        for (const key of key_array) {
            if (keys[key]) {
                return true;
            }
        }
        return false;
    },
};
const mouseup_all = () => {
    mouse.up_buttons = [false, false, false];
    mouse.buttons = [false, false, false];
    mouse.up_position = [vector.create(mouse.x, mouse.y), vector.create(mouse.x, mouse.y), vector.create(mouse.x, mouse.y)];
    mouse.drag_vector = [false, false, false];
    mouse.drag_vector_old = [false, false, false];
};
export const alert_ = (...args) => {
    window.alert(...args);
    mouseup_all();
};
export const prompt_ = (...args) => {
    const answer = window.prompt(...args);
    mouseup_all();
    return answer;
};
