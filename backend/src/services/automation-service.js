/**
 * Automation Service
 *
 * Workflow engine for marketing automations.
 * Handles triggers, enrollments, and step execution.
 */

const AutomationWorkflow = require('../models/AutomationWorkflow');
const EmailUnsubscribe = require('../models/EmailUnsubscribe');
const ConnectionManager = require('./database/ConnectionManager');

class AutomationService {
  /**
   * Trigger types supported by the automation engine
   */
  static TRIGGER_TYPES = {
    // Customer lifecycle
    CUSTOMER_CREATED: 'customer_created',
    CUSTOMER_FIRST_ORDER: 'customer_first_order',
    CUSTOMER_ORDER: 'customer_order',

    // E-commerce events
    ABANDONED_CART: 'abandoned_cart',
    ORDER_PLACED: 'order_placed',
    ORDER_SHIPPED: 'order_shipped',
    ORDER_DELIVERED: 'order_delivered',

    // Engagement
    FORM_SUBMITTED: 'form_submitted',
    EMAIL_OPENED: 'email_opened',
    EMAIL_CLICKED: 'email_clicked',

    // Time-based
    DATE_TRIGGER: 'date_trigger',
    RECURRING: 'recurring',

    // Segment-based
    ENTERED_SEGMENT: 'entered_segment',
    LEFT_SEGMENT: 'left_segment',

    // Manual
    MANUAL: 'manual'
  };

  /**
   * Step types available in workflows
   */
  static STEP_TYPES = {
    // Actions
    SEND_EMAIL: 'send_email',
    SEND_SMS: 'send_sms',
    ADD_TAG: 'add_tag',
    REMOVE_TAG: 'remove_tag',
    UPDATE_FIELD: 'update_field',
    ADD_TO_SEGMENT: 'add_to_segment',
    REMOVE_FROM_SEGMENT: 'remove_from_segment',
    WEBHOOK: 'webhook',
    INTERNAL_NOTIFICATION: 'internal_notification',

    // Flow control
    DELAY: 'delay',
    CONDITION: 'condition',
    SPLIT: 'split',
    WAIT_FOR_EVENT: 'wait_for_event',
    EXIT: 'exit'
  };

  /**
   * Create a new workflow
   */
  static async createWorkflow(storeId, workflowData) {
    return await AutomationWorkflow.create(storeId, workflowData);
  }

  /**
   * Update a workflow
   */
  static async updateWorkflow(storeId, workflowId, updateData) {
    return await AutomationWorkflow.update(storeId, workflowId, updateData);
  }

  /**
   * Get workflow by ID
   */
  static async getWorkflow(storeId, workflowId) {
    return await AutomationWorkflow.findById(storeId, workflowId);
  }

  /**
   * Get all workflows
   */
  static async getAllWorkflows(storeId, options = {}) {
    return await AutomationWorkflow.findAll(storeId, options);
  }

  /**
   * Delete a workflow
   */
  static async deleteWorkflow(storeId, workflowId) {
    return await AutomationWorkflow.delete(storeId, workflowId);
  }

  /**
   * Activate a workflow
   */
  static async activateWorkflow(storeId, workflowId) {
    const workflow = await AutomationWorkflow.findById(storeId, workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Validate workflow has at least one step
    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    return await AutomationWorkflow.activate(storeId, workflowId);
  }

  /**
   * Pause a workflow
   */
  static async pauseWorkflow(storeId, workflowId) {
    return await AutomationWorkflow.pause(storeId, workflowId);
  }

  /**
   * Handle trigger event - check if any workflow should be triggered
   */
  static async handleTrigger(storeId, triggerType, triggerData) {
    console.log(`[AutomationService] Handling trigger: ${triggerType}`, triggerData);

    // Get active workflows for this trigger type
    const workflows = await AutomationWorkflow.getActiveByTrigger(storeId, triggerType);

    if (workflows.length === 0) {
      console.log(`[AutomationService] No active workflows for trigger: ${triggerType}`);
      return { enrolled: 0 };
    }

    let enrolledCount = 0;

    for (const workflow of workflows) {
      try {
        // Check trigger conditions
        if (!this.checkTriggerConditions(workflow.trigger_config, triggerData)) {
          continue;
        }

        // Check if customer can be enrolled
        const customerId = triggerData.customerId;
        if (!customerId) {
          console.warn('[AutomationService] No customerId in trigger data');
          continue;
        }

        // Check if customer is already enrolled
        const isEnrolled = await this.isCustomerEnrolled(storeId, workflow.id, customerId);
        if (isEnrolled && !workflow.trigger_config?.allowReEnrollment) {
          console.log(`[AutomationService] Customer ${customerId} already enrolled in workflow ${workflow.id}`);
          continue;
        }

        // Check unsubscribe status
        const email = triggerData.email;
        if (email) {
          const isUnsubscribed = await EmailUnsubscribe.isUnsubscribed(storeId, email);
          if (isUnsubscribed) {
            console.log(`[AutomationService] Customer ${email} is unsubscribed, skipping enrollment`);
            continue;
          }
        }

        // Enroll customer
        await this.enrollCustomer(storeId, workflow.id, customerId, triggerData);
        enrolledCount++;

        console.log(`[AutomationService] Enrolled customer ${customerId} in workflow ${workflow.name}`);
      } catch (error) {
        console.error(`[AutomationService] Error processing workflow ${workflow.id}:`, error);
      }
    }

    return { enrolled: enrolledCount };
  }

  /**
   * Check trigger conditions
   */
  static checkTriggerConditions(triggerConfig, triggerData) {
    if (!triggerConfig || !triggerConfig.conditions) {
      return true; // No conditions = always trigger
    }

    for (const condition of triggerConfig.conditions) {
      const value = triggerData[condition.field];

      switch (condition.operator) {
        case 'equals':
          if (value !== condition.value) return false;
          break;
        case 'not_equals':
          if (value === condition.value) return false;
          break;
        case 'contains':
          if (!String(value).includes(condition.value)) return false;
          break;
        case 'greater_than':
          if (value <= condition.value) return false;
          break;
        case 'less_than':
          if (value >= condition.value) return false;
          break;
        case 'in':
          if (!Array.isArray(condition.value) || !condition.value.includes(value)) return false;
          break;
      }
    }

    return true;
  }

  /**
   * Check if customer is already enrolled
   */
  static async isCustomerEnrolled(storeId, workflowId, customerId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data } = await tenantDb
      .from('automation_enrollments')
      .select('id')
      .eq('workflow_id', workflowId)
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .maybeSingle();

    return !!data;
  }

  /**
   * Enroll customer in workflow
   */
  static async enrollCustomer(storeId, workflowId, customerId, triggerData = {}) {
    return await AutomationWorkflow.enrollCustomer(storeId, workflowId, customerId, triggerData);
  }

  /**
   * Process pending automation steps
   * Called by background job
   */
  static async processPendingSteps(storeId) {
    console.log(`[AutomationService] Processing pending steps for store ${storeId}`);

    const enrollments = await AutomationWorkflow.getPendingEnrollments(storeId);

    let processed = 0;
    let errors = 0;

    for (const enrollment of enrollments) {
      try {
        await this.processEnrollmentStep(storeId, enrollment);
        processed++;
      } catch (error) {
        console.error(`[AutomationService] Error processing enrollment ${enrollment.id}:`, error);
        errors++;
      }
    }

    console.log(`[AutomationService] Processed ${processed} enrollments, ${errors} errors`);
    return { processed, errors };
  }

  /**
   * Process a single enrollment step
   */
  static async processEnrollmentStep(storeId, enrollment) {
    const workflow = enrollment.automation_workflows;
    if (!workflow || !workflow.steps) {
      console.warn(`[AutomationService] No workflow or steps for enrollment ${enrollment.id}`);
      return;
    }

    const currentStep = enrollment.current_step || 0;
    const steps = workflow.steps;

    if (currentStep >= steps.length) {
      // Workflow completed
      await AutomationWorkflow.updateEnrollment(storeId, enrollment.id, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });
      return;
    }

    const step = steps[currentStep];

    // Execute the step
    const result = await this.executeStep(storeId, enrollment, step);

    // Log the step execution
    await AutomationWorkflow.logStep(storeId, {
      workflowId: workflow.id,
      enrollmentId: enrollment.id,
      customerId: enrollment.customer_id,
      stepIndex: currentStep,
      stepType: step.type,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error,
      metadata: result.metadata
    });

    if (!result.success) {
      // Step failed - check if we should retry or exit
      if (result.shouldExit) {
        await AutomationWorkflow.updateEnrollment(storeId, enrollment.id, {
          status: 'exited',
          exit_reason: result.error
        });
        return;
      }
    }

    // Determine next step
    let nextStep = currentStep + 1;
    let nextStepAt = null;

    // Handle flow control steps
    if (step.type === this.STEP_TYPES.DELAY) {
      nextStepAt = this.calculateDelayTime(step.config);
    } else if (step.type === this.STEP_TYPES.CONDITION) {
      nextStep = this.evaluateCondition(enrollment, step.config);
    } else if (step.type === this.STEP_TYPES.EXIT) {
      await AutomationWorkflow.updateEnrollment(storeId, enrollment.id, {
        status: 'exited',
        exit_reason: 'Reached exit step'
      });
      return;
    }

    // Update enrollment to next step
    await AutomationWorkflow.updateEnrollment(storeId, enrollment.id, {
      current_step: nextStep,
      next_step_at: nextStepAt,
      last_step_at: new Date().toISOString()
    });
  }

  /**
   * Execute a workflow step
   */
  static async executeStep(storeId, enrollment, step) {
    console.log(`[AutomationService] Executing step: ${step.type}`);

    try {
      switch (step.type) {
        case this.STEP_TYPES.SEND_EMAIL:
          return await this.executeSendEmail(storeId, enrollment, step.config);

        case this.STEP_TYPES.ADD_TAG:
          return await this.executeAddTag(storeId, enrollment, step.config);

        case this.STEP_TYPES.REMOVE_TAG:
          return await this.executeRemoveTag(storeId, enrollment, step.config);

        case this.STEP_TYPES.UPDATE_FIELD:
          return await this.executeUpdateField(storeId, enrollment, step.config);

        case this.STEP_TYPES.ADD_TO_SEGMENT:
          return await this.executeAddToSegment(storeId, enrollment, step.config);

        case this.STEP_TYPES.REMOVE_FROM_SEGMENT:
          return await this.executeRemoveFromSegment(storeId, enrollment, step.config);

        case this.STEP_TYPES.WEBHOOK:
          return await this.executeWebhook(storeId, enrollment, step.config);

        case this.STEP_TYPES.INTERNAL_NOTIFICATION:
          return await this.executeInternalNotification(storeId, enrollment, step.config);

        case this.STEP_TYPES.DELAY:
          // Delay is handled in processEnrollmentStep
          return { success: true };

        case this.STEP_TYPES.CONDITION:
          // Condition is handled in processEnrollmentStep
          return { success: true };

        case this.STEP_TYPES.EXIT:
          return { success: true };

        default:
          console.warn(`[AutomationService] Unknown step type: ${step.type}`);
          return { success: false, error: `Unknown step type: ${step.type}` };
      }
    } catch (error) {
      console.error(`[AutomationService] Step execution error:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute send email step
   */
  static async executeSendEmail(storeId, enrollment, config) {
    const EmailService = require('./email-service');

    const customer = enrollment.customers;
    if (!customer || !customer.email) {
      return { success: false, error: 'No customer email', shouldExit: true };
    }

    // Check unsubscribe
    const isUnsubscribed = await EmailUnsubscribe.isUnsubscribed(storeId, customer.email);
    if (isUnsubscribed) {
      return { success: false, error: 'Customer unsubscribed', shouldExit: true };
    }

    try {
      await EmailService.sendEmail(storeId, {
        to: customer.email,
        templateId: config.templateId,
        subject: config.subject,
        data: {
          customer,
          ...enrollment.trigger_data
        }
      });

      return { success: true, metadata: { templateId: config.templateId } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute add tag step
   */
  static async executeAddTag(storeId, enrollment, config) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data: customer } = await tenantDb
      .from('customers')
      .select('tags')
      .eq('id', enrollment.customer_id)
      .single();

    const currentTags = customer?.tags || [];
    const newTags = Array.isArray(config.tags) ? config.tags : [config.tags];
    const updatedTags = [...new Set([...currentTags, ...newTags])];

    await tenantDb
      .from('customers')
      .update({ tags: updatedTags })
      .eq('id', enrollment.customer_id);

    return { success: true, metadata: { tagsAdded: newTags } };
  }

  /**
   * Execute remove tag step
   */
  static async executeRemoveTag(storeId, enrollment, config) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data: customer } = await tenantDb
      .from('customers')
      .select('tags')
      .eq('id', enrollment.customer_id)
      .single();

    const currentTags = customer?.tags || [];
    const tagsToRemove = Array.isArray(config.tags) ? config.tags : [config.tags];
    const updatedTags = currentTags.filter(tag => !tagsToRemove.includes(tag));

    await tenantDb
      .from('customers')
      .update({ tags: updatedTags })
      .eq('id', enrollment.customer_id);

    return { success: true, metadata: { tagsRemoved: tagsToRemove } };
  }

  /**
   * Execute update field step
   */
  static async executeUpdateField(storeId, enrollment, config) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {};
    updates[config.field] = config.value;

    await tenantDb
      .from('customers')
      .update(updates)
      .eq('id', enrollment.customer_id);

    return { success: true, metadata: { field: config.field, value: config.value } };
  }

  /**
   * Execute add to segment step
   */
  static async executeAddToSegment(storeId, enrollment, config) {
    const CustomerSegment = require('../models/CustomerSegment');

    await CustomerSegment.addMember(storeId, config.segmentId, enrollment.customer_id);

    return { success: true, metadata: { segmentId: config.segmentId } };
  }

  /**
   * Execute remove from segment step
   */
  static async executeRemoveFromSegment(storeId, enrollment, config) {
    const CustomerSegment = require('../models/CustomerSegment');

    await CustomerSegment.removeMember(storeId, config.segmentId, enrollment.customer_id);

    return { success: true, metadata: { segmentId: config.segmentId } };
  }

  /**
   * Execute webhook step
   */
  static async executeWebhook(storeId, enrollment, config) {
    const fetch = require('node-fetch');

    const payload = {
      event: 'automation_step',
      workflow_id: enrollment.workflow_id,
      customer_id: enrollment.customer_id,
      customer: enrollment.customers,
      trigger_data: enrollment.trigger_data,
      custom_data: config.data
    };

    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return { success: false, error: `Webhook failed: ${response.status}` };
    }

    return { success: true, metadata: { statusCode: response.status } };
  }

  /**
   * Execute internal notification step
   */
  static async executeInternalNotification(storeId, enrollment, config) {
    // This could integrate with a notification service
    console.log(`[AutomationService] Internal notification: ${config.message}`);

    // For now, just log it
    return { success: true, metadata: { message: config.message } };
  }

  /**
   * Calculate delay time
   */
  static calculateDelayTime(config) {
    const now = new Date();
    let delayMs = 0;

    switch (config.unit) {
      case 'minutes':
        delayMs = config.value * 60 * 1000;
        break;
      case 'hours':
        delayMs = config.value * 60 * 60 * 1000;
        break;
      case 'days':
        delayMs = config.value * 24 * 60 * 60 * 1000;
        break;
      case 'weeks':
        delayMs = config.value * 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        delayMs = config.value * 60 * 1000; // Default to minutes
    }

    return new Date(now.getTime() + delayMs).toISOString();
  }

  /**
   * Evaluate condition and return next step index
   */
  static evaluateCondition(enrollment, config) {
    const { field, operator, value, trueStep, falseStep } = config;

    let fieldValue;

    // Get field value from customer or trigger data
    if (enrollment.customers && enrollment.customers[field] !== undefined) {
      fieldValue = enrollment.customers[field];
    } else if (enrollment.trigger_data && enrollment.trigger_data[field] !== undefined) {
      fieldValue = enrollment.trigger_data[field];
    }

    let result = false;

    switch (operator) {
      case 'equals':
        result = fieldValue === value;
        break;
      case 'not_equals':
        result = fieldValue !== value;
        break;
      case 'contains':
        result = String(fieldValue).includes(value);
        break;
      case 'greater_than':
        result = fieldValue > value;
        break;
      case 'less_than':
        result = fieldValue < value;
        break;
      case 'is_set':
        result = fieldValue !== null && fieldValue !== undefined;
        break;
      case 'is_not_set':
        result = fieldValue === null || fieldValue === undefined;
        break;
    }

    return result ? trueStep : falseStep;
  }

  /**
   * Check for abandoned carts and trigger workflows
   */
  static async checkAbandonedCarts(storeId) {
    console.log(`[AutomationService] Checking abandoned carts for store ${storeId}`);

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get carts that are older than 1 hour but less than 24 hours
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: abandonedCarts, error } = await tenantDb
      .from('carts')
      .select(`
        id,
        customer_id,
        total,
        items,
        updated_at,
        customers (id, email, first_name, last_name)
      `)
      .lt('updated_at', oneHourAgo.toISOString())
      .gt('updated_at', oneDayAgo.toISOString())
      .not('customer_id', 'is', null)
      .eq('is_abandoned_email_sent', false);

    if (error) {
      console.error('[AutomationService] Error fetching abandoned carts:', error);
      return { triggered: 0 };
    }

    let triggered = 0;

    for (const cart of abandonedCarts || []) {
      if (!cart.customers?.email) continue;

      // Trigger abandoned cart automation
      await this.handleTrigger(storeId, this.TRIGGER_TYPES.ABANDONED_CART, {
        customerId: cart.customer_id,
        email: cart.customers.email,
        cartId: cart.id,
        cartTotal: cart.total,
        cartItems: cart.items
      });

      // Mark cart as processed
      await tenantDb
        .from('carts')
        .update({ is_abandoned_email_sent: true })
        .eq('id', cart.id);

      triggered++;
    }

    console.log(`[AutomationService] Triggered ${triggered} abandoned cart automations`);
    return { triggered };
  }

  /**
   * Get workflow templates
   */
  static getWorkflowTemplates() {
    return [
      {
        id: 'welcome_series',
        name: 'Welcome Series',
        description: 'Send a series of welcome emails to new customers',
        triggerType: this.TRIGGER_TYPES.CUSTOMER_CREATED,
        steps: [
          { type: 'send_email', config: { templateId: 'welcome_1', subject: 'Welcome to our store!' } },
          { type: 'delay', config: { value: 3, unit: 'days' } },
          { type: 'send_email', config: { templateId: 'welcome_2', subject: 'Here\'s what you can do' } },
          { type: 'delay', config: { value: 7, unit: 'days' } },
          { type: 'send_email', config: { templateId: 'welcome_3', subject: 'Special offer just for you' } }
        ]
      },
      {
        id: 'abandoned_cart',
        name: 'Abandoned Cart Recovery',
        description: 'Recover abandoned carts with reminder emails',
        triggerType: this.TRIGGER_TYPES.ABANDONED_CART,
        steps: [
          { type: 'delay', config: { value: 1, unit: 'hours' } },
          { type: 'send_email', config: { templateId: 'cart_reminder_1', subject: 'You left something behind!' } },
          { type: 'delay', config: { value: 24, unit: 'hours' } },
          { type: 'condition', config: { field: 'cart_recovered', operator: 'equals', value: false, trueStep: 3, falseStep: 5 } },
          { type: 'send_email', config: { templateId: 'cart_reminder_2', subject: 'Your cart is waiting' } },
          { type: 'exit' }
        ]
      },
      {
        id: 'post_purchase',
        name: 'Post-Purchase Follow-up',
        description: 'Follow up with customers after their purchase',
        triggerType: this.TRIGGER_TYPES.ORDER_PLACED,
        steps: [
          { type: 'delay', config: { value: 7, unit: 'days' } },
          { type: 'send_email', config: { templateId: 'feedback_request', subject: 'How was your order?' } },
          { type: 'delay', config: { value: 30, unit: 'days' } },
          { type: 'send_email', config: { templateId: 'reorder_reminder', subject: 'Time to reorder?' } }
        ]
      },
      {
        id: 'win_back',
        name: 'Win-Back Campaign',
        description: 'Re-engage inactive customers',
        triggerType: this.TRIGGER_TYPES.ENTERED_SEGMENT,
        triggerConfig: { segmentId: 'at_risk' },
        steps: [
          { type: 'send_email', config: { templateId: 'winback_1', subject: 'We miss you!' } },
          { type: 'delay', config: { value: 7, unit: 'days' } },
          { type: 'send_email', config: { templateId: 'winback_2', subject: 'Special offer inside' } },
          { type: 'add_tag', config: { tags: ['winback_sent'] } }
        ]
      }
    ];
  }
}

module.exports = AutomationService;
