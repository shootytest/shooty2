import { Context } from "./draw.js";
export const canvas = document.createElement("canvas");
export const ctx = new Context(canvas.getContext("2d", { alpha: false }));
canvas.classList.add("canvas");
document.body.appendChild(canvas);
// just the window...
export const view = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
};
export const init_canvas = () => {
    ctx.resetTransform();
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    resize_canvas();
};
export const resize_canvas = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    view.width = w;
    view.height = h;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + "";
    canvas.style.height = h + "";
};
window.addEventListener("resize", resize_canvas);
