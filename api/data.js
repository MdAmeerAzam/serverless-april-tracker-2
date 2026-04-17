import { pool } from './db.js';

export default async function handler(req, res) {
    const { tracker, asset, market, interval } = req.query;

    if (!tracker || !asset || !market || !interval) {
        return res.status(400).json({ error: "Missing parameters (tracker, asset, market, interval)." });
    }

    let tableName = `${asset}_${market}_${interval}`;
    
    // Legacy mapping exception for root Bitcoin tracking (SPOT ONLY)
    if (tracker === 'bitcoin' && asset === 'btc' && market === 'spot') {
        if (interval === '4h') tableName = 'klines';
        else tableName = `klines_${interval}`;
    }

    try {
        const client = await pool.connect();
        try {
            // Fetch last 100 rows
            const { rows } = await client.query(`SELECT * FROM ${tableName} ORDER BY timestamp DESC LIMIT 100`);
            
            // Format for frontend
            const formatted = rows.map(r => ({
                timestamp: Number(r.timestamp),
                open: Number(r.open),
                high: Number(r.high),
                low: Number(r.low),
                close: Number(r.closevalue),
                closePts: Number(r.closepts),
                closePct: Number(r.closepct),
                volume: Number(r.closevol),
                sar1: Number(r.sar1),
                sar2: Number(r.sar2),
                sar3: Number(r.sar3)
            })).reverse();

            res.status(200).json(formatted);
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Data Fetch Failure:", err);
        res.status(500).json({ error: err.message });
    }
}
