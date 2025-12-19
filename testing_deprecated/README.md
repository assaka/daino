# Comprehensive Testing & Debugging Stack

A production-ready testing and monitoring system for the DainoStore e-commerce platform, designed to prevent critical bugs like the custom mappings transformation issue and provide real-time debugging capabilities.

## 🎯 Overview

This testing stack addresses the critical transformation bug where API endpoints ending in 's' were incorrectly transformed, breaking custom mappings functionality. It provides comprehensive monitoring, validation, and prevention mechanisms.

## 📊 Components

### 1. API Contract Testing System
- **Location**: `testing/api-contracts/`
- **Purpose**: Schema validation, contract testing, regression prevention
- **Key Files**:
  - `base-schemas.js` - Core API response schemas
  - `contract-validator.js` - Validation engine with transformation compliance
  - `test-data-generators.js` - Realistic test data generation

### 2. Real-time Monitoring Dashboard
- **Location**: `testing/monitoring/`
- **Purpose**: Live performance tracking, error detection, visual debugging
- **URL**: `http://localhost:3001` (when running)
- **Key Features**:
  - WebSocket-based real-time updates
  - Transformation rule compliance monitoring
  - Performance regression detection
  - Interactive dashboard UI

### 3. End-to-End Testing Pipeline
- **Location**: `testing/e2e/`
- **Framework**: Playwright
- **Coverage**: Cross-browser, mobile, user journeys
- **Key Tests**:
  - Authentication flows
  - Product import journeys (Akeneo integration)
  - API transformation compliance

### 4. Automated Error Detection
- **Location**: `testing/error-detection/`
- **Purpose**: Memory leak detection, performance monitoring, dead code analysis
- **Features**:
  - Learning from known issues
  - Pattern recognition
  - Automated alerting

### 5. CI/CD Integration
- **Location**: `.github/workflows/`, `.husky/`
- **Features**:
  - Pre-commit validation
  - Automated testing pipeline
  - Deployment health checks
  - Rollback automation

## 🚀 Quick Start

### Prerequisites
```bash
Node.js >= 18
npm >= 8
PostgreSQL (for backend testing)
```

### Installation
```bash
# Install main dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install Playwright browsers (for E2E tests)
npx playwright install

# Install testing dependencies
npm install --save-dev @playwright/test joi @faker-js/faker socket.io

# Setup Husky for pre-commit hooks
npx husky install
chmod +x .husky/pre-commit
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env.testing

# Configure testing environment
echo "
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/daino_test
API_BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
MONITORING_ENABLED=true
" >> .env.testing
```

## 📋 Running Tests

### 1. API Contract Testing
```bash
# Run contract validation
node testing/api-contracts/contract-validator.js

# Validate specific endpoint
node testing/api-contracts/validate-endpoint.js /api/integrations/akeneo/custom-mappings

# Generate test data
node testing/api-contracts/test-data-generators.js --scenario=regression

# Run full contract suite
npm run test:contracts
```

### 2. Start Monitoring Dashboard
```bash
# Start monitoring server
node testing/monitoring/dashboard-server.js

# Visit dashboard
open http://localhost:3001

# Export monitoring report
curl http://localhost:3001/api/export > monitoring-report.json
```

### 3. End-to-End Testing
```bash
# Run all E2E tests
cd testing/e2e
npx playwright test

# Run specific test suite
npx playwright test --project=chromium tests/api-transformation.spec.js

# Run with UI mode
npx playwright test --ui

# Generate report
npx playwright show-report
```

### 4. Error Detection
```bash
# Run error detection analysis
node testing/error-detection/error-detector.js

# Analyze memory leaks
node testing/error-detection/memory-leak-detector.js

# Generate error report
node testing/error-detection/generate-report.js
```

## 🔧 Integration with Existing Codebase

### Backend Integration (Express)
```javascript
// In your main server.js
const DashboardServer = require('./testing/monitoring/dashboard-server');

// Start monitoring dashboard
if (process.env.MONITORING_ENABLED) {
  const dashboard = new DashboardServer();
  dashboard.start();
  
  // Add monitoring middleware
  app.use(dashboard.createMiddleware());
}
```

### Frontend Integration (React)
```javascript
// In your API client
import { apiDebugger } from './testing/utils/api-debugger';

// Enable debugging in development
if (process.env.NODE_ENV === 'development') {
  apiDebugger.enable();
}
```

### Database Integration
```sql
-- Add to your migration scripts
-- Create monitoring tables if needed
CREATE TABLE IF NOT EXISTS api_monitoring_logs (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255),
  method VARCHAR(10),
  response_time INTEGER,
  status_code INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🛡️ Preventing the Custom Mappings Bug

### The Issue
The original bug occurred because:
1. API responses were transformed based on endpoint patterns
2. Endpoints ending in 's' were automatically transformed
3. `/custom-mappings` endpoint was incorrectly transformed
4. This broke the expected response structure

### Prevention Mechanisms

#### 1. Contract Validation
```javascript
// Validates response structure
const validation = await contractValidator.validateResponse(
  '/integrations/akeneo/custom-mappings',
  'GET',
  response
);

if (!validation.valid) {
  throw new Error('Contract violation detected');
}
```

#### 2. Transformation Rules
```javascript
// Explicit transformation rules
contractValidator.registerTransformationRule('/custom-mappings', {
  shouldTransform: false,
  reason: 'Custom mappings require raw response structure'
});
```

#### 3. Pre-commit Validation
```bash
# Automatically runs on commit
git commit -m "Fix API endpoint"
# -> Validates transformation rules
# -> Checks critical endpoints
# -> Prevents breaking changes
```

## 📈 Monitoring & Alerts

### Real-time Dashboard Features
- **API Performance**: Response times, success rates
- **Transformation Compliance**: Rule violations, endpoint analysis  
- **Error Patterns**: Automated pattern detection
- **System Metrics**: Memory usage, CPU, active requests
- **Alert Management**: High/medium/low severity alerts

### Alert Thresholds
```javascript
const alertThresholds = {
  responseTime: 2000,     // ms
  errorRate: 5,          // percentage  
  memoryUsage: 80,       // percentage
  transformationViolations: 0  // zero tolerance
};
```

### Notification Channels
- Console logs (development)
- WebSocket alerts (dashboard)
- GitHub Issues (CI/CD)
- Slack notifications (production)

## 🔍 Testing Scenarios

### Critical Test Cases

#### 1. Custom Mappings Endpoint
```javascript
test('custom mappings should not be transformed', async () => {
  const response = await api.get('/integrations/akeneo/custom-mappings');
  
  // Must be object with mappings, not array
  expect(response).toHaveProperty('success', true);
  expect(response).toHaveProperty('mappings');
  expect(response.mappings).toHaveProperty('attributes');
  expect(Array.isArray(response)).toBe(false);
});
```

#### 2. Transformation Rule Compliance
```javascript
test('transformation rules are followed', async () => {
  const endpoints = [
    { path: '/products', shouldTransform: true },
    { path: '/custom-mappings', shouldTransform: false },
    { path: '/storage/files', shouldTransform: false },
    { path: '/products/stats', shouldTransform: false }
  ];
  
  for (const { path, shouldTransform } of endpoints) {
    const response = await api.get(path);
    const wasTransformed = Array.isArray(response);
    expect(wasTransformed).toBe(shouldTransform);
  }
});
```

#### 3. Performance Regression  
```javascript
test('api performance within thresholds', async () => {
  const start = Date.now();
  await api.get('/products');
  const responseTime = Date.now() - start;
  
  expect(responseTime).toBeLessThan(1000);
});
```

## 🚦 CI/CD Pipeline

### GitHub Actions Workflow
1. **Contract Testing**: Validates API schemas and transformation rules
2. **Performance Monitoring**: Detects bottlenecks and memory issues
3. **E2E Testing**: Cross-browser user journey validation
4. **Security Scanning**: Vulnerability detection
5. **Deployment Health**: Production smoke tests
6. **Automated Rollback**: On critical failures

### Pre-commit Hooks
- Linting and code style
- Contract validation for changed files
- Security scanning
- Transformation rule verification
- Critical endpoint testing

## 📊 Reporting & Analytics

### Generated Reports
- **Contract Validation**: `contract-report.json`
- **Performance Monitoring**: `monitoring-report.json`  
- **E2E Test Results**: `playwright-report/`
- **Error Detection**: `error-detection-report.json`
- **Combined Report**: `testing-report.html`

### Metrics Tracked
- API response times (95th percentile)
- Error rates by endpoint
- Transformation rule compliance
- Memory usage patterns
- Test coverage and success rates
- Deployment health scores

## 🔧 Configuration

### Monitoring Configuration
```javascript
// testing/monitoring/config.js
module.exports = {
  maxDataPoints: 1000,
  alertThresholds: {
    responseTime: 2000,
    errorRate: 5,
    memoryUsage: 80
  },
  metricsRetention: 24 * 60 * 60 * 1000 // 24 hours
};
```

### Contract Validation Config
```javascript
// testing/api-contracts/config.js  
module.exports = {
  strictMode: true,
  transformationRules: {
    '/custom-mappings': { shouldTransform: false },
    '/storage/': { shouldTransform: false },
    '/stats$': { shouldTransform: false }
  }
};
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Dashboard Not Loading
```bash
# Check if monitoring server is running
netstat -tulpn | grep :3001

# Restart monitoring server
node testing/monitoring/dashboard-server.js
```

#### 2. Contract Validation Failures
```bash
# Check registered schemas
node -e "
const validator = require('./testing/api-contracts/contract-validator');
console.log(Array.from(validator.schemas.keys()));
"

# Validate specific response
node testing/api-contracts/debug-validation.js
```

#### 3. E2E Test Failures
```bash
# Check browser installation
npx playwright install --dry-run

# Run in headed mode for debugging
npx playwright test --headed --project=chromium
```

#### 4. Performance Issues
```bash
# Check memory usage
node --expose-gc testing/monitoring/memory-profiler.js

# Analyze slow endpoints
curl http://localhost:3001/api/endpoint/products/GET
```

## 🤝 Contributing

### Adding New Tests
1. Add contract schemas to `base-schemas.js`
2. Create E2E test files in `testing/e2e/tests/`
3. Update transformation rules if needed
4. Add monitoring for new endpoints

### Extending Monitoring
1. Add new metrics to `PerformanceMonitor`
2. Update dashboard UI for new visualizations
3. Configure alerts for new thresholds
4. Document new monitoring features

## 📚 Additional Resources

- [API Contract Testing Best Practices](./docs/contract-testing.md)
- [Performance Monitoring Guide](./docs/performance-monitoring.md)
- [E2E Testing Patterns](./docs/e2e-patterns.md)
- [Error Detection Strategies](./docs/error-detection.md)
- [CI/CD Pipeline Configuration](./docs/cicd-setup.md)

## 📞 Support

For issues or questions:
1. Check the troubleshooting guide above
2. Review error logs in monitoring dashboard
3. Run diagnostic scripts in `testing/diagnostics/`
4. Create GitHub issue with reproduction steps

---

**Built to prevent critical bugs and ensure reliable e-commerce operations** 🛡️