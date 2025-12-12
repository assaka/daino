const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkStoreOwnership } = require('../middleware/storeAuth');
const ConnectionManager = require('../services/database/ConnectionManager');
const { v4: uuidv4 } = require('uuid');
const dns = require('dns').promises;
const https = require('https');

/**
 * GET /api/stores/:store_id/storefront-url
 * Get the primary storefront URL for a store (public endpoint for preview system)
 */
router.get('/storefront-url', async (req, res) => {
  try {
    const storeId = req.params.store_id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Query by is_active since storeId is tenant identifier, not store UUID
    const { data: store } = await tenantDb
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Priority order for storefront URL:
    // 1. Primary custom domain (verified)
    // 2. Any verified custom domain
    // 3. Render service URL
    // 4. Fallback to slug-based URL
    
    let storefrontUrl = null;
    let source = 'fallback';
    
    // Check for custom domains first
    const domains = store.settings?.custom_domains || [];
    const primaryDomain = store.settings?.domain?.primary_domain;
    
    // Try primary domain from domain configuration
    if (primaryDomain && store.settings?.domain?.verification_status === 'verified') {
      storefrontUrl = `https://${primaryDomain}`;
      source = 'primary_domain';
    } else {
      // Check custom domains array for verified domains
      const verifiedDomain = domains.find(d => d.status === 'verified' || d.status === 'active');
      if (verifiedDomain) {
        storefrontUrl = `https://${verifiedDomain.domain}`;
        source = 'custom_domain';
      }
    }
    
    // Note: render_service_url column has been removed
    // If needed, it can be stored in settings.render_service_url
    
    // Final fallback to slug-based URL
    if (!storefrontUrl) {
      storefrontUrl = `https://${store.slug}.dainostore.com`;
      source = 'slug_fallback';
    }

    res.json({
      success: true,
      storefront_url: storefrontUrl,
      source: source,
      store_slug: store.slug
    });
  } catch (error) {
    console.error('Get storefront URL error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// All routes below require authentication and store ownership
router.use(authMiddleware);
router.use(checkStoreOwnership);

/**
 * GET /api/stores/:store_id/domains
 * Get custom domains for a store
 */
router.get('/', async (req, res) => {
  try {
    const storeId = req.params.store_id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Query by is_active since storeId is tenant identifier, not store UUID
    const { data: store } = await tenantDb
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Get domains from store settings or separate domains table if exists
    const domains = store.settings?.custom_domains || [];
    
    // Add status checks for each domain
    const domainsWithStatus = await Promise.all(
      domains.map(async (domain) => {
        const status = await checkDomainStatus(domain.domain);
        const sslStatus = await checkSSLStatus(domain.domain);
        
        return {
          ...domain,
          status: status.verified ? 'active' : 'pending',
          ssl_status: sslStatus.valid ? 'active' : 'pending',
          dns_verified: status.dns_verified,
          ssl_expires_at: sslStatus.expires_at
        };
      })
    );

    res.json({
      success: true,
      data: domainsWithStatus
    });
  } catch (error) {
    console.error('Get domains error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/stores/:store_id/domains
 * Add a custom domain
 * @param {string} domain - Primary domain (e.g., www.example.com or example.com)
 * @param {string} redirect_from - Optional companion domain that redirects to primary (e.g., example.com or www.example.com)
 */
router.post('/', async (req, res) => {
  try {
    const storeId = req.params.store_id;
    const { domain, redirect_from = null, auto_setup_dns = false, ssl_enabled = true } = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain is required'
      });
    }

    // Validate domain format - supports subdomains like www.example.com, shop.example.com
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid domain format'
      });
    }

    // Validate redirect_from domain if provided
    if (redirect_from && !domainRegex.test(redirect_from)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid redirect domain format'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Query by is_active since storeId is tenant identifier, not store UUID
    const { data: store } = await tenantDb
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Check if domain already exists
    const existingDomains = store.settings?.custom_domains || [];
    if (existingDomains.some(d => d.domain === domain.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Domain already exists'
      });
    }

    // Check if redirect_from domain already exists
    if (redirect_from && existingDomains.some(d => d.domain === redirect_from.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Redirect domain ${redirect_from} already exists`
      });
    }

    const domainsToAdd = [];

    // Create primary domain entry
    const newDomain = {
      id: uuidv4(),
      domain: domain.toLowerCase(),
      status: 'pending',
      ssl_enabled,
      is_primary: existingDomains.length === 0,
      auto_setup_dns,
      created_at: new Date().toISOString(),
      verification_token: generateVerificationToken()
    };
    domainsToAdd.push(newDomain);

    // Create redirect domain entry if provided
    let redirectDomain = null;
    if (redirect_from) {
      redirectDomain = {
        id: uuidv4(),
        domain: redirect_from.toLowerCase(),
        status: 'pending',
        ssl_enabled,
        is_primary: false,
        is_redirect: true, // Mark as redirect domain
        redirect_to: domain.toLowerCase(), // Target domain to redirect to
        auto_setup_dns,
        created_at: new Date().toISOString(),
        verification_token: generateVerificationToken()
      };
      domainsToAdd.push(redirectDomain);
    }

    // Add all domains to store settings
    const updatedDomains = [...existingDomains, ...domainsToAdd];
    await tenantDb
      .from('stores')
      .update({
        settings: {
          ...store.settings,
          custom_domains: updatedDomains
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', storeId);

    // If auto setup DNS is enabled, try to configure DNS via Cloudflare
    if (auto_setup_dns) {
      try {
        await setupCloudflareRecords(storeId, domain);
        newDomain.dns_status = 'configured';
        if (redirect_from) {
          await setupCloudflareRecords(storeId, redirect_from);
          redirectDomain.dns_status = 'configured';
        }
      } catch (dnsError) {
        console.error('Auto DNS setup failed:', dnsError);
        newDomain.dns_status = 'manual_required';
        if (redirectDomain) {
          redirectDomain.dns_status = 'manual_required';
        }
      }
    }

    const responseData = {
      primary: newDomain,
      redirect: redirectDomain
    };

    res.json({
      success: true,
      message: redirect_from
        ? `Domains added: ${domain} (primary) and ${redirect_from} (redirects to primary)`
        : 'Domain added successfully',
      data: responseData
    });
  } catch (error) {
    console.error('Add domain error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/stores/:store_id/domains/:domain_id/verify
 * Verify domain ownership
 */
router.post('/:domain_id/verify', async (req, res) => {
  try {
    const storeId = req.params.store_id;
    const { domain_id } = req.params;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Query by is_active since storeId is tenant identifier, not store UUID
    const { data: store } = await tenantDb
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    const domains = store.settings?.custom_domains || [];
    const domain = domains.find(d => d.id === domain_id);

    if (!domain) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found'
      });
    }

    // Check domain status
    const status = await checkDomainStatus(domain.domain);
    
    if (status.verified) {
      // Update domain status
      domain.status = 'verified';
      domain.verified_at = new Date().toISOString();
      
      const updatedDomains = domains.map(d => d.id === domain_id ? domain : d);
      await tenantDb
        .from('stores')
        .update({
          settings: {
            ...store.settings,
            custom_domains: updatedDomains
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', storeId);

      res.json({
        success: true,
        message: 'Domain verified successfully',
        data: domain
      });
    } else {
      res.json({
        success: false,
        message: 'Domain verification failed. Please check DNS records.',
        data: {
          domain_status: status,
          required_records: getRequiredDNSRecords(storeId)
        }
      });
    }
  } catch (error) {
    console.error('Verify domain error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/stores/:store_id/domains/:domain_id/ssl/setup
 * Setup SSL certificate for domain
 */
router.post('/:domain_id/ssl/setup', async (req, res) => {
  try {
    const storeId = req.params.store_id;
    const { domain_id } = req.params;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Query by is_active since storeId is tenant identifier, not store UUID
    const { data: store } = await tenantDb
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    const domains = store.settings?.custom_domains || [];
    const domain = domains.find(d => d.id === domain_id);

    if (!domain) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found'
      });
    }

    if (domain.status !== 'verified') {
      return res.status(400).json({
        success: false,
        error: 'Domain must be verified before SSL setup'
      });
    }

    // Initiate SSL certificate provisioning
    const sslResult = await provisionSSLCertificate(domain.domain);
    
    if (sslResult.success) {
      domain.ssl_status = 'active';
      domain.ssl_issued_at = new Date().toISOString();
      domain.ssl_expires_at = sslResult.expires_at;
      
      const updatedDomains = domains.map(d => d.id === domain_id ? domain : d);
      await tenantDb
        .from('stores')
        .update({
          settings: {
            ...store.settings,
            custom_domains: updatedDomains
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', storeId);

      res.json({
        success: true,
        message: 'SSL certificate setup successful',
        data: domain
      });
    } else {
      res.status(400).json({
        success: false,
        error: sslResult.error
      });
    }
  } catch (error) {
    console.error('SSL setup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/stores/:store_id/domains/:domain_id
 * Remove a custom domain
 */
router.delete('/:domain_id', async (req, res) => {
  try {
    const storeId = req.params.store_id;
    const { domain_id } = req.params;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Query by is_active since storeId is tenant identifier, not store UUID
    const { data: store } = await tenantDb
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    const domains = store.settings?.custom_domains || [];
    const domain = domains.find(d => d.id === domain_id);

    if (!domain) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found'
      });
    }

    // Remove from domains array
    const updatedDomains = domains.filter(d => d.id !== domain_id);
    
    // If this was the primary domain, make the first remaining domain primary
    if (domain.is_primary && updatedDomains.length > 0) {
      updatedDomains[0].is_primary = true;
    }

    await tenantDb
      .from('stores')
      .update({
        settings: {
          ...store.settings,
          custom_domains: updatedDomains
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', storeId);

    res.json({
      success: true,
      message: 'Domain removed successfully'
    });
  } catch (error) {
    console.error('Remove domain error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/stores/:store_id/dns-records
 * Get DNS records status for all domains
 */
router.get('/dns-records', async (req, res) => {
  try {
    const storeId = req.params.store_id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data: store } = await tenantDb
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();
    const domains = store?.settings?.custom_domains || [];
    
    const dnsRecords = [];
    
    for (const domain of domains) {
      const records = await checkDNSRecords(domain.domain, storeId);
      dnsRecords.push(...records);
    }

    res.json({
      success: true,
      data: dnsRecords
    });
  } catch (error) {
    console.error('Get DNS records error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/stores/:store_id/ssl-status
 * Get SSL status for all domains
 */
router.get('/ssl-status', async (req, res) => {
  try {
    const storeId = req.params.store_id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data: store } = await tenantDb
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();
    const domains = store?.settings?.custom_domains || [];
    
    const sslStatus = {};
    
    for (const domain of domains) {
      const status = await checkSSLStatus(domain.domain);
      sslStatus[domain.domain] = status;
    }

    res.json({
      success: true,
      data: sslStatus
    });
  } catch (error) {
    console.error('Get SSL status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper functions
function generateVerificationToken() {
  return uuidv4().replace(/-/g, '').substring(0, 16);
}

async function checkDomainStatus(domain) {
  try {
    // Check if domain points to our servers
    const records = await dns.resolve4(domain);
    const ourIPs = ['76.76.19.23', '104.18.0.1']; // Example IPs
    
    const pointsToUs = records.some(ip => ourIPs.includes(ip));
    
    // Check CNAME for www subdomain
    let wwwPointsToUs = false;
    try {
      const wwwRecords = await dns.resolveCname(`www.${domain}`);
      wwwPointsToUs = wwwRecords.some(cname => cname.includes('daino') || cname.includes('pages.dev'));
    } catch (error) {
      // CNAME not found, which is OK
    }
    
    return {
      verified: pointsToUs,
      dns_verified: pointsToUs,
      www_configured: wwwPointsToUs,
      records: records
    };
  } catch (error) {
    return {
      verified: false,
      dns_verified: false,
      www_configured: false,
      error: error.message
    };
  }
}

async function checkSSLStatus(domain) {
  return new Promise((resolve) => {
    const options = {
      hostname: domain,
      port: 443,
      method: 'HEAD',
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      const cert = res.connection.getPeerCertificate();
      
      if (cert && cert.subject) {
        resolve({
          valid: true,
          status: 'active',
          issuer: cert.issuer?.O || 'Unknown',
          expires_at: cert.valid_to,
          subject: cert.subject.CN
        });
      } else {
        resolve({
          valid: false,
          status: 'pending',
          error: 'No certificate found'
        });
      }
    });

    req.on('error', () => {
      resolve({
        valid: false,
        status: 'failed',
        error: 'SSL connection failed'
      });
    });

    req.on('timeout', () => {
      resolve({
        valid: false,
        status: 'timeout',
        error: 'Connection timeout'
      });
    });

    req.end();
  });
}

async function checkDNSRecords(domain, storeId) {
  const requiredRecords = getRequiredDNSRecords(storeId);
  const results = [];
  
  for (const record of requiredRecords) {
    try {
      const fullDomain = record.name === '@' ? domain : `${record.name}.${domain}`;
      
      let actualRecords = [];
      if (record.type === 'A') {
        actualRecords = await dns.resolve4(fullDomain);
      } else if (record.type === 'CNAME') {
        actualRecords = await dns.resolveCname(fullDomain);
      } else if (record.type === 'TXT') {
        actualRecords = await dns.resolveTxt(fullDomain);
      }
      
      const isValid = actualRecords.some(r => 
        Array.isArray(r) ? r.join('').includes(record.value) : r.includes(record.value)
      );
      
      results.push({
        type: record.type,
        name: record.name,
        domain: fullDomain,
        value: record.value,
        actual: actualRecords,
        status: isValid ? 'valid' : 'invalid'
      });
    } catch (error) {
      results.push({
        type: record.type,
        name: record.name,
        domain: record.name === '@' ? domain : `${record.name}.${domain}`,
        value: record.value,
        status: 'not_found',
        error: error.message
      });
    }
  }
  
  return results;
}

function getRequiredDNSRecords(storeId) {
  return [
    {
      type: 'A',
      name: '@',
      value: '76.76.19.23',
      description: 'Points your root domain to our servers'
    },
    {
      type: 'CNAME',
      name: 'www',
      value: 'daino.pages.dev',
      description: 'Points www subdomain to our CDN'
    }
  ];
}

async function setupCloudflareRecords(storeId, domain) {
  // This would integrate with Cloudflare API to automatically setup DNS records
  // For now, return success to simulate the functionality
  return {
    success: true,
    message: 'DNS records configured via Cloudflare'
  };
}

async function provisionSSLCertificate(domain) {
  // This would integrate with Let's Encrypt or similar to provision SSL certificates
  // For now, simulate the functionality
  return {
    success: true,
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days from now
    issuer: "Let's Encrypt"
  };
}

module.exports = router;