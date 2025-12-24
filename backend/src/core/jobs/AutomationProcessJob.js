const BaseJobHandler = require('./BaseJobHandler');
const AutomationWorkflow = require('../../models/AutomationWorkflow');

/**
 * Background job for processing automation workflow enrollments
 *
 * This job runs periodically to:
 * 1. Find enrollments with pending steps that are due
 * 2. Execute each step (send email, wait, condition check, etc.)
 * 3. Move to the next step or complete the enrollment
 *
 * Payload:
 * - storeId: Optional - process specific store only
 * - limit: Max enrollments to process (default: 100)
 */
class AutomationProcessJob extends BaseJobHandler {
  async execute() {
    const payload = this.getPayload();
    const { storeId, limit = 100 } = payload;

    this.log('Starting automation process job');
    await this.updateProgress(5, 'Loading pending enrollments...');

    // Get automation service
    const automationService = require('../../services/automation-service');

    // Get pending enrollments that are due for processing
    const enrollments = await automationService.getPendingEnrollments({
      storeId,
      limit
    });

    if (enrollments.length === 0) {
      this.log('No pending enrollments to process');
      return { success: true, processed: 0, message: 'No enrollments due' };
    }

    this.log(`Found ${enrollments.length} enrollments to process`);
    await this.updateProgress(10, `Processing ${enrollments.length} enrollments...`);

    let processed = 0;
    let completed = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < enrollments.length; i++) {
      await this.checkAbort();

      const enrollment = enrollments[i];

      try {
        this.log(`Processing enrollment ${enrollment.id} (step ${enrollment.current_step_index})`);

        // Get the workflow
        const workflow = await AutomationWorkflow.findById(
          enrollment.store_id,
          enrollment.workflow_id
        );

        if (!workflow || !workflow.is_active) {
          this.log(`Workflow ${enrollment.workflow_id} not found or inactive, skipping`, 'warn');
          await automationService.updateEnrollmentStatus(
            enrollment.store_id,
            enrollment.id,
            'cancelled',
            { reason: 'workflow_inactive' }
          );
          continue;
        }

        const steps = workflow.steps || [];
        const currentStepIndex = enrollment.current_step_index || 0;

        if (currentStepIndex >= steps.length) {
          // Workflow completed
          await automationService.completeEnrollment(enrollment.store_id, enrollment.id);
          completed++;
          continue;
        }

        const currentStep = steps[currentStepIndex];

        // Execute the step
        const stepResult = await this.executeStep(
          enrollment.store_id,
          enrollment,
          currentStep,
          workflow
        );

        if (stepResult.success) {
          if (stepResult.moveToNext) {
            // Move to next step
            const nextStepIndex = currentStepIndex + 1;

            if (nextStepIndex >= steps.length) {
              // Workflow completed
              await automationService.completeEnrollment(enrollment.store_id, enrollment.id);
              completed++;
            } else {
              // Schedule next step
              const nextStep = steps[nextStepIndex];
              const nextExecuteAt = this.calculateNextExecuteTime(nextStep);

              await automationService.updateEnrollment(enrollment.store_id, enrollment.id, {
                currentStepIndex: nextStepIndex,
                nextExecuteAt,
                lastStepResult: stepResult.data
              });
            }
          }
          // If moveToNext is false, step will be retried later (e.g., delay step)
        } else {
          // Step failed
          await automationService.logStep(enrollment.store_id, enrollment.id, {
            stepIndex: currentStepIndex,
            stepType: currentStep.type,
            status: 'failed',
            error: stepResult.error
          });

          // Mark enrollment as failed after max retries
          const retryCount = (enrollment.retry_count || 0) + 1;
          if (retryCount >= 3) {
            await automationService.updateEnrollmentStatus(
              enrollment.store_id,
              enrollment.id,
              'failed',
              { error: stepResult.error }
            );
            failed++;
          } else {
            // Retry later
            await automationService.updateEnrollment(enrollment.store_id, enrollment.id, {
              retryCount,
              nextExecuteAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
            });
          }
        }

        processed++;
      } catch (error) {
        this.log(`Error processing enrollment ${enrollment.id}: ${error.message}`, 'error');
        errors.push({ enrollmentId: enrollment.id, error: error.message });
        failed++;
      }

      // Update progress
      const progress = 10 + Math.floor((i + 1) / enrollments.length * 85);
      await this.updateProgress(progress, `Processed ${i + 1}/${enrollments.length} enrollments`);
    }

    await this.updateProgress(100, 'Automation processing completed');

    const result = {
      success: true,
      processed,
      completed,
      failed,
      errors: errors.slice(0, 10)
    };

    this.log(`Automation processing completed: ${processed} processed, ${completed} completed, ${failed} failed`);
    return result;
  }

  /**
   * Execute a single automation step
   */
  async executeStep(storeId, enrollment, step, workflow) {
    const automationService = require('../../services/automation-service');

    switch (step.type) {
      case 'send_email':
        return await this.executeEmailStep(storeId, enrollment, step);

      case 'delay':
        return await this.executeDelayStep(storeId, enrollment, step);

      case 'condition':
        return await this.executeConditionStep(storeId, enrollment, step, workflow);

      case 'update_contact':
        return await this.executeUpdateContactStep(storeId, enrollment, step);

      case 'webhook':
        return await this.executeWebhookStep(storeId, enrollment, step);

      case 'add_tag':
        return await this.executeAddTagStep(storeId, enrollment, step);

      default:
        this.log(`Unknown step type: ${step.type}`, 'warn');
        return { success: true, moveToNext: true };
    }
  }

  /**
   * Execute email sending step
   */
  async executeEmailStep(storeId, enrollment, step) {
    try {
      const emailService = require('../../services/email-service');

      const { templateId, subject, content } = step.config || {};

      // Get customer email
      const email = enrollment.customer_email || enrollment.metadata?.email;
      if (!email) {
        return { success: false, error: 'No email address for enrollment' };
      }

      // Send email
      await emailService.sendEmail(storeId, {
        to: email,
        subject: subject || 'Automated Email',
        html: content,
        tags: [`automation:${enrollment.workflow_id}`],
        metadata: {
          automation_id: enrollment.workflow_id,
          enrollment_id: enrollment.id,
          step_type: 'send_email'
        }
      });

      return { success: true, moveToNext: true, data: { emailSent: true } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute delay step
   */
  async executeDelayStep(storeId, enrollment, step) {
    const { duration, unit } = step.config || {};

    // Calculate delay in milliseconds
    const delayMs = this.calculateDelayMs(duration || 1, unit || 'hours');

    // Check if delay has passed
    const stepStartedAt = enrollment.step_started_at || enrollment.updated_at;
    const delayEndTime = new Date(stepStartedAt).getTime() + delayMs;

    if (Date.now() >= delayEndTime) {
      // Delay completed
      return { success: true, moveToNext: true, data: { delayCompleted: true } };
    }

    // Still waiting
    return { success: true, moveToNext: false };
  }

  /**
   * Execute condition step (split based on condition)
   */
  async executeConditionStep(storeId, enrollment, step, workflow) {
    const { field, operator, value, trueBranch, falseBranch } = step.config || {};

    // Get customer data
    const customerData = enrollment.metadata || {};
    const fieldValue = customerData[field];

    // Evaluate condition
    const conditionMet = this.evaluateCondition(fieldValue, operator, value);

    // Determine next step index based on condition
    // For now, we just move to next step (branches would need more complex logic)
    return {
      success: true,
      moveToNext: true,
      data: { conditionMet, field, operator, value }
    };
  }

  /**
   * Execute update contact step
   */
  async executeUpdateContactStep(storeId, enrollment, step) {
    try {
      const { updates } = step.config || {};

      if (!updates || !enrollment.customer_id) {
        return { success: true, moveToNext: true };
      }

      // Update customer
      const Customer = require('../../models/Customer');
      await Customer.update(storeId, enrollment.customer_id, updates);

      return { success: true, moveToNext: true, data: { updated: true } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute webhook step
   */
  async executeWebhookStep(storeId, enrollment, step) {
    try {
      const axios = require('axios');
      const { url, method = 'POST', headers = {} } = step.config || {};

      if (!url) {
        return { success: false, error: 'No webhook URL configured' };
      }

      await axios({
        method,
        url,
        headers,
        data: {
          enrollment_id: enrollment.id,
          workflow_id: enrollment.workflow_id,
          customer_email: enrollment.customer_email,
          metadata: enrollment.metadata
        },
        timeout: 30000
      });

      return { success: true, moveToNext: true, data: { webhookCalled: true } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute add tag step
   */
  async executeAddTagStep(storeId, enrollment, step) {
    try {
      const { tags } = step.config || {};

      if (!tags || !enrollment.customer_id) {
        return { success: true, moveToNext: true };
      }

      // Add tags to customer
      const Customer = require('../../models/Customer');
      await Customer.addTags(storeId, enrollment.customer_id, tags);

      return { success: true, moveToNext: true, data: { tagsAdded: tags } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate delay in milliseconds
   */
  calculateDelayMs(duration, unit) {
    const multipliers = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000
    };

    return duration * (multipliers[unit] || multipliers.hours);
  }

  /**
   * Calculate next execute time based on step type
   */
  calculateNextExecuteTime(step) {
    if (step.type === 'delay') {
      const { duration, unit } = step.config || {};
      const delayMs = this.calculateDelayMs(duration || 1, unit || 'hours');
      return new Date(Date.now() + delayMs);
    }

    // Execute immediately for other step types
    return new Date();
  }

  /**
   * Evaluate a condition
   */
  evaluateCondition(fieldValue, operator, value) {
    switch (operator) {
      case 'equals':
        return fieldValue == value;
      case 'not_equals':
        return fieldValue != value;
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'not_contains':
        return !String(fieldValue).includes(String(value));
      case 'is_empty':
        return !fieldValue || fieldValue === '';
      case 'is_not_empty':
        return fieldValue && fieldValue !== '';
      default:
        return true;
    }
  }
}

module.exports = AutomationProcessJob;
