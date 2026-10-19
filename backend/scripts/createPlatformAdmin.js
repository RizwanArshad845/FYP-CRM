// Creates a platform administrator (plan 4.1). There is no public signup.
// Usage: npm run platform:create-admin -- --email you@example.com --name "Name"
// The password is asked for on the terminal and stored as a bcrypt hash (cost 10).
import bcrypt from 'bcryptjs';
import readline from 'readline';
import pool from '../config/db.js';

const arg = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
};

// One prompt interface for both questions; typed characters are not echoed.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
let prompt = '';
rl._writeToOutput = (s) => { if (s.startsWith(prompt)) rl.output.write(s); };
const lines = rl[Symbol.asyncIterator]();
const askHidden = async (question) => {
    prompt = question;
    rl.output.write(question);
    const { value } = await lines.next();
    rl.output.write('\n');
    return value ?? '';
};

const email = arg('email')?.trim().toLowerCase();
const name = arg('name')?.trim();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
    console.error('Usage: npm run platform:create-admin -- --email you@example.com --name "Name"');
    process.exit(1);
}

try {
    const password = await askHidden('Password (min 8 characters): ');
    if (password.length < 8) throw new Error('Password must be at least 8 characters');
    if (password !== await askHidden('Repeat password: ')) throw new Error('Passwords do not match');
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
        'INSERT INTO platform_admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        [name, email, hash]
    );
    console.log(`Platform admin #${rows[0].id} created for ${email}`);
} catch (error) {
    console.error(error.code === '23505' ? 'A platform admin with this email already exists' : error.message);
    process.exitCode = 1;
} finally {
    rl.close();
    await pool.end();
}
