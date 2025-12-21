# AI Training & RAG Architecture

## Overview

The Catalyst AI system uses a combination of **Retrieval Augmented Generation (RAG)** and **Self-Learning** to provide intelligent, context-aware responses that improve over time without manual intervention.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER PROMPT                                     │
│                    "show products under $50"                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         RAG CONTEXT RETRIEVAL                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │ ai_context_     │  │ ai_plugin_      │  │ ai_entity_      │          │
│  │ documents       │  │ examples        │  │ definitions     │          │
│  │                 │  │                 │  │                 │          │
│  │ Knowledge base  │  │ Code examples   │  │ Entity schemas  │          │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘          │
│           └────────────────────┼────────────────────┘                    │
│                                ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │              ai_training_candidates                          │        │
│  │           (promoted examples from learning)                  │        │
│  └─────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           LLM PROCESSING                                 │
│                                                                          │
│   System Prompt + RAG Context + User Prompt → AI Response                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SELF-LEARNING LOOP                               │
│                                                                          │
│   1. Capture prompt → ai_training_candidates (pending)                   │
│   2. Execute action → update outcome (success/failure)                   │
│   3. Apply rules → auto-promote successful patterns                      │
│   4. Promoted patterns → become RAG context for future prompts           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Architecture

### Master DB Tables (Shared across all stores)

| Table | Purpose | Records |
|-------|---------|---------|
| `ai_context_documents` | Knowledge base - tutorials, docs, best practices | Static, seeded |
| `ai_plugin_examples` | Working plugin code examples | Static, seeded |
| `ai_entity_definitions` | Entity schemas for admin operations | Static + learned |
| `ai_training_candidates` | Self-learning hub - prompts, outcomes, feedback | Dynamic, auto-populated |
| `ai_training_validations` | Validation audit trail | Dynamic |
| `ai_training_rules` | Auto-approval rules configuration | Static, configurable |

### Tenant DB Tables (Per-store)

| Table | Purpose |
|-------|---------|
| `ai_chat_sessions` | User's chat history (visible in UI) |
| `ai_input_history` | Autocomplete suggestions |
| `ai_usage_logs` | Per-store usage tracking |
| `ai_user_preferences` | User preferences |

---

## RAG System

### 1. Context Documents (`ai_context_documents`)

Global knowledge base containing:
- **Architecture docs** - How the system works
- **API references** - Available endpoints and methods
- **Best practices** - Recommended patterns
- **Tutorials** - Step-by-step guides

```sql
SELECT * FROM ai_context_documents
WHERE is_active = true
AND (mode = 'all' OR mode = :userMode)
ORDER BY priority DESC;
```

### 2. Plugin Examples (`ai_plugin_examples`)

Working code examples for plugin development:
- Complete plugin implementations
- Categorized by complexity (simple, intermediate, advanced)
- Tagged with features and use cases

```sql
SELECT * FROM ai_plugin_examples
WHERE is_active = true
AND category = :relevantCategory
ORDER BY usage_count DESC;
```

### 3. Entity Definitions (`ai_entity_definitions`)

Schema definitions for admin entities (products, orders, customers, etc.):

```javascript
{
  entity_name: 'products',
  table_name: 'products',
  supported_operations: ['list', 'get', 'create', 'update', 'delete'],
  fields: [...],
  intent_keywords: ['product', 'item', 'inventory'],
  example_prompts: ['show all products', 'create a new product']
}
```

Used for:
- Intent detection (matching user prompts to entities)
- Operation validation
- Field mapping

### 4. Training Candidates (`ai_training_candidates`)

Learned patterns from real user interactions:

```sql
SELECT user_prompt, ai_response, detected_entity, detected_operation
FROM ai_training_candidates
WHERE training_status IN ('approved', 'promoted')
AND outcome_status = 'success'
ORDER BY success_count DESC;
```

---

## Self-Learning System

### Flow Diagram

```
┌──────────────────┐
│   User Prompt    │
│ "show products"  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│              captureTrainingCandidate()                   │
│                                                           │
│  INSERT INTO ai_training_candidates:                      │
│    user_prompt: "show products"                           │
│    detected_entity: "products"                            │
│    detected_operation: "list"                             │
│    outcome_status: "pending"                              │
│    training_status: "candidate"                           │
│    confidence_score: 0.92                                 │
└────────┬─────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│              AI Executes Action                           │
│                                                           │
│  - Query products table                                   │
│  - Format response                                        │
│  - Return to user                                         │
└────────┬─────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│              updateOutcome()                              │
│                                                           │
│  UPDATE ai_training_candidates:                           │
│    outcome_status: "success"                              │
│    success_count: success_count + 1                       │
│    outcome_details: { rows_returned: 42 }                 │
└────────┬─────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│              checkAndApplyRules()                         │
│                                                           │
│  Check ai_training_rules:                                 │
│    - success_count >= 3?                                  │
│    - failure_count == 0?                                  │
│    - confidence >= 0.8?                                   │
│                                                           │
│  IF all conditions met:                                   │
│    training_status = "approved"                           │
└────────┬─────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│              promoteToEntityDefinitions()                 │
│                                                           │
│  UPDATE ai_entity_definitions                             │
│  SET example_prompts = example_prompts || "show products" │
│  WHERE entity_name = "products"                           │
│                                                           │
│  → Prompt now appears in RAG context for future users     │
└──────────────────────────────────────────────────────────┘
```

### Training Status Lifecycle

```
candidate → approved → promoted
    │           │
    │           └──→ (stays approved, used for context)
    │
    └──→ rejected (if failures exceed threshold)
```

| Status | Description |
|--------|-------------|
| `candidate` | New prompt, awaiting validation |
| `approved` | Validated successful, ready for use |
| `promoted` | Added to entity definitions |
| `rejected` | Failed validation, excluded from training |

### Auto-Approval Rules

Default rules in `ai_training_rules`:

```sql
-- Auto-approve high-confidence repeated success
{
  "min_success_count": 3,
  "max_failure_count": 0,
  "min_confidence": 0.8
} → approve

-- Auto-approve with user positive feedback
{
  "has_positive_feedback": true,
  "min_success_count": 1
} → approve

-- Flag low confidence for review
{
  "max_confidence": 0.6
} → flag_for_review

-- Auto-reject repeated failures
{
  "min_failure_count": 3
} → reject

-- Auto-reject reverted actions
{
  "outcome_status": "reverted"
} → reject
```

---

## Service Architecture

### aiContextService.js
- Retrieves RAG context (documents, examples, patterns)
- Saves chat messages to tenant DB
- Captures training candidates via aiTrainingService

### aiTrainingService.js
- `captureTrainingCandidate()` - Creates new candidate
- `updateOutcome()` - Updates success/failure
- `checkAndApplyRules()` - Applies auto-approval rules
- `promoteApprovedCandidates()` - Promotes to entity definitions

### aiEntityService.js
- Loads entity definitions for intent detection
- Matches prompts to entities using keywords

### aiLearningService.js
- Records user feedback
- Generates learning statistics
- Retrieves successful patterns for context

---

## API Integration Points

### Chat Endpoint Flow

```javascript
// POST /api/ai/chat
async function handleChat(req, res) {
  const { message, storeId, userId } = req.body;

  // 1. Get RAG context
  const context = await aiContextService.getContext({ query: message });

  // 2. Detect intent & entity
  const intent = await detectIntent(message, context.entities);

  // 3. Capture for training (if admin_entity)
  let candidateId;
  if (intent.type === 'admin_entity') {
    const capture = await aiTrainingService.captureTrainingCandidate({
      userPrompt: message,
      detectedEntity: intent.entity,
      detectedOperation: intent.operation,
      ...
    });
    candidateId = capture.candidateId;
  }

  // 4. Execute action
  const result = await executeAction(intent, storeId);

  // 5. Update training outcome
  if (candidateId) {
    await aiTrainingService.updateOutcome(
      candidateId,
      result.success ? 'success' : 'failure',
      result.details
    );
  }

  // 6. Save to chat history (tenant DB)
  await aiContextService.saveChatMessage({
    userId, storeId, role: 'assistant',
    content: result.response,
    wasSuccessful: result.success
  });

  return res.json(result);
}
```

---

## Monitoring & Analytics

### Training Statistics

```sql
-- Success rate by entity
SELECT
  detected_entity,
  COUNT(*) as total,
  SUM(CASE WHEN outcome_status = 'success' THEN 1 ELSE 0 END) as successes,
  ROUND(AVG(confidence_score), 2) as avg_confidence
FROM ai_training_candidates
GROUP BY detected_entity;

-- Promotion pipeline
SELECT
  training_status,
  COUNT(*) as count
FROM ai_training_candidates
GROUP BY training_status;
```

### Useful Queries

```sql
-- Most successful prompts (candidates for promotion)
SELECT user_prompt, detected_entity, success_count
FROM ai_training_candidates
WHERE training_status = 'candidate'
AND outcome_status = 'success'
ORDER BY success_count DESC
LIMIT 20;

-- Failed patterns to investigate
SELECT user_prompt, detected_entity, failure_count, outcome_details
FROM ai_training_candidates
WHERE failure_count > 0
ORDER BY failure_count DESC;

-- Recently promoted patterns
SELECT user_prompt, detected_entity, promoted_at
FROM ai_training_candidates
WHERE training_status = 'promoted'
ORDER BY promoted_at DESC
LIMIT 10;
```

---

## Best Practices

### 1. Seeding Initial Context
- Populate `ai_context_documents` with comprehensive documentation
- Add `ai_entity_definitions` for all admin entities
- Include diverse `example_prompts` in entity definitions

### 2. Training Quality
- Monitor `ai_training_candidates` for anomalies
- Review low-confidence candidates manually
- Adjust `ai_training_rules` thresholds based on data

### 3. Performance
- Index frequently queried columns
- Cache static context (documents, examples)
- Limit RAG context size to relevant items

### 4. Privacy
- Chat history stored in tenant DB only
- Master DB contains anonymized training patterns
- No PII in training candidates

---

## Migration Notes

### Consolidated Tables (June 2025)

The following tables were consolidated into `ai_training_candidates`:
- `ai_chat_history` → Chat stays in tenant `ai_chat_sessions`
- `ai_context_usage` → Merged tracking fields
- `ai_code_patterns` → Successful patterns from training
- `ai_learning_insights` → Dropped (never used)
- `ai_training_metrics` → Dropped (never used)

Run `consolidate-ai-tables.sql` to apply migration.
