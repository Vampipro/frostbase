import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Load DATABASE_URL from .env.local (override any existing env var) ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const eqIdx = trimmed.indexOf('=');
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
  }
}

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

// --- Status mapping ---
const statusMap = {
  'skam': 'scam',
  'Скам': 'scam',
  'Проверен': 'verified',
  'Подозрительний': 'suspicious',
  'Нету возможности проверить': 'unverified',
  'Нет возможности проверить': 'unverified',
  'не проверен': 'unverified',
};

const typeMap = {
  'Бот': 'bot',
  'Человек': 'human',
};

function mapStatus(raw) {
  return statusMap[raw.trim()] || 'unverified';
}

function mapType(raw) {
  return typeMap[raw.trim()] || '';
}

/**
 * Extract the VALUES block from SQL, respecting quoted strings
 * (so we don't stop at a semicolon inside a string literal).
 */
function extractValuesBlock(sqlText) {
  const valuesIdx = sqlText.indexOf('VALUES');
  if (valuesIdx === -1) throw new Error('Could not find VALUES keyword');
  let start = valuesIdx + 6;

  let i = start;
  let inString = false;
  while (i < sqlText.length) {
    const ch = sqlText[i];
    if (inString) {
      if (ch === "'" && sqlText[i + 1] === "'") { i += 2; continue; }
      if (ch === "'") { inString = false; i++; continue; }
      i++; continue;
    }
    if (ch === "'") { inString = true; i++; continue; }
    if (ch === ';') return sqlText.substring(start, i);
    i++;
  }
  throw new Error('Could not find end of VALUES block');
}

/**
 * Parse VALUES block into array of rows, each row = array of values.
 * Handles single-quoted strings (with '' escapes), numbers, NULL, newlines.
 */
function parseRows(valuesBlock) {
  const rows = [];
  let i = 0;
  let currentRow = null;
  let currentField = '';
  let inString = false;

  function pushField() {
    if (currentRow === null) return;
    const trimmed = currentField.trim();
    if (trimmed === 'NULL' || trimmed === '') {
      currentRow.push(null);
    } else if (/^\d+$/.test(trimmed)) {
      currentRow.push(parseInt(trimmed, 10));
    } else {
      currentRow.push(trimmed); // raw string content (no quotes)
    }
    currentField = '';
  }

  while (i < valuesBlock.length) {
    const ch = valuesBlock[i];

    if (inString) {
      if (ch === "'" && valuesBlock[i + 1] === "'") {
        currentField += "'"; i += 2; continue;
      }
      if (ch === "'") { inString = false; i++; continue; }
      currentField += ch; i++; continue;
    }

    if (ch === "'") { inString = true; i++; continue; }
    if (ch === '(') { currentRow = []; currentField = ''; i++; continue; }
    if (ch === ')') { pushField(); rows.push(currentRow); currentRow = null; i++; continue; }
    if (ch === ',') {
      if (currentRow !== null) pushField();
      i++; continue;
    }
    currentField += ch; i++;
  }

  return rows;
}

function clean(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function parseSqlValues(sqlText) {
  const block = extractValuesBlock(sqlText);
  return parseRows(block);
}

async function main() {
  const sqlPath = '/home/z/my-project/upload/scam.sql';
  const sqlText = fs.readFileSync(sqlPath, 'utf-8');

  console.log('Parsing SQL file...');
  const rawRows = parseSqlValues(sqlText);
  console.log(`Parsed ${rawRows.length} raw rows\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rawRows) {
    // Columns: id, username, id_user, status, prlink, type, opis, chek, date
    if (row.length !== 9) {
      console.warn(`Skipping row with ${row.length} columns:`, row.slice(0, 2));
      errors++;
      continue;
    }

    const [rawId, rawUsername, rawIdUser, rawStatus, rawPrlink, rawType, rawOpis, rawChek, rawDate] = row;

    const name = clean(rawUsername);
    const status = mapStatus(clean(rawStatus));
    const proofLink = clean(rawPrlink);
    const scammerType = mapType(clean(rawType));
    const description = clean(rawOpis);
    const searchCount = typeof rawChek === 'number' ? rawChek : (parseInt(String(rawChek), 10) || 0);
    const scamDate = clean(rawDate);

    if (!name) {
      console.warn(`Skipping row ${rawId}: empty name`);
      errors++;
      continue;
    }

    try {
      // Check if name already exists
      const existing = await prisma.scammer.findFirst({ where: { name } });

      if (existing) {
        skipped++;
        console.log(`  SKIP (exists): ${name}`);
      } else {
        await prisma.scammer.create({
          data: {
            name,
            description,
            status,
            searchCount,
            screenshots: '[]',
            scammerType,
            scamDate,
            proofLink,
          },
        });
        inserted++;
        console.log(`  + INSERTED: ${name} [${status}] [${scammerType}]`);
      }
    } catch (err) {
      console.error(`  x ERROR on "${name}": ${err.message.substring(0, 200)}`);
      errors++;
    }
  }

  console.log('\n========== IMPORT SUMMARY ==========');
  console.log(`Total parsed:  ${rawRows.length}`);
  console.log(`Inserted:      ${inserted}`);
  console.log(`Skipped (dup): ${skipped}`);
  console.log(`Errors:        ${errors}`);
  console.log('====================================');
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
