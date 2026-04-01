import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Surreal } from 'surrealdb';
import { appSettings } from '../common/config/appSetting';

async function main() {
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

  // Export schema-only (không export records).
  const schema = await db.export({
    users: true,
    accesses: true,
    params: true,
    functions: true,
    analyzers: true,
    tables: true,
    versions: true,
    records: false,
    sequences: true,
    v3: false,
  });

  const outputPath = join(__dirname, 'schema.from-db.surql');
  const content = [
    '-- AUTO-GENERATED FROM CONNECTED SURREALDB',
    `-- Generated at: ${new Date().toISOString()}`,
    '',
    typeof schema === 'string' ? schema : String(schema),
    '',
  ].join('\n');

  writeFileSync(outputPath, content, 'utf8');
  await db.close();

  // eslint-disable-next-line no-console
  console.log(`✅ Pulled schema to ${outputPath}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ Pull schema failed', e);
  process.exit(1);
});

