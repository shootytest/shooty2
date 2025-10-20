import { svg_paths } from "./svg.js";
import { math } from "./math.js";
const images = {};
export class Context {
    ctx;
    saves;
    // ready
    constructor(ctx) {
        if (ctx == null) {
            throw "bad context";
        }
        this.ctx = ctx;
        this.saves = {};
        // why
        this.ctx.textRendering = "optimizeSpeed";
    }
    // get
    get canvas() {
        return this.ctx.canvas;
    }
    get strokeStyle() {
        return this.ctx.strokeStyle;
    }
    get fillStyle() {
        return this.ctx.fillStyle;
    }
    get globalAlpha() {
        return this.ctx.globalAlpha;
    }
    get globalCompositeOperation() {
        return this.ctx.globalCompositeOperation;
    }
    get textAlign() {
        return this.ctx.textAlign;
    }
    get textBaseline() {
        return this.ctx.textBaseline;
    }
    get lineWidth() {
        return this.ctx.lineWidth;
    }
    get lineCap() {
        return this.ctx.lineCap;
    }
    get lineJoin() {
        return this.ctx.lineJoin;
    }
    get shadowBlur() {
        return this.ctx.shadowBlur;
    }
    get shadowOffsetX() {
        return this.ctx.shadowOffsetX;
    }
    get shadowOffsetY() {
        return this.ctx.shadowOffsetY;
    }
    get shadowColor() {
        return this.ctx.shadowColor;
    }
    get filter() {
        return this.ctx.filter;
    }
    // set
    set strokeStyle(stroke) {
        this.ctx.strokeStyle = stroke;
    }
    set fillStyle(fill) {
        this.ctx.fillStyle = fill;
    }
    set globalAlpha(alpha) {
        this.ctx.globalAlpha = alpha;
    }
    set globalCompositeOperation(co) {
        this.ctx.globalCompositeOperation = co;
    }
    set textAlign(align) {
        this.ctx.textAlign = align;
    }
    set textBaseline(baseline) {
        this.ctx.textBaseline = baseline;
    }
    set lineWidth(lineWidth) {
        this.ctx.lineWidth = lineWidth;
    }
    set lineCap(lineCap) {
        this.ctx.lineCap = lineCap;
    }
    set lineJoin(lineJoin) {
        this.ctx.lineJoin = lineJoin;
    }
    set shadowBlur(shadowBlur) {
        this.ctx.shadowBlur = shadowBlur;
    }
    set shadowOffsetX(shadowOffsetX) {
        this.ctx.shadowOffsetX = shadowOffsetX;
    }
    set shadowOffsetY(shadowOffsetY) {
        this.ctx.shadowOffsetY = shadowOffsetY;
    }
    set shadowColor(shadowColor) {
        this.ctx.shadowColor = shadowColor;
    }
    set filter(filter) {
        this.ctx.filter = filter;
    }
    // go
    save(slot) {
        const ctx = this.ctx;
        ctx.save(); // save first, in case of ctx.clip calls
        this.saves[slot] = {
            strokeStyle: ctx.strokeStyle,
            fillStyle: ctx.fillStyle,
            globalAlpha: ctx.globalAlpha,
            globalCompositeOperation: ctx.globalCompositeOperation,
            lineWidth: ctx.lineWidth,
            lineCap: ctx.lineCap,
            lineJoin: ctx.lineJoin,
            miterLimit: ctx.miterLimit,
            lineDashOffset: ctx.lineDashOffset,
            shadowOffsetX: ctx.shadowOffsetX,
            shadowOffsetY: ctx.shadowOffsetY,
            shadowBlur: ctx.shadowBlur,
            shadowColor: ctx.shadowColor,
            font: ctx.font,
            textAlign: ctx.textAlign,
            textBaseline: ctx.textBaseline,
            direction: ctx.direction,
            imageSmoothingEnabled: ctx.imageSmoothingEnabled,
            transform: ctx.getTransform(),
        };
    }
    restore(slot) {
        if (this.saves[slot] == undefined) {
            console.error("[draw/restore] save slot not recognised: " + slot);
            return;
        }
        const save = this.saves[slot];
        const ctx = this.ctx;
        ctx.restore(); // restore first, in case of ctx.clip calls
        ctx.strokeStyle = save.strokeStyle;
        ctx.fillStyle = save.fillStyle;
        ctx.globalAlpha = save.globalAlpha;
        ctx.globalCompositeOperation = save.globalCompositeOperation;
        ctx.lineWidth = save.lineWidth;
        ctx.lineCap = save.lineCap;
        ctx.lineJoin = save.lineJoin;
        ctx.miterLimit = save.miterLimit;
        ctx.lineDashOffset = save.lineDashOffset;
        ctx.shadowOffsetX = save.shadowOffsetX;
        ctx.shadowOffsetY = save.shadowOffsetY;
        ctx.shadowBlur = save.shadowBlur;
        ctx.shadowColor = save.shadowColor;
        ctx.font = save.font;
        ctx.textAlign = save.textAlign;
        ctx.textBaseline = save.textBaseline;
        ctx.direction = save.direction;
        ctx.imageSmoothingEnabled = save.imageSmoothingEnabled;
        ctx.setTransform(save.transform);
    }
    stroke() {
        this.ctx.stroke();
    }
    fill(fillRule) {
        this.ctx.fill(fillRule);
    }
    strokePath(path) {
        this.ctx.stroke(path);
    }
    fillPath(path, fillRule) {
        this.ctx.fill(path, fillRule);
    }
    beginPath() {
        this.ctx.beginPath();
    }
    begin() {
        this.beginPath();
    }
    clear(color) {
        if (color != undefined) {
            this.fillStyle = color;
            this.globalCompositeOperation = "source-over";
            this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
        }
        else {
            this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
        }
    }
    moveTo(x, y) {
        this.ctx.moveTo(x, y);
    }
    moveTo_v(v) {
        this.ctx.moveTo(v.x, v.y);
    }
    lineTo(x, y) {
        this.ctx.lineTo(x, y);
    }
    lineTo_v(v) {
        this.ctx.lineTo(v.x, v.y);
    }
    rect(x, y, w, h, a = 0) {
        if (a !== 0) {
            // this method is like an artificial rotation matrix thingy
            // because i don't want to use ctx.rotate (in case it interferes with something?)
            const vs = [w / 2 * Math.cos(a), h / 2 * Math.sin(a), w / 2 * Math.sin(a), h / 2 * Math.cos(a)];
            this.ctx.moveTo(x + vs[0] - vs[1], y + vs[2] + vs[3]);
            this.ctx.lineTo(x - vs[0] - vs[1], y - vs[2] + vs[3]);
            this.ctx.lineTo(x - vs[0] + vs[1], y - vs[2] - vs[3]);
            this.ctx.lineTo(x + vs[0] + vs[1], y + vs[2] - vs[3]);
        }
        else {
            this.ctx.rect(x, y, w, h);
        }
    }
    rectangle(x, y, w, h, a) {
        this.rect(x - w / 2, y - h / 2, w, h, a);
    }
    arc(x, y, r, start, end, clockwise = false) {
        this.ctx.arc(x, y, r, start, end, !clockwise);
    }
    arc_v(v, r, start, end, clockwise = false) {
        this.ctx.arc(v.x, v.y, r, start, end, !clockwise);
    }
    circle(x, y, r, clockwise = false) {
        this.arc(x, y, r, 0, 2 * Math.PI, clockwise);
    }
    circle_v(v, r, clockwise = false) {
        this.arc(v.x, v.y, r, 0, 2 * Math.PI, clockwise);
    }
    // r1 > r2
    donut(x, y, r1, r2) {
        this.arc(x, y, r1, 0, 2 * Math.PI, false); // Math.max(r1, r2)
        this.arc(x, y, r2, 0, 2 * Math.PI, true); // Math.min(r1, r2)
    }
    // r1 > r2
    donut_arc(x, y, r1, r2, start, end, start2 = start, end2 = end) {
        this.arc(x, y, r1, end, start, false);
        this.arc(x, y, r2, start2, end2, true);
    }
    line(x1, y1, x2, y2) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }
    line_v(x1, y1) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1.x, x1.y);
        this.ctx.lineTo(y1.x, y1.y);
        this.ctx.stroke();
    }
    lines(xs, ys, close_loop = true) {
        if (xs.length <= 1 || ys.length <= 1) {
            console.warn("[draw/lines] list length < 0");
            return;
        }
        if (xs.length !== ys.length) {
            console.warn("[draw/lines] x_list and y_list lengths don't match:");
            console.log(xs, ys);
            return;
        }
        this.ctx.moveTo(xs[0], ys[0]);
        for (let i = 1; i < xs.length; i++) {
            this.ctx.lineTo(xs[i], ys[i]);
        }
        if (close_loop)
            this.ctx.lineTo(xs[0], ys[0]);
    }
    lines_v(vectors, close_loop = true) {
        if (vectors.length <= 1) {
            return;
        }
        this.ctx.moveTo(vectors[0].x, vectors[0].y);
        for (let i = 1; i < vectors.length; i++) {
            this.ctx.lineTo(vectors[i].x, vectors[i].y);
        }
        if (close_loop)
            this.ctx.lineTo(vectors[0].x, vectors[0].y);
    }
    polygon(sides, r, x, y, angle = 0) {
        let a = angle;
        this.ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
        // draw one more side because lineCap is weird if it is square
        for (let i = 0; i < sides + 1; ++i) {
            a += Math.PI * 2 / sides;
            this.ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
        }
    }
    svg(type, x, y, r) {
        const path2d = svg_paths[type];
        if (path2d == undefined) {
            console.warn("[draw/svg] unknown SVG type: " + type);
            return;
        }
        const a = r / 24;
        this.ctx.save();
        this.ctx.translate(x - a * 12, y - a * 12);
        this.ctx.scale(a, a);
        this.ctx.fill(path2d);
        this.ctx.restore();
    }
    svg_v(type, v, r) {
        return this.svg(type, v.x, v.y, r);
    }
    measureText(s) {
        return this.ctx.measureText(s);
    }
    text_width(s) {
        return this.ctx.measureText(s).width;
    }
    fill_screen(color) {
        this.fillStyle = color;
        this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }
    fillText(s, x, y, maxWidth) {
        let { actualBoundingBoxAscent, actualBoundingBoxDescent } = this.measureText(s);
        this.ctx.fillText(s, math.fastround(x), math.fastround(y + (actualBoundingBoxAscent - actualBoundingBoxDescent) / 2), maxWidth);
    }
    fillText_v(s, v, maxWidth) {
        this.fillText(s, v.x, v.y, maxWidth);
    }
    strokeText(s, x, y, maxWidth) {
        let { actualBoundingBoxAscent, actualBoundingBoxDescent } = this.measureText(s);
        this.ctx.strokeText(s, math.fastround(x), math.fastround(y + (actualBoundingBoxAscent - actualBoundingBoxDescent) / 2), maxWidth);
    }
    strokeText_v(s, v, maxWidth) {
        this.strokeText(s, v.x, v.y, maxWidth);
    }
    text(s, x, y, maxWidth) {
        this.fillText(s, x, y, maxWidth);
    }
    text_v(s, v, maxWidth) {
        this.fillText(s, v.x, v.y, maxWidth);
    }
    set_font_mono(size, prefix = "") {
        this.ctx.font = `${prefix} ${Math.floor(size)}px roboto mono`.trim();
        this.textAlign = "center";
        this.textBaseline = "middle";
    }
    set_font_condensed(size, prefix = "") {
        this.ctx.font = `${prefix} ${Math.floor(size)}px roboto condensed`.trim();
        this.textAlign = "center";
        this.textBaseline = "middle";
    }
    draw_image(path, x, y, w, h) {
        if (!images[path]) {
            const image = document.createElement("img");
            image.src = path;
            images[path] = image;
        }
        this.ctx.drawImage(images[path], x, y, w, h);
    }
    resetTransform() {
        this.ctx.resetTransform();
        // const pixel_ratio = window.devicePixelRatio;
        // this.ctx.scale(pixel_ratio, pixel_ratio);
    }
    translate(x, y) {
        this.ctx.translate(x, y);
    }
    translate_v(v) {
        this.ctx.translate(v.x, v.y);
    }
    rotate(angle) {
        this.ctx.rotate(angle);
    }
    scale(scale_x, scale_y = scale_x) {
        this.ctx.scale(scale_x, scale_y);
    }
    scale_v(scale_v) {
        this.ctx.scale(scale_v.x, scale_v.y);
    }
    clip(fillRule) {
        this.ctx.clip(fillRule);
    }
    clip_path(path, fillRule) {
        this.ctx.clip(path, fillRule);
    }
    point_in_path(px, py, fillRule) {
        return this.ctx.isPointInPath(px, py, fillRule);
    }
    point_in_path_v(p, fillRule) {
        return this.point_in_path(p.x, p.y, fillRule);
    }
    point_in_stroke(px, py) {
        return this.ctx.isPointInStroke(px, py);
    }
    point_in_stroke_v(p) {
        return this.point_in_stroke(p.x, p.y);
    }
    point_in_this_path(path, px, py, fillRule) {
        return this.ctx.isPointInPath(path, px, py, fillRule);
    }
    point_in_this_stroke(path, px, py) {
        return this.ctx.isPointInStroke(path, px, py);
    }
    createConicGradient(startAngle, x, y) {
        return this.ctx.createConicGradient(startAngle, x, y);
    }
    createConicGradient_v(startAngle, v) {
        return this.ctx.createConicGradient(startAngle, v.x, v.y);
    }
    createLinearGradient(x0, y0, x1, y1) {
        return this.ctx.createLinearGradient(x0, y0, x1, y1);
    }
    createLinearGradient_v(v0, v1) {
        return this.ctx.createLinearGradient(v0.x, v0.y, v1.x, v1.y);
    }
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
        return this.ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
    }
    createRadialGradient_v(c0, c1) {
        return this.ctx.createRadialGradient(c0.x, c0.y, c0.r, c1.x, c1.y, c1.r);
    }
}
;
