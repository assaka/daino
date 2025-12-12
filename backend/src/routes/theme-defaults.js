const express = require('express');
const { masterDbClient } = require('../database/masterConnection');

const router = express.Router();

/**
 * @route   GET /api/public/theme-defaults
 * @desc    Get system default theme settings
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { data: defaults, error } = await masterDbClient
      .from('theme_defaults')
      .select('preset_name, display_name, theme_settings')
      .eq('is_system_default', true)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching theme defaults:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch theme defaults'
      });
    }

    if (!defaults) {
      // Return empty - frontend will use hardcoded fallbacks
      return res.json({
        success: true,
        data: null,
        message: 'No theme defaults configured'
      });
    }

    // Set cache headers (theme defaults rarely change)
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour

    res.json({
      success: true,
      data: {
        preset_name: defaults.preset_name,
        display_name: defaults.display_name,
        theme: defaults.theme_settings
      }
    });
  } catch (error) {
    console.error('Error fetching theme defaults:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch theme defaults'
    });
  }
});

/**
 * @route   GET /api/public/theme-defaults/presets
 * @desc    Get all available theme presets
 * @access  Public
 */
router.get('/presets', async (req, res) => {
  try {
    const { data: presets, error } = await masterDbClient
      .from('theme_defaults')
      .select('id, preset_name, display_name, description, theme_settings, is_system_default')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching theme presets:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch theme presets'
      });
    }

    // Set cache headers
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour

    res.json({
      success: true,
      data: presets || []
    });
  } catch (error) {
    console.error('Error fetching theme presets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch theme presets'
    });
  }
});

/**
 * @route   GET /api/public/theme-defaults/preset/:presetName
 * @desc    Get a specific theme preset by name
 * @access  Public
 */
router.get('/preset/:presetName', async (req, res) => {
  try {
    const { presetName } = req.params;

    const { data: preset, error } = await masterDbClient
      .from('theme_defaults')
      .select('id, preset_name, display_name, description, theme_settings')
      .eq('preset_name', presetName)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching theme preset:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch theme preset'
      });
    }

    if (!preset) {
      return res.status(404).json({
        success: false,
        message: `Theme preset '${presetName}' not found`
      });
    }

    // Set cache headers
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour

    res.json({
      success: true,
      data: {
        ...preset,
        theme: preset.theme_settings
      }
    });
  } catch (error) {
    console.error('Error fetching theme preset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch theme preset'
    });
  }
});

module.exports = router;
