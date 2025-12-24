/**
 * Automations API Routes
 *
 * Manages marketing automation workflows.
 */

const express = require('express');
const router = express.Router();
const AutomationService = require('../services/automation-service');
const AutomationWorkflow = require('../models/AutomationWorkflow');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/auth');

/**
 * GET /api/automations
 * List all automation workflows
 */
router.get('/', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const options = {
      status: req.query.status,
      isActive: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      triggerType: req.query.trigger_type,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    const workflows = await AutomationService.getAllWorkflows(storeId, options);

    res.json({ success: true, workflows });
  } catch (error) {
    console.error('[Automations] Error listing workflows:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/automations/triggers
 * Get available trigger types
 */
router.get('/triggers', authMiddleware, authorize(['admin', 'store_owner']), (req, res) => {
  try {
    const triggers = Object.entries(AutomationService.TRIGGER_TYPES).map(([key, value]) => ({
      id: value,
      name: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
      value
    }));

    res.json({ success: true, triggers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/automations/steps
 * Get available step types
 */
router.get('/steps', authMiddleware, authorize(['admin', 'store_owner']), (req, res) => {
  try {
    const steps = Object.entries(AutomationService.STEP_TYPES).map(([key, value]) => ({
      id: value,
      name: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
      value,
      category: ['delay', 'condition', 'split', 'wait_for_event', 'exit'].includes(value) ? 'flow' : 'action'
    }));

    res.json({ success: true, steps });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/automations/templates
 * Get workflow templates
 */
router.get('/templates', authMiddleware, authorize(['admin', 'store_owner']), (req, res) => {
  try {
    const templates = AutomationService.getWorkflowTemplates();
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/automations/:id
 * Get workflow by ID
 */
router.get('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const workflow = await AutomationService.getWorkflow(storeId, req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    res.json({ success: true, workflow });
  } catch (error) {
    console.error('[Automations] Error getting workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/automations
 * Create a new workflow
 */
router.post('/', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const { name, description, triggerType, triggerConfig, steps } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }

    if (!triggerType) {
      return res.status(400).json({ success: false, error: 'triggerType is required' });
    }

    const workflow = await AutomationService.createWorkflow(storeId, {
      name,
      description,
      triggerType,
      triggerConfig: triggerConfig || {},
      steps: steps || []
    });

    res.status(201).json({ success: true, workflow });
  } catch (error) {
    console.error('[Automations] Error creating workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/automations/from-template
 * Create workflow from template
 */
router.post('/from-template', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const { templateId, name } = req.body;

    if (!templateId) {
      return res.status(400).json({ success: false, error: 'templateId is required' });
    }

    const templates = AutomationService.getWorkflowTemplates();
    const template = templates.find(t => t.id === templateId);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const workflow = await AutomationService.createWorkflow(storeId, {
      name: name || template.name,
      description: template.description,
      triggerType: template.triggerType,
      triggerConfig: template.triggerConfig || {},
      steps: template.steps
    });

    res.status(201).json({ success: true, workflow });
  } catch (error) {
    console.error('[Automations] Error creating from template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/automations/:id
 * Update a workflow
 */
router.put('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const { name, description, triggerType, triggerConfig, steps } = req.body;

    const workflow = await AutomationService.updateWorkflow(storeId, req.params.id, {
      name,
      description,
      triggerType,
      triggerConfig,
      steps
    });

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    res.json({ success: true, workflow });
  } catch (error) {
    console.error('[Automations] Error updating workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/automations/:id
 * Delete a workflow
 */
router.delete('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    await AutomationService.deleteWorkflow(storeId, req.params.id);

    res.json({ success: true, message: 'Workflow deleted successfully' });
  } catch (error) {
    console.error('[Automations] Error deleting workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/automations/:id/activate
 * Activate a workflow
 */
router.post('/:id/activate', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const workflow = await AutomationService.activateWorkflow(storeId, req.params.id);

    res.json({ success: true, workflow });
  } catch (error) {
    console.error('[Automations] Error activating workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/automations/:id/pause
 * Pause a workflow
 */
router.post('/:id/pause', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const workflow = await AutomationService.pauseWorkflow(storeId, req.params.id);

    res.json({ success: true, workflow });
  } catch (error) {
    console.error('[Automations] Error pausing workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/automations/:id/stats
 * Get workflow statistics
 */
router.get('/:id/stats', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const workflow = await AutomationService.getWorkflow(storeId, req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    res.json({
      success: true,
      stats: {
        totalEnrolled: workflow.total_enrolled || 0,
        totalCompleted: workflow.total_completed || 0,
        totalExited: workflow.total_exited || 0,
        status: workflow.status,
        isActive: workflow.is_active
      }
    });
  } catch (error) {
    console.error('[Automations] Error getting stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/automations/:id/logs
 * Get workflow execution logs
 */
router.get('/:id/logs', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const options = {
      status: req.query.status,
      limit: req.query.limit ? parseInt(req.query.limit) : 50
    };

    const logs = await AutomationWorkflow.getLogs(storeId, req.params.id, options);

    res.json({ success: true, logs });
  } catch (error) {
    console.error('[Automations] Error getting logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/automations/:id/enroll
 * Manually enroll a customer in a workflow
 */
router.post('/:id/enroll', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const { customerId, triggerData } = req.body;

    if (!customerId) {
      return res.status(400).json({ success: false, error: 'customerId is required' });
    }

    const enrollment = await AutomationService.enrollCustomer(
      storeId,
      req.params.id,
      customerId,
      triggerData || {}
    );

    res.json({ success: true, enrollment });
  } catch (error) {
    console.error('[Automations] Error enrolling customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/automations/trigger
 * Trigger automation workflows (internal/webhook use)
 */
router.post('/trigger', authMiddleware, authorize(['admin', 'store_owner', 'system']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const { triggerType, triggerData } = req.body;

    if (!triggerType) {
      return res.status(400).json({ success: false, error: 'triggerType is required' });
    }

    const result = await AutomationService.handleTrigger(storeId, triggerType, triggerData || {});

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Automations] Error triggering:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
