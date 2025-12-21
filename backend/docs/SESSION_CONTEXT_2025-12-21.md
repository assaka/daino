# Session Context - December 21, 2025

## Summary of Work Done

### 1. Created Q&A Training Documents
Analyzed ALL route files in the codebase and created comprehensive training documents:

- **`backend/docs/ECOMMERCE_QA_TRAINING.md`** - 25+ Q&A topics covering:
  - Coupons, shipping, payments, tax, CMS, customers
  - Email templates, product labels, wishlist, cart, delivery
  - SEO, redirects, A/B testing, credits, orders
  - Cookie consent, configurable products, analytics

- **`backend/docs/PLATFORM_FEATURES_TRAINING.md`** - Platform features Q&A
- **`backend/docs/API_ROUTES_TRAINING.md`** - API routes documentation

### 2. Fixed Intent Detection Problem

**Problem:** When asking "How do I create a coupon?", the AI created a coupon (SAVE20) instead of providing information.

**Solution:** Added "info" intent type to distinguish informational questions from action requests.

**Files Modified:**

#### `backend/src/services/aiEntityService.js`
- Added "info" to the intent types
- Added guidance to distinguish questions from actions:
  - Questions: "How do I...", "What is...", "Can you explain..." → Use intent "info"
  - Actions: "Create a...", "Add...", "Delete..." → Use intent "admin_entity"
- Added 5 examples of informational questions

#### `backend/src/routes/ai.js`
- Added handler for `intent.intent === 'info'` at line ~7900
- Uses RAG context (training documents) to provide informational answers
- Does NOT take any database actions
- Returns helpful explanations from training docs

### 3. Deployment Status
- All changes committed and pushed to git
- Commit: `1fce8dce` - "Add info intent to distinguish questions from action requests"
- Should be deployed on Render

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/src/services/aiEntityService.js` | Intent detection prompt with "info" intent |
| `backend/src/routes/ai.js` | Intent handlers including new "info" handler |
| `backend/docs/ECOMMERCE_QA_TRAINING.md` | Q&A training data for AI |
| `backend/src/services/database/ConnectionManager.js` | Multi-tenant DB connections |

## How Intent Detection Works Now

```
User: "How do I create a coupon?"
  → aiEntityService detects intent: "info", entity: "coupons"
  → ai.js routes to info handler
  → Uses RAG context from training docs
  → Returns informational answer (no action taken)

User: "Create a 20% coupon SUMMER20"
  → aiEntityService detects intent: "admin_entity", entity: "coupons", operation: "create"
  → ai.js routes to admin_entity handler
  → Actually creates the coupon in database
```

## Auto-Training System

- URL: Admin UI → AI Training (or `/api/ai-training/auto-train`)
- Scans markdown files in `backend/docs/`
- Generates embeddings using OpenAI
- Stores in `ai_context_documents` table with pgvector

Last run results:
- 3 new documents imported
- 383 skipped (already existed)
- Embeddings generated for all 3 new documents

## Testing After Restart

1. Wait for Render deployment to complete
2. Go to AI Chat in Admin UI
3. Test: "How do I create a coupon?"
4. Should receive informational response, NOT create a coupon

## Git Status
```
Branch: main
Last commit: 1fce8dce - Add info intent to distinguish questions from action requests
Status: Clean, pushed to origin
```
