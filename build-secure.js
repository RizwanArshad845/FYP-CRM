import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import JavaScriptObfuscator from 'javascript-obfuscator';

async function build() {
    console.log('--- PREPARING SECURE BUILD ---');

    // ── CRASH RECOVERY ────────────────────────────────────────────────────────
    // If electron_backup already exists, the previous build was interrupted
    // (e.g. Ctrl+C, power loss) before the finally-block could restore sources.
    // Auto-heal now so we never start a build from already-obfuscated files.
    if (fs.existsSync('./electron_backup')) {
        console.warn('⚠️  Found leftover electron_backup — previous build was interrupted.');
        console.log('🔄  Auto-restoring original source files before continuing...');
        fs.removeSync('./electron');
        fs.moveSync('./electron_backup', './electron');
        console.log('✅  Source files restored successfully.\n');
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Backup original source folders
    fs.copySync('./electron', './electron_backup');
    
    // Detect if this is a release build (npm run release sets PUBLISH=always)
    const publishFlag = process.env.PUBLISH === 'always' ? '--publish always' : '';
    if (publishFlag) console.log('--- RELEASE MODE: will publish to GitHub ---');
    
    try {
        
        console.log('Obfuscating electron code...');
        obfuscateDirectory('./electron');
        
        console.log('--- RUNNING ELECTRON-BUILDER ---');
        // Run the original build command (with optional publish flag)
        execSync(`npm run build && electron-builder ${publishFlag}`, { stdio: 'inherit' });
        
    } catch (err) {
        console.error('Build failed:', err);
    } finally {
        console.log('--- RESTORING ORIGINAL SOURCE CODE ---');
        
        fs.removeSync('./electron');
        fs.moveSync('./electron_backup', './electron');
        console.log('Build script complete.');
    }
}

function obfuscateDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            obfuscateDirectory(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.cjs')) {
            const code = fs.readFileSync(fullPath, 'utf8');
            console.log(`  Obfuscating: ${fullPath}`);
            const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
                // ── Layout ──
                compact: true,
                simplify: true,

                // ── Control Flow ──
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 1,    // Apply to 100% of blocks

                // ── Dead Code Injection ──
                deadCodeInjection: true,               // Inject fake code to confuse reverse-engineers
                deadCodeInjectionThreshold: 0.4,       // 40% dead code ratio (balanced)

                // ── Debug Protection ──
                debugProtection: true,                 // Makes browser debugger unusable on this code
                debugProtectionInterval: 2000,         // Periodically re-engages debug protection

                // ── Console ──
                disableConsoleOutput: false,           // Keep console for troubleshooting in production

                // ── Identifiers ──
                identifierNamesGenerator: 'hexadecimal',
                renameGlobals: false,                  // Don't rename globals (could break Node.js built-ins)

                // ── Self-Defending ──
                selfDefending: true,                   // Code breaks if someone beautifies/formats it

                // ── String Protection ──
                splitStrings: true,
                splitStringsChunkLength: 5,            // Split strings into 5-char chunks
                stringArray: true,
                stringArrayCallsTransform: true,
                stringArrayEncoding: ['rc4'],          // RC4 encryption (stronger than base64)
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayWrappersCount: 2,
                stringArrayWrappersChainedCalls: true,
                stringArrayWrappersType: 'function',
                stringArrayThreshold: 1,               // Encode ALL strings (100%)

                // ── Numbers ──
                numbersToExpressions: true,

                // ── Object Keys ──
                transformObjectKeys: true,             // Obfuscate object property names

                // ── Unicode ──
                unicodeEscapeSequence: false,

                // ── Misc ──
                log: false,
            });
            fs.writeFileSync(fullPath, obfuscationResult.getObfuscatedCode(), 'utf8');
        }
    }
}

build();
