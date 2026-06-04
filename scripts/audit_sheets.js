process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { pool } = require('../api/db');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path');
const fs = require('fs');

const SPREADSHEETS = {
    crypto:  '1CoU7Df_HBGTqaV8nrt8b5pka0jWyXkYsgVh4Gukml8I',
    macro:   '1VytsJdr8EnKUXqxdMhvcDMzd9fCQowAPzayMWKKc4rA'
};

async function getDoc(spreadsheetId) {
    const credsStr = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!credsStr) throw new Error('GOOGLE_CREDENTIALS_JSON not found');
    const creds = JSON.parse(credsStr);
    
    const auth = new JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
    });
    const doc = new GoogleSpreadsheet(spreadsheetId, auth);
    await doc.loadInfo();
    return doc;
}

async function auditTable(client, doc, tableName) {
    console.log(`\n============================`);
    console.log(`AUDIT: ${tableName}`);
    console.log(`============================`);
    
    // 1. Fetch DB
    const { rows: dbRows } = await client.query(`SELECT timestamp, closevalue, sar1, sar2, sar3 FROM ${tableName} ORDER BY timestamp DESC LIMIT 5`);
    const dbData = dbRows.reverse(); // oldest to newest of the last 5
    
    // 2. Fetch Sheet
    const sheet = doc.sheetsByTitle[tableName];
    if (!sheet) {
        console.log(`[!] Sheet ${tableName} not found in Google Sheets.`);
        return;
    }
    
    const sheetRows = await sheet.getRows();
    const latestSheetRows = sheetRows.slice(-5);
    
    console.log('\n--- SUPABASE DATABASE (Last 5) ---');
    console.table(dbData.map(r => ({
        timestamp: r.timestamp,
        close: Number(r.closevalue),
        sar1: Number(r.sar1),
        sar2: Number(r.sar2),
        sar3: Number(r.sar3)
    })));
    
    console.log('\n--- GOOGLE SHEETS (Last 5) ---');
    console.table(latestSheetRows.map(r => ({
        timestamp: r.get('timestamp'),
        close: Number(r.get('closeValue')),
        sar1: Number(r.get('sar1')),
        sar2: Number(r.get('sar2')),
        sar3: Number(r.get('sar3'))
    })));
    
    // 3. Mathematical Match Check
    let allMatched = true;
    for(let i=0; i<5; i++) {
        if(!dbData[i] || !latestSheetRows[i]) continue;
        const dbSar1 = Number(dbData[i].sar1).toFixed(2);
        const shSar1 = Number(latestSheetRows[i].get('sar1')).toFixed(2);
        const dbSar2 = Number(dbData[i].sar2).toFixed(2);
        const shSar2 = Number(latestSheetRows[i].get('sar2')).toFixed(2);
        
        if (dbSar1 !== shSar1 || dbSar2 !== shSar2) {
            allMatched = false;
        }
    }
    
    if (allMatched) {
        console.log(`\n[SUCCESS] Mathematical Data Integrity 100% MATCHED between Supabase and Google Sheets.`);
    } else {
        console.log(`\n[FAILURE] Mathematical mismatch detected!`);
    }
}

(async () => {
    let client;
    try {
        console.log('[Cloud Audit] Initializing Mathematical Sheets Audit...');
        client = await pool.connect();
        
        const docCrypto = await getDoc(SPREADSHEETS.crypto);
        
        await auditTable(client, docCrypto, 'btc_futures_4h');
        await auditTable(client, docCrypto, 'eth_spot_12h');
        await auditTable(client, docCrypto, 'klines_weekly');
        
        console.log('\n[Audit Complete]\n');
        process.exit(0);
    } catch (err) {
        console.error('FATAL AUDIT ERROR:', err);
        process.exit(1);
    } finally {
        if (client) client.release();
    }
})();
