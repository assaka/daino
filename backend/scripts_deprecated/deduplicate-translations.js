const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const seedFilePath = path.join(__dirname, '../src/database/schemas/tenant/002-tenant-seed-data.sql');

console.log('📖 Reading seed file...');
const content = fs.readFileSync(seedFilePath, 'utf8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);

// Find translations INSERT section
let translationsStartLine = -1;
let translationsEndLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('INSERT INTO translations (id, key, language_code, value, category, created_at, updated_at, type, store_id)')) {
    translationsStartLine = i;
    console.log(`Found translations INSERT at line ${i + 1}`);
  }

  if (translationsStartLine > -1 && translationsEndLine === -1) {
    // Look for the end of translations section (either ON CONFLICT or next INSERT)
    if (i > translationsStartLine + 5 && (
      lines[i].trim().startsWith('ON CONFLICT') ||
      (lines[i].trim().startsWith('INSERT INTO') && !lines[i].includes('translations'))
    )) {
      translationsEndLine = i - 1;
      console.log(`Found translations end at line ${i + 1}`);
      break;
    }
  }
}

if (translationsStartLine === -1) {
  console.error('❌ Could not find translations INSERT statement');
  process.exit(1);
}

// Find the actual end by looking for the closing of VALUES section
for (let i = translationsStartLine; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  if (trimmed === 'ON CONFLICT DO NOTHING;' || trimmed === 'ON CONFLICT (id) DO NOTHING;') {
    translationsEndLine = i;
    console.log(`Found ON CONFLICT at line ${i + 1}`);
    break;
  }
}

console.log(`\nTranslations section: lines ${translationsStartLine + 1} to ${translationsEndLine + 1}`);

// Parse all translation entries
const translations = [];
const uniqueMap = new Map(); // key = "translationKey|language", value = first occurrence

console.log('\n🔍 Parsing translation entries...');

for (let i = translationsStartLine + 2; i < translationsEndLine; i++) {
  const line = lines[i].trim();

  // Match translation entry pattern
  const match = line.match(/^\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\)[,;]?$/);

  if (match) {
    const [, id, key, language_code, value, category, created_at, updated_at, type, store_id] = match;

    const uniqueKey = `${key}|${language_code}`;

    // Skip non-English translations (only keep 'en')
    if (language_code !== 'en') {
      translations.push({ uniqueKey, lineNum: i + 1, skipped: true });
      continue;
    }

    if (!uniqueMap.has(uniqueKey)) {
      // First occurrence - keep it
      uniqueMap.set(uniqueKey, {
        id,
        key,
        language_code,
        value,
        category,
        created_at,
        updated_at,
        type,
        store_id: '00000000-0000-0000-0000-000000000000' // Placeholder store_id
      });
    }

    translations.push({ uniqueKey, lineNum: i + 1 });
  }
}

const skippedCount = translations.filter(t => t.skipped).length;

console.log(`\n📊 Statistics:`);
console.log(`Total translation entries found: ${translations.length}`);
console.log(`Non-English translations removed: ${skippedCount}`);
console.log(`Unique English translations kept: ${uniqueMap.size}`);
console.log(`Total rows removed: ${translations.length - uniqueMap.size}`);

// Count by language
const byLang = {};
uniqueMap.forEach(t => {
  byLang[t.language_code] = (byLang[t.language_code] || 0) + 1;
});
console.log(`\nTranslations by language:`);
Object.entries(byLang).sort((a, b) => b[1] - a[1]).forEach(([lang, count]) => {
  console.log(`  ${lang}: ${count}`);
});

// Rebuild translations INSERT statement
console.log('\n✍️  Rebuilding translations INSERT statement...');

const translationValues = Array.from(uniqueMap.values())
  .map((t, index, array) => {
    const isLast = index === array.length - 1;
    return `  ('${t.id}', '${t.key}', '${t.language_code}', '${t.value.replace(/'/g, "''")}', '${t.category}', '${t.created_at}', '${t.updated_at}', '${t.type}', '${t.store_id}')${isLast ? '' : ','}`;
  });

const newTranslationsSection = [
  'INSERT INTO translations (id, key, language_code, value, category, created_at, updated_at, type, store_id)',
  'VALUES',
  ...translationValues,
  'ON CONFLICT DO NOTHING;'
].join('\n');

// Reconstruct the file
const beforeTranslations = lines.slice(0, translationsStartLine).join('\n');
const afterTranslations = lines.slice(translationsEndLine + 1).join('\n');

const newContent = beforeTranslations + '\n' + newTranslationsSection + '\n' + afterTranslations;

// Write backup
const backupPath = seedFilePath + '.backup';
console.log(`\n💾 Creating backup at: ${backupPath}`);
fs.writeFileSync(backupPath, content, 'utf8');

// Write new file
console.log(`📝 Writing deduplicated seed file...`);
fs.writeFileSync(seedFilePath, newContent, 'utf8');

console.log('\n✅ Done! Translations have been deduplicated.');
console.log(`📊 Removed ${translations.length - uniqueMap.size} duplicate entries`);
console.log(`📄 Backup saved to: ${backupPath}`);
