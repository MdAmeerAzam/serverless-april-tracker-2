process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path');

const SPREADSHEETS = {
    crypto:  '1CoU7Df_HBGTqaV8nrt8b5pka0jWyXkYsgVh4Gukml8I',
};

async function getDoc(spreadsheetId) {
    const creds = require(path.join(process.cwd(), 'credentials.json'));
    const auth = new JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
    });
    const doc = new GoogleSpreadsheet(spreadsheetId, auth);
    await doc.loadInfo();
    return doc;
}

async function clearAllSheets(name, spreadsheetId) {
    console.log(`\n── Clearing ${name}...`);
    const doc = await getDoc(spreadsheetId);
    const sheets = doc.sheetsByIndex;

    for (const sheet of sheets) {
        process.stdout.write(`  → Deleting tab: ${sheet.title}... `);
        try {
            await sheet.delete();
            console.log('deleted');
        } catch (e) {
            // Can't delete the last sheet — clear it instead
            await sheet.clear();
            console.log('cleared (last tab)');
        }
        await new Promise(res => setTimeout(res, 1100));
    }
}

(async () => {
    console.log('\n[Clear Sheets] Wiping all tabs for fresh re-push...\n');
    await clearAllSheets('Crypto',  SPREADSHEETS.crypto);
    console.log('\n[Done] All sheets cleared. Now run: node scripts/run_backup.js\n');
    process.exit(0);
})();
