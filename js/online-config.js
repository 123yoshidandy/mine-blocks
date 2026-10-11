/**
 * オンライン対戦のサーバーの URL
 * AWS にデプロイしたら、出力された WebSocketUrl を ONLINE_DEPLOYED_SERVER_URL に書く
 */

const ONLINE_DEPLOYED_SERVER_URL = 'wss://0oz8smh26m.execute-api.ap-northeast-1.amazonaws.com/prod';
const ONLINE_LOCAL_SERVER_URL = 'ws://localhost:8787'; // npm run dev:server で起動するテスト用サーバー

// ?server=wss://... で接続先を変えられる。手元（localhost）で開いたときはテスト用サーバーにつなぐ
function getOnlineServerUrl() {
    const override = new URLSearchParams(location.search).get('server');
    if (override) return override;
    if (['localhost', '127.0.0.1'].includes(location.hostname) || location.protocol === 'file:') {
        return ONLINE_LOCAL_SERVER_URL;
    }
    return ONLINE_DEPLOYED_SERVER_URL;
}
