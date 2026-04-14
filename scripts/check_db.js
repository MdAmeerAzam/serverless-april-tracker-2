process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { pool } = require('../api/db');

const TABLES = [
    'klines','klines_12h','klines_daily','klines_weekly','klines_monthly',
    'btc_spot_4h','btc_spot_12h','btc_spot_daily','btc_spot_weekly','btc_spot_monthly',
    'btc_futures_4h','btc_futures_12h','btc_futures_daily','btc_futures_weekly','btc_futures_monthly',
    'eth_spot_4h','eth_spot_12h','eth_spot_daily','eth_spot_weekly','eth_spot_monthly',
    'eth_futures_4h','eth_futures_12h','eth_futures_daily','eth_futures_weekly','eth_futures_monthly',
];

(async () => {
    const client = await pool.connect();
    let failures = 0;
    try {
        console.log('\n══════════════════════════════════════════════════════════');
        console.log('  SUPABASE INTEGRITY CHECK — serverless-april-tracker-2');
        console.log('══════════════════════════════════════════════════════════\n');
        console.log(('TABLE').padEnd(26) + ('ROWS').padEnd(7) + ('LATEST CANDLE UTC').padEnd(22) + ('SAR1').padEnd(10) + ('SAR2').padEnd(10) + ('SAR3').padEnd(10) + 'CLOSE');

        for (const t of TABLES) {
            try {
                const cnt = await client.query(`SELECT COUNT(*) as c FROM ${t}`);
                const top = await client.query(`SELECT timestamp,sar1,sar2,sar3,closevalue FROM ${t} ORDER BY timestamp DESC LIMIT 1`);
                const row = top.rows[0];
                const latest = new Date(Number(row.timestamp)).toISOString().slice(0,16);
                const sar1OK = Number(row.sar1) !== 0;
                const closeOK = Number(row.closevalue) !== 0;
                const flag = (!sar1OK || !closeOK) ? ' ⚠' : ' ✔';
                if (!sar1OK || !closeOK) failures++;
                console.log(
                    t.padEnd(26) +
                    String(cnt.rows[0].c).padEnd(7) +
                    latest.padEnd(22) +
                    String(Number(row.sar1).toFixed(2)).padEnd(10) +
                    String(Number(row.sar2).toFixed(2)).padEnd(10) +
                    String(Number(row.sar3).toFixed(2)).padEnd(10) +
                    String(Number(row.closevalue).toFixed(2)) + flag
                );
            } catch(e) {
                failures++;
                console.log(t.padEnd(26) + 'ERROR: ' + e.message + ' ✖');
            }
        }
        console.log('\n══════════════════════════════════════════════════════════');
        if (failures === 0) {
            console.log('  ✅ ALL TABLES HEALTHY — No anomalies detected');
        } else {
            console.log(`  ⚠  ${failures} TABLE(S) WITH ANOMALIES — Review above`);
        }
        console.log('══════════════════════════════════════════════════════════\n');
    } finally {
        client.release();
        process.exit(0);
    }
})();
