/**
 * AI Training Service - Automatic Training Data Collection & Validation
 *
 * This service handles:
 * 1. Capturing actual user prompts as training candidates
 * 2. Tracking action outcomes (success/failure/reverted)
 * 3. Auto-validating and approving based on rules
 * 4. Promoting successful patterns to entity definitions
 * 5. Providing admin review interface data
 *
 * Flow:
 * User Prompt → AI Response → Action Taken → Outcome Check → Validation → Approval → Promotion
 */

const { masterDbClient } = require('../database/masterConnection');

class AITrainingService {
  constructor() {
    // Cache for training rules
    this.rulesCache = null;
    this.rulesCacheExpiry = null;
    this.RULES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Capture a user prompt as a training candidate
   * Called after every AI interaction
   */
  async captureTrainingCandidate({
    storeId,
    userId,
    sessionId,
    userPrompt,
    aiResponse,
    detectedIntent,
    detectedEntity,
    detectedOperation,
    actionTaken,
    confidenceScore,
    metadata = {}
  }) {
    try {
      // Check for similar existing prompts to avoid duplicates
      const similarityScore = await this.checkSimilarity(userPrompt, detectedEntity);

      // Don't capture if too similar to existing training data
      if (similarityScore > 0.95) {
        console.log('[AITrainingService] Prompt too similar to existing data, skipping capture');
        return { captured: false, reason: 'too_similar' };
      }

      const { data, error } = await masterDbClient
        .from('ai_training_candidates')
        .insert({
          store_id: storeId,
          user_id: userId,
          session_id: sessionId,
          user_prompt: userPrompt,
          ai_response: aiResponse,
          detected_intent: detectedIntent,
          detected_entity: detectedEntity,
          detected_operation: detectedOperation,
          action_taken: actionTaken,
          confidence_score: confidenceScore,
          similarity_score: similarityScore,
          outcome_status: 'pending',
          metadata
        })
        .select('id')
        .single();

      if (error) {
        console.error('[AITrainingService] Error capturing candidate:', error);
        return { captured: false, error: error.message };
      }

      return { captured: true, candidateId: data.id };
    } catch (error) {
      console.error('[AITrainingService] Error in captureTrainingCandidate:', error);
      return { captured: false, error: error.message };
    }
  }

  /**
   * Update the outcome of a training candidate
   * Called after an AI action is executed
   */
  async updateOutcome(candidateId, outcomeStatus, outcomeDetails = {}) {
    try {
      // Update using the database function
      const { error } = await masterDbClient.rpc('update_training_candidate_outcome', {
        p_candidate_id: candidateId,
        p_outcome_status: outcomeStatus,
        p_outcome_details: outcomeDetails
      });

      if (error) {
        // Fallback to direct update if function doesn't exist
        await masterDbClient
          .from('ai_training_candidates')
          .update({
            outcome_status: outcomeStatus,
            outcome_details: outcomeDetails,
            success_count: outcomeStatus === 'success' ? masterDbClient.raw('success_count + 1') : undefined,
            failure_count: ['failure', 'reverted'].includes(outcomeStatus) ? masterDbClient.raw('failure_count + 1') : undefined,
            updated_at: new Date().toISOString()
          })
          .eq('id', candidateId);
      }

      // Check training rules after outcome update
      await this.checkAndApplyRules(candidateId);

      return { success: true };
    } catch (error) {
      console.error('[AITrainingService] Error updating outcome:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record that an action was reverted (user undid it)
   */
  async recordRevert(candidateId, revertDetails = {}) {
    return this.updateOutcome(candidateId, 'reverted', {
      reverted: true,
      revert_time: new Date().toISOString(),
      ...revertDetails
    });
  }

  /**
   * Record user feedback on an AI response
   */
  async recordUserFeedback(candidateId, wasHelpful, feedbackText = null) {
    try {
      const { error } = await masterDbClient
        .from('ai_training_candidates')
        .update({
          metadata: masterDbClient.raw(`
            metadata || jsonb_build_object(
              'user_feedback', '${wasHelpful ? 'positive' : 'negative'}',
              'feedback_text', ${feedbackText ? `'${feedbackText.replace(/'/g, "''")}'` : 'null'},
              'feedback_at', '${new Date().toISOString()}'
            )
          `),
          updated_at: new Date().toISOString()
        })
        .eq('id', candidateId);

      if (error) throw error;

      // Log validation
      await masterDbClient.from('ai_training_validations').insert({
        candidate_id: candidateId,
        validation_type: 'user_feedback',
        validation_result: wasHelpful ? 'passed' : 'failed',
        evidence: { was_helpful: wasHelpful, feedback_text: feedbackText },
        validation_source: 'user'
      });

      // Re-check rules with new feedback
      await this.checkAndApplyRules(candidateId);

      return { success: true };
    } catch (error) {
      console.error('[AITrainingService] Error recording feedback:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check training rules and apply appropriate action
   */
  async checkAndApplyRules(candidateId) {
    try {
      // Try using the database function
      const { data, error } = await masterDbClient.rpc('check_training_rules', {
        p_candidate_id: candidateId
      });

      if (error) {
        // Fallback to JavaScript implementation
        return await this.checkRulesJS(candidateId);
      }

      return { result: data };
    } catch (error) {
      console.error('[AITrainingService] Error checking rules:', error);
      return { result: 'error' };
    }
  }

  /**
   * JavaScript fallback for rule checking
   */
  async checkRulesJS(candidateId) {
    try {
      const rules = await this.getTrainingRules();
      const { data: candidate } = await masterDbClient
        .from('ai_training_candidates')
        .select('*')
        .eq('id', candidateId)
        .single();

      if (!candidate) return { result: 'not_found' };

      for (const rule of rules) {
        const conditions = rule.conditions;
        let matches = true;

        // Check conditions
        if (conditions.min_success_count && candidate.success_count < conditions.min_success_count) {
          matches = false;
        }
        if (conditions.max_failure_count && candidate.failure_count > conditions.max_failure_count) {
          matches = false;
        }
        if (conditions.min_confidence && candidate.confidence_score < conditions.min_confidence) {
          matches = false;
        }
        if (conditions.entity && candidate.detected_entity !== conditions.entity) {
          matches = false;
        }
        if (conditions.outcome_status && candidate.outcome_status !== conditions.outcome_status) {
          matches = false;
        }
        if (conditions.has_positive_feedback) {
          const feedback = candidate.metadata?.user_feedback;
          if (feedback !== 'positive') matches = false;
        }

        if (matches) {
          // Apply action
          let newStatus = candidate.training_status;
          if (rule.action === 'approve') newStatus = 'approved';
          else if (rule.action === 'reject') newStatus = 'rejected';
          else if (rule.action === 'flag_for_review') newStatus = 'review_needed';

          await masterDbClient
            .from('ai_training_candidates')
            .update({
              training_status: newStatus,
              was_validated: rule.action !== 'flag_for_review',
              validated_at: rule.action !== 'flag_for_review' ? new Date().toISOString() : null,
              validation_method: 'auto',
              updated_at: new Date().toISOString()
            })
            .eq('id', candidateId);

          // Log validation
          await masterDbClient.from('ai_training_validations').insert({
            candidate_id: candidateId,
            validation_type: 'rule_check',
            validation_result: rule.action,
            evidence: { rule_id: rule.id, rule_name: rule.rule_name },
            validation_source: 'system'
          });

          return { result: rule.action };
        }
      }

      return { result: 'no_match' };
    } catch (error) {
      console.error('[AITrainingService] Error in checkRulesJS:', error);
      return { result: 'error' };
    }
  }

  /**
   * Get training rules (cached)
   */
  async getTrainingRules() {
    if (this.rulesCache && this.rulesCacheExpiry > Date.now()) {
      return this.rulesCache;
    }

    const { data, error } = await masterDbClient
      .from('ai_training_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('[AITrainingService] Error fetching rules:', error);
      return [];
    }

    this.rulesCache = data || [];
    this.rulesCacheExpiry = Date.now() + this.RULES_CACHE_TTL;

    return this.rulesCache;
  }

  /**
   * Promote approved candidates to entity definitions
   */
  async promoteApprovedCandidates() {
    try {
      // Get approved candidates that haven't been promoted yet
      const { data: candidates, error } = await masterDbClient
        .from('ai_training_candidates')
        .select('*')
        .eq('training_status', 'approved')
        .is('promoted_at', null)
        .order('success_count', { ascending: false })
        .limit(50);

      if (error) throw error;

      const results = { promoted: 0, failed: 0 };

      for (const candidate of candidates || []) {
        try {
          // Get current entity definition
          const { data: entityDef } = await masterDbClient
            .from('ai_entity_definitions')
            .select('example_prompts')
            .eq('entity_name', candidate.detected_entity)
            .single();

          if (!entityDef) continue;

          // Parse existing prompts
          let existingPrompts = [];
          try {
            existingPrompts = typeof entityDef.example_prompts === 'string'
              ? JSON.parse(entityDef.example_prompts)
              : (entityDef.example_prompts || []);
          } catch {
            existingPrompts = [];
          }

          // Check if prompt already exists
          if (existingPrompts.includes(candidate.user_prompt)) {
            continue;
          }

          // Add new prompt
          existingPrompts.push(candidate.user_prompt);

          // Update entity definition
          await masterDbClient
            .from('ai_entity_definitions')
            .update({
              example_prompts: JSON.stringify(existingPrompts),
              updated_at: new Date().toISOString()
            })
            .eq('entity_name', candidate.detected_entity);

          // Mark as promoted
          await masterDbClient
            .from('ai_training_candidates')
            .update({
              training_status: 'promoted',
              promoted_at: new Date().toISOString(),
              promoted_to: candidate.detected_entity,
              updated_at: new Date().toISOString()
            })
            .eq('id', candidate.id);

          results.promoted++;
        } catch (err) {
          console.error(`[AITrainingService] Error promoting candidate ${candidate.id}:`, err);
          results.failed++;
        }
      }

      return results;
    } catch (error) {
      console.error('[AITrainingService] Error promoting candidates:', error);
      return { error: error.message };
    }
  }

  /**
   * Check similarity of prompt against existing training data
   */
  async checkSimilarity(prompt, entityName) {
    try {
      // Get existing example prompts for this entity
      const { data: entityDef } = await masterDbClient
        .from('ai_entity_definitions')
        .select('example_prompts')
        .eq('entity_name', entityName)
        .single();

      if (!entityDef || !entityDef.example_prompts) {
        return 0;
      }

      const existingPrompts = typeof entityDef.example_prompts === 'string'
        ? JSON.parse(entityDef.example_prompts)
        : entityDef.example_prompts;

      // Simple similarity check using word overlap
      const promptWords = new Set(prompt.toLowerCase().split(/\s+/));
      let maxSimilarity = 0;

      for (const existing of existingPrompts) {
        const existingWords = new Set(existing.toLowerCase().split(/\s+/));
        const intersection = [...promptWords].filter(w => existingWords.has(w));
        const union = new Set([...promptWords, ...existingWords]);
        const similarity = intersection.length / union.size;

        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
        }
      }

      return maxSimilarity;
    } catch (error) {
      console.error('[AITrainingService] Error checking similarity:', error);
      return 0;
    }
  }

  /**
   * Get training candidates for admin review
   */
  async getCandidatesForReview({ status, entity, page = 1, limit = 20 }) {
    try {
      let query = masterDbClient
        .from('ai_training_candidates')
        .select('*', { count: 'exact' });

      if (status) {
        query = query.eq('training_status', status);
      }
      if (entity) {
        query = query.eq('detected_entity', entity);
      }

      const offset = (page - 1) * limit;
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, count, error } = await query;

      if (error) throw error;

      return {
        candidates: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('[AITrainingService] Error getting candidates:', error);
      return { candidates: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  /**
   * Manually approve a training candidate
   */
  async approveCandidate(candidateId, approvedBy) {
    try {
      await masterDbClient
        .from('ai_training_candidates')
        .update({
          training_status: 'approved',
          was_validated: true,
          validated_at: new Date().toISOString(),
          validated_by: approvedBy,
          validation_method: 'manual',
          updated_at: new Date().toISOString()
        })
        .eq('id', candidateId);

      // Log validation
      await masterDbClient.from('ai_training_validations').insert({
        candidate_id: candidateId,
        validation_type: 'manual_review',
        validation_result: 'approved',
        validated_by: approvedBy,
        validation_source: 'admin'
      });

      return { success: true };
    } catch (error) {
      console.error('[AITrainingService] Error approving candidate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Manually reject a training candidate
   */
  async rejectCandidate(candidateId, rejectedBy, reason = null) {
    try {
      await masterDbClient
        .from('ai_training_candidates')
        .update({
          training_status: 'rejected',
          was_validated: true,
          validated_at: new Date().toISOString(),
          validated_by: rejectedBy,
          validation_method: 'manual',
          metadata: reason ? masterDbClient.raw(`metadata || '{"rejection_reason": "${reason}"}'::jsonb`) : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', candidateId);

      // Log validation
      await masterDbClient.from('ai_training_validations').insert({
        candidate_id: candidateId,
        validation_type: 'manual_review',
        validation_result: 'rejected',
        validated_by: rejectedBy,
        notes: reason,
        validation_source: 'admin'
      });

      return { success: true };
    } catch (error) {
      console.error('[AITrainingService] Error rejecting candidate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get training metrics/statistics
   */
  async getTrainingMetrics(dateFrom = null, dateTo = null) {
    try {
      // Get overall stats
      const { data: statusCounts } = await masterDbClient
        .from('ai_training_candidates')
        .select('training_status')
        .then(result => {
          const counts = {};
          (result.data || []).forEach(r => {
            counts[r.training_status] = (counts[r.training_status] || 0) + 1;
          });
          return { data: counts };
        });

      // Get entity distribution
      const { data: entityCounts } = await masterDbClient
        .from('ai_training_candidates')
        .select('detected_entity')
        .not('detected_entity', 'is', null)
        .then(result => {
          const counts = {};
          (result.data || []).forEach(r => {
            counts[r.detected_entity] = (counts[r.detected_entity] || 0) + 1;
          });
          return { data: counts };
        });

      // Get recent promotion count
      let recentQuery = masterDbClient
        .from('ai_training_candidates')
        .select('id', { count: 'exact', head: true })
        .eq('training_status', 'promoted');

      if (dateFrom) {
        recentQuery = recentQuery.gte('promoted_at', dateFrom);
      }

      const { count: recentPromotions } = await recentQuery;

      return {
        statusCounts: statusCounts || {},
        entityDistribution: entityCounts || {},
        recentPromotions: recentPromotions || 0,
        summary: {
          total: Object.values(statusCounts || {}).reduce((a, b) => a + b, 0),
          pending: statusCounts?.candidate || 0,
          approved: statusCounts?.approved || 0,
          promoted: statusCounts?.promoted || 0,
          rejected: statusCounts?.rejected || 0,
          needsReview: statusCounts?.review_needed || 0
        }
      };
    } catch (error) {
      console.error('[AITrainingService] Error getting metrics:', error);
      return { error: error.message };
    }
  }

  /**
   * Clear rules cache (call when rules are updated)
   */
  clearRulesCache() {
    this.rulesCache = null;
    this.rulesCacheExpiry = null;
  }

  // ============================================
  // CORRECTION DETECTION & CONFIRMATION SYSTEM
  // ============================================

  // Patterns that indicate user is correcting/undoing previous action
  static CORRECTION_PATTERNS = [
    // Undo/revert requests
    /\b(undo|revert|cancel|rollback|undo that|take that back)\b/i,
    // Explicit corrections
    /\b(wrong|incorrect|not what I|that's not|that wasn't)\b/i,
    /\b(I meant|I wanted|I said|should have been|should be)\b/i,
    // Retry patterns
    /\b(try again|do it again|redo|let me rephrase)\b/i,
    // Complaints about result
    /\b(doesn't work|didn't work|failed|broken|not working)\b/i,
    /\b(that's wrong|you misunderstood|no,? I)\b/i
  ];

  // In-memory storage for pending confirmations (per session)
  static pendingConfirmations = new Map();

  /**
   * Mark a training candidate as pending confirmation
   * Called after action execution instead of immediate success
   */
  async markPendingConfirmation(candidateId, sessionId, actionDescription = '') {
    try {
      // Update database status
      await masterDbClient
        .from('ai_training_candidates')
        .update({
          outcome_status: 'pending_confirmation',
          updated_at: new Date().toISOString()
        })
        .eq('id', candidateId);

      // Store in memory for quick lookup
      AITrainingService.pendingConfirmations.set(sessionId, {
        candidateId,
        actionTimestamp: Date.now(),
        actionDescription
      });

      // Auto-expire after 10 minutes
      setTimeout(() => {
        const pending = AITrainingService.pendingConfirmations.get(sessionId);
        if (pending && pending.candidateId === candidateId) {
          // If still pending after 10 min, assume success (user moved on)
          this.confirmSuccess(candidateId, { autoConfirmed: true, reason: 'timeout' });
          AITrainingService.pendingConfirmations.delete(sessionId);
        }
      }, 10 * 60 * 1000);

      return { success: true };
    } catch (error) {
      console.error('[AITrainingService] Error marking pending confirmation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if a message indicates correction of previous action
   */
  checkForCorrection(message) {
    if (!message || typeof message !== 'string') return false;

    for (const pattern of AITrainingService.CORRECTION_PATTERNS) {
      if (pattern.test(message)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get pending confirmation for a session
   */
  getPendingConfirmation(sessionId) {
    return AITrainingService.pendingConfirmations.get(sessionId) || null;
  }

  /**
   * Confirm success after no correction detected
   */
  async confirmSuccess(candidateId, details = {}) {
    try {
      await masterDbClient
        .from('ai_training_candidates')
        .update({
          outcome_status: 'success',
          success_count: masterDbClient.raw('COALESCE(success_count, 0) + 1'),
          metadata: masterDbClient.raw(`
            COALESCE(metadata, '{}'::jsonb) || '${JSON.stringify({
              confirmed_at: new Date().toISOString(),
              confirmation_type: 'no_correction',
              ...details
            })}'::jsonb
          `),
          updated_at: new Date().toISOString()
        })
        .eq('id', candidateId);

      // Check training rules after success confirmation
      await this.checkAndApplyRules(candidateId);

      // Generate embedding for successful candidate (async)
      const embeddingService = require('./embeddingService');
      embeddingService.embedTrainingCandidateAsync(candidateId);

      return { success: true };
    } catch (error) {
      console.error('[AITrainingService] Error confirming success:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark as failure due to correction
   */
  async markCorrected(candidateId, correctionMessage, sessionId = null) {
    try {
      await masterDbClient
        .from('ai_training_candidates')
        .update({
          outcome_status: 'failure',
          failure_count: masterDbClient.raw('COALESCE(failure_count, 0) + 1'),
          metadata: masterDbClient.raw(`
            COALESCE(metadata, '{}'::jsonb) || '${JSON.stringify({
              corrected_at: new Date().toISOString(),
              correction_message: correctionMessage?.substring(0, 500),
              correction_type: 'user_correction'
            })}'::jsonb
          `),
          updated_at: new Date().toISOString()
        })
        .eq('id', candidateId);

      // Remove from pending
      if (sessionId) {
        AITrainingService.pendingConfirmations.delete(sessionId);
      }

      // Check training rules after failure
      await this.checkAndApplyRules(candidateId);

      return { success: true };
    } catch (error) {
      console.error('[AITrainingService] Error marking corrected:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process next message for pending confirmations
   * Call this at the start of each chat message processing
   */
  async processNextMessage(sessionId, userMessage) {
    const pending = this.getPendingConfirmation(sessionId);

    if (!pending) {
      return { hadPending: false };
    }

    const isCorrection = this.checkForCorrection(userMessage);

    if (isCorrection) {
      await this.markCorrected(pending.candidateId, userMessage, sessionId);
      AITrainingService.pendingConfirmations.delete(sessionId);
      return {
        hadPending: true,
        wasCorrection: true,
        candidateId: pending.candidateId
      };
    } else {
      await this.confirmSuccess(pending.candidateId, {
        confirmedBy: 'next_message',
        nextMessage: userMessage.substring(0, 100)
      });
      AITrainingService.pendingConfirmations.delete(sessionId);
      return {
        hadPending: true,
        wasCorrection: false,
        candidateId: pending.candidateId
      };
    }
  }

  /**
   * Clear pending confirmation without processing
   */
  clearPendingConfirmation(sessionId) {
    AITrainingService.pendingConfirmations.delete(sessionId);
  }
}

module.exports = new AITrainingService();
