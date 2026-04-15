import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => client.query("SELECT data FROM audit_logs WHERE action = 'auth.login.failed' ORDER BY ts DESC LIMIT 3"))
  .then(res => console.log(JSON.stringify(res.rows.map(r => r.data), null, 2)))
  .finally(() => client.end());
