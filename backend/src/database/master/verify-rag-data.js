#!/usr/bin/env node

const { sequelize } = require('../connection');

async function verifyRAGData() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    // Query all RAG tables
    console.log('📚 AI CONTEXT DOCUMENTS:');
    const [docs] = await sequelize.query('SELECT type, title, category FROM ai_context_documents');
    docs.forEach(doc => {
      console.log(`  - [${doc.category}] ${doc.type}: ${doc.title}`);
    });

    console.log('\n💡 PLUGIN EXAMPLES:');
    const [examples] = await sequelize.query('SELECT name, category, complexity FROM ai_plugin_examples');
    examples.forEach(ex => {
      console.log(`  - [${ex.category}] ${ex.name} (${ex.complexity})`);
    });

    console.log('\n🔧 CODE PATTERNS:');
    const [patterns] = await sequelize.query('SELECT pattern_type, name, framework FROM ai_code_patterns');
    patterns.forEach(pat => {
      console.log(`  - [${pat.pattern_type}] ${pat.name} ${pat.framework ? `(${pat.framework})` : ''}`);
    });

    console.log('\n📊 SUMMARY:');
    console.log(`  Total Documents: ${docs.length}`);
    console.log(`  Total Examples: ${examples.length}`);
    console.log(`  Total Patterns: ${patterns.length}`);

    const categories = [...new Set(docs.map(d => d.category))];
    console.log(`\n📂 Categories: ${categories.join(', ')}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyRAGData();
