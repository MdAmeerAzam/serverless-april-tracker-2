process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { pool } = require('../api/db');

// Strict Cloud Bitcoin Table Definitions (Legacy mapping)
const TABLES = [
    { name: 'klines', interval: 240 },
    { name: 'klines_12h', interval: 720 },
    { name: 'klines_daily', interval: 1440 },
    { name: 'klines_weekly', interval: 10080 },
    { name: 'klines_monthly', interval: 43200 }
];

async function checkTable(client, t) {
    const now = Date.now();
    const result = { name: t.name, status: 'OK', errors: [] };

    try {
        const { rows } = await client.query(`SELECT * FROM ${t.name} ORDER BY timestamp DESC LIMIT 7`);
        if (rows.length === 0) {
            result.status = 'FAIL';
            result.errors.push('Table is entirely empty (Zero Rows)');
            return result;
        }

        const latest = rows[0];
        const gapMs = now - Number(latest.timestamp);
        const gapCandles = gapMs / (t.interval * 60 * 1000);

        // 1. Sync Gap (Tolerate 2 candles difference)
        if (gapCandles > 2.2) {
            result.errors.push(`Sync Gap: Late by ${gapCandles.toFixed(1)} candles`);
        }

        // 2. Math & Algorithm Trajectory Scan
        let sar2Flatline = true;
        let sar1Missing = false;
        let zeroResetViolation = false;

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const s1 = Number(Number(r.sar1).toFixed(2));
            const s2 = Number(r.sar2);
            const s3 = Number(Number(r.sar3).toFixed(2));
            const isClosed = (i > 0);

            if (s1 === 0) sar1Missing = true;
            if (s2 !== 0) sar2Flatline = false;

            // Zero-Reset Matrix Rule
            if (isClosed && s3 !== 0 && s1 !== 0 && s3 === s1) {
                zeroResetViolation = true;
            }
        }

        if (sar1Missing) result.errors.push('CRITICAL: Genesis missing (SAR 1 destroyed)');
        if (sar2Flatline) result.errors.push('CRITICAL: Algorithm death (SAR 2 static flatline)');
        if (zeroResetViolation) result.errors.push('CRITICAL: Zero-Reset 3 Rule violated (Dirty historical structure)');

        if (result.errors.length > 0) result.status = 'ISSUE';

    } catch (e) {
        result.status = 'FAIL';
        result.errors.push(`Postgres Query Error: ${e.message}`);
    }

    return result;
}

(async () => {
    console.log('\n[Dedicated Cloud Bitcoin WATCHDOG] Initializing Deep Perimeter Scan...');
    const client = await pool.connect();
    let totalIssues = 0;

    try {
        for (const t of TABLES) {
            const audit = await checkTable(client, t);
            if (audit.status !== 'OK') {
                totalIssues++;
                console.log(`\n✖ [${audit.name}] - ${audit.status}`);
                audit.errors.forEach(err => console.log(`  └─ ${err}`));
            } else {
                console.log(`✔ [${audit.name}] - Clean & Healthy`);
            }
        }

        if (totalIssues > 0) {
            console.log(`\n[FATAL ANOMALY] Bitcoin Watchdog detected ${totalIssues} structural failures. Synchronization paused.\n`);
            process.exit(1);
        } else {
            console.log('\n[SUCCESS] Cloud Bitcoin Perimeter is mathematically secure. Sync 100% current.\n');
            process.exit(0);
        }
    } finally {
        client.release();
    }
})();
