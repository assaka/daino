const fs = require('fs');
const path = require('path');

const seedFilePath = path.join(__dirname, '../src/database/schemas/tenant/002-tenant-seed-data.sql');

console.log('📖 Reading seed file...');
const content = fs.readFileSync(seedFilePath, 'utf8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);

// Tables to deduplicate and their unique key fields
const tablesToDeduplicate = {
  'email_templates': { uniqueKey: 'identifier', storeIdField: 'store_id' },
  'pdf_templates': { uniqueKey: 'identifier', storeIdField: 'store_id' },
  'shipping_methods': { uniqueKey: 'name', storeIdField: 'store_id' }
};

// Placeholder store_id to use
const PLACEHOLDER_STORE_ID = '00000000-0000-0000-0000-000000000000';

// Function to find table section
function findTableSection(tableName) {
  let startLine = -1;
  let endLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`INSERT INTO ${tableName} (`)) {
      startLine = i;
      console.log(`Found ${tableName} INSERT at line ${i + 1}`);
    }

    if (startLine > -1 && endLine === -1) {
      if (i > startLine + 2 && lines[i].trim().startsWith('ON CONFLICT')) {
        endLine = i;
        console.log(`Found ${tableName} end at line ${i + 1}`);
        break;
      }
    }
  }

  return { startLine, endLine };
}

// Function to parse value from INSERT statement
function extractFieldValue(line, fieldName, insertLine) {
  // Get field positions from INSERT line
  const insertMatch = insertLine.match(/INSERT INTO \w+ \((.*?)\)/);
  if (!insertMatch) return null;

  const fields = insertMatch[1].split(',').map(f => f.trim());
  const fieldIndex = fields.indexOf(fieldName);

  if (fieldIndex === -1) return null;

  // Parse the VALUES line to extract field at specific index
  // This is a simplified parser - may need adjustment for complex data
  const valuesMatch = line.match(/^\s*\('(.*)'\)[,;]?$/);
  if (!valuesMatch) return null;

  // Split by ', ' but be careful with nested quotes
  const parts = [];
  let current = '';
  let inQuotes = false;
  let depth = 0;

  for (let i = 0; i < valuesMatch[1].length; i++) {
    const char = valuesMatch[1][i];
    const nextChar = valuesMatch[1][i + 1];

    if (char === "'" && valuesMatch[1][i - 1] !== '\\') {
      inQuotes = !inQuotes;
    }

    if (!inQuotes && char === ',' && nextChar === ' ') {
      parts.push(current.trim());
      current = '';
      i++; // Skip the space
      continue;
    }

    current += char;
  }
  parts.push(current.trim());

  return parts[fieldIndex] ? parts[fieldIndex].replace(/^'|'$/g, '') : null;
}

// Deduplicate each table
let totalChanges = [];

Object.entries(tablesToDeduplicate).forEach(([tableName, config]) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${tableName}`);
  console.log('='.repeat(60));

  const { startLine, endLine } = findTableSection(tableName);

  if (startLine === -1) {
    console.log(`⚠️  Table ${tableName} not found in seed file`);
    return;
  }

  const insertLine = lines[startLine];
  const entries = [];
  const uniqueMap = new Map();
  let skippedDuplicates = 0;

  // Parse entries
  for (let i = startLine + 2; i < endLine; i++) {
    const line = lines[i].trim();

    if (!line.startsWith('(')) continue;

    // Simple UUID extraction from start of line
    const uuidMatch = line.match(/^\('([^']+)'/);
    if (!uuidMatch) continue;

    const entryId = uuidMatch[1];

    // Extract unique key value (identifier or name)
    const uniqueValue = extractFieldValue(line, config.uniqueKey, insertLine);

    if (!uniqueValue) {
      console.log(`⚠️  Could not extract ${config.uniqueKey} from line ${i + 1}`);
      entries.push({ line, lineNum: i, keep: true });
      continue;
    }

    // Check for duplicates
    if (uniqueMap.has(uniqueValue)) {
      skippedDuplicates++;
      entries.push({ line, lineNum: i, keep: false, duplicate: true, uniqueValue });
    } else {
      uniqueMap.set(uniqueValue, true);

      // Replace store_id with placeholder
      let updatedLine = line;

      // Find and replace store_id in the line
      // Pattern: store_id field followed by UUID value
      updatedLine = updatedLine.replace(
        /('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')/gi,
        (match) => {
          // Check if this is likely a store_id by position
          // This is a heuristic - may need refinement
          return `'${PLACEHOLDER_STORE_ID}'`;
        }
      );

      // Simpler approach: just replace all UUIDs with placeholder except the first one (id field)
      let uuidCount = 0;
      updatedLine = updatedLine.replace(
        /'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/gi,
        (match) => {
          uuidCount++;
          // Keep first UUID (id field), replace others (likely store_id)
          return uuidCount === 1 ? match : `'${PLACEHOLDER_STORE_ID}'`;
        }
      );

      entries.push({ line: updatedLine, lineNum: i, keep: true, uniqueValue });
    }
  }

  console.log(`\n📊 ${tableName} Statistics:`);
  console.log(`Total entries: ${entries.length}`);
  console.log(`Unique entries kept: ${uniqueMap.size}`);
  console.log(`Duplicates removed: ${skippedDuplicates}`);

  if (skippedDuplicates > 0) {
    // Rebuild the section
    const keptEntries = entries.filter(e => e.keep);
    const newLines = keptEntries.map((e, idx) => {
      const isLast = idx === keptEntries.length - 1;
      return e.line.replace(/[,;]$/, isLast ? '' : ',');
    });

    // Replace the section in the file
    const beforeSection = lines.slice(0, startLine);
    const afterSection = lines.slice(endLine);

    const newSection = [
      insertLine,
      'VALUES',
      ...newLines,
      lines[endLine]
    ];

    lines.splice(startLine, endLine - startLine + 1, ...newSection);

    totalChanges.push({
      table: tableName,
      removed: skippedDuplicates,
      kept: uniqueMap.size
    });

    console.log(`✅ ${tableName} deduplicated successfully`);
  } else {
    console.log(`✅ No duplicates found in ${tableName}`);
  }
});

// Write the file if there were changes
if (totalChanges.length > 0) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));

  totalChanges.forEach(change => {
    console.log(`${change.table}: Removed ${change.removed} duplicates, kept ${change.kept} unique entries`);
  });

  // Create backup
  const backupPath = seedFilePath + '.backup2';
  console.log(`\n💾 Creating backup at: ${backupPath}`);
  fs.writeFileSync(backupPath, content, 'utf8');

  // Write new content
  const newContent = lines.join('\n');
  console.log(`📝 Writing deduplicated seed file...`);
  fs.writeFileSync(seedFilePath, newContent, 'utf8');

  console.log('\n✅ All tables deduplicated successfully!');
} else {
  console.log('\n✅ No duplicates found in any table');
}
