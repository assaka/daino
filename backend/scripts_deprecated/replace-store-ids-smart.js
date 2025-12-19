const fs = require('fs');
const path = require('path');

const seedFilePath = path.join(__dirname, '../src/database/schemas/tenant/002-tenant-seed-data.sql');
const PLACEHOLDER_STORE_ID = '00000000-0000-0000-0000-000000000000';

console.log('📖 Reading seed file...');
let content = fs.readFileSync(seedFilePath, 'utf8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);

// Tables and their store_id field position (0-indexed)
const tablesToUpdate = {
  'cms_pages': { storeIdFieldName: 'store_id' },
  'cookie_consent_settings': { storeIdFieldName: 'store_id' },
  'email_templates': { storeIdFieldName: 'store_id' },
  'payment_methods': { storeIdFieldName: 'store_id' },
  'pdf_templates': { storeIdFieldName: 'store_id' },
  'shipping_methods': { storeIdFieldName: 'store_id' }
};

// Create backup
const backupPath = seedFilePath + '.backup3';
console.log(`\n💾 Creating backup at: ${backupPath}`);
fs.writeFileSync(backupPath, content, 'utf8');

let totalReplacements = 0;

Object.entries(tablesToUpdate).forEach(([tableName, config]) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${tableName}`);
  console.log('='.repeat(60));

  // Find the INSERT statement for this table
  let inTable = false;
  let insertLine = '';
  let storeIdFieldIndex = -1;
  let replacements = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if we're starting this table's INSERT
    if (line.includes(`INSERT INTO ${tableName} (`)) {
      inTable = true;
      insertLine = line;
      console.log(`Found table at line ${i + 1}`);

      // Parse field positions
      const fieldsMatch = line.match(/INSERT INTO \w+ \((.*?)\)/);
      if (fieldsMatch) {
        const fields = fieldsMatch[1].split(',').map(f => f.trim().replace(/"/g, ''));
        storeIdFieldIndex = fields.indexOf(config.storeIdFieldName);
        console.log(`store_id field is at position ${storeIdFieldIndex}`);
      }
      continue;
    }

    // If we're in this table and haven't hit ON CONFLICT yet
    if (inTable) {
      // Check if we've reached the end
      if (line.trim().startsWith('ON CONFLICT') ||
          (line.trim().startsWith('INSERT INTO') && !line.includes(tableName))) {
        inTable = false;
        console.log(`End of table at line ${i + 1}`);
        console.log(`Replaced ${replacements} store_id values`);
        continue;
      }

      // Process data rows
      if (line.trim().startsWith('(\'')) {
        // This is a data row - replace store_id
        // Find all quoted values
        const quotedValues = [];
        let current = '';
        let inQuote = false;
        let escaped = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];

          if (char === '\\' && !escaped) {
            escaped = true;
            current += char;
            continue;
          }

          if (char === "'" && !escaped) {
            if (inQuote) {
              // End of quoted value
              quotedValues.push(current);
              current = '';
              inQuote = false;
            } else {
              // Start of quoted value
              inQuote = true;
            }
          } else if (inQuote) {
            current += char;
          }

          escaped = false;
        }

        // If we found the store_id position and it's a valid UUID, replace it
        if (storeIdFieldIndex >= 0 && storeIdFieldIndex < quotedValues.length) {
          const value = quotedValues[storeIdFieldIndex];
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

          if (uuidPattern.test(value) && value !== PLACEHOLDER_STORE_ID) {
            // Replace this specific UUID with the placeholder
            const oldValue = `'${value}'`;
            const newValue = `'${PLACEHOLDER_STORE_ID}'`;
            lines[i] = lines[i].replace(oldValue, newValue);
            replacements++;
            totalReplacements++;
          }
        }
      }
    }
  }
});

// Write the updated content
const newContent = lines.join('\n');
console.log(`\n${'='.repeat(60)}`);
console.log(`SUMMARY`);
console.log('='.repeat(60));
console.log(`Total store_id replacements: ${totalReplacements}`);

console.log(`\n📝 Writing updated seed file...`);
fs.writeFileSync(seedFilePath, newContent, 'utf8');

console.log('\n✅ Done! All store_id values replaced with placeholder.');
console.log(`📄 Backup saved to: ${backupPath}`);
