// Read-only: compares public-schema columns of two databases.
// Usage: node backend/scripts/schemaDiff.js <referenceUrl>   (target = DATABASE_URL from .env)
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const columns = async (connectionString, ssl) => {
    const client = new pg.Client({ connectionString, ssl });
    await client.connect();
    const { rows } = await client.query(`
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns WHERE table_schema = 'public'
    `);
    await client.end();
    return new Map(rows.map((r) => [`${r.table_name}.${r.column_name}`, `${r.data_type} ${r.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`]));
};

const reference = await columns(process.argv[2], false);
const target = await columns(process.env.DATABASE_URL, { rejectUnauthorized: false });

let diffs = 0;
for (const [col, type] of reference) {
    if (!target.has(col)) { console.log(`missing in target: ${col} (${type})`); diffs++; }
    else if (target.get(col) !== type) { console.log(`differs: ${col} reference=${type} target=${target.get(col)}`); diffs++; }
}
for (const col of target.keys()) {
    if (!reference.has(col)) { console.log(`extra in target: ${col}`); diffs++; }
}
console.log(diffs ? `${diffs} difference(s)` : `schemas match (${reference.size} columns)`);
