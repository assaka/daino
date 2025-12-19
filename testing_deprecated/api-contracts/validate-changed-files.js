// Validate API contracts for changed files
// Prevents breaking changes from being committed

const fs = require('fs').promises;
const path = require('path');
const ContractValidator = require('./contract-validator');
const TestDataGenerators = require('./test-data-generators');

class ChangedFilesValidator {
  constructor() {
    this.contractValidator = new ContractValidator();
    this.testDataGen = new TestDataGenerators();
    this.errors = [];
    this.warnings = [];
  }

  async validateChangedFiles(changedFiles) {
    console.log(`🔍 Validating ${changedFiles.length} changed files...`);

    for (const filePath of changedFiles) {
      await this.validateFile(filePath);
    }

    this.printResults();
    
    if (this.errors.length > 0) {
      process.exit(1);
    }
  }

  async validateFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Check API client changes
      if (filePath.includes('client.js') || filePath.includes('api-client')) {
        await this.validateApiClientChanges(filePath, content);
      }

      // Check endpoint route changes
      if (filePath.includes('/routes/') || filePath.includes('/controllers/')) {
        await this.validateEndpointChanges(filePath, content);
      }

      // Check schema/model changes
      if (filePath.includes('/models/') || filePath.includes('/schemas/')) {
        await this.validateSchemaChanges(filePath, content);
      }

      // Check component changes that might affect API calls
      if (filePath.includes('/components/') && filePath.includes('.jsx')) {
        await this.validateComponentApiUsage(filePath, content);
      }

    } catch (error) {
      this.errors.push(`Error validating ${filePath}: ${error.message}`);
    }
  }

  async validateApiClientChanges(filePath, content) {
    console.log(`🔧 Validating API client changes in ${filePath}`);

    // Check for transformation logic changes
    const transformationPatterns = [
      /shouldEndpointTransform/,
      /custom-mappings/,
      /endsWith\(['"]s['"]\)/,
      /transformation.*applied/i,
      /skip-transform/
    ];

    let hasTransformationChanges = false;
    for (const pattern of transformationPatterns) {
      if (pattern.test(content)) {
        hasTransformationChanges = true;
        break;
      }
    }

    if (hasTransformationChanges) {
      console.log('⚠️  Transformation logic changes detected');
      
      // Validate critical endpoints are properly handled
      const criticalEndpoints = [
        '/integrations/akeneo/custom-mappings',
        '/storage/',
        '/stats',
        '/status',
        '/config'
      ];

      for (const endpoint of criticalEndpoints) {
        const shouldNotTransform = this.contractValidator.findTransformationRule(endpoint);
        if (shouldNotTransform && shouldNotTransform.shouldTransform === false) {
          // Check if the code properly handles this endpoint
          const endpointPattern = endpoint.replace(/\//g, '\\/');
          const checkPattern = new RegExp(`${endpointPattern}.*shouldTransform.*false|${endpointPattern}.*skip.*transform`, 'i');
          
          if (!checkPattern.test(content)) {
            this.errors.push(`Critical endpoint ${endpoint} may not be properly handled in transformation logic`);
          }
        }
      }

      // Check for the specific custom mappings bug pattern
      if (content.includes('custom-mappings') && !content.includes('skip-transform')) {
        this.warnings.push('Custom mappings endpoint detected but no explicit skip-transform rule found');
      }
    }

    // Check for new endpoint patterns that might need transformation rules
    const endpointMatches = content.match(/['"`]\/api\/[^'"`]+['"`]/g);
    if (endpointMatches) {
      for (const match of endpointMatches) {
        const endpoint = match.slice(1, -1).replace('/api/', '');
        if (endpoint.endsWith('s') && !endpoint.match(/(stats|status|config|test|save)$/)) {
          if (!content.includes(`${endpoint}.*transform`)) {
            this.warnings.push(`New list endpoint ${endpoint} may need transformation rules`);
          }
        }
      }
    }
  }

  async validateEndpointChanges(filePath, content) {
    console.log(`🛣️  Validating endpoint changes in ${filePath}`);

    // Check for new routes
    const routePatterns = [
      /router\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g,
      /app\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g
    ];

    for (const pattern of routePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const route = match[2];
        
        await this.validateNewEndpoint(method, route, filePath);
      }
    }

    // Check for response format changes
    if (content.includes('res.json') || content.includes('response.json')) {
      // Look for potential breaking changes in response format
      const responsePatterns = [
        /res\.json\(\s*\{[^}]*success\s*:\s*true/,
        /res\.json\(\s*\{[^}]*data\s*:/,
        /res\.json\(\s*\[[^\]]*\]/  // Direct array responses
      ];

      for (const pattern of responsePatterns) {
        if (pattern.test(content)) {
          this.warnings.push(`Response format change detected in ${filePath} - ensure contract compliance`);
          break;
        }
      }
    }
  }

  async validateNewEndpoint(method, route, filePath) {
    console.log(`🆕 Validating new endpoint: ${method} ${route}`);

    // Check if new endpoint needs a contract schema
    const schemaKey = this.determineSchemaKey(route, method);
    if (schemaKey && !this.contractValidator.schemas.has(schemaKey)) {
      this.warnings.push(`New endpoint ${method} ${route} may need a contract schema: ${schemaKey}`);
    }

    // Check if endpoint pattern might cause transformation issues
    if (route.endsWith('s') && !route.match(/(stats|status|config|test|save)$/)) {
      this.warnings.push(`New list endpoint ${route} should be tested for proper transformation behavior`);
    }

    // Check for endpoints that should not be transformed
    const nonTransformPatterns = [
      /\/custom-mappings/,
      /\/storage\//,
      /\/stats$/,
      /\/status$/,
      /\/config$/,
      /\/health$/
    ];

    for (const pattern of nonTransformPatterns) {
      if (pattern.test(route)) {
        this.warnings.push(`Endpoint ${route} should not be transformed - ensure proper rules are in place`);
        break;
      }
    }
  }

  determineSchemaKey(route, method) {
    // Simple schema key determination logic
    const cleanRoute = route.replace(/^\/api\//, '').replace(/\/:\w+/g, '/:id');
    
    if (method === 'GET' && !route.includes('/:id')) {
      return `${cleanRoute}:list`;
    } else if (['POST', 'PUT', 'PATCH'].includes(method) || route.includes('/:id')) {
      return `${cleanRoute}:single`;
    }
    
    return null;
  }

  async validateSchemaChanges(filePath, content) {
    console.log(`📊 Validating schema changes in ${filePath}`);

    // Check for database model changes that might affect API responses
    const modelPatterns = [
      /DataTypes\.\w+/g,
      /allowNull:\s*false/g,
      /validate:\s*\{/g
    ];

    let hasSchemaChanges = false;
    for (const pattern of modelPatterns) {
      if (pattern.test(content)) {
        hasSchemaChanges = true;
        break;
      }
    }

    if (hasSchemaChanges) {
      this.warnings.push(`Schema changes in ${filePath} may require contract schema updates`);
    }

    // Check for new required fields
    if (content.includes('allowNull: false') && content.includes('validate:')) {
      this.warnings.push(`New required fields detected in ${filePath} - may cause validation failures`);
    }
  }

  async validateComponentApiUsage(filePath, content) {
    console.log(`⚛️  Validating component API usage in ${filePath}`);

    // Check for direct API calls that bypass the client
    const directApiPatterns = [
      /fetch\(['"`]\/api\//,
      /axios\.(get|post|put|delete)\(['"`]\/api\//,
      /\$\.ajax\(/,
      /XMLHttpRequest/
    ];

    for (const pattern of directApiPatterns) {
      if (pattern.test(content)) {
        this.warnings.push(`Direct API call detected in ${filePath} - consider using the API client for consistency`);
        break;
      }
    }

    // Check for custom headers that might affect transformation
    if (content.includes('x-skip-transform')) {
      this.warnings.push(`Custom transformation header usage in ${filePath} - ensure proper handling`);
    }

    // Check for endpoint usage that might be affected by transformation
    const criticalEndpointUsage = [
      /custom-mappings/,
      /\/storage\//,
      /\/stats/,
      /\/status/
    ];

    for (const pattern of criticalEndpointUsage) {
      if (pattern.test(content)) {
        this.warnings.push(`Critical endpoint usage in ${filePath} - verify transformation behavior`);
        break;
      }
    }
  }

  printResults() {
    console.log('\n📋 Validation Results:');
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ No issues found in changed files');
      return;
    }

    if (this.errors.length > 0) {
      console.log('\n❌ Errors (must be fixed):');
      this.errors.forEach(error => console.log(`  • ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings (review recommended):');
      this.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    console.log(`\n📊 Summary: ${this.errors.length} errors, ${this.warnings.length} warnings`);
  }
}

// CLI execution
if (require.main === module) {
  const changedFiles = process.argv.slice(2);
  
  if (changedFiles.length === 0) {
    console.log('No files to validate');
    process.exit(0);
  }

  const validator = new ChangedFilesValidator();
  validator.validateChangedFiles(changedFiles).catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = ChangedFilesValidator;