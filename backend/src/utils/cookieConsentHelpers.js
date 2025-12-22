/**
 * Cookie Consent Settings Helpers for Normalized Translations
 *
 * These helpers construct the same format that the frontend expects
 * from normalized translation tables using Supabase.
 */

const ConnectionManager = require('../services/database/ConnectionManager');

/**
 * Get cookie consent settings with translations from normalized tables
 *
 * @param {string} storeId - Store ID
 * @param {Object} where - WHERE clause conditions
 * @param {string} lang - Language code (optional, not used but kept for compatibility)
 * @returns {Promise<Array>} Cookie consent settings with full translations object
 */
async function getCookieConsentSettingsWithTranslations(storeId, where = {}, lang = 'en') {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Fetch cookie consent settings
  let settingsQuery = tenantDb.from('cookie_consent_settings').select('*');

  // Apply where conditions
  for (const [key, value] of Object.entries(where)) {
    settingsQuery = settingsQuery.eq(key, value);
  }

  settingsQuery = settingsQuery.order('created_at', { ascending: false });

  const { data: settings, error: settingsError } = await settingsQuery;

  if (settingsError) {
    console.error('Error fetching cookie_consent_settings:', settingsError);
    throw settingsError;
  }

  if (!settings || settings.length === 0) {
    return [];
  }

  // Fetch translations for all settings
  const settingsIds = settings.map(s => s.id);
  const { data: translations, error: transError } = await tenantDb
    .from('cookie_consent_settings_translations')
    .select('*')
    .in('cookie_consent_settings_id', settingsIds);

  if (transError) {
    console.error('Error fetching cookie_consent_settings_translations:', transError);
  }

  // Build translation map
  const transMap = {};
  (translations || []).forEach(t => {
    if (!transMap[t.cookie_consent_settings_id]) {
      transMap[t.cookie_consent_settings_id] = {};
    }
    transMap[t.cookie_consent_settings_id][t.language_code] = {
      banner_text: t.banner_text,
      accept_button_text: t.accept_button_text,
      reject_button_text: t.reject_button_text,
      settings_button_text: t.settings_button_text,
      privacy_policy_text: t.privacy_policy_text,
      save_preferences_button_text: t.save_preferences_button_text,
      necessary_name: t.necessary_name,
      necessary_description: t.necessary_description,
      analytics_name: t.analytics_name,
      analytics_description: t.analytics_description,
      marketing_name: t.marketing_name,
      marketing_description: t.marketing_description,
      functional_name: t.functional_name,
      functional_description: t.functional_description
    };
  });

  // Merge settings with translations
  return settings.map(setting => ({
    ...setting,
    translations: transMap[setting.id] || {}
  }));
}

/**
 * Get single cookie consent settings with translations
 *
 * @param {string} storeId - Store ID
 * @param {string} id - Cookie consent settings ID
 * @param {string} lang - Language code (optional, not used but kept for compatibility)
 * @returns {Promise<Object|null>} Cookie consent settings with full translations object
 */
async function getCookieConsentSettingsById(storeId, id, lang = 'en') {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Fetch the cookie consent settings
  const { data: setting, error: settingError } = await tenantDb
    .from('cookie_consent_settings')
    .select('*')
    .eq('id', id)
    .single();

  if (settingError || !setting) {
    return null;
  }

  // Fetch translations
  const { data: translations, error: transError } = await tenantDb
    .from('cookie_consent_settings_translations')
    .select('*')
    .eq('cookie_consent_settings_id', id);

  if (transError) {
    console.error('Error fetching cookie_consent_settings_translations:', transError);
  }

  // Build translations object
  const translationsObj = {};
  (translations || []).forEach(t => {
    translationsObj[t.language_code] = {
      banner_text: t.banner_text,
      accept_button_text: t.accept_button_text,
      reject_button_text: t.reject_button_text,
      settings_button_text: t.settings_button_text,
      privacy_policy_text: t.privacy_policy_text,
      save_preferences_button_text: t.save_preferences_button_text,
      necessary_name: t.necessary_name,
      necessary_description: t.necessary_description,
      analytics_name: t.analytics_name,
      analytics_description: t.analytics_description,
      marketing_name: t.marketing_name,
      marketing_description: t.marketing_description,
      functional_name: t.functional_name,
      functional_description: t.functional_description
    };
  });

  return {
    ...setting,
    translations: translationsObj
  };
}

/**
 * Create cookie consent settings with translations
 *
 * @param {string} storeId - Store ID
 * @param {Object} settingsData - Cookie consent settings data (without translations)
 * @param {Object} translations - Translations object { en: {...}, nl: {...} }
 * @returns {Promise<Object>} Created cookie consent settings with translations
 */
async function createCookieConsentSettingsWithTranslations(storeId, settingsData, translations = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  try {
    // Insert cookie consent settings
    const { data: settings, error: settingsError } = await tenantDb
      .from('cookie_consent_settings')
      .insert({
        store_id: settingsData.store_id,
        is_enabled: settingsData.is_enabled !== false,
        banner_position: settingsData.banner_position || 'bottom',
        // DEPRECATED: banner_text, accept_button_text, reject_button_text, settings_button_text,
        // privacy_policy_text, translations - use cookie_consent_settings_translations table instead
        privacy_policy_url: settingsData.privacy_policy_url || '',
        necessary_cookies: settingsData.necessary_cookies !== false,
        analytics_cookies: settingsData.analytics_cookies || false,
        marketing_cookies: settingsData.marketing_cookies || false,
        functional_cookies: settingsData.functional_cookies || false,
        theme: settingsData.theme || 'light',
        primary_color: settingsData.primary_color || '#007bff',
        background_color: settingsData.background_color || '#ffffff',
        text_color: settingsData.text_color || '#333333',
        gdpr_mode: settingsData.gdpr_mode !== false,
        auto_detect_country: settingsData.auto_detect_country !== false,
        audit_enabled: settingsData.audit_enabled !== false,
        consent_expiry_days: settingsData.consent_expiry_days || 365,
        show_close_button: settingsData.show_close_button !== false,
        categories: settingsData.categories || {},
        gdpr_countries: settingsData.gdpr_countries || [],
        google_analytics_id: settingsData.google_analytics_id || null,
        google_tag_manager_id: settingsData.google_tag_manager_id || null,
        custom_css: settingsData.custom_css || null,
        accept_button_bg_color: settingsData.accept_button_bg_color || null,
        accept_button_text_color: settingsData.accept_button_text_color || null,
        reject_button_bg_color: settingsData.reject_button_bg_color || null,
        reject_button_text_color: settingsData.reject_button_text_color || null,
        save_preferences_button_bg_color: settingsData.save_preferences_button_bg_color || null,
        save_preferences_button_text_color: settingsData.save_preferences_button_text_color || null
      })
      .select()
      .single();

    if (settingsError) {
      console.error('Error inserting cookie_consent_settings:', settingsError);
      throw settingsError;
    }

    // Insert translations
    console.log('Creating cookie consent translations, received:', JSON.stringify(translations, null, 2));

    for (const [langCode, data] of Object.entries(translations)) {
      console.log(`Processing translation for language: ${langCode}`, data);
      if (data && Object.keys(data).length > 0) {
        const translationData = {
          cookie_consent_settings_id: settings.id,
          language_code: langCode,
          banner_text: data.banner_text || null,
          accept_button_text: data.accept_button_text || null,
          reject_button_text: data.reject_button_text || null,
          settings_button_text: data.settings_button_text || null,
          privacy_policy_text: data.privacy_policy_text || null,
          save_preferences_button_text: data.save_preferences_button_text || null,
          necessary_name: data.necessary_name || null,
          necessary_description: data.necessary_description || null,
          analytics_name: data.analytics_name || null,
          analytics_description: data.analytics_description || null,
          marketing_name: data.marketing_name || null,
          marketing_description: data.marketing_description || null,
          functional_name: data.functional_name || null,
          functional_description: data.functional_description || null
        };

        console.log(`Upserting translation for ${langCode}:`, translationData);

        const { data: upsertResult, error: transError } = await tenantDb
          .from('cookie_consent_settings_translations')
          .upsert(translationData, {
            onConflict: 'cookie_consent_settings_id,language_code'
          })
          .select();

        if (transError) {
          console.error('Error upserting cookie_consent_settings_translation:', transError);
          // Continue with other translations
        } else {
          console.log(`Successfully upserted translation for ${langCode}:`, upsertResult);
        }
      }
    }

    // Return the created settings with translations
    return await getCookieConsentSettingsById(storeId, settings.id, 'en');
  } catch (error) {
    console.error('Error creating cookie consent settings:', error);
    throw error;
  }
}

/**
 * Update cookie consent settings with translations
 *
 * @param {string} storeId - Store ID
 * @param {string} id - Cookie consent settings ID
 * @param {Object} settingsData - Cookie consent settings data (without translations)
 * @param {Object} translations - Translations object { en: {...}, nl: {...} }
 * @returns {Promise<Object>} Updated cookie consent settings with translations
 */
async function updateCookieConsentSettingsWithTranslations(storeId, id, settingsData, translations = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  try {
    // Build update object
    const updateData = {};

    // DEPRECATED: banner_text, accept_button_text, reject_button_text, settings_button_text,
    // privacy_policy_text, translations - use cookie_consent_settings_translations table instead
    const fields = [
      'is_enabled', 'banner_position', 'privacy_policy_url',
      'necessary_cookies', 'analytics_cookies', 'marketing_cookies', 'functional_cookies',
      'theme', 'primary_color', 'background_color', 'text_color',
      'gdpr_mode', 'auto_detect_country', 'audit_enabled', 'consent_expiry_days',
      'show_close_button', 'categories', 'gdpr_countries',
      'google_analytics_id', 'google_tag_manager_id', 'custom_css',
      'accept_button_bg_color', 'accept_button_text_color',
      'reject_button_bg_color', 'reject_button_text_color',
      'save_preferences_button_bg_color', 'save_preferences_button_text_color'
    ];

    fields.forEach(field => {
      if (settingsData[field] !== undefined) {
        updateData[field] = settingsData[field];
      }
    });

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();

      const { error: updateError } = await tenantDb
        .from('cookie_consent_settings')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('Error updating cookie_consent_settings:', updateError);
        throw updateError;
      }
    }

    // Update translations
    console.log('Updating cookie consent translations, received:', JSON.stringify(translations, null, 2));

    for (const [langCode, data] of Object.entries(translations)) {
      console.log(`Processing update for language: ${langCode}`, data);
      if (data && Object.keys(data).length > 0) {
        const translationData = {
          cookie_consent_settings_id: id,
          language_code: langCode,
          banner_text: data.banner_text || null,
          accept_button_text: data.accept_button_text || null,
          reject_button_text: data.reject_button_text || null,
          settings_button_text: data.settings_button_text || null,
          privacy_policy_text: data.privacy_policy_text || null,
          save_preferences_button_text: data.save_preferences_button_text || null,
          necessary_name: data.necessary_name || null,
          necessary_description: data.necessary_description || null,
          analytics_name: data.analytics_name || null,
          analytics_description: data.analytics_description || null,
          marketing_name: data.marketing_name || null,
          marketing_description: data.marketing_description || null,
          functional_name: data.functional_name || null,
          functional_description: data.functional_description || null,
          updated_at: new Date().toISOString()
        };

        console.log(`Upserting translation update for ${langCode}:`, translationData);

        const { data: upsertResult, error: transError } = await tenantDb
          .from('cookie_consent_settings_translations')
          .upsert(translationData, {
            onConflict: 'cookie_consent_settings_id,language_code'
          })
          .select();

        if (transError) {
          console.error('Error upserting cookie_consent_settings_translation:', transError);
          // Continue with other translations
        } else {
          console.log(`Successfully upserted translation update for ${langCode}:`, upsertResult);
        }
      }
    }

    // Return the updated settings with translations
    return await getCookieConsentSettingsById(storeId, id, 'en');
  } catch (error) {
    console.error('Error updating cookie consent settings:', error);
    throw error;
  }
}

/**
 * Delete cookie consent settings (translations are CASCADE deleted)
 *
 * @param {string} storeId - Store ID
 * @param {string} id - Cookie consent settings ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteCookieConsentSettings(storeId, id) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  const { error } = await tenantDb
    .from('cookie_consent_settings')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting cookie_consent_settings:', error);
    throw error;
  }

  return true;
}

module.exports = {
  getCookieConsentSettingsWithTranslations,
  getCookieConsentSettingsById,
  createCookieConsentSettingsWithTranslations,
  updateCookieConsentSettingsWithTranslations,
  deleteCookieConsentSettings
};
