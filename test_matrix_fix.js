import { pool } from './api/db.js';
import handler from './api/sync.js';

async function test() {
    console.log("--- Testing Matrix Fix ---");
    
    // Simulate BTC Spot 4h Request
    const reqSpot = { query: { tracker: 'bitcoin', asset: 'btc', market: 'spot', interval: '4h' } };
    const resSpot = { status: (s) => ({ json: (j) => console.log("Spot Sync Result:", j) }) };
    
    // Simulate BTC Futures 4h Request
    const reqFutures = { query: { tracker: 'bitcoin', asset: 'btc', market: 'futures', interval: '4h' } };
    const resFutures = { status: (s) => ({ json: (j) => console.log("Futures Sync Result:", j) }) };

    try {
        await handler(reqSpot, resSpot);
        await handler(reqFutures, resFutures);
        
        // Verify tables contain data
        const { rows: spotRows } = await pool.query('SELECT count(*) FROM klines');
        const { rows: futuresRows } = await pool.query('SELECT count(*) FROM btc_futures_4h');
        
        console.log("Rows in klines (Spot 4h):", spotRows[0].count);
        console.log("Rows in btc_futures_4h (Futures 4h):", futuresRows[0].count);
        
        if (spotRows[0].count > 0 && futuresRows[0].count > 0) {
            console.log("SUCCESS: Bitcoin tables separated correctly!");
        } else {
            console.error("FAILURE: One or both tables are empty.");
        }
    } catch (e) {
        console.error("Test Error:", e);
    } finally {
        await pool.end();
    }
}

test();
