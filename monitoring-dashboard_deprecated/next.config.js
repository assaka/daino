/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Environment variables for the monitoring dashboard
  env: {
    RENDER_BACKEND_URL: process.env.RENDER_BACKEND_URL || 'https://backend.dainostore.com',
    VERCEL_FRONTEND_URL: process.env.VERCEL_FRONTEND_URL || 'https://www..dainostore.com',
    MONITORING_ENABLED: 'true'
  },

  // Headers for CORS and security
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' }
        ],
      },
    ];
  },

  // Rewrites for clean URLs
  async rewrites() {
    return [
      {
        source: '/health',
        destination: '/api/health-check'
      },
      {
        source: '/status', 
        destination: '/api/deployment-status'
      }
    ];
  }
};

module.exports = nextConfig;