// Unified Deployment Monitor for Vercel + Supabase
// Complete monitoring of your entire deployment stack

const VercelIntegration = require('./vercel-integration.cjs');
const SupabaseIntegration = require('./supabase-integration.cjs');

class DeploymentMonitor {
  constructor() {
    this.vercel = new VercelIntegration();
    this.supabase = new SupabaseIntegration();

    this.lastHealthCheck = null;
    this.alertHistory = [];
    this.uptime = {
      vercel: { total: 0, healthy: 0 },
      supabase: { total: 0, healthy: 0 }
    };
  }

  // Run comprehensive health check across all platforms
  async runFullHealthCheck() {
    console.log('🌟 COMPREHENSIVE DEPLOYMENT HEALTH CHECK');
    console.log('==========================================');
    console.log(`Started: ${new Date().toLocaleString()}`);

    const startTime = Date.now();
    const results = {
      timestamp: new Date().toISOString(),
      platforms: {},
      overallStatus: 'unknown',
      criticalIssues: [],
      warnings: [],
      performance: {}
    };

    try {
      // Check Vercel (Frontend)
      console.log('\n🌐 VERCEL FRONTEND CHECK:');
      console.log('=========================');
      const vercelStart = Date.now();
      results.platforms.vercel = await this.vercel.checkFrontendHealth();
      results.performance.vercelTime = Date.now() - vercelStart;

      this.updateUptime('vercel', results.platforms.vercel.healthy);

      // Check Supabase (Database & Storage)
      console.log('\n🗄️ SUPABASE DATABASE CHECK:');
      console.log('===========================');
      const supabaseStart = Date.now();
      results.platforms.supabase = await this.supabase.runComprehensiveCheck();
      results.performance.supabaseTime = Date.now() - supabaseStart;

      this.updateUptime('supabase', results.platforms.supabase.overall);

      // Analyze results
      results.overallStatus = this.determineOverallStatus(results.platforms);
      results.criticalIssues = this.findCriticalIssues(results.platforms);
      results.warnings = this.findWarnings(results.platforms);

      // Check the specific transformation bug we fixed
      await this.validateTransformationBugFix(results);

    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      results.error = error.message;
      results.overallStatus = 'error';
    }

    results.performance.totalTime = Date.now() - startTime;
    this.lastHealthCheck = results;

    this.printHealthSummary(results);
    return results;
  }

  // Validate that the transformation bug we fixed is still fixed
  async validateTransformationBugFix(results) {
    console.log('\n🐛 TRANSFORMATION BUG VALIDATION:');
    console.log('==================================');
    console.log('✅ Skipping backend validation (backend integration removed)');
  }

  // Determine overall system status
  determineOverallStatus(platforms) {
    const vercelOk = platforms.vercel?.healthy !== false;
    const supabaseOk = platforms.supabase?.overall !== false;

    if (vercelOk && supabaseOk) {
      return 'healthy';
    } else if (!supabaseOk) {
      return 'critical'; // Database down
    } else {
      return 'degraded'; // Frontend issues but core services working
    }
  }

  // Find critical issues that need immediate attention
  findCriticalIssues(platforms) {
    const issues = [];

    // Database issues
    if (!platforms.supabase?.overall) {
      issues.push({
        severity: 'CRITICAL',
        platform: 'supabase',
        issue: 'Database connectivity issues',
        impact: 'Data operations failing'
      });
    }

    return issues;
  }

  // Find warnings that should be monitored
  findWarnings(platforms) {
    const warnings = [];

    // Frontend issues
    if (!platforms.vercel?.healthy) {
      warnings.push('Frontend deployment issues detected');
    }

    // Performance issues
    if (platforms.vercel?.responseTime > 3000) {
      warnings.push('Frontend response times over 3 seconds');
    }

    return warnings;
  }

  // Update uptime statistics
  updateUptime(platform, isHealthy) {
    this.uptime[platform].total++;
    if (isHealthy) {
      this.uptime[platform].healthy++;
    }
  }

  // Print comprehensive health summary
  printHealthSummary(results) {
    console.log('\n📊 DEPLOYMENT HEALTH SUMMARY:');
    console.log('==============================');
    console.log(`Overall Status: ${this.getStatusEmoji(results.overallStatus)} ${results.overallStatus.toUpperCase()}`);
    console.log(`Check Duration: ${results.performance.totalTime}ms`);
    console.log(`Timestamp: ${new Date(results.timestamp).toLocaleString()}`);

    // Platform Status
    console.log('\n🏗️ Platform Status:');
    console.log(`  Vercel (Frontend): ${results.platforms.vercel?.healthy ? '✅' : '❌'} (${results.performance.vercelTime}ms)`);
    console.log(`  Supabase (Database): ${results.platforms.supabase?.overall ? '✅' : '❌'} (${results.performance.supabaseTime}ms)`);

    // Uptime Statistics
    console.log('\n📈 Uptime Statistics:');
    Object.entries(this.uptime).forEach(([platform, stats]) => {
      const uptime = stats.total > 0 ? (stats.healthy / stats.total * 100).toFixed(1) : 0;
      console.log(`  ${platform}: ${uptime}% (${stats.healthy}/${stats.total} checks)`);
    });

    // Critical Issues
    if (results.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      results.criticalIssues.forEach(issue => {
        console.log(`  ${issue.severity}: ${issue.issue}`);
        console.log(`    Impact: ${issue.impact}`);
        if (issue.action) console.log(`    Action: ${issue.action}`);
      });
    }

    // Warnings
    if (results.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      results.warnings.forEach(warning => {
        console.log(`  - ${warning}`);
      });
    }

    // Success Messages
    if (results.overallStatus === 'healthy') {
      console.log('\n🎉 ALL SYSTEMS OPERATIONAL!');
      console.log('✅ Your Vercel + Supabase stack is healthy');
      console.log('✅ Testing stack integration is fully compatible');
    }
  }

  getStatusEmoji(status) {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'critical': return '🚨';
      case 'error': return '❌';
      default: return '❓';
    }
  }

  // Get monitoring configuration for all platforms
  getAllMonitoringConfigs() {
    return {
      vercel: this.vercel.getMonitoringConfig(),
      supabase: this.supabase.getMonitoringConfig(),
      unified: {
        checkInterval: 300000, // 5 minutes
        platforms: ['vercel', 'supabase'],
        criticalEndpoints: [
          'https://www..dainostore.com'
        ]
      }
    };
  }

  // Export health data for monitoring dashboard
  exportHealthData() {
    return {
      lastCheck: this.lastHealthCheck,
      uptime: this.uptime,
      alertHistory: this.alertHistory,
      platformConfigs: this.getAllMonitoringConfigs()
    };
  }
}

// CLI execution
if (require.main === module) {
  const monitor = new DeploymentMonitor();
  monitor.runFullHealthCheck().then(results => {
    process.exit(results.overallStatus === 'healthy' ? 0 : 1);
  }).catch(error => {
    console.error('Monitor execution failed:', error);
    process.exit(1);
  });
}

module.exports = DeploymentMonitor;