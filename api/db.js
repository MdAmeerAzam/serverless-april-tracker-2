process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { Pool } = require('pg');

const uri = process.env.DATABASE_URL || "postgresql://postgres.ybnpnpisvalswxyjjfvx:Qzh3nc8S%40UQezjc@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

// Vercel Serverless requires pooled connections (Port 6543)
const pool = new Pool({
    connectionString: uri,
    ssl: { rejectUnauthorized: false },
    max: 20, // Supported by Supabase Transaction Pooler (Port 6543)
    idleTimeoutMillis: 1000, // Fast release for serverless concurrency
    connectionTimeoutMillis: 5000
});

module.exports = { pool };
