/**
 * ピースの形を1つの絵（SVG）にするモジュール
 * マスを別々の要素で描くと、動かしたときにマスごとに別の層で描かれて、つなぎ目に線が出る
 * そこで、ピース1つを1つの SVG にまとめ、厚みの影や動きもその1つに付ける
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

// 地雷のアイコン（style.css の --mine-icon と同じ絵）
const MINE_ICON_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg stroke='%232b1d1d' stroke-width='2.2' stroke-linecap='round'%3E%3Cpath d='M12 2.5v19M2.5 12h19M5.3 5.3l13.4 13.4M18.7 5.3 5.3 18.7'/%3E%3C/g%3E%3Ccircle cx='12' cy='12' r='6.2' fill='%232b1d1d'/%3E%3Ccircle cx='10.8' cy='10.8' r='1.4' fill='%23fff' fill-opacity='.85'/%3E%3C/svg%3E";

// grid（1がピースのマス）から、マスの大きさ cell・隙間 gap のピースの SVG を作る
// 各マスの四角に加え、右・下の同じピースのマスとの隙間、田の字の真ん中の隙間も同じ色で埋める
// getMark(r, c) を渡すと、そのマスに数字（{ number }）や地雷の印（{ mine: true }）を重ねて描く（null なら何も描かない）
function createPieceSvg(grid, cell, gap, color, getMark = null) {
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
    svg.setAttribute('aria-hidden', 'true');

    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('fill', color);
    group.setAttribute('shape-rendering', 'crispEdges'); // 四角どうしの境目をにじませない（丸い印はなめらかに描くので、四角だけに付ける）
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
    if (getMark) addPieceMarks(svg, grid, step, cell, getMark);
    return svg;
}

// ピースが覆っている数字と地雷を描く（置いたあとも何を覆ったか分かるように）
function addPieceMarks(svg, grid, step, cell, getMark) {
    const marks = document.createElementNS(SVG_NS, 'g');
    marks.setAttribute('class', 'piece-marks');
    grid.forEach((cells, r) => cells.forEach((filled, c) => {
        if (!filled) return;
        const mark = getMark(r, c);
        if (!mark) return;
        const cx = c * step + cell / 2;
        const cy = r * step + cell / 2;

        if (mark.mine) {
            const radius = cell * 0.26;
            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('class', 'piece-mark-mine');
            circle.setAttribute('cx', cx);
            circle.setAttribute('cy', cy);
            circle.setAttribute('r', radius);
            marks.appendChild(circle);

            const icon = document.createElementNS(SVG_NS, 'image');
            const size = radius * 1.7;
            icon.setAttribute('href', MINE_ICON_URI);
            icon.setAttribute('x', cx - size / 2);
            icon.setAttribute('y', cy - size / 2);
            icon.setAttribute('width', size);
            icon.setAttribute('height', size);
            marks.appendChild(icon);
        } else {
            const text = document.createElementNS(SVG_NS, 'text');
            text.setAttribute('class', 'piece-mark-number');
            text.setAttribute('x', cx);
            text.setAttribute('y', cy);
            text.setAttribute('font-size', cell * 0.42);
            text.textContent = mark.number;
            marks.appendChild(text);
        }
    }));
    svg.appendChild(marks);
}
