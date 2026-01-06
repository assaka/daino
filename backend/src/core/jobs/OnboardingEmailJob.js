const BaseJobHandler = require('./BaseJobHandler');
const masterEmailService = require('../../services/master-email-service');

/**
 * Onboarding Email Job
 * Sends onboarding emails to store owners 24 hours after registration
 * Helps users create their first store or provides tips for existing stores
 */
class OnboardingEmailJob extends BaseJobHandler {
  constructor(job) {
    super(job);
  }

  async execute() {
    console.log('[ONBOARDING_EMAIL_JOB] Starting onboarding email job');

    try {
      const results = await masterEmailService.sendPendingOnboardingEmails();

      console.log(`[ONBOARDING_EMAIL_JOB] Completed: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`);

      return {
        success: true,
        message: `Onboarding emails: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`,
        total: results.total,
        sent: results.sent,
        skipped: results.skipped,
        failed: results.failed,
        errors: results.errors,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[ONBOARDING_EMAIL_JOB] Fatal error:', error.message);
      throw error;
    }
  }

  /**
   * Get job type identifier
   */
  static getJobType() {
    return 'system:onboarding_email';
  }

  /**
   * Get job description for logging
   */
  getDescription() {
    return 'Send onboarding emails to users who registered 24 hours ago';
  }

  /**
   * Validate job payload (none required for this job)
   */
  validatePayload() {
    return true;
  }
}

module.exports = OnboardingEmailJob;
