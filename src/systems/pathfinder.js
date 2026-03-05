export default class Pathfinder {
    constructor(originX, originY, totalW, totalH) {
        this.cellSize = 48;
        this.originX = originX;
        this.originY = originY;
        this.cols = Math.ceil(totalW / this.cellSize);
        this.rows = Math.ceil(totalH / this.cellSize);
        this.grid = new Uint8Array(this.cols * this.rows);
    }

    blockRect(left, top, w, h) {
        const pad = this.cellSize * 1.2;
        const c1 = Math.floor((left - pad - this.originX) / this.cellSize);
        const r1 = Math.floor((top - pad - this.originY) / this.cellSize);
        const c2 = Math.ceil((left + w + pad - this.originX) / this.cellSize);
        const r2 = Math.ceil((top + h + pad - this.originY) / this.cellSize);
        for (let r = Math.max(0, r1); r <= Math.min(this.rows - 1, r2); r++)
            for (let c = Math.max(0, c1); c <= Math.min(this.cols - 1, c2); c++)
                this.grid[r * this.cols + c] = 1;
    }

    worldToCell(x, y) {
        return {
            c: Math.floor((x - this.originX) / this.cellSize),
            r: Math.floor((y - this.originY) / this.cellSize)
        };
    }

    cellToWorld(c, r) {
        return {
            x: this.originX + c * this.cellSize + this.cellSize / 2,
            y: this.originY + r * this.cellSize + this.cellSize / 2
        };
    }

    isWalkable(c, r) {
        if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false;
        return this.grid[r * this.cols + c] === 0;
    }

    findPath(fromX, fromY, toX, toY) {
        let start = this.worldToCell(fromX, fromY);
        let end = this.worldToCell(toX, toY);
        const clamp = cell => {
            cell.c = Math.max(0, Math.min(this.cols - 1, cell.c));
            cell.r = Math.max(0, Math.min(this.rows - 1, cell.r));
            return cell;
        };
        clamp(start); clamp(end);

        if (!this.isWalkable(end.c, end.r)) {
            let found = false;
            for (let radius = 1; radius < 6 && !found; radius++) {
                for (let dc = -radius; dc <= radius && !found; dc++) {
                    for (let dr = -radius; dr <= radius && !found; dr++) {
                        if ((Math.abs(dc) === radius || Math.abs(dr) === radius) &&
                            this.isWalkable(end.c + dc, end.r + dr)) {
                            end.c += dc; end.r += dr; found = true;
                        }
                    }
                }
            }
            if (!found) return [];
        }

        const key = (c, r) => r * this.cols + c;
        const h = (c, r) => Math.abs(c - end.c) + Math.abs(r - end.r);
        const open = [{ c: start.c, r: start.r, f: 0, g: 0 }];
        const gMap = new Map([[key(start.c, start.r), 0]]);
        const came = new Map();
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

        let iters = 0;
        while (open.length > 0 && iters++ < 4000) {
            let li = 0;
            for (let i = 1; i < open.length; i++) if (open[i].f < open[li].f) li = i;
            const { c, r } = open.splice(li, 1)[0];

            if (c === end.c && r === end.r) {
                const path = [];
                let k = key(c, r);
                while (came.has(k)) {
                    const cell = came.get(k);
                    path.unshift(this.cellToWorld(cell.c, cell.r));
                    k = key(cell.c, cell.r);
                }
                path.push(this.cellToWorld(end.c, end.r));
                return this.smooth(path);
            }

            for (const [dc, dr] of dirs) {
                const nc = c + dc, nr = r + dr;
                if (!this.isWalkable(nc, nr)) continue;
                if (dc !== 0 && dr !== 0 &&
                    (!this.isWalkable(c + dc, r) || !this.isWalkable(c, r + dr))) continue;
                const cost = (dc !== 0 && dr !== 0) ? 1.414 : 1;
                const ng = (gMap.get(key(c, r)) || 0) + cost;
                const nk = key(nc, nr);
                if (ng < (gMap.get(nk) ?? Infinity)) {
                    gMap.set(nk, ng);
                    came.set(nk, { c, r });
                    open.push({ c: nc, r: nr, g: ng, f: ng + h(nc, nr) });
                }
            }
        }
        return [];
    }

    smooth(path) {
        if (path.length <= 2) return path;
        const out = [path[0]];
        for (let i = 1; i < path.length - 1; i++) {
            const p = out[out.length - 1], c = path[i], n = path[i + 1];
            if (Math.abs((c.x - p.x) - (n.x - c.x)) > 1 || Math.abs((c.y - p.y) - (n.y - c.y)) > 1)
                out.push(c);
        }
        out.push(path[path.length - 1]);
        return out;
    }
}