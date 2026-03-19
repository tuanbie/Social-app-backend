import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Surreal } from 'surrealdb';
import { appSettings } from 'src/common/config/appSetting';

function splitStatements(input: string): string[] {
  // Tách theo ';' nhưng giữ nguyên nội dung (surql schema ở đây đơn giản).
  return input
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => `${s};`);
}

async function main() {
  const schemaPath = join(__dirname, 'schema.surql');
  const schema = readFileSync(schemaPath, 'utf8');

  const db = new Surreal();
  await db.connect(appSettings.db.url);
  await db.signin({
    username: appSettings.db.username,
    password: appSettings.db.password,
  });
  await db.use({
    namespace: appSettings.db.namespace,
    database: appSettings.db.database,
  });

  const stmts = splitStatements(schema);
  for (const stmt of stmts) {
    try {
      await db.query(stmt);
    } catch (err: any) {
      // Nếu schema đã tồn tại, SurrealDB thường báo lỗi "already exists".
      // Mục tiêu: chạy migrate nhiều lần vẫn không “dừng” toàn bộ.
      const msg = typeof err?.message === 'string' ? err.message : String(err);
      if (msg.toLowerCase().includes('already exists')) continue;
      // In ra statement để dễ debug
      // eslint-disable-next-line no-console
      console.error(`Failed statement: ${stmt}`);
      throw err;
    }
  }

  // eslint-disable-next-line no-console
  console.log('✅ SurrealDB schema migrated successfully');
  await db.close();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ Schema migration failed', e);
  process.exit(1);
});

