const { masterDbClient } = require('../database/masterConnection');

class DomainConfiguration {
  /**
   * Save domain configuration to store settings
   */
  async saveDomainConfig(storeId, domainConfig) {
    try {
      // Fetch store from Master DB
      const { data: store, error: fetchError } = await masterDbClient
        .from('stores')
        .select('id, settings')
        .eq('id', storeId)
        .single();

      if (fetchError || !store) {
        throw new Error('Store not found');
      }

      const currentSettings = store.settings || {};

      // Update domain configuration in store settings
      const updatedSettings = {
        ...currentSettings,
        domain: {
          ...currentSettings.domain,
          ...domainConfig,
          updated_at: new Date().toISOString()
        }
      };

      // Update store in Master DB
      const { error: updateError } = await masterDbClient
        .from('stores')
        .update({ settings: updatedSettings })
        .eq('id', storeId);

      if (updateError) {
        throw new Error(`Failed to update store settings: ${updateError.message}`);
      }

      return {
        success: true,
        domain_config: updatedSettings.domain,
        message: 'Domain configuration saved successfully'
      };

    } catch (error) {
      console.error('Failed to save domain configuration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get domain configuration from store settings
   */
  async getDomainConfig(storeId) {
    try {
      // Fetch store from Master DB
      const { data: store, error: fetchError } = await masterDbClient
        .from('stores')
        .select('id, settings')
        .eq('id', storeId)
        .single();

      if (fetchError || !store) {
        throw new Error('Store not found');
      }

      const domainConfig = store.settings?.domain || {};

      return {
        success: true,
        domain_config: domainConfig
      };

    } catch (error) {
      console.error('Failed to get domain configuration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Add domain to store and Render (if connected)
   */
  async addDomain(storeId, domain, options = {}) {
    try {
      const {
        render_service_id,
        auto_configure_render = false,
        ssl_enabled = true,
        redirect_www = true
      } = options;

      // Validate domain format
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
      if (!domainRegex.test(domain)) {
        throw new Error('Invalid domain format');
      }

      // Verify store exists in Master DB
      const { data: store, error: fetchError } = await masterDbClient
        .from('stores')
        .select('id')
        .eq('id', storeId)
        .single();

      if (fetchError || !store) {
        throw new Error('Store not found');
      }

      // Generate DNS instructions
      const dnsInstructions = {
        records: [
          {
            type: 'CNAME',
            name: domain.replace(/^www\./, ''),
            value: render_service_id ? `${render_service_id}.onrender.com` : 'your-service.yourdomain.com',
            ttl: 3600,
            priority: null
          }
        ],
        notes: [
          'Add a CNAME record pointing your domain to your hosting service',
          'DNS changes may take 15 minutes to 48 hours to propagate',
          'Make sure to configure SSL/TLS in your hosting dashboard'
        ]
      };

      // Save domain configuration to store
      const domainConfig = {
        primary_domain: domain,
        ssl_enabled,
        redirect_www,
        verification_status: 'pending',
        dns_configured: false,
        dns_instructions: dnsInstructions,
        added_at: new Date().toISOString()
      };

      const saveResult = await this.saveDomainConfig(storeId, domainConfig);

      if (!saveResult.success) {
        throw new Error(saveResult.error);
      }

      return {
        success: true,
        domain: domain,
        domain_config: domainConfig,
        dns_instructions: dnsInstructions,
        message: 'Domain added successfully. Configure DNS to complete setup.'
      };

    } catch (error) {
      console.error('Failed to add domain:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Remove domain from store and Render
   */
  async removeDomain(storeId, domain) {
    try {
      // Fetch store from Master DB
      const { data: store, error: fetchError } = await masterDbClient
        .from('stores')
        .select('id, settings')
        .eq('id', storeId)
        .single();

      if (fetchError || !store) {
        throw new Error('Store not found');
      }

      const domainConfig = store.settings?.domain || {};

      // Remove domain configuration from store settings
      const currentSettings = store.settings || {};
      const { domain: removedDomain, ...remainingSettings } = currentSettings;

      // Update store in Master DB
      const { error: updateError } = await masterDbClient
        .from('stores')
        .update({ settings: remainingSettings })
        .eq('id', storeId);

      if (updateError) {
        throw new Error(`Failed to update store settings: ${updateError.message}`);
      }

      return {
        success: true,
        message: 'Domain removed successfully'
      };

    } catch (error) {
      console.error('Failed to remove domain:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check domain verification status
   */
  async checkDomainStatus(storeId) {
    try {
      // Fetch store from Master DB
      const { data: store, error: fetchError } = await masterDbClient
        .from('stores')
        .select('id, settings')
        .eq('id', storeId)
        .single();

      if (fetchError || !store) {
        throw new Error('Store not found');
      }

      const domainConfig = store.settings?.domain || {};

      if (!domainConfig.primary_domain) {
        return {
          success: true,
          domain_configured: false,
          message: 'No domain configured'
        };
      }

      const verificationStatus = domainConfig.verification_status || 'pending';
      const dnsConfigured = domainConfig.dns_configured || false;

      return {
        success: true,
        domain_configured: true,
        domain: domainConfig.primary_domain,
        verification_status: verificationStatus,
        dns_configured: dnsConfigured,
        ssl_enabled: domainConfig.ssl_enabled,
        last_checked: domainConfig.last_checked || domainConfig.added_at
      };

    } catch (error) {
      console.error('Failed to check domain status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update domain DNS configuration status
   */
  async updateDNSStatus(storeId, dnsConfigured, additionalData = {}) {
    try {
      // Fetch store from Master DB
      const { data: store, error: fetchError } = await masterDbClient
        .from('stores')
        .select('id, settings')
        .eq('id', storeId)
        .single();

      if (fetchError || !store) {
        throw new Error('Store not found');
      }

      const currentDomainConfig = store.settings?.domain || {};

      const updatedConfig = {
        ...currentDomainConfig,
        dns_configured: dnsConfigured,
        verification_status: dnsConfigured ? 'verified' : 'pending',
        last_updated: new Date().toISOString(),
        ...additionalData
      };

      const saveResult = await this.saveDomainConfig(storeId, updatedConfig);

      return saveResult;

    } catch (error) {
      console.error('Failed to update DNS status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate comprehensive setup instructions
   */
  generateSetupInstructions(storeId, domainConfig) {
    const domain = domainConfig.primary_domain;
    const dnsInstructions = domainConfig.dns_instructions || {
      records: [
        {
          type: 'CNAME',
          name: domain.replace(/^www\./, ''),
          value: 'your-service.yourdomain.com',
          ttl: 3600,
          priority: null
        }
      ],
      notes: [
        'Add a CNAME record pointing your domain to your hosting service',
        'DNS changes may take 15 minutes to 48 hours to propagate'
      ]
    };

    return {
      domain: domain,
      setup_steps: [
        {
          step: 1,
          title: "Access Your Domain Registrar",
          description: "Log into the control panel of your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)",
          status: "pending"
        },
        {
          step: 2,
          title: "Navigate to DNS Settings",
          description: "Find DNS, Name Server, or Domain Management settings",
          status: "pending"
        },
        {
          step: 3,
          title: "Add DNS Records",
          description: "Add the CNAME record as specified below",
          status: "pending",
          dns_records: dnsInstructions.records
        },
        {
          step: 4,
          title: "Wait for DNS Propagation",
          description: "DNS changes can take 15 minutes to 48 hours to fully propagate",
          status: "pending"
        },
        {
          step: 5,
          title: "Verify Domain",
          description: "Once DNS propagates, your domain will be verified automatically",
          status: "pending"
        }
      ],
      dns_instructions: dnsInstructions,
      verification_url: `/admin/settings/domain/verify/${storeId}`,
      support_info: {
        message: "Need help? Check our detailed guides for your registrar",
        guides_url: "/docs/domain-setup",
        contact_support: "support@dainostore.com"
      }
    };
  }
}

module.exports = new DomainConfiguration();