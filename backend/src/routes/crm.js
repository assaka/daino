/**
 * CRM Routes - Pipelines, Deals, Leads, Activities
 *
 * All endpoints require authentication via storeOwnerOnly middleware.
 * Endpoints are tenant-isolated via store_id.
 */

const express = require('express');
const router = express.Router();
const { storeOwnerOnly } = require('../middleware/auth');
const CrmPipeline = require('../models/CrmPipeline');
const CrmDeal = require('../models/CrmDeal');
const CrmLead = require('../models/CrmLead');
const CrmActivity = require('../models/CrmActivity');

// ============================================
// PIPELINES
// ============================================

/**
 * GET /api/crm/pipelines
 * List all pipelines for a store
 */
router.get('/pipelines', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id, active_only } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const options = {};
    if (active_only === 'true') {
      options.isActive = true;
    }

    const pipelines = await CrmPipeline.findAll(store_id, options);

    // Transform stages for frontend
    const transformed = pipelines.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      is_default: p.is_default,
      is_active: p.is_active,
      stages: (p.crm_pipeline_stages || [])
        .sort((a, b) => a.order_position - b.order_position)
        .map(s => ({
          id: s.id,
          name: s.name,
          color: s.color,
          order: s.order_position,
          is_won: s.is_won,
          is_lost: s.is_lost
        })),
      created_at: p.created_at
    }));

    res.json({ pipelines: transformed });
  } catch (error) {
    console.error('Error listing pipelines:', error);
    res.status(500).json({ error: 'Failed to list pipelines' });
  }
});

/**
 * GET /api/crm/pipelines/:id
 * Get a single pipeline with stages
 */
router.get('/pipelines/:id', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const pipeline = await CrmPipeline.findById(store_id, id);

    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    res.json({
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description,
        is_default: pipeline.is_default,
        is_active: pipeline.is_active,
        stages: (pipeline.crm_pipeline_stages || [])
          .sort((a, b) => a.order_position - b.order_position)
          .map(s => ({
            id: s.id,
            name: s.name,
            color: s.color,
            order: s.order_position,
            is_won: s.is_won,
            is_lost: s.is_lost
          }))
      }
    });
  } catch (error) {
    console.error('Error getting pipeline:', error);
    res.status(500).json({ error: 'Failed to get pipeline' });
  }
});

/**
 * POST /api/crm/pipelines
 * Create a new pipeline with stages
 */
router.post('/pipelines', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { name, description, stages } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Pipeline name is required' });
    }

    // Create pipeline
    const pipeline = await CrmPipeline.create(store_id, {
      name,
      description,
      isDefault: false,
      isActive: true
    });

    // Create stages if provided
    const createdStages = [];
    if (stages && stages.length > 0) {
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const createdStage = await CrmPipeline.createStage(store_id, pipeline.id, {
          name: stage.name,
          color: stage.color || '#6366f1',
          orderPosition: i,
          isWon: stage.is_won || false,
          isLost: stage.is_lost || false
        });
        createdStages.push({
          id: createdStage.id,
          name: createdStage.name,
          color: createdStage.color,
          order: createdStage.order_position,
          is_won: createdStage.is_won,
          is_lost: createdStage.is_lost
        });
      }
    }

    res.status(201).json({
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description,
        is_default: pipeline.is_default,
        is_active: pipeline.is_active,
        stages: createdStages
      }
    });
  } catch (error) {
    console.error('Error creating pipeline:', error);
    res.status(500).json({ error: 'Failed to create pipeline' });
  }
});

/**
 * PUT /api/crm/pipelines/:id
 * Update a pipeline and its stages
 */
router.put('/pipelines/:id', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;
    const { name, description, stages, is_active } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    // Update pipeline
    const pipeline = await CrmPipeline.update(store_id, id, {
      name,
      description,
      isActive: is_active
    });

    // Update stages if provided
    if (stages && stages.length > 0) {
      // Get existing stages
      const existing = await CrmPipeline.findById(store_id, id);
      const existingStageIds = (existing?.crm_pipeline_stages || []).map(s => s.id);

      // Process each stage
      const updatedStages = [];
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];

        if (stage.id && existingStageIds.includes(stage.id)) {
          // Update existing stage
          const updated = await CrmPipeline.updateStage(store_id, stage.id, {
            name: stage.name,
            color: stage.color,
            orderPosition: i,
            isWon: stage.is_won || false,
            isLost: stage.is_lost || false
          });
          updatedStages.push({
            id: updated.id,
            name: updated.name,
            color: updated.color,
            order: updated.order_position,
            is_won: updated.is_won,
            is_lost: updated.is_lost
          });
        } else {
          // Create new stage
          const created = await CrmPipeline.createStage(store_id, id, {
            name: stage.name,
            color: stage.color || '#6366f1',
            orderPosition: i,
            isWon: stage.is_won || false,
            isLost: stage.is_lost || false
          });
          updatedStages.push({
            id: created.id,
            name: created.name,
            color: created.color,
            order: created.order_position,
            is_won: created.is_won,
            is_lost: created.is_lost
          });
        }
      }

      // Delete stages that are no longer in the list
      const newStageIds = stages.filter(s => s.id).map(s => s.id);
      for (const existingId of existingStageIds) {
        if (!newStageIds.includes(existingId)) {
          await CrmPipeline.deleteStage(store_id, existingId);
        }
      }

      res.json({
        pipeline: {
          id: pipeline.id,
          name: pipeline.name,
          description: pipeline.description,
          is_default: pipeline.is_default,
          is_active: pipeline.is_active,
          stages: updatedStages
        }
      });
    } else {
      const updatedPipeline = await CrmPipeline.findById(store_id, id);
      res.json({
        pipeline: {
          id: updatedPipeline.id,
          name: updatedPipeline.name,
          description: updatedPipeline.description,
          is_default: updatedPipeline.is_default,
          is_active: updatedPipeline.is_active,
          stages: (updatedPipeline.crm_pipeline_stages || [])
            .sort((a, b) => a.order_position - b.order_position)
            .map(s => ({
              id: s.id,
              name: s.name,
              color: s.color,
              order: s.order_position,
              is_won: s.is_won,
              is_lost: s.is_lost
            }))
        }
      });
    }
  } catch (error) {
    console.error('Error updating pipeline:', error);
    res.status(500).json({ error: 'Failed to update pipeline' });
  }
});

/**
 * DELETE /api/crm/pipelines/:id
 * Delete a pipeline and all its stages
 */
router.delete('/pipelines/:id', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    await CrmPipeline.delete(store_id, id);

    res.json({ success: true, message: 'Pipeline deleted successfully' });
  } catch (error) {
    console.error('Error deleting pipeline:', error);
    res.status(500).json({ error: 'Failed to delete pipeline' });
  }
});

/**
 * POST /api/crm/pipelines/:id/set-default
 * Set a pipeline as the default
 */
router.post('/pipelines/:id/set-default', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    await CrmPipeline.setDefault(store_id, id);

    res.json({ success: true, message: 'Pipeline set as default' });
  } catch (error) {
    console.error('Error setting default pipeline:', error);
    res.status(500).json({ error: 'Failed to set default pipeline' });
  }
});

// ============================================
// DEALS
// ============================================

/**
 * GET /api/crm/deals
 * List all deals for a store
 */
router.get('/deals', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id, pipeline_id, stage_id, status, limit } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const options = {};
    if (pipeline_id) options.pipelineId = pipeline_id;
    if (stage_id) options.stageId = stage_id;
    if (status) options.status = status;
    if (limit) options.limit = parseInt(limit);

    const deals = await CrmDeal.findAll(store_id, options);

    // Transform for frontend
    const transformed = deals.map(d => ({
      id: d.id,
      name: d.name,
      value: d.value,
      currency: d.currency,
      probability: d.probability,
      expected_close_date: d.expected_close_date,
      status: d.status,
      source: d.source,
      notes: d.notes,
      pipeline_id: d.pipeline_id,
      stage_id: d.stage_id,
      pipeline: d.crm_pipelines,
      stage: d.crm_pipeline_stages,
      customer: d.customers,
      lead: d.crm_leads,
      created_at: d.created_at
    }));

    res.json({ deals: transformed });
  } catch (error) {
    console.error('Error listing deals:', error);
    res.status(500).json({ error: 'Failed to list deals' });
  }
});

/**
 * GET /api/crm/deals/pipeline/:pipelineId
 * Get deals grouped by stage for Kanban view
 */
router.get('/deals/pipeline/:pipelineId', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { pipelineId } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const result = await CrmDeal.getByStages(store_id, pipelineId);

    res.json({
      stages: result.stages,
      deals_by_stage: result.dealsByStage
    });
  } catch (error) {
    console.error('Error getting deals by pipeline:', error);
    res.status(500).json({ error: 'Failed to get deals' });
  }
});

/**
 * GET /api/crm/deals/stats
 * Get deal statistics
 */
router.get('/deals/stats', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id, pipeline_id } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const options = {};
    if (pipeline_id) options.pipelineId = pipeline_id;

    const stats = await CrmDeal.getStatistics(store_id, options);

    res.json({ stats });
  } catch (error) {
    console.error('Error getting deal stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * GET /api/crm/deals/:id
 * Get a single deal
 */
router.get('/deals/:id', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const deal = await CrmDeal.findById(store_id, id);

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    res.json({
      deal: {
        id: deal.id,
        name: deal.name,
        value: deal.value,
        currency: deal.currency,
        probability: deal.probability,
        expected_close_date: deal.expected_close_date,
        status: deal.status,
        source: deal.source,
        notes: deal.notes,
        custom_fields: deal.custom_fields,
        pipeline_id: deal.pipeline_id,
        stage_id: deal.stage_id,
        pipeline: deal.crm_pipelines,
        stage: deal.crm_pipeline_stages,
        customer: deal.customers,
        lead: deal.crm_leads,
        created_at: deal.created_at
      }
    });
  } catch (error) {
    console.error('Error getting deal:', error);
    res.status(500).json({ error: 'Failed to get deal' });
  }
});

/**
 * POST /api/crm/deals
 * Create a new deal
 */
router.post('/deals', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const {
      name, value, currency, probability, expected_close_date,
      pipeline_id, stage_id, customer_id, lead_id, source, notes, custom_fields
    } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Deal name is required' });
    }

    if (!pipeline_id || !stage_id) {
      return res.status(400).json({ error: 'Pipeline and stage are required' });
    }

    const deal = await CrmDeal.create(store_id, {
      name,
      value: value || 0,
      currency: currency || 'EUR',
      probability: probability || 0,
      expectedCloseDate: expected_close_date,
      pipelineId: pipeline_id,
      stageId: stage_id,
      customerId: customer_id,
      leadId: lead_id,
      source,
      notes,
      customFields: custom_fields
    });

    res.status(201).json({ deal });
  } catch (error) {
    console.error('Error creating deal:', error);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

/**
 * PUT /api/crm/deals/:id
 * Update a deal
 */
router.put('/deals/:id', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;
    const updates = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    // Map frontend fields to backend
    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.value !== undefined) updateData.value = updates.value;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.probability !== undefined) updateData.probability = updates.probability;
    if (updates.expected_close_date !== undefined) updateData.expectedCloseDate = updates.expected_close_date;
    if (updates.pipeline_id !== undefined) updateData.pipelineId = updates.pipeline_id;
    if (updates.stage_id !== undefined) updateData.stageId = updates.stage_id;
    if (updates.customer_id !== undefined) updateData.customerId = updates.customer_id;
    if (updates.lead_id !== undefined) updateData.leadId = updates.lead_id;
    if (updates.source !== undefined) updateData.source = updates.source;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.custom_fields !== undefined) updateData.customFields = updates.custom_fields;

    const deal = await CrmDeal.update(store_id, id, updateData);

    res.json({ deal });
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

/**
 * PUT /api/crm/deals/:id/stage
 * Move a deal to a different stage
 */
router.put('/deals/:id/stage', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;
    const { stage_id } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    if (!stage_id) {
      return res.status(400).json({ error: 'stage_id is required' });
    }

    const deal = await CrmDeal.moveToStage(store_id, id, stage_id);

    res.json({ deal });
  } catch (error) {
    console.error('Error moving deal:', error);
    res.status(500).json({ error: 'Failed to move deal' });
  }
});

/**
 * DELETE /api/crm/deals/:id
 * Delete a deal
 */
router.delete('/deals/:id', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    await CrmDeal.delete(store_id, id);

    res.json({ success: true, message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

// ============================================
// LEADS
// ============================================

/**
 * GET /api/crm/leads
 * List all leads for a store
 */
router.get('/leads', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id, status, source, min_score, limit, offset } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const options = {};
    if (status) options.status = status;
    if (source) options.source = source;
    if (min_score) options.minScore = parseInt(min_score);
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);

    const leads = await CrmLead.findAll(store_id, options);

    res.json({ leads });
  } catch (error) {
    console.error('Error listing leads:', error);
    res.status(500).json({ error: 'Failed to list leads' });
  }
});

/**
 * GET /api/crm/leads/stats
 * Get lead statistics
 */
router.get('/leads/stats', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const stats = await CrmLead.getStatistics(store_id);

    res.json({ stats });
  } catch (error) {
    console.error('Error getting lead stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * GET /api/crm/leads/:id
 * Get a single lead
 */
router.get('/leads/:id', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const lead = await CrmLead.findById(store_id, id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ lead });
  } catch (error) {
    console.error('Error getting lead:', error);
    res.status(500).json({ error: 'Failed to get lead' });
  }
});

/**
 * POST /api/crm/leads
 * Create a new lead
 */
router.post('/leads', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const {
      email, first_name, last_name, company, phone, website,
      source, status, score, notes, custom_fields, tags
    } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check for existing lead with same email
    const existing = await CrmLead.findByEmail(store_id, email);
    if (existing) {
      return res.status(409).json({ error: 'A lead with this email already exists' });
    }

    const lead = await CrmLead.create(store_id, {
      email,
      firstName: first_name,
      lastName: last_name,
      company,
      phone,
      website,
      source,
      status: status || 'new',
      score: score || 0,
      notes,
      customFields: custom_fields,
      tags
    });

    res.status(201).json({ lead });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

/**
 * PUT /api/crm/leads/:id
 * Update a lead
 */
router.put('/leads/:id', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;
    const updates = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    // Map frontend fields to backend
    const updateData = {};
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.first_name !== undefined) updateData.firstName = updates.first_name;
    if (updates.last_name !== undefined) updateData.lastName = updates.last_name;
    if (updates.company !== undefined) updateData.company = updates.company;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.website !== undefined) updateData.website = updates.website;
    if (updates.source !== undefined) updateData.source = updates.source;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.score !== undefined) updateData.score = updates.score;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.custom_fields !== undefined) updateData.customFields = updates.custom_fields;
    if (updates.tags !== undefined) updateData.tags = updates.tags;

    const lead = await CrmLead.update(store_id, id, updateData);

    res.json({ lead });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

/**
 * PUT /api/crm/leads/:id/status
 * Update lead status
 */
router.put('/leads/:id/status', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;
    const { status } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const lead = await CrmLead.updateStatus(store_id, id, status);

    res.json({ lead });
  } catch (error) {
    console.error('Error updating lead status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

/**
 * POST /api/crm/leads/:id/convert
 * Convert a lead to a customer (and optionally create a deal)
 */
router.post('/leads/:id/convert', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;
    const { create_deal, deal_name, deal_value, pipeline_id, stage_id } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    // Convert lead to customer
    const result = await CrmLead.convertToCustomer(store_id, id);

    // Optionally create a deal
    let deal = null;
    if (create_deal && pipeline_id && stage_id) {
      deal = await CrmDeal.create(store_id, {
        name: deal_name || `Deal from lead ${id}`,
        value: deal_value || 0,
        pipelineId: pipeline_id,
        stageId: stage_id,
        customerId: result.customerId,
        leadId: id
      });
    }

    res.json({
      success: true,
      lead_id: result.leadId,
      customer_id: result.customerId,
      deal: deal
    });
  } catch (error) {
    console.error('Error converting lead:', error);
    res.status(500).json({ error: 'Failed to convert lead' });
  }
});

/**
 * DELETE /api/crm/leads/:id
 * Delete a lead
 */
router.delete('/leads/:id', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    await CrmLead.delete(store_id, id);

    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

/**
 * POST /api/crm/leads/bulk
 * Bulk import leads
 */
router.post('/leads/bulk', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { leads } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'leads array is required' });
    }

    const createdLeads = await CrmLead.bulkCreate(store_id, leads);

    res.status(201).json({
      success: true,
      count: createdLeads.length,
      leads: createdLeads
    });
  } catch (error) {
    console.error('Error bulk importing leads:', error);
    res.status(500).json({ error: 'Failed to import leads' });
  }
});

// ============================================
// ACTIVITIES
// ============================================

/**
 * GET /api/crm/activities
 * List all activities for a store
 */
router.get('/activities', storeOwnerOnly, async (req, res) => {
  try {
    const {
      store_id, deal_id, lead_id, customer_id,
      activity_type, is_completed, limit, offset
    } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const options = {};
    if (deal_id) options.dealId = deal_id;
    if (lead_id) options.leadId = lead_id;
    if (customer_id) options.customerId = customer_id;
    if (activity_type) options.activityType = activity_type;
    if (is_completed !== undefined) options.isCompleted = is_completed === 'true';
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);

    const activities = await CrmActivity.findAll(store_id, options);

    // Transform for frontend
    const transformed = activities.map(a => ({
      id: a.id,
      activity_type: a.activity_type,
      subject: a.subject,
      description: a.description,
      due_date: a.due_date,
      is_completed: a.is_completed,
      completed_at: a.completed_at,
      metadata: a.metadata,
      deal_id: a.deal_id,
      lead_id: a.lead_id,
      customer_id: a.customer_id,
      deal: a.crm_deals,
      lead: a.crm_leads,
      customer: a.customers,
      created_at: a.created_at
    }));

    res.json({ activities: transformed });
  } catch (error) {
    console.error('Error listing activities:', error);
    res.status(500).json({ error: 'Failed to list activities' });
  }
});

/**
 * GET /api/crm/activities/upcoming
 * Get upcoming activities
 */
router.get('/activities/upcoming', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id, days_ahead, limit } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const options = {};
    if (days_ahead) options.daysAhead = parseInt(days_ahead);
    if (limit) options.limit = parseInt(limit);

    const activities = await CrmActivity.getUpcoming(store_id, options);

    res.json({ activities });
  } catch (error) {
    console.error('Error getting upcoming activities:', error);
    res.status(500).json({ error: 'Failed to get activities' });
  }
});

/**
 * GET /api/crm/activities/overdue
 * Get overdue activities
 */
router.get('/activities/overdue', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id, limit } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const options = {};
    if (limit) options.limit = parseInt(limit);

    const activities = await CrmActivity.getOverdue(store_id, options);

    res.json({ activities });
  } catch (error) {
    console.error('Error getting overdue activities:', error);
    res.status(500).json({ error: 'Failed to get activities' });
  }
});

/**
 * GET /api/crm/activities/stats
 * Get activity statistics
 */
router.get('/activities/stats', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const stats = await CrmActivity.getStatistics(store_id);

    res.json({ stats });
  } catch (error) {
    console.error('Error getting activity stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * GET /api/crm/activities/:id
 * Get a single activity
 */
router.get('/activities/:id', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const activity = await CrmActivity.findById(store_id, id);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json({ activity });
  } catch (error) {
    console.error('Error getting activity:', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

/**
 * POST /api/crm/activities
 * Create a new activity
 */
router.post('/activities', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const {
      activity_type, subject, description, due_date,
      deal_id, lead_id, customer_id, metadata
    } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    if (!activity_type) {
      return res.status(400).json({ error: 'activity_type is required' });
    }

    if (!subject) {
      return res.status(400).json({ error: 'subject is required' });
    }

    const activity = await CrmActivity.create(store_id, {
      activityType: activity_type,
      subject,
      description,
      dueDate: due_date,
      dealId: deal_id,
      leadId: lead_id,
      customerId: customer_id,
      metadata
    });

    res.status(201).json({ activity });
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

/**
 * PUT /api/crm/activities/:id
 * Update an activity
 */
router.put('/activities/:id', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;
    const updates = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    // Map frontend fields to backend
    const updateData = {};
    if (updates.activity_type !== undefined) updateData.activityType = updates.activity_type;
    if (updates.subject !== undefined) updateData.subject = updates.subject;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.due_date !== undefined) updateData.dueDate = updates.due_date;
    if (updates.is_completed !== undefined) updateData.isCompleted = updates.is_completed;
    if (updates.deal_id !== undefined) updateData.dealId = updates.deal_id;
    if (updates.lead_id !== undefined) updateData.leadId = updates.lead_id;
    if (updates.customer_id !== undefined) updateData.customerId = updates.customer_id;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    const activity = await CrmActivity.update(store_id, id, updateData);

    res.json({ activity });
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

/**
 * POST /api/crm/activities/:id/complete
 * Mark an activity as complete
 */
router.post('/activities/:id/complete', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const activity = await CrmActivity.markComplete(store_id, id);

    res.json({ activity });
  } catch (error) {
    console.error('Error completing activity:', error);
    res.status(500).json({ error: 'Failed to complete activity' });
  }
});

/**
 * POST /api/crm/activities/:id/incomplete
 * Mark an activity as incomplete
 */
router.post('/activities/:id/incomplete', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const activity = await CrmActivity.markIncomplete(store_id, id);

    res.json({ activity });
  } catch (error) {
    console.error('Error marking activity incomplete:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

/**
 * DELETE /api/crm/activities/:id
 * Delete an activity
 */
router.delete('/activities/:id', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { id } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    await CrmActivity.delete(store_id, id);

    res.json({ success: true, message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

// ============================================
// DASHBOARD
// ============================================

/**
 * GET /api/crm/dashboard
 * Get CRM dashboard data
 */
router.get('/dashboard', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    // Get all stats in parallel
    const [dealStats, leadStats, activityStats, recentDeals, recentLeads] = await Promise.all([
      CrmDeal.getStatistics(store_id),
      CrmLead.getStatistics(store_id),
      CrmActivity.getStatistics(store_id),
      CrmDeal.findAll(store_id, { limit: 5 }),
      CrmLead.findAll(store_id, { limit: 5 })
    ]);

    res.json({
      deals: dealStats,
      leads: leadStats,
      activities: activityStats,
      recent_deals: recentDeals,
      recent_leads: recentLeads
    });
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

module.exports = router;
