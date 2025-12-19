const fs = require('fs');
const path = require('path');

const seedFilePath = path.join(__dirname, '../src/database/schemas/tenant/002-tenant-seed-data.sql');
const PLACEHOLDER_STORE_ID = '00000000-0000-0000-0000-000000000000';

console.log('📖 Reading seed file...');
const content = fs.readFileSync(seedFilePath, 'utf8');

console.log('🔍 Finding all unique store_id UUIDs...');

// Find all UUID patterns that are used as store_id values
const uuidPattern = /'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/gi;
const allUuids = content.match(uuidPattern) || [];
const uniqueUuids = [...new Set(allUuids)];

console.log(`Found ${uniqueUuids.length} unique UUIDs in the file`);

// Tables that need store_id replacement
const tablesToUpdate = [
  'cms_pages',
  'cookie_consent_settings',
  'email_templates',
  'payment_methods',
  'pdf_templates',
  'shipping_methods'
];

// Pattern to find INSERT INTO statements for these tables
const findStoreIdInTable = (tableName, content) => {
  const tablePattern = new RegExp(`INSERT INTO ${tableName}[^;]*;`, 'gis');
  const match = content.match(tablePattern);

  if (!match) {
    console.log(`⚠️  Table ${tableName} not found`);
    return null;
  }

  // Find all UUIDs in this table's INSERT statement
  const tableContent = match[0];
  const uuidsInTable = tableContent.match(uuidPattern) || [];

  return { tableContent, uuidsInTable: [...new Set(uuidsInTable)] };
};

// Collect store_id UUIDs that need to be replaced
const storeIdsToReplace = new Set();

tablesToUpdate.forEach(tableName => {
  console.log(`\n📋 Analyzing ${tableName}...`);
  const result = findStoreIdInTable(tableName, content);

  if (result) {
    console.log(`  Found ${result.uuidsInTable.length} unique UUIDs`);
    result.uuidsInTable.forEach(uuid => {
      // Add all UUIDs from these tables - we'll replace them all with placeholder
      storeIdsToReplace.add(uuid);
    });
  }
});

console.log(`\n📊 Summary:`);
console.log(`Total UUIDs to replace: ${storeIdsToReplace.size}`);
console.log(`Tables to update: ${tablesToUpdate.length}`);

// Create backup
const backupPath = seedFilePath + '.backup3';
console.log(`\n💾 Creating backup at: ${backupPath}`);
fs.writeFileSync(backupPath, content, 'utf8');

// Replace all store_id UUIDs with placeholder
let newContent = content;
let replacementCount = 0;

storeIdsToReplace.forEach(uuid => {
  const regex = new RegExp(uuid, 'g');
  const matches = newContent.match(regex) || [];
  replacementCount += matches.length;
  newContent = newContent.replace(regex, `'${PLACEHOLDER_STORE_ID}'`);
});

console.log(`\n✍️  Replaced ${replacementCount} store_id occurrences`);

// Write new content
console.log(`📝 Writing updated seed file...`);
fs.writeFileSync(seedFilePath, newContent, 'utf8');

console.log('\n✅ Done! All store_id values replaced with placeholder.');
console.log(`📄 Backup saved to: ${backupPath}`);
