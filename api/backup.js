import { pool } from './db.js';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPREADSHEETS = {
    macro: '1VytsJdr8EnKUXqxdMhvcDMzd9fCQowAPzayMWKKc4rA',
    crypto: '1CoU7Df_HBGTqaV8nrt8b5pka0jWyXkYsgVh4Gukml8I',
    bitcoin: '12wWGLGhnQSDbHpvM3nn8gNs2Ip69TwmBnjlqWi-HV4o'
};

const TIMEFRAMES = ['4h', '8h', '12h', 'daily', 'weekly', 'monthly'];

let cachedDocs = {};

async function authenticateDocs(tracker) {
    if (cachedDocs[tracker]) return cachedDocs[tracker];

    // Assuming config.js is also converted or accessible
    // For simplicity, using env vars directly is preferred, but following existing pattern:
    const configPath = path.join(process.cwd(), 'config.js');
    const { default: creds } = await import('file://' + configPath);
    
    const serviceAccountAuth = new JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
    });

    const doc = new GoogleSpreadsheet(SPREADSHEETS[tracker], serviceAccountAuth);
    await doc.loadInfo();
    cachedDocs[tracker] = doc;
    return cachedDocs[tracker];
}

// Micro-Transaction Endpoint: /api/backup?tracker=crypto&asset=eth&market=spot
export default async function handler(req, res) {
    const { tracker, asset, market } = req.query;

    if (!tracker || !asset || !market) {
        return res.status(400).json({ error: "Missing micro-transaction block coordinates (tracker, asset, market)." });
    }

    try {
        const doc = await authenticateDocs(tracker);
        
        let targetIntervals = TIMEFRAMES;
        if (tracker === 'macro') {
            targetIntervals = ['daily', 'weekly', 'monthly'];
        }

        let tablesToFetch = [];
        
        if (tracker === 'bitcoin' && asset === 'btc') {
            tablesToFetch = [
                'klines', 'klines_8h', 'klines_12h', 'klines_daily', 'klines_weekly', 'klines_monthly',
                'btc_futures_4h', 'btc_futures_8h', 'btc_futures_12h', 'btc_futures_daily', 'btc_futures_weekly', 'btc_futures_monthly'
            ];
        } else {
            tablesToFetch = targetIntervals.map(i => `${asset}_${market}_${i}`);
        }

        const client = await pool.connect();
        try {
            for (const tableName of tablesToFetch) {
                let sheet = doc.sheetsByTitle[tableName];
                const headerValues = ['id', 'timestamp', 'date', 'open', 'high', 'low', 'sar1', 'sar2', 'sar3', 'closeValue', 'closePts', 'closePct', 'closeVol'];
                
                let maxTimestamp = 0;
                let existingRows = [];

                if (!sheet) {
                    sheet = await doc.addSheet({ title: tableName, headerValues });
                } else {
                    // Only fetch the last 100 rows
                    const rowsFetch = await sheet.getRows({ 
                        offset: Math.max(0, sheet.rowCount - 100),
                        limit: 100 
                    });
                    existingRows = rowsFetch;
                    if (existingRows.length > 0) {
                        maxTimestamp = Number(existingRows[existingRows.length - 1].toObject().timestamp);
                    }
                }

                const { rows: pgRows } = await client.query(`SELECT * FROM ${tableName} WHERE timestamp >= $1 ORDER BY timestamp ASC`, [maxTimestamp]);
                
                if (pgRows.length === 0) continue;
                
                let rowsToAppend = pgRows;

                if (maxTimestamp > 0 && Number(pgRows[0].timestamp) === maxTimestamp && existingRows.length > 0) {
                    const lastRowToUpdate = existingRows[existingRows.length - 1];
                    const r = pgRows[0];
                    lastRowToUpdate.assign(r);
                    await lastRowToUpdate.save();
                    rowsToAppend = pgRows.slice(1);
                }

                if (rowsToAppend.length > 0) {
                    const appendData = rowsToAppend.map(r => ({
                        id: r.id,
                        timestamp: r.timestamp,
                        date: new Date(Number(r.timestamp)).toISOString(),
                        open: r.open,
                        high: r.high,
                        low: r.low,
                        sar1: r.sar1,
                        sar2: r.sar2,
                        sar3: r.sar3,
                        closeValue: r.closevalue,
                        closePts: r.closepts,
                        closePct: r.closepct,
                        closeVol: r.closevol
                    }));
                    await sheet.addRows(appendData);
                }
            }
        } finally {
            client.release();
        }

        res.status(200).json({ success: true, message: `Backup successful for ${asset}_${market}` });

    } catch (err) {
        console.error("Backup Failure:", err);
        res.status(500).json({ success: false, error: err.message });
    }
}
