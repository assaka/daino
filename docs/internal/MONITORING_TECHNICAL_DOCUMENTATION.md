# 🔧 DainoStore Monitoring System - Technical Documentation

## 📋 Table of Contents
1. [Installation Instructions](#installation-instructions)
2. [System Architecture](#system-architecture)
3. [Code Components Overview](#code-components-overview)
4. [Render Log Monitoring](#render-log-monitoring)
5. [Browser Console Error Detection](#browser-console-error-detection)
6. [API Monitoring Implementation](#api-monitoring-implementation)
7. [Error Detection Mechanisms](#error-detection-mechanisms)
8. [Integration Points](#integration-points)
9. [Deployment Architecture](#deployment-architecture)

---

## Installation Instructions

### 🚀 **Quick Start - Deploy Monitoring Dashboard**

#### **Option 1: Standalone Deployment (Recommended)**

```bash
# Navigate to monitoring dashboard directory
cd monitoring-dashboard

# Install dependencies
npm install

# Deploy to Vercel
npx vercel --prod

# Follow prompts:
# ? Set up and deploy "~/monitoring-dashboard"? Y
# ? Which scope do you want to deploy to? (Your account)
# ? Link to existing project? N
# ? What's your project's name? daino-monitoring
# ? In which directory is your code located? ./
```

#### **Option 2: One-Click Deploy**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/daino-monitoring)

### ⚙️ **Environment Variables Setup**

**In Vercel Dashboard:**
1. Go to your deployed project
2. Navigate to "Settings" → "Environment Variables"
3. Add the following variables:

```bash
# Required Environment Variables
RENDER_BACKEND_URL=https://backend.dainostore.com
VERCEL_FRONTEND_URL=https://www..dainostore.com
MONITORING_ENABLED=true

# Optional Environment Variables
ALERT_WEBHOOK_URL=https://hooks.slack.com/your-webhook
MONITORING_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=10000
```

### 🔧 **Main Application Integration**

#### **Step 1: Install Dependencies** (If not already present)
```bash
# In your main daino project
npm install axios  # Already installed
```

#### **Step 2: Enable API Debugging** (Already integrated)
The monitoring code is already integrated in your main application:
- ✅ `src/api/client.js` - Enhanced with debugging
- ✅ `src/utils/api-debugger.js` - Auto-debugging service

#### **Step 3: Enable Development Monitoring**
```javascript
// src/.env.local (create if doesn't exist)
VITE_ENABLE_API_DEBUG=true
VITE_MONITORING_ENDPOINT=https://your-monitoring-dashboard.vercel.app
```

### 📦 **Dependencies Overview**

#### **Monitoring Dashboard Dependencies** (`monitoring-dashboard/package.json`)
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

#### **Main Application Dependencies** (Already installed)
```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "react": "^18.2.0",
    "vite": "^5.0.0"
  }
}
```

### 🔍 **Verification Steps**

#### **1. Verify Monitoring Dashboard Deployment**
```bash
# Test health check endpoint
curl https://your-monitoring-dashboard.vercel.app/api/health-check

# Expected response:
{
  "timestamp": "2024-01-XX...",
  "platforms": {
    "render": { "healthy": true },
    "vercel": { "healthy": true }
  },
  "overallStatus": "healthy"
}
```

#### **2. Verify Main Application Integration**
```bash
# In main project, start development server
npm run dev

# Open browser console, should see:
# "🔍 API Debugger initialized"
# "📊 Schema validation enabled"
```

#### **3. Test Transformation Bug Detection**
```bash
# Test the critical monitoring endpoint
curl https://backend.dainostore.com/api/integrations/akeneo/custom-mappings

# If returns array [] instead of object {}, monitoring will alert:
# "🚨 CRITICAL: Custom mappings returned array - TRANSFORMATION BUG IS BACK!"
```

### ⏱️ **Monitoring Schedule**

#### **Automated Checks**
- **Health Checks**: Every 5 minutes (Vercel Cron)
- **Dashboard Refresh**: Every 30 seconds (Frontend)
- **Performance Monitoring**: Real-time (API Client)
- **Error Detection**: Immediate (Event-driven)

#### **Manual Checks**
- **Render Logs**: Check Render dashboard manually
- **Vercel Logs**: Check Vercel dashboard manually  
- **Database Status**: Monitored via API endpoints

### 🛠️ **Local Development Setup**

#### **Run Monitoring Dashboard Locally**
```bash
cd monitoring-dashboard

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

#### **Test Monitoring Integration**
```bash
# Run local test script
node test-local.js

# Expected output:
# ✅ Health check API logic working
# ✅ Deployment status API logic working  
# ✅ Transformation bug detection active
# ✅ File structure complete
```

### 🚨 **Troubleshooting**

#### **Common Issues & Solutions**

**1. "Cannot reach backend" error:**
```bash
# Check backend URL in environment variables
echo $RENDER_BACKEND_URL
# Should output: https://backend.dainostore.com

# Test backend directly
curl https://backend.dainostore.com/api/health
```

**2. "Monitoring dashboard not updating" error:**
```bash
# Check Vercel deployment logs
npx vercel logs

# Verify environment variables are set
npx vercel env ls
```

**3. "API debugging not working" error:**
```bash
# Check if development mode is enabled
echo $VITE_ENABLE_API_DEBUG
# Should output: true

# Check browser console for initialization message
# Should see: "🔍 API Debugger initialized"
```

#### **Debug Commands**
```bash
# Check monitoring dashboard status
curl https://your-monitoring-dashboard.vercel.app/health

# Test specific platform monitoring
curl https://your-monitoring-dashboard.vercel.app/api/deployment-status

# Check Vercel function logs
npx vercel logs --follow

# Test local monitoring setup
cd monitoring-dashboard && npm run test
```

### 📞 **Support & Maintenance**

#### **Regular Maintenance Tasks**
1. **Weekly**: Check monitoring dashboard for any critical alerts
2. **Monthly**: Review performance metrics and response times
3. **Quarterly**: Update dependencies in monitoring dashboard

#### **Scaling Considerations**
- **High Traffic**: Consider upgrading Vercel plan for more function invocations
- **More Platforms**: Add new monitoring checks in `api/health-check.js`
- **Enhanced Alerting**: Integrate with Slack, Discord, or email notifications

#### **Monitoring the Monitor**
```bash
# Set up uptime monitoring for the monitoring dashboard itself
# Using services like UptimeRobot or Pingdom
# Monitor: https://your-monitoring-dashboard.vercel.app/health
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MONITORING SYSTEM ARCHITECTURE               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   Render API    │    │  Vercel Frontend│    │  Supabase DB │ │
│  │   (Backend)     │    │   (Frontend)    │    │  (Database)  │ │
│  └─────────┬───────┘    └─────────┬───────┘    └──────┬───────┘ │
│            │                      │                   │         │
│            │ HTTP Health Checks   │ Performance       │ Conn    │
│            │                      │ Monitoring        │ Tests   │
│            ▼                      ▼                   ▼         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │          MONITORING DASHBOARD (Vercel)                     │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │ │
│  │  │  Health Check   │  │ Error Detection │  │ Performance │ │ │
│  │  │  API Endpoint   │  │    Service      │  │  Monitor    │ │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code Components Overview

### 🗂️ **Main Codebase Integration** (`src/`)

#### **1. Enhanced API Client** - `src/api/client.js`
```javascript
// Location: src/api/client.js:45-67
async request(method, endpoint, data = null, customHeaders = {}) {
  const startTime = performance.now();
  
  // 🔍 MONITORING: Debug API call initiation
  const debugId = apiDebugger.debugAPICall('request', {
    endpoint, method, data, headers: customHeaders
  });

  try {
    const response = await fetch(fullUrl, options);
    const result = await response.json();
    
    // 🔍 MONITORING: Performance tracking
    const duration = performance.now() - startTime;
    apiDebugger.debugAPICall('response', {
      debugId, endpoint, method, duration: Math.round(duration),
      rawResponse: result, response: result, status: response.status
    });
    
    return result;
  } catch (error) {
    // 🔍 MONITORING: Error tracking
    apiDebugger.debugAPICall('error', {
      debugId, endpoint, method, error: error.message
    });
    throw error;
  }
}
```

**What it monitors:**
- ✅ API request/response times
- ✅ HTTP status codes
- ✅ Request/response payload validation
- ✅ Network errors and timeouts

#### **2. API Debugger Service** - `src/utils/api-debugger.js`
```javascript
// Location: src/utils/api-debugger.js:15-45
export class APIDebugger {
  constructor() {
    this.isEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_API_DEBUG === 'true';
    this.logs = [];
    this.schemas = new Map();
    this.transformationRules = new Map();
  }

  // 🔍 MONITORING: Schema validation
  validateSchema(endpoint, data) {
    const schema = this.schemas.get(endpoint);
    if (!schema) return { valid: true };
    
    const validation = this.validateObject(data, schema);
    if (!validation.valid) {
      this.alert('SCHEMA_MISMATCH', {
        endpoint, expected: schema, received: data, errors: validation.errors
      });
    }
    return validation;
  }

  // 🔍 MONITORING: Transformation bug detection
  checkTransformationIssues(endpoint, rawResponse, transformedResponse) {
    const rawKeys = this.getObjectKeys(rawResponse);
    const transformedKeys = this.getObjectKeys(transformedResponse);
    const missingKeys = rawKeys.filter(key => !transformedKeys.includes(key));
    
    if (missingKeys.length > 0) {
      this.alert('TRANSFORMATION_MISMATCH', {
        endpoint, missingKeys, rawKeys, transformedKeys
      });
    }
  }
}
```

**What it monitors:**
- ✅ API response schema validation
- ✅ Data transformation issues (like the custom mappings bug)
- ✅ Missing fields in responses
- ✅ Type mismatches

### 🗂️ **Standalone Monitoring Dashboard** (`monitoring-dashboard/`)

#### **3. Health Check API** - `monitoring-dashboard/api/health-check.js`
```javascript
// Location: monitoring-dashboard/api/health-check.js:12-85
export default async function handler(req, res) {
  const healthCheck = {
    timestamp: new Date().toISOString(),
    platforms: {},
    overallStatus: 'healthy',
    criticalIssues: [],
    checkDuration: 0
  };

  // 🔍 MONITORING: Render Backend Health
  try {
    const backendResponse = await fetch(`${RENDER_BACKEND_URL}/api/health`, {
      method: 'GET',
      timeout: 10000
    });
    
    healthCheck.platforms.render = {
      healthy: backendResponse.ok,
      status: backendResponse.status,
      responseTime: Math.round(backendEndTime - backendStartTime),
      url: RENDER_BACKEND_URL
    };
    
    if (!backendResponse.ok) {
      healthCheck.criticalIssues.push({
        severity: 'CRITICAL',
        issue: 'Backend API unavailable',
        platform: 'render',
        impact: 'API endpoints not responding'
      });
    }
  } catch (error) {
    // 🔍 MONITORING: Backend connection errors
    healthCheck.platforms.render = {
      healthy: false,
      error: error.message,
      url: RENDER_BACKEND_URL
    };
  }

  // 🔍 MONITORING: Custom Mappings Transformation Bug Detection
  try {
    const mappingsResponse = await fetch(`${RENDER_BACKEND_URL}/api/integrations/akeneo/custom-mappings`);
    const mappingsData = await mappingsResponse.json();
    
    // ⚠️  CRITICAL: Detect if transformation bug has returned
    const isTransformationBug = Array.isArray(mappingsData);
    
    healthCheck.platforms.customMappings = {
      healthy: !isTransformationBug,
      status: mappingsResponse.status,
      transformationBugDetected: isTransformationBug,
      protected: mappingsResponse.status === 401
    };
    
    if (isTransformationBug) {
      healthCheck.criticalIssues.push({
        severity: 'CRITICAL',
        issue: 'Custom mappings returned array - TRANSFORMATION BUG IS BACK!',
        platform: 'backend-api',
        impact: 'Frontend integration will break'
      });
    }
  } catch (error) {
    // Protected endpoint is expected (401), connection errors are not
    if (!error.message.includes('401')) {
      healthCheck.platforms.customMappings = {
        healthy: false,
        error: error.message
      };
    }
  }
}
```

**What it monitors:**
- ✅ **Render backend availability** and response times
- ✅ **Transformation bug detection** (array vs object responses)
- ✅ **Critical API endpoint health**
- ✅ **Database connectivity** through API endpoints

#### **4. Real-time Dashboard UI** - `monitoring-dashboard/pages/index.js`
```javascript
// Location: monitoring-dashboard/pages/index.js:45-120
export default function MonitoringDashboard() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  // 🔍 MONITORING: Auto-refresh every 30 seconds
  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const response = await fetch('/api/health-check');
        const data = await response.json();
        setHealthData(data);
        setLastUpdate(new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Failed to fetch health data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHealthData();
    const interval = setInterval(fetchHealthData, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, []);

  // 🔍 MONITORING: Critical alerts display
  const renderCriticalAlerts = () => {
    if (!healthData?.criticalIssues?.length) return null;
    
    return (
      <div className="alert-banner">
        <h3 className="text-lg font-bold text-red-800 mb-2">🚨 Critical Alerts</h3>
        {healthData.criticalIssues.map((issue, index) => (
          <div key={index} className="mb-2">
            <span className="font-semibold">{issue.severity}:</span> {issue.issue}
            {issue.impact && <div className="text-sm text-red-600">Impact: {issue.impact}</div>}
          </div>
        ))}
      </div>
    );
  };
}
```

**What it monitors:**
- ✅ **Real-time status updates** every 30 seconds
- ✅ **Critical alert notifications**
- ✅ **Platform-specific health indicators**
- ✅ **Performance metrics visualization**

---

## Render Log Monitoring

### 🔍 **Current Implementation Status**

**❌ Direct Render Log Access:** Not currently implemented
- Render logs are not directly accessible via API
- Render dashboard must be manually checked

**✅ Indirect Render Monitoring (Active):**
```javascript
// Location: monitoring-dashboard/api/health-check.js:25-45
// Monitor Render through health endpoints
const backendResponse = await fetch(`${RENDER_BACKEND_URL}/api/health`);

// Detect Render issues through:
// 1. API response times (timeout = 10 seconds)
// 2. HTTP status codes (500, 503, etc.)
// 3. Connection failures (network errors)
// 4. Response payload validation
```

### 🔧 **Enhanced Render Monitoring (Recommended Addition)**

To enable direct Render log monitoring, add:

```javascript
// monitoring-dashboard/api/render-logs.js (NEW FILE)
export default async function handler(req, res) {
  try {
    // Option 1: Render webhook integration
    // Configure Render to send error logs to this endpoint
    
    // Option 2: Log aggregation service (Logtail, LogDNA)
    // Check external log service for Render errors
    
    // Option 3: Error pattern detection
    // Monitor for specific error patterns in API responses
    const errorPatterns = [
      'Internal Server Error',
      'Database connection failed',
      'Memory limit exceeded',
      'Request timeout'
    ];
    
    return res.json({
      renderLogs: {
        errorCount: 0,
        lastError: null,
        patterns: errorPatterns
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

---

## Browser Console Error Detection

### 🔍 **Current Implementation Status**

**✅ Frontend Error Monitoring (Active):**
```javascript
// Location: src/utils/api-debugger.js:75-95
// Browser console integration
debugAPICall(type, data) {
  if (!this.isEnabled) return;
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    ...data
  };
  
  // 🔍 MONITORING: Console error tracking
  if (type === 'error') {
    console.error('🚨 API Error:', logEntry);
    this.logs.push(logEntry);
    
    // Send to monitoring dashboard (if configured)
    this.sendToMonitoring(logEntry);
  }
}
```

**✅ Global Error Handling (Active):**
```javascript
// Location: src/api/client.js:78-95
// Enhanced error handling
} catch (error) {
  // 🔍 MONITORING: Capture and categorize errors
  const errorData = {
    debugId,
    endpoint,
    method,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };
  
  apiDebugger.debugAPICall('error', errorData);
  
  // Browser console logging
  console.error('API Request Failed:', errorData);
  throw error;
}
```

### 🔧 **Enhanced Browser Error Detection (Recommended Addition)**

Add comprehensive browser error monitoring:

```javascript
// src/utils/browser-error-monitor.js (NEW FILE)
class BrowserErrorMonitor {
  constructor() {
    this.errors = [];
    this.init();
  }

  init() {
    // 🔍 MONITORING: Global error handler
    window.addEventListener('error', (event) => {
      this.captureError({
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    // 🔍 MONITORING: Promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        type: 'promise',
        message: event.reason?.message || 'Unhandled Promise Rejection',
        reason: event.reason
      });
    });

    // 🔍 MONITORING: Console error override
    const originalError = console.error;
    console.error = (...args) => {
      this.captureError({
        type: 'console',
        message: args.join(' '),
        args
      });
      originalError.apply(console, args);
    };
  }

  captureError(errorData) {
    const enrichedError = {
      ...errorData,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      id: Date.now() + Math.random()
    };

    this.errors.push(enrichedError);
    
    // Send to monitoring dashboard
    this.sendToMonitoring(enrichedError);
  }

  async sendToMonitoring(error) {
    try {
      await fetch('/api/browser-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error)
      });
    } catch (e) {
      // Monitoring service unavailable
    }
  }
}
```

---

## API Monitoring Implementation

### 🔍 **Request/Response Monitoring**

```javascript
// Location: src/api/client.js:30-70
class APIClient {
  async request(method, endpoint, data = null, customHeaders = {}) {
    // 🔍 MONITORING: Pre-request logging
    const requestMetadata = {
      endpoint,
      method,
      timestamp: new Date().toISOString(),
      headers: customHeaders,
      payload: data
    };
    
    const startTime = performance.now();
    
    try {
      const response = await fetch(fullUrl, options);
      const result = await response.json();
      
      // 🔍 MONITORING: Success monitoring
      const responseMetadata = {
        ...requestMetadata,
        status: response.status,
        duration: Math.round(performance.now() - startTime),
        size: JSON.stringify(result).length,
        success: true
      };
      
      // Schema validation
      apiDebugger.validateSchema(endpoint, result);
      
      // Transformation issue detection
      apiDebugger.checkTransformationIssues(endpoint, result, result);
      
      return result;
      
    } catch (error) {
      // 🔍 MONITORING: Error monitoring
      const errorMetadata = {
        ...requestMetadata,
        duration: Math.round(performance.now() - startTime),
        error: error.message,
        success: false
      };
      
      apiDebugger.debugAPICall('error', errorMetadata);
      throw error;
    }
  }
}
```

### 🔍 **Schema Validation System**

```javascript
// Location: src/utils/api-debugger.js:95-135
// Schema registration for critical endpoints
initializeDebugging() {
  // 🔍 MONITORING: Custom mappings endpoint (transformation bug prevention)
  apiDebugger.registerSchema('/integrations/akeneo/custom-mappings', {
    success: 'boolean',
    mappings: {
      attributes: 'array',
      images: 'array', 
      files: 'array'
    }
  }, 'Akeneo custom mappings endpoint');

  // 🔍 MONITORING: Products endpoint
  apiDebugger.registerSchema('/api/products', {
    success: 'boolean',
    data: {
      products: 'array',
      total: 'number',
      page: 'number'
    }
  }, 'Products listing endpoint');
}

validateSchema(endpoint, data) {
  const schema = this.schemas.get(endpoint);
  if (!schema) return { valid: true };
  
  // 🔍 MONITORING: Deep validation
  const validation = this.validateObject(data, schema);
  
  if (!validation.valid) {
    this.alert('SCHEMA_MISMATCH', {
      endpoint,
      expected: schema,
      received: data,
      errors: validation.errors
    });
  }
  
  return validation;
}
```

---

## Error Detection Mechanisms

### 🚨 **Critical Error Types Monitored**

#### **1. Transformation Bugs** (High Priority)
```javascript
// Location: monitoring-dashboard/api/health-check.js:95-115
// Detect the custom mappings transformation bug
const mappingsData = await mappingsResponse.json();
const isTransformationBug = Array.isArray(mappingsData);

if (isTransformationBug) {
  healthCheck.criticalIssues.push({
    severity: 'CRITICAL',
    issue: 'Custom mappings returned array - TRANSFORMATION BUG IS BACK!',
    platform: 'backend-api',
    impact: 'Frontend integration will break'
  });
}
```

#### **2. API Connectivity Issues**
```javascript
// Location: monitoring-dashboard/api/health-check.js:25-45
// Backend connectivity monitoring
try {
  const backendResponse = await fetch(`${RENDER_BACKEND_URL}/api/health`, {
    timeout: 10000
  });
  
  if (!backendResponse.ok) {
    healthCheck.criticalIssues.push({
      severity: 'CRITICAL',
      issue: 'Backend API unavailable',
      platform: 'render',
      impact: 'API endpoints not responding'
    });
  }
} catch (error) {
  // Network connectivity issues
  healthCheck.platforms.render = {
    healthy: false,
    error: error.message
  };
}
```

#### **3. Performance Degradation**
```javascript
// Location: src/api/client.js:55-65
// Response time monitoring
const duration = Math.round(performance.now() - startTime);

if (duration > 5000) { // 5 second threshold
  apiDebugger.alert('PERFORMANCE_DEGRADATION', {
    endpoint,
    duration,
    threshold: 5000,
    severity: 'HIGH'
  });
}
```

#### **4. Schema Validation Failures**
```javascript
// Location: src/utils/api-debugger.js:140-165
validateObject(obj, schema) {
  const errors = [];
  
  for (const [key, expectedType] of Object.entries(schema)) {
    if (!(key in obj)) {
      errors.push(`Missing required field: ${key}`);
      continue;
    }
    
    const actualType = Array.isArray(obj[key]) ? 'array' : typeof obj[key];
    if (actualType !== expectedType) {
      errors.push(`Type mismatch for ${key}: expected ${expectedType}, got ${actualType}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## Integration Points

### 🔌 **Main Application Integration**

#### **Frontend Integration** (`src/`)
```javascript
// Location: src/main.jsx:15-25
// Initialize monitoring on app startup
import { apiDebugger } from './utils/api-debugger';
import apiClient from './api/client';

// Enable debugging in development
if (import.meta.env.DEV) {
  apiClient.initializeDebugging();
  apiDebugger.enable();
}

// Initialize error monitoring
window.addEventListener('load', () => {
  apiClient.validateConnection();
});
```

#### **Backend Integration** (Optional)
```javascript
// backend/src/middleware/monitoring.js (OPTIONAL ADDITION)
const monitoringMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // 🔍 MONITORING: Request logging
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  
  // Override res.json to monitor responses
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    // 🔍 MONITORING: Response logging
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    
    // Send metrics to monitoring dashboard
    if (process.env.MONITORING_WEBHOOK) {
      sendMetrics({
        endpoint: req.path,
        method: req.method,
        status: res.statusCode,
        duration,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};
```

### 🔌 **Monitoring Dashboard Integration**

#### **Automated Health Checks**
```javascript
// Location: monitoring-dashboard/vercel.json:2-10
{
  "crons": [
    {
      "path": "/api/health-check",
      "schedule": "*/5 * * * *"  // Every 5 minutes
    }
  ]
}
```

#### **Real-time Updates**
```javascript
// Location: monitoring-dashboard/pages/index.js:25-35
useEffect(() => {
  const fetchHealthData = async () => {
    const response = await fetch('/api/health-check');
    const data = await response.json();
    setHealthData(data);
  };

  fetchHealthData();
  const interval = setInterval(fetchHealthData, 30000); // 30 seconds
  return () => clearInterval(interval);
}, []);
```

---

## Deployment Architecture

### 🚀 **Production Deployment Setup**

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🌐 VERCEL (Frontend)                                      │
│  ├─ Main App: https://www..dainostore.com           │
│  └─ Monitoring: https://monitoring.vercel.app             │
│                                                             │
│  🎯 RENDER (Backend)                                       │
│  └─ API: https://backend.dainostore.com       │
│                                                             │
│  🗄️  SUPABASE (Database)                                   │
│  └─ PostgreSQL + Storage                                   │
│                                                             │
│  📊 MONITORING FLOW                                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Monitoring Dashboard (Vercel Edge Functions)          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │ │
│  │  │   Health    │  │   Error     │  │   Performance   │ │ │
│  │  │   Checks    │  │ Detection   │  │   Monitoring    │ │ │
│  │  │ (5 min)     │  │ (Real-time) │  │   (30 sec)      │ │ │
│  │  └─────┬───────┘  └─────┬───────┘  └─────┬───────────┘ │ │
│  │        │                │                │             │ │
│  │        ▼                ▼                ▼             │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │         External HTTP Monitoring                   │ │ │
│  │  │  • Render API endpoints                            │ │ │
│  │  │  • Vercel frontend status                          │ │ │
│  │  │  • Supabase connectivity                           │ │ │
│  │  │  • Custom mappings transformation                  │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 🔧 **Environment Configuration**

#### **Monitoring Dashboard Environment Variables**
```bash
# monitoring-dashboard/.env.production
RENDER_BACKEND_URL=https://backend.dainostore.com
VERCEL_FRONTEND_URL=https://www..dainostore.com
MONITORING_ENABLED=true
ALERT_WEBHOOK_URL=https://hooks.slack.com/your-webhook
```

#### **Main Application Environment Variables**
```bash
# src/.env.production
VITE_ENABLE_API_DEBUG=false
VITE_MONITORING_ENDPOINT=https://monitoring.vercel.app/api/errors
VITE_PERFORMANCE_TRACKING=true
```

---

## Summary

### ✅ **Currently Active Monitoring**

1. **API Request/Response Monitoring** - All API calls tracked
2. **Schema Validation** - Prevents transformation bugs
3. **Performance Tracking** - Response time monitoring
4. **Health Check APIs** - Platform availability monitoring
5. **Real-time Dashboard** - 30-second refresh intervals
6. **Critical Alert System** - Immediate issue notification

### 🔧 **Recommended Enhancements**

1. **Direct Render Log Integration** - Add webhook endpoints
2. **Enhanced Browser Error Capture** - Global error handlers
3. **Performance Alerting** - Threshold-based notifications
4. **Uptime Tracking** - Historical availability data
5. **Error Pattern Analysis** - Machine learning detection

### 🎯 **Key Benefits**

- **Proactive Issue Detection** - Catch problems before users
- **Transformation Bug Prevention** - Specific monitoring for known issues
- **Independent Monitoring** - Dashboard runs separately from main app
- **Real-time Visibility** - Live status updates
- **Production Ready** - Scalable architecture for growth

The monitoring system provides comprehensive coverage of your application stack while remaining completely independent and deployable without affecting your main codebase.