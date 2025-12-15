const BaseJobHandler = require('./BaseJobHandler');
const translationService = require('../../services/translation-service');
const creditService = require('../../services/credit-service');
const emailService = require('../../services/email-service');

/**
 * UI Labels Bulk Translation Job Handler
 *
 * Translates all UI labels from one language to another in the background.
 * This job survives server restarts/deployments when using BullMQ.
 */
class UILabelsBulkTranslationJob extends BaseJobHandler {
  async execute() {
    const { userId, userEmail, storeId, fromLang, toLang } = this.job.payload;

    this.log(`Starting UI labels bulk translation: ${fromLang} → ${toLang} for store ${storeId}`);
    await this.updateProgress(5, 'Fetching source labels...');

    // Get all labels in the source language
    const sourceLabels = await translationService.getUILabels(storeId, fromLang);

    if (!sourceLabels || !sourceLabels.labels) {
      this.log('No labels found to translate');
      return {
        total: 0,
        translated: 0,
        skipped: 0,
        failed: 0,
        message: 'No labels found to translate'
      };
    }

    await this.updateProgress(10, 'Checking existing translations...');

    // Get existing labels in target language to avoid re-translating
    const targetLabels = await translationService.getUILabels(storeId, toLang);
    const existingKeys = new Set();

    // Flatten target labels to get existing keys
    const flattenKeys = (obj, prefix = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flattenKeys(value, fullKey);
        } else {
          existingKeys.add(fullKey);
        }
      });
    };
    flattenKeys(targetLabels.labels || {});

    // Flatten the source labels
    const flattenLabels = (obj, prefix = '') => {
      const result = {};
      Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(result, flattenLabels(value, fullKey));
        } else {
          result[fullKey] = value;
        }
      });
      return result;
    };

    const flatSourceLabels = flattenLabels(sourceLabels.labels);
    const keysToTranslate = Object.keys(flatSourceLabels).filter(key => !existingKeys.has(key));

    const results = {
      total: Object.keys(flatSourceLabels).length,
      translated: 0,
      skipped: Object.keys(flatSourceLabels).length - keysToTranslate.length,
      failed: 0,
      errors: []
    };

    this.log(`Total labels: ${results.total}, To translate: ${keysToTranslate.length}, Already translated: ${results.skipped}`);

    if (keysToTranslate.length === 0) {
      this.log('No missing translations found');
      await this.updateProgress(100, 'All labels already translated');

      // Still deduct credits for all labels
      await this.deductCredits(userId, storeId, fromLang, toLang, results);

      return results;
    }

    await this.updateProgress(15, `Translating ${keysToTranslate.length} labels...`);

    // Process translations in parallel batches with rate limit protection
    const BATCH_SIZE = 10; // Process 10 labels at a time to avoid Anthropic rate limits
    const BATCH_DELAY_MS = 2000; // 2 second delay between batches to respect rate limits
    const batches = [];
    for (let i = 0; i < keysToTranslate.length; i += BATCH_SIZE) {
      batches.push(keysToTranslate.slice(i, i + BATCH_SIZE));
    }

    this.log(`Processing ${keysToTranslate.length} labels in ${batches.length} batches of ${BATCH_SIZE}`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      // Check for cancellation before each batch
      await this.checkAbort();

      const batch = batches[batchIndex];

      // Calculate progress (15% to 90% for translation)
      const translationProgress = 15 + ((batchIndex / batches.length) * 75);
      await this.updateProgress(
        Math.round(translationProgress),
        `Processing batch ${batchIndex + 1}/${batches.length} (${results.translated}/${keysToTranslate.length} translated)`
      );

      this.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} labels)`);

      // Translate batch in parallel
      const batchPromises = batch.map(async (key) => {
        try {
          const sourceValue = flatSourceLabels[key];
          if (!sourceValue || typeof sourceValue !== 'string') {
            results.skipped++;
            return { key, status: 'skipped' };
          }

          // Translate using AI with retry on rate limit
          let translatedValue;
          let retries = 0;
          const MAX_RETRIES = 2;

          while (retries <= MAX_RETRIES) {
            try {
              translatedValue = await translationService.aiTranslate(sourceValue, fromLang, toLang);
              break; // Success, exit retry loop
            } catch (aiError) {
              if (aiError.message?.includes('rate_limit') && retries < MAX_RETRIES) {
                retries++;
                const waitTime = retries * 5000; // 5s, 10s
                this.log(`Rate limit hit for ${key}, waiting ${waitTime}ms before retry ${retries}/${MAX_RETRIES}`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              } else {
                throw aiError; // Re-throw if not rate limit or out of retries
              }
            }
          }

          // Determine category from key
          const category = key.split('.')[0] || 'common';

          // Save the translation
          await translationService.saveUILabel(storeId, key, toLang, translatedValue, category, 'system');

          results.translated++;
          return { key, status: 'success' };
        } catch (error) {
          this.log(`Error translating UI label ${key}: ${error.message}`);
          results.failed++;
          results.errors.push({
            key,
            error: error.message
          });
          return { key, status: 'failed', error: error.message };
        }
      });

      await Promise.all(batchPromises);
      this.log(`Batch ${batchIndex + 1} complete - Progress: ${results.translated}/${keysToTranslate.length} translated`);

      // Add delay between batches to respect Anthropic rate limits (except after last batch)
      if (batchIndex < batches.length - 1) {
        this.log(`Waiting ${BATCH_DELAY_MS}ms before next batch to respect rate limits...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    await this.updateProgress(90, 'Translation complete, deducting credits...');
    this.log(`UI labels translation complete: ${results.translated} translated, ${results.skipped} skipped, ${results.failed} failed`);

    // Deduct credits for ALL labels (including skipped)
    await this.deductCredits(userId, storeId, fromLang, toLang, results);

    await this.updateProgress(95, 'Sending email notification...');

    // Send email notification
    if (userEmail) {
      await this.sendEmailNotification(userEmail, fromLang, toLang, results);
    }

    await this.updateProgress(100, 'Job completed successfully');

    return results;
  }

  /**
   * Deduct credits for the translation job
   */
  async deductCredits(userId, storeId, fromLang, toLang, results) {
    const totalItems = results.total;

    if (totalItems > 0) {
      const costPerItem = await translationService.getTranslationCost('standard');
      const actualCost = totalItems * costPerItem;

      this.log(`Charging for ${totalItems} items × ${costPerItem} credits = ${actualCost} credits`);

      try {
        await creditService.deduct(
          userId,
          storeId,
          actualCost,
          `Bulk UI Labels Translation (${fromLang} → ${toLang})`,
          {
            fromLang,
            toLang,
            totalItems,
            translated: results.translated,
            skipped: results.skipped,
            failed: results.failed,
            note: 'Charged for all items including skipped'
          },
          null,
          'ai_translation'
        );
        this.log(`Credits deducted successfully: ${actualCost}`);
      } catch (error) {
        this.log(`Failed to deduct credits: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Send email notification when translation is complete
   */
  async sendEmailNotification(userEmail, fromLang, toLang, results) {
    try {
      await emailService.sendTranslationCompleteEmail({
        to: userEmail,
        fromLang,
        toLang,
        stats: results
      });
      this.log(`Email notification sent to ${userEmail}`);
    } catch (error) {
      this.log(`Failed to send email notification: ${error.message}`);
      // Don't throw error - email failure shouldn't fail the job
    }
  }

  /**
   * Helper method for logging
   */
  log(message) {
    console.log(`[UILabelsBulkTranslationJob ${this.job.id}] ${message}`);
  }
}

module.exports = UILabelsBulkTranslationJob;
