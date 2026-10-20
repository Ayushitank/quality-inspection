import pg from 'pg';

// keeping DATE columns as 'YYYY-MM-DD' strings; pg's default Date objects shift across timezones
pg.types.setTypeParser(1082, (value) => value);

export function createPool(connectionString, options = {}) {
  return new pg.Pool({ connectionString, max: 10, ...options });
}

export async function waitForDb(pool, { attempts = 15, delayMs = 1000, log = console } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (attempt >= attempts) throw err;
      log.info(`Waiting for database (${attempt}/${attempts}): ${err.code ?? err.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
