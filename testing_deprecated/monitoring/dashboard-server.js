// Real-time Monitoring Dashboard Server
// Provides WebSocket-based real-time monitoring interface for developers

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const PerformanceMonitor = require('./performance-monitor');

class DashboardServer {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3001,
      cors: options.cors || {
        origin: ["http://localhost:3000", "http://localhost:5173"],
        methods: ["GET", "POST"]
      },
      ...options
    };

    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: this.options.cors
    });

    this.monitor = new PerformanceMonitor();
    this.connectedClients = new Set();
    
    this.setupExpress();
    this.setupSocketIO();
    this.setupMonitoringEvents();
  }

  setupExpress() {
    // Serve static dashboard files
    this.app.use(express.static(path.join(__dirname, 'dashboard-ui')));
    
    // API endpoints for dashboard data
    this.app.get('/api/dashboard', (req, res) => {
      res.json(this.monitor.getDashboardData());
    });

    this.app.get('/api/summary', (req, res) => {
      res.json(this.monitor.getPerformanceSummary());
    });

    this.app.get('/api/endpoint/:endpoint/:method', (req, res) => {
      const { endpoint, method } = req.params;
      const analytics = this.monitor.getEndpointAnalytics(
        decodeURIComponent(endpoint), 
        method.toUpperCase()
      );
      
      if (!analytics) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      
      res.json(analytics);
    });

    this.app.get('/api/export', async (req, res) => {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(__dirname, 'reports', `metrics-${timestamp}.json`);
        
        const report = await this.monitor.exportMetrics(filePath);
        res.json({ 
          success: true, 
          reportPath: filePath,
          summary: report.summary 
        });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        connectedClients: this.connectedClients.size,
        activeRequests: this.monitor.activeRequests.size
      });
    });
  }

  setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log(`Dashboard client connected: ${socket.id}`);
      this.connectedClients.add(socket.id);

      // Send initial data
      socket.emit('dashboard-data', this.monitor.getDashboardData());

      // Handle client requests
      socket.on('get-endpoint-details', (data) => {
        const { endpoint, method } = data;
        const analytics = this.monitor.getEndpointAnalytics(endpoint, method);
        socket.emit('endpoint-details', { endpoint, method, analytics });
      });

      socket.on('get-transformation-issues', () => {
        socket.emit('transformation-issues', {
          issues: this.monitor.metrics.transformationIssues.slice(-20),
          summary: {
            total: this.monitor.metrics.transformationIssues.length,
            highSeverity: this.monitor.metrics.transformationIssues.filter(i => i.severity === 'HIGH').length
          }
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`Dashboard client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });
    });
  }

  setupMonitoringEvents() {
    // Forward performance monitor events to connected clients
    this.monitor.on('apiCall', (data) => {
      this.io.emit('api-call', data);
      
      // Send updated summary every 10 calls
      if (this.monitor.metrics.apiCalls.length % 10 === 0) {
        this.io.emit('summary-update', this.monitor.getPerformanceSummary());
      }
    });

    this.monitor.on('error', (data) => {
      this.io.emit('api-error', data);
    });

    this.monitor.on('alert', (data) => {
      this.io.emit('alert', data);
      
      // Log alerts to console for development
      console.log(`🚨 Alert: ${data.type} - ${data.message}`, data);
    });

    this.monitor.on('systemMetrics', (data) => {
      this.io.emit('system-metrics', data);
    });

    // Send dashboard updates every 5 seconds
    setInterval(() => {
      if (this.connectedClients.size > 0) {
        this.io.emit('dashboard-update', this.monitor.getDashboardData());
      }
    }, 5000);
  }

  // Middleware to integrate with existing API
  createMiddleware() {
    return (req, res, next) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Track request start
      const callData = this.monitor.trackApiCallStart(
        requestId,
        req.path,
        req.method,
        req.headers
      );

      // Store request ID for later use
      req.monitoringId = requestId;

      // Override res.json to track response
      const originalJson = res.json;
      const originalSend = res.send;
      
      const trackResponse = (data) => {
        const responseSize = data ? JSON.stringify(data).length : 0;
        
        // Check if transformation was applied (based on response structure)
        let transformationApplied = false;
        if (data && typeof data === 'object') {
          // If response is an array directly, transformation was applied
          if (Array.isArray(data)) {
            transformationApplied = true;
          }
          // If response has wrapper but data is transformed, transformation was applied
          else if (data.success && data.data && Array.isArray(data.data)) {
            // This indicates the wrapper was kept but data was transformed
            transformationApplied = false;
          }
        }

        this.monitor.trackApiCallEnd(
          requestId,
          res.statusCode,
          responseSize,
          transformationApplied
        );
      };

      res.json = function(data) {
        trackResponse(data);
        return originalJson.call(this, data);
      };

      res.send = function(data) {
        trackResponse(data);
        return originalSend.call(this, data);
      };

      // Track errors
      res.on('error', (error) => {
        this.monitor.trackError(requestId, error, req.path, req.method);
      });

      next();
    };
  }

  // Start the dashboard server
  start() {
    return new Promise((resolve) => {
      this.server.listen(this.options.port, () => {
        console.log(`📊 Monitoring Dashboard Server running on port ${this.options.port}`);
        console.log(`🌐 Dashboard URL: http://localhost:${this.options.port}`);
        console.log(`🔌 WebSocket endpoint: ws://localhost:${this.options.port}`);
        resolve();
      });
    });
  }

  // Stop the server
  stop() {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('📊 Monitoring Dashboard Server stopped');
        resolve();
      });
    });
  }

  // Get monitor instance for direct access
  getMonitor() {
    return this.monitor;
  }

  // Manual tracking methods for integration
  trackApiCall(endpoint, method, responseTime, statusCode, transformationApplied = false) {
    const requestId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.monitor.trackApiCallStart(requestId, endpoint, method);
    setTimeout(() => {
      this.monitor.trackApiCallEnd(requestId, statusCode, 0, transformationApplied);
    }, 0);
  }

  trackError(endpoint, method, error) {
    const requestId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.monitor.trackError(requestId, error, endpoint, method);
  }

  // Create alert manually
  createAlert(type, severity, message, details = {}) {
    return this.monitor.emitAlert({
      type,
      severity,
      message,
      ...details
    });
  }
}

module.exports = DashboardServer;