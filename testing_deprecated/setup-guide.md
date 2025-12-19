# Testing Stack Setup Guide

Complete setup guide for implementing the comprehensive testing and debugging stack.

## 📋 Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] npm 8+ installed  
- [ ] Git configured
- [ ] PostgreSQL running (for backend tests)
- [ ] Chrome/Firefox browsers installed
- [ ] VS Code or similar editor

## 🚀 Step-by-Step Setup

### 1. Install Testing Dependencies

```bash
# Navigate to project root
cd /path/to/daino

# Install main testing dependencies
npm install --save-dev \
  @playwright/test \
  joi \
  @faker-js/faker \
  socket.io \
  socket.io-client \
  secretlint \
  husky

# Install backend testing dependencies
cd backend
npm install --save-dev \
  jest \
  supertest \
  nodemon

# Install Playwright browsers
cd ../
npx playwright install
```

### 2. Configure Environment Variables

```bash
# Create testing environment file
cat > .env.testing << EOF
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/daino_test
API_BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
MONITORING_ENABLED=true
PLAYWRIGHT_BROWSERS_PATH=./browsers
EOF

# Add to .gitignore if not already present
echo ".env.testing" >> .gitignore
echo "browsers/" >> .gitignore
echo "test-results/" >> .gitignore
echo "monitoring-reports/" >> .gitignore
```

### 3. Setup Pre-commit Hooks

```bash
# Initialize Husky
npx husky install

# Make pre-commit executable
chmod +x .husky/pre-commit

# Test pre-commit hook
git add .
git commit -m "Test pre-commit hooks"
```

### 4. Configure Package.json Scripts

Add these scripts to your main `package.json`:

```json
{
  "scripts": {
    "test:contracts": "node testing/api-contracts/run-contract-tests.js",
    "test:e2e": "cd testing/e2e && npx playwright test",
    "test:e2e:ui": "cd testing/e2e && npx playwright test --ui",
    "test:monitoring": "node testing/monitoring/dashboard-server.js",
    "test:smoke": "node testing/smoke-tests/critical-endpoints.js",
    "test:all": "npm run test:contracts && npm run test:e2e && npm run test:smoke",
    "monitoring:start": "node testing/monitoring/dashboard-server.js",
    "monitoring:export": "curl -s http://localhost:3001/api/export",
    "validate:contracts": "node testing/api-contracts/validate-all.js",
    "detect:errors": "node testing/error-detection/error-detector.js"
  }
}
```

### 5. Setup Database for Testing

```bash
# Create test database
createdb daino_test

# Run migrations
cd backend
NODE_ENV=test npm run migrate

# Seed test data
NODE_ENV=test npm run db:seed
```

### 6. Configure VS Code (Optional)

Create `.vscode/settings.json`:

```json
{
  "testing.automaticallyOpenPeekView": "never",
  "playwright.showTrace": true,
  "playwright.reuseBrowser": true,
  "files.associations": {
    "*.spec.js": "javascript"
  },
  "editor.rulers": [80, 120],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Monitoring Dashboard",
      "type": "shell",
      "command": "npm run monitoring:start",
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "panel": "new"
      },
      "isBackground": true
    },
    {
      "label": "Run E2E Tests",
      "type": "shell", 
      "command": "npm run test:e2e",
      "group": "test",
      "presentation": {
        "echo": true,
        "reveal": "always"
      }
    }
  ]
}
```

## 🧪 Testing the Setup

### 1. Verify Contract Testing

```bash
# Test contract validator
node -e "
const ContractValidator = require('./testing/api-contracts/contract-validator');
const validator = new ContractValidator();
console.log('✅ Contract validator loaded');
console.log('Registered schemas:', Array.from(validator.schemas.keys()).length);
"

# Test data generation
node -e "
const TestDataGenerators = require('./testing/api-contracts/test-data-generators');
const generator = new TestDataGenerators();
const product = generator.generateProduct();
console.log('✅ Test data generator working');
console.log('Sample product:', product.name);
"
```

### 2. Verify Monitoring Dashboard

```bash
# Start monitoring server
npm run monitoring:start &

# Wait for server to start
sleep 5

# Test API endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api/dashboard

# Check if dashboard UI loads
curl -I http://localhost:3001/

# Stop monitoring server
pkill -f "monitoring"
```

### 3. Verify E2E Testing

```bash
# Check Playwright installation
npx playwright --version

# List installed browsers
npx playwright install --dry-run

# Run a simple test
cd testing/e2e
npx playwright test --reporter=line tests/auth-flow.spec.js
```

### 4. Verify Error Detection

```bash
# Test error detector
node -e "
const ErrorDetector = require('./testing/error-detection/error-detector');
const detector = new ErrorDetector();
console.log('✅ Error detector initialized');
console.log('Known issues:', detector.knownIssues.size);
"
```

### 5. Test Pre-commit Hooks

```bash
# Make a small change
echo "// Test comment" >> src/App.jsx

# Try to commit
git add src/App.jsx
git commit -m "Test pre-commit validation"

# Should run all pre-commit checks
```

## 🔧 Integration Steps

### 1. Backend Integration

Add to your `backend/src/server.js`:

```javascript
const DashboardServer = require('../testing/monitoring/dashboard-server');

// Add after other middleware
if (process.env.MONITORING_ENABLED === 'true') {
  const dashboardServer = new DashboardServer();
  
  // Start monitoring dashboard
  dashboardServer.start().then(() => {
    console.log('📊 Monitoring dashboard started');
  });

  // Add monitoring middleware to Express app
  app.use(dashboardServer.createMiddleware());
}
```

### 2. Frontend Integration

Update your `src/api/client.js` (if not already done):

```javascript
import { apiDebugger } from '../utils/api-debugger.js';

// Enable debugging in development
if (import.meta.env.DEV) {
  apiDebugger.enable();
}

// Add contract validation in development
if (import.meta.env.DEV) {
  const ContractValidator = require('./testing/api-contracts/contract-validator');
  const validator = new ContractValidator();
  
  // Validate responses in development
  const originalRequest = this.request;
  this.request = async function(...args) {
    const response = await originalRequest.apply(this, args);
    
    // Validate critical endpoints
    if (args[1].includes('custom-mappings')) {
      const validation = await validator.validateResponse(args[1], args[0], response);
      if (!validation.valid) {
        console.warn('Contract validation failed:', validation.errors);
      }
    }
    
    return response;
  };
}
```

### 3. Database Integration

Add monitoring tables (optional):

```sql
-- Add to your migrations
CREATE TABLE IF NOT EXISTS api_monitoring_logs (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(255),
  endpoint VARCHAR(500),
  method VARCHAR(10),
  status_code INTEGER,
  response_time INTEGER,
  transformation_applied BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_monitoring_endpoint ON api_monitoring_logs(endpoint);
CREATE INDEX idx_monitoring_created_at ON api_monitoring_logs(created_at);
```

## ⚡ Performance Optimization

### 1. Optimize E2E Tests

```javascript
// testing/e2e/playwright.config.js
module.exports = defineConfig({
  // Optimize for CI
  workers: process.env.CI ? 1 : 4,
  retries: process.env.CI ? 2 : 0,
  
  // Faster execution
  use: {
    actionTimeout: 5000,
    navigationTimeout: 15000,
  },
  
  // Optimize browser context
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        // Disable images for faster loading
        launchOptions: {
          args: ['--disable-images']
        }
      },
    }
  ]
});
```

### 2. Optimize Contract Testing

```javascript
// testing/api-contracts/config.js
module.exports = {
  // Cache validation results
  enableCache: true,
  cacheExpiry: 5 * 60 * 1000, // 5 minutes
  
  // Batch validations
  batchSize: 10,
  
  // Parallel processing
  maxConcurrency: 4
};
```

## 🔍 Troubleshooting Common Issues

### Issue: Port Already in Use

```bash
# Find process using port 3001
lsof -ti:3001

# Kill the process
kill -9 $(lsof -ti:3001)

# Or use different port
MONITORING_PORT=3002 npm run monitoring:start
```

### Issue: Playwright Browser Download Fails

```bash
# Set proxy if behind corporate firewall
export HTTPS_PROXY=http://proxy.company.com:8080
export HTTP_PROXY=http://proxy.company.com:8080

# Or download to specific location
export PLAYWRIGHT_BROWSERS_PATH=./browsers
npx playwright install
```

### Issue: Database Connection Fails

```bash
# Check PostgreSQL status
pg_isready -h localhost -p 5432

# Test connection
psql postgresql://postgres:postgres@localhost:5432/daino_test -c "SELECT version();"

# Reset database
dropdb daino_test && createdb daino_test
cd backend && NODE_ENV=test npm run migrate
```

### Issue: Pre-commit Hooks Too Slow

```javascript
// .husky/pre-commit - optimize for speed
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Only run on changed files
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if echo "$CHANGED_FILES" | grep -q "\.(js|jsx|ts|tsx)$"; then
  # Fast linting on changed files only
  npx eslint $CHANGED_FILES --fix
  
  # Quick contract validation
  node testing/api-contracts/validate-changed-files.js $CHANGED_FILES
fi
```

## 📊 Monitoring Setup Success

### Health Check Commands

```bash
# Check all components
npm run test:health

# Individual checks
curl http://localhost:3001/health    # Monitoring dashboard
curl http://localhost:5000/health    # Backend API
curl http://localhost:5173/         # Frontend

# Database check
psql $DATABASE_URL -c "SELECT 1"

# Browser check
npx playwright --version
```

### Success Indicators

- ✅ All health checks pass
- ✅ Pre-commit hooks execute in < 30 seconds
- ✅ Monitoring dashboard loads at http://localhost:3001
- ✅ Contract tests pass without errors
- ✅ E2E tests run successfully in all browsers
- ✅ No security vulnerabilities in dependencies

## 🎯 Next Steps

1. **Customize for your needs**: Adjust thresholds, add specific endpoints
2. **Set up notifications**: Configure Slack/email alerts
3. **Train your team**: Share this guide with developers
4. **Monitor in production**: Enable monitoring on staging/production
5. **Iterate and improve**: Add new tests as features are developed

## 📞 Getting Help

If you encounter issues:

1. Check the main [README.md](./README.md) for detailed documentation
2. Review error logs in `testing/logs/`
3. Run diagnostic scripts: `npm run test:diagnostics`
4. Check GitHub Issues for known problems
5. Create a new issue with reproduction steps

---

**Your comprehensive testing stack is ready!** 🚀

Start monitoring your API transformations and preventing critical bugs today.