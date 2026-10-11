/**
 * UI操作モジュール
 * ユーザーインターフェイス関連の処理を行います
 */

// イベントリスナーのセットアップ
function setupEventListeners() {
    // 新しいゲームボタン（次のシードの問題に進む）
    elements.newGameButton.addEventListener('click', () => {
        generateGame(getNextSeed(gameState.seed));
    });
    
    // ヒントボタン（遊び方をアニメーションで説明する）
    setupHint();
    
    // 共有ボタン（今の問題番号から同じ順番で遊べるURLを共有）
    elements.shareButton.addEventListener('click', shareGame);

    // モード切り替えボタン
    elements.endlessModeButton.addEventListener('click', requestExitChallenge);
    elements.challengeModeButton.addEventListener('click', () => {
        if (!challengeState.active) {
            startChallenge();
        }
    });

    // チャレンジ結果画面のボタン
    elements.challengeRetryButton.addEventListener('click', startChallenge);
    elements.challengeExitButton.addEventListener('click', exitChallenge);

    // 次のゲームボタン（次のシードの問題に進む）
    elements.nextGameButton.addEventListener('click', () => {
        elements.clearModal.classList.remove('active');
        generateGame(getNextSeed(gameState.seed));
    });
}

// 今の問題番号のURLを共有する
// スマホでは共有シート、パソコンではクリップボードへのコピー、どちらも使えなければダイアログで表示
async function shareGame() {
    // チャレンジ中は、同じ問題の列で挑戦できるよう開始した問題番号を共有する
    const seed = challengeState.active ? challengeState.startSeed : gameState.seed;
    const url = new URL(location.href);
    url.searchParams.set('seed', seed);
    const shareUrl = url.toString();
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

    if (isTouchDevice && navigator.share) {
        try {
            await navigator.share({
                title: 'MINE BLOCKS',
                text: challengeState.active
                    ? `MINE BLOCKS チャレンジモード 問題番号 ${seed} で勝負！`
                    : `MINE BLOCKS 問題番号 ${seed} で勝負！`,
                url: shareUrl
            });
        } catch (e) {
            // 共有シートをキャンセルした場合などは何もしない
        }
        return;
    }

    try {
        await navigator.clipboard.writeText(shareUrl);
        showShareFeedback('コピーしました！');
    } catch (e) {
        window.prompt('このURLを共有してください', shareUrl);
    }
}

// 共有ボタンのアイコンを一時的にチェックマークに変えて結果を知らせる
function showShareFeedback(message) {
    const button = elements.shareButton;
    button.classList.add('copied');
    button.title = message;
    setTimeout(() => {
        button.classList.remove('copied');
        button.title = '共有';
    }, 2000);
}

// ブロックのプレビューを表示
function showBlockPreview(startRow, startCol, block) {
    const canPlace = canPlaceBlock(startRow, startCol, block);

    // ブロックのプレビューを表示
    for (let row = 0; row < block.rows; row++) {
        for (let col = 0; col < block.cols; col++) {
            if (block.grid[row][col] === 1) {
                const boardRow = startRow + row;
                const boardCol = startCol + col;
                
                // ボード内かつ空いているセルのみ処理
                if (boardRow >= 0 && boardRow < gameState.boardRows &&
                    boardCol >= 0 && boardCol < gameState.boardCols) {
                    
                    const cellElement = document.querySelector(`.cell[data-row="${boardRow}"][data-col="${boardCol}"]`);
                    if (cellElement) {
                        // セルをホバープレビューリストに追加
                        dragState.hoverCells.push(cellElement);
                        
                        // ホバープレビュークラスを追加（色は配置済みピースの色と別の変数で渡す）
                        cellElement.classList.add('hover-preview');
                        cellElement.style.setProperty('--preview-color', block.color);
                        
                        // 配置できない場合は無効スタイルを追加
                        if (!canPlace) {
                            cellElement.classList.add('invalid');
                        }
                        
                        // ピースが覆う盤面のマインを強調表示（マインは盤面にあるもの）
                        const isMine = getMineInfoFromSolution(boardRow, boardCol).hasMine;
                        if (isMine) {
                            cellElement.classList.add('mine');
                        }
                    }
                }
            }
        }
    }
}

// ホバープレビューをクリア
function clearHoverPreview() {
    dragState.hoverCells.forEach(cell => {
        cell.classList.remove('hover-preview', 'invalid', 'mine');
        cell.style.removeProperty('--preview-color');
    });
    dragState.hoverCells = [];
    dragState.lastHoverRow = -1;
    dragState.lastHoverCol = -1;
}