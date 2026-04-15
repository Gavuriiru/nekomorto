import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function clearSessions() {
  await client.connect();
  console.log("Connected to database...");
  await client.query('DELETE FROM user_sessions WHERE sid IN (SELECT sid FROM user_session_index WHERE "userId" = \'380305493391966208\')');
  await client.query('DELETE FROM user_session_index WHERE "userId" = \'380305493391966208\'');
  console.log("Successfully wiped session data for gavuriiru.");
  await client.end();
}

clearSessions().catch(console.error);
