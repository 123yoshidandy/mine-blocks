/**
 * ピースの形を1つの絵（SVG）にするモジュール
 * マスを別々の要素で描くと、動かしたときにマスごとに別の層で描かれて、つなぎ目に線が出る
 * そこで、ピース1つを1つの SVG にまとめ、厚みの影や動きもその1つに付ける
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

// grid（1がピースのマス）から、マスの大きさ cell・隙間 gap のピースの SVG を作る
// 各マスの四角に加え、右・下の同じピースのマスとの隙間、田の字の真ん中の隙間も同じ色で埋める
function createPieceSvg(grid, cell, gap, color) {
    const rows = grid.length;
    const cols = grid[0].length;
    const step = cell + gap;
    const width = cols * cell + (cols - 1) * gap;
    const height = rows * cell + (rows - 1) * gap;
    const isFilled = (r, c) => grid[r]?.[c] === 1;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('shape-rendering', 'crispEdges'); // 四角どうしの境目をにじませない
    svg.setAttribute('aria-hidden', 'true');

    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('fill', color);
    const addRect = (x, y, w, h) => {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        group.appendChild(rect);
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!isFilled(r, c)) continue;
            const x = c * step;
            const y = r * step;
            const right = isFilled(r, c + 1);
            const down = isFilled(r + 1, c);
            addRect(x, y, cell + (right ? gap : 0), cell);
            if (down) addRect(x, y, cell, cell + gap);
            if (right && down && isFilled(r + 1, c + 1)) addRect(x + cell, y + cell, gap, gap);
        }
    }

    svg.appendChild(group);
    return svg;
}
