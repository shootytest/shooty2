import { Context } from "./draw.js";
export const canvas_ = document.createElement("canvas");
export const canvas = canvas_.transferControlToOffscreen();
export const ctx = new Context(canvas.getContext("2d", { alpha: false }));
canvas_.classList.add("canvas");
document.body.appendChild(canvas_);
// just the window...
export const view = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
};
export const init_canvas = () => {
    ctx.resetTransform();
    ctx.lineCap = "butt";
    ctx.lineJoin = "bevel";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // resize_canvas();
    window.dispatchEvent(new Event("resize"));
};
export const resize_canvas = () => {
    const pixel_ratio = window.devicePixelRatio;
    const w = window.innerWidth;
    const h = window.innerHeight;
    view.width = w;
    view.height = h;
    const resolution_mult = 1;
    canvas.width = w * pixel_ratio * resolution_mult;
    canvas.height = h * pixel_ratio * resolution_mult;
    window.canvas_ratio = pixel_ratio * resolution_mult;
    // canvas.style.width = w + "";
    // canvas.style.height = h + "";
    ctx.resetTransform();
};
window.addEventListener("resize", resize_canvas);
