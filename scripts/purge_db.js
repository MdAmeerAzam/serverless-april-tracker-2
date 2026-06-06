const { pool } = require('../api/db');
async function run() {
  const client = await pool.connect();
  try {
    await client.query('DROP TABLE IF EXISTS klines, klines_8h, klines_12h, klines_daily, klines_weekly, klines_monthly;');
    console.log('Tables dropped successfully from Cloud.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
