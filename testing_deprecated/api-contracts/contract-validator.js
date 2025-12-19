// API Contract Validator
// Validates API responses against predefined schemas and detects breaking changes

const Joi = require('joi');
const fs = require('fs').promises;
const path = require('path');
const { 
  baseResponseSchema, 
  errorResponseSchema,
  productSchema,
  categorySchema,
  orderSchema,
  userSchema,
  storeSchema,
  akeneoMappingSchema,
  akeneoCustomMappingSchema,
  createListResponse,
  createSingleResponse
} = require('./schemas/base-schemas');

class ContractValidator {
  constructor() {
    this.schemas = new Map();
    this.validationHistory = [];
    this.transformationRules = new Map();
    this.breakingChanges = [];
    
    this.initializeSchemas();
    this.initializeTransformationRules();
  }

  initializeSchemas() {
    // Register core entity schemas
    this.schemas.set('products:list', createListResponse(productSchema));
    this.schemas.set('products:single', createSingleResponse(productSchema));
    this.schemas.set('categories:list', createListResponse(categorySchema));
    this.schemas.set('categories:single', createSingleResponse(categorySchema));
    this.schemas.set('orders:list', createListResponse(orderSchema));
    this.schemas.set('orders:single', createSingleResponse(orderSchema));
    this.schemas.set('users:list', createListResponse(userSchema));
    this.schemas.set('users:single', createSingleResponse(userSchema));
    this.schemas.set('stores:list', createListResponse(storeSchema));
    this.schemas.set('stores:single', createSingleResponse(storeSchema));
    
    // Register Akeneo-specific schemas (critical for transformation bug prevention)
    this.schemas.set('akeneo-mappings:list', createListResponse(akeneoMappingSchema));
    this.schemas.set('akeneo-mappings:single', createSingleResponse(akeneoMappingSchema));
    this.schemas.set('akeneo-custom-mappings', akeneoCustomMappingSchema);
    
    // Register error schemas
    this.schemas.set('error:400', errorResponseSchema);
    this.schemas.set('error:401', errorResponseSchema);
    this.schemas.set('error:403', errorResponseSchema);
    this.schemas.set('error:404', errorResponseSchema);
    this.schemas.set('error:422', errorResponseSchema);
    this.schemas.set('error:500', errorResponseSchema);
  }

  initializeTransformationRules() {
    // Critical: Track transformation patterns that caused the custom mappings bug
    this.transformationRules.set('/integrations/akeneo/custom-mappings', {
      shouldTransform: false,
      reason: 'Custom mappings endpoint requires raw response structure',
      riskLevel: 'HIGH',
      bugHistory: [
        {
          date: '2025-01-10',
          issue: 'Response transformation broke custom mappings structure',
          solution: 'Added explicit skip-transform for endpoints containing "/custom-mappings"',
          prevention: 'Always check endpoint pattern before applying transformations'
        }
      ]
    });

    this.transformationRules.set('/storage/', {
      shouldTransform: false,
      reason: 'Storage endpoints return file metadata and URLs',
      riskLevel: 'MEDIUM'
    });

    this.transformationRules.set('/:id/stats', {
      shouldTransform: false,
      reason: 'Statistics endpoints have custom response format',
      riskLevel: 'LOW'
    });

    this.transformationRules.set('/:id/config', {
      shouldTransform: false,
      reason: 'Configuration endpoints have specific structure requirements',
      riskLevel: 'MEDIUM'
    });
  }

  // Validate API response against contract
  async validateResponse(endpoint, method, response, statusCode = 200) {
    const validationId = this.generateValidationId();
    const timestamp = new Date().toISOString();

    try {
      // Determine schema key based on endpoint and method
      const schemaKey = this.determineSchemaKey(endpoint, method, statusCode);
      
      if (!schemaKey) {
        throw new Error(`No schema found for endpoint: ${endpoint} ${method} ${statusCode}`);
      }

      const schema = this.schemas.get(schemaKey);
      if (!schema) {
        throw new Error(`Schema not registered: ${schemaKey}`);
      }

      // Perform validation
      const { error, value } = schema.validate(response, { 
        allowUnknown: false,
        stripUnknown: false 
      });

      const result = {
        validationId,
        timestamp,
        endpoint,
        method,
        statusCode,
        schemaKey,
        valid: !error,
        errors: error ? this.formatJoiError(error) : [],
        response: value,
        transformationCheck: this.checkTransformationCompliance(endpoint, response)
      };

      // Log validation result
      this.validationHistory.push(result);
      
      // Check for potential breaking changes
      if (error) {
        await this.detectBreakingChanges(endpoint, method, error, response);
      }

      return result;

    } catch (validationError) {
      const result = {
        validationId,
        timestamp,
        endpoint,
        method,
        statusCode,
        valid: false,
        errors: [validationError.message],
        transformationCheck: this.checkTransformationCompliance(endpoint, response)
      };

      this.validationHistory.push(result);
      return result;
    }
  }

  // Check transformation compliance (critical for preventing custom mappings bug)
  checkTransformationCompliance(endpoint, response) {
    const transformationRule = this.findTransformationRule(endpoint);
    
    if (!transformationRule) {
      return {
        status: 'NO_RULE',
        message: 'No specific transformation rule found',
        shouldTransform: this.defaultShouldTransform(endpoint)
      };
    }

    // Check if transformation was incorrectly applied
    const hasWrapper = response && typeof response === 'object' && 
                      'success' in response && 'data' in response;
    
    const transformationApplied = !hasWrapper && Array.isArray(response);

    return {
      status: transformationRule.shouldTransform === transformationApplied ? 'COMPLIANT' : 'VIOLATION',
      rule: transformationRule,
      transformationApplied,
      shouldTransform: transformationRule.shouldTransform,
      riskLevel: transformationRule.riskLevel,
      message: transformationRule.shouldTransform === transformationApplied 
        ? 'Transformation rule followed correctly'
        : `Transformation rule violated: ${transformationRule.reason}`
    };
  }

  findTransformationRule(endpoint) {
    // Check for exact matches first
    if (this.transformationRules.has(endpoint)) {
      return this.transformationRules.get(endpoint);
    }

    // Check for pattern matches
    for (const [pattern, rule] of this.transformationRules.entries()) {
      if (endpoint.includes(pattern.replace(/^\/|\/$/g, ''))) {
        return rule;
      }
    }

    return null;
  }

  defaultShouldTransform(endpoint) {
    // Default transformation logic based on endpoint patterns
    return endpoint.includes('/list') || 
           (endpoint.endsWith('s') && 
            !endpoint.includes('/stats') && 
            !endpoint.includes('/status') && 
            !endpoint.includes('/config') &&
            !endpoint.includes('/test') &&
            !endpoint.includes('/save'));
  }

  // Detect potential breaking changes
  async detectBreakingChanges(endpoint, method, validationError, response) {
    const breakingChange = {
      timestamp: new Date().toISOString(),
      endpoint,
      method,
      type: this.classifyError(validationError),
      severity: this.determineSeverity(validationError, endpoint),
      details: this.formatJoiError(validationError),
      response: JSON.stringify(response, null, 2),
      suggestions: this.generateFixSuggestions(validationError, endpoint)
    };

    this.breakingChanges.push(breakingChange);

    // Auto-generate schema updates for non-breaking changes
    if (breakingChange.severity === 'LOW') {
      await this.suggestSchemaUpdates(endpoint, validationError, response);
    }

    return breakingChange;
  }

  classifyError(validationError) {
    const errorMessage = validationError.message;
    
    if (errorMessage.includes('required')) return 'MISSING_REQUIRED_FIELD';
    if (errorMessage.includes('unknown key')) return 'UNEXPECTED_FIELD';
    if (errorMessage.includes('must be')) return 'TYPE_MISMATCH';
    if (errorMessage.includes('enum')) return 'INVALID_ENUM_VALUE';
    
    return 'UNKNOWN';
  }

  determineSeverity(validationError, endpoint) {
    const errorMessage = validationError.message;
    
    // High severity: missing required fields or wrong types in critical endpoints
    if (endpoint.includes('custom-mappings') || endpoint.includes('orders') || endpoint.includes('payments')) {
      if (errorMessage.includes('required') || errorMessage.includes('must be')) {
        return 'HIGH';
      }
    }
    
    // Medium severity: unexpected fields or enum violations
    if (errorMessage.includes('unknown key') || errorMessage.includes('enum')) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  }

  generateFixSuggestions(validationError, endpoint) {
    const suggestions = [];
    const errorMessage = validationError.message;

    if (errorMessage.includes('unknown key')) {
      suggestions.push('Add new field to schema or remove from response');
      suggestions.push('Check if field is properly documented in API spec');
    }

    if (errorMessage.includes('required')) {
      suggestions.push('Ensure all required fields are included in response');
      suggestions.push('Check if field should be optional in schema');
    }

    if (errorMessage.includes('must be')) {
      suggestions.push('Fix data type in response or update schema');
      suggestions.push('Add data transformation logic if needed');
    }

    if (endpoint.includes('custom-mappings')) {
      suggestions.push('Verify response transformation is disabled for custom mappings endpoint');
      suggestions.push('Check client.js transformation rules');
    }

    return suggestions;
  }

  // Suggest schema updates for evolution
  async suggestSchemaUpdates(endpoint, validationError, response) {
    const suggestions = {
      endpoint,
      timestamp: new Date().toISOString(),
      currentError: this.formatJoiError(validationError),
      suggestedChanges: [],
      reasoning: []
    };

    // Analyze the error and response to suggest updates
    if (validationError.message.includes('unknown key')) {
      const unknownFields = this.extractUnknownFields(validationError);
      unknownFields.forEach(field => {
        suggestions.suggestedChanges.push({
          action: 'ADD_OPTIONAL_FIELD',
          field: field.key,
          type: this.inferFieldType(field.value),
          path: field.path
        });
        suggestions.reasoning.push(`Field '${field.key}' appears in response but not in schema`);
      });
    }

    return suggestions;
  }

  extractUnknownFields(validationError) {
    // Extract unknown field information from Joi validation error
    const fields = [];
    const details = validationError.details || [];
    
    details.forEach(detail => {
      if (detail.type === 'object.unknown') {
        fields.push({
          key: detail.context.key,
          path: detail.path,
          value: detail.context.value
        });
      }
    });

    return fields;
  }

  inferFieldType(value) {
    if (typeof value === 'string') {
      if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) return 'timestamp';
      if (value.match(/^[a-f0-9-]{36}$/)) return 'uuid';
      if (value.match(/^https?:\/\//)) return 'url';
      if (value.match(/^[a-z0-9-]+$/)) return 'slug';
      return 'string';
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object' && value !== null) return 'object';
    
    return 'unknown';
  }

  determineSchemaKey(endpoint, method, statusCode) {
    // Handle error responses
    if (statusCode >= 400) {
      return `error:${statusCode}`;
    }

    // Clean endpoint for pattern matching
    const cleanEndpoint = endpoint.replace(/^\/+|\/+$/g, '').replace(/\/\d+/g, '/:id');
    
    // Map endpoints to schema keys
    const endpointPatterns = {
      'products': method === 'GET' && !endpoint.includes('/:id') ? 'products:list' : 'products:single',
      'categories': method === 'GET' && !endpoint.includes('/:id') ? 'categories:list' : 'categories:single',
      'orders': method === 'GET' && !endpoint.includes('/:id') ? 'orders:list' : 'orders:single',
      'users': method === 'GET' && !endpoint.includes('/:id') ? 'users:list' : 'users:single',
      'stores': method === 'GET' && !endpoint.includes('/:id') ? 'stores:list' : 'stores:single',
      'integrations/akeneo/mappings': 'akeneo-mappings:list',
      'integrations/akeneo/custom-mappings': 'akeneo-custom-mappings'
    };

    // Check for specific patterns
    for (const [pattern, schemaKey] of Object.entries(endpointPatterns)) {
      if (cleanEndpoint.includes(pattern)) {
        return schemaKey;
      }
    }

    return null;
  }

  formatJoiError(error) {
    if (!error || !error.details) return [];
    
    return error.details.map(detail => ({
      message: detail.message,
      path: detail.path,
      type: detail.type,
      context: detail.context
    }));
  }

  generateValidationId() {
    return `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get validation statistics
  getValidationStats() {
    const total = this.validationHistory.length;
    const passed = this.validationHistory.filter(v => v.valid).length;
    const failed = total - passed;

    const endpointStats = {};
    this.validationHistory.forEach(validation => {
      if (!endpointStats[validation.endpoint]) {
        endpointStats[validation.endpoint] = { total: 0, passed: 0, failed: 0 };
      }
      endpointStats[validation.endpoint].total++;
      if (validation.valid) {
        endpointStats[validation.endpoint].passed++;
      } else {
        endpointStats[validation.endpoint].failed++;
      }
    });

    return {
      total,
      passed,
      failed,
      successRate: total > 0 ? (passed / total * 100).toFixed(2) : 0,
      endpointStats,
      breakingChanges: this.breakingChanges.length,
      transformationViolations: this.validationHistory.filter(
        v => v.transformationCheck && v.transformationCheck.status === 'VIOLATION'
      ).length
    };
  }

  // Export validation report
  async exportValidationReport(filePath) {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: this.getValidationStats(),
      validationHistory: this.validationHistory,
      breakingChanges: this.breakingChanges,
      transformationRules: Array.from(this.transformationRules.entries()),
      recommendations: this.generateRecommendations()
    };

    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    // Check for frequent failures
    const endpointStats = this.getValidationStats().endpointStats;
    Object.entries(endpointStats).forEach(([endpoint, stats]) => {
      if (stats.failed > stats.passed) {
        recommendations.push({
          type: 'HIGH_FAILURE_RATE',
          endpoint,
          message: `Endpoint ${endpoint} has high failure rate (${stats.failed}/${stats.total})`,
          priority: 'HIGH'
        });
      }
    });

    // Check for transformation violations
    const violations = this.validationHistory.filter(
      v => v.transformationCheck && v.transformationCheck.status === 'VIOLATION'
    );
    if (violations.length > 0) {
      recommendations.push({
        type: 'TRANSFORMATION_VIOLATIONS',
        message: `${violations.length} transformation rule violations detected`,
        priority: 'HIGH',
        details: violations.map(v => ({
          endpoint: v.endpoint,
          rule: v.transformationCheck.rule
        }))
      });
    }

    return recommendations;
  }

  // Register custom schema
  registerSchema(key, schema, description) {
    this.schemas.set(key, schema);
    console.log(`Schema registered: ${key} - ${description}`);
  }

  // Register transformation rule
  registerTransformationRule(pattern, rule) {
    this.transformationRules.set(pattern, rule);
    console.log(`Transformation rule registered: ${pattern}`);
  }
}

module.exports = ContractValidator;