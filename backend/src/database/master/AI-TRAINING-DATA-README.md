# AI Training Data for DainoStore Workspace

## Overview

This directory contains SQL seed files for training the AI workspace assistant with comprehensive Q&A pairs and system documentation.

## Files

### 1. `seed-ai-training-candidates.sql` (Original)
- ~45 basic training examples
- Original seed data

### 2. `seed-ai-workspace-knowledge.sql`
- ~50 deep knowledge examples
- Covers:
  - Destructive operations & confirmation requirements
  - Slot management & layout modifications
  - AI Shopping requirements (GTIN, MPN, highlights)
  - Product-category relationships
  - DainoStore-specific operations
  - Basic troubleshooting

### 3. `seed-ai-system-documentation.sql`
- 12 RAG context documents for `ai_context_documents` table
- Deep system knowledge for:
  - Confirmation system architecture
  - Slot system (UnifiedSlotRenderer, slot types)
  - AI Shopping feed requirements
  - Product-category relationships
  - Destructive operation definitions
  - Webshop best practices

### 4. `seed-ai-training-comprehensive.sql` (NEW - 340 examples)
- Comprehensive training data covering all admin operations
- Categories:
  | Category | Examples |
  |----------|----------|
  | Products | 30 |
  | Orders | 25 |
  | Customers | 25 |
  | Categories | 20 |
  | Coupons | 20 |
  | Shipping | 20 |
  | Inventory | 20 |
  | Analytics | 20 |
  | Settings | 20 |
  | SEO | 20 |
  | Translations | 20 |
  | CMS Pages | 20 |
  | Layout/Slots | 20 |
  | Integrations | 25 |
  | Email Templates | 25 |
  | Troubleshooting | 30 |

## How to Run

### Via Supabase SQL Editor (Recommended)

1. Open Supabase Dashboard for your master database
2. Go to **SQL Editor**
3. Run each file in order:
   ```
   1. seed-ai-workspace-knowledge.sql
   2. seed-ai-system-documentation.sql
   3. seed-ai-training-comprehensive.sql
   ```

### Safety

All files use `ON CONFLICT DO NOTHING` - safe to re-run without duplicating data.

## Database Tables

### `ai_training_candidates`
Stores Q&A training pairs for the AI assistant.

```sql
- user_prompt: The user's question/command
- ai_response: The AI's trained response
- detected_intent: Intent classification (admin_ai, help, etc.)
- detected_entity: Entity type (product, order, customer, etc.)
- detected_operation: Operation type (create, read, update, delete, bulk_update)
- training_status: 'suggestion' or 'needs_confirmation'
- confidence_score: Optional confidence value
- metadata: JSON with additional context
```

### `ai_context_documents`
Stores RAG knowledge documents for context retrieval.

```sql
- type: Document category (slot_system, ai_shopping_system, etc.)
- title: Document title
- content: Full document content (markdown)
- category: Grouping category
- keywords: Search keywords array
- priority: Display/retrieval priority
```

## Training Status Values

- `suggestion`: Safe operation, AI can execute directly
- `needs_confirmation`: Requires user confirmation before execution
- `promoted`: Pre-approved, high-confidence training data

## Future Improvements

### Areas to Expand
- [ ] More variant/attribute management examples
- [ ] Multi-store management scenarios
- [ ] Advanced analytics queries
- [ ] Bulk operation edge cases
- [ ] Error recovery scenarios
- [ ] API/webhook configuration details
- [ ] Theme customization examples
- [ ] Plugin development guidance

### Maintenance
- Review and update examples quarterly
- Add new examples based on user feedback
- Track which prompts users ask that aren't covered
- Update responses when features change

## Check Script

Use `backend/scripts/check-ai-training-data.js` to verify what data exists before running seeds:

```bash
cd backend
node scripts/check-ai-training-data.js
```

Requires: `MASTER_SUPABASE_URL` and `MASTER_SUPABASE_SERVICE_KEY` environment variables.

## Total Training Data

After running all seed files:
- **~550+ training examples** in `ai_training_candidates`
- **12 context documents** in `ai_context_documents`

## Key Patterns in Training Data

### Destructive Operations (require confirmation)
- Bulk delete (products, customers, categories)
- Currency changes
- Settings reset
- Language removal
- Account deletion (GDPR)

### Safe Operations (no confirmation needed)
- Read/list operations
- Single item updates
- Create operations
- Status changes (activate/deactivate)

### AI Shopping Requirements
Products need for AI discovery:
- GTIN (barcode) or MPN
- Brand name
- Detailed description (100-500 chars)
- Product highlights (5 key points)
- High-quality images (800x800+)
- Accurate pricing and availability

### Slot System
Available slot types:
- `text` - Rich text content
- `image` - Single image with link
- `button` - Interactive buttons
- `component` - React components (ProductReviews, etc.)
- `container` - Groups of slots
- `html` - Raw HTML (sanitized)
