# DTAP Versioning Flow for Slot Configurations

This document outlines the enhanced Development, Test, Acceptance, Production (DTAP) workflow implemented for slot configurations in the DainoStore e-commerce platform.

## 🎯 Overview

The enhanced versioning system provides a proper DTAP flow with the following statuses:
- **Draft**: Work-in-progress configurations (Development)
- **Acceptance**: Preview/staging configurations (Test/Acceptance)
- **Published**: Live production configurations (Production)
- **Reverted**: Previously active configurations that have been superseded

## 🔄 Workflow States

```
Draft ──────────┐
                ├─→ Acceptance ──→ Published
Draft ──────────┘                      │
                                       │
                              ┌────────┘
                              ↓
                          Reverted
```

## 📋 Database Schema Enhancements

### New Columns Added:
- `status`: Enhanced ENUM with 'acceptance' status
- `acceptance_published_at`: Timestamp for acceptance publishing
- `acceptance_published_by`: User who published to acceptance
- `current_edit_id`: Tracks which configuration is being edited for revert operations

### Status Flow:
1. `draft` → `acceptance` (Publish to Preview)
2. `acceptance` → `published` (Deploy to Production)
3. `published` → `reverted` (When a newer version is published or reverted)

## 🛠️ API Endpoints

### New DTAP Endpoints:

#### Get Acceptance Configuration (Preview)
```
GET /api/slot-configurations/acceptance/:storeId/:pageType?
```
Returns the latest acceptance version for preview environments.

#### Publish to Acceptance
```
POST /api/slot-configurations/publish-to-acceptance/:configId
```
Publishes a draft to acceptance status for preview/testing.

#### Publish to Production
```
POST /api/slot-configurations/publish-to-production/:configId
```
Publishes an acceptance version to production status.

#### Current Edit Tracking
```
POST /api/slot-configurations/set-current-edit/:configId
GET /api/slot-configurations/current-edit/:storeId/:pageType?
```
Tracks which configuration is currently being edited for proper revert operations.

### Enhanced Revert Functionality:
- Sets higher version numbers to 'reverted' status
- Tracks the original version being reverted to via `current_edit_id`
- Creates a new published version based on the target reversion

## 🌍 Environment Configuration

### Production Storefront
- Uses `/published/` endpoint
- Only displays configurations with `status = 'published'`
- Ensures stable, tested configurations in production

### Preview/Staging Environment
- Uses `/acceptance/` endpoint
- Falls back to published if no acceptance version exists
- Allows testing of configurations before production deployment

### Development Environment
- Uses `/draft/` endpoint
- Allows real-time editing and testing of configurations

## 🔄 Versioning Strategy

### Version Numbers:
- Auto-incremented integer for each store/page combination
- Maintains chronological order regardless of status transitions
- Preserved during revert operations for audit trail

### Revert Process:
1. Identify target version to revert to
2. Mark all higher versions as 'reverted'
3. Create new published version with content from target
4. Set `current_edit_id` to track reversion source
5. Increment version number for new published version

## 🎛️ Frontend Integration

### Service Methods Added:
```javascript
// DTAP Publishing
slotConfigurationService.publishToAcceptance(configId)
slotConfigurationService.publishToProduction(configId)
slotConfigurationService.getAcceptanceConfiguration(storeId, pageType)

// Edit Tracking
slotConfigurationService.setCurrentEdit(configId, storeId, pageType)
slotConfigurationService.getCurrentEdit(storeId, pageType)
```

### UI Flow:
1. **Draft Phase**: Auto-save changes, show draft status
2. **Preview Phase**: "Publish to Preview" → Test in acceptance environment
3. **Production Phase**: "Deploy to Production" → Make live for users
4. **Revert**: Select any previous version to revert to

## 🔒 Benefits

### Risk Reduction:
- Two-stage deployment prevents untested changes going live
- Ability to test in preview environment before production
- Safe revert mechanism with full audit trail

### Collaboration:
- Multiple team members can review acceptance versions
- Clear separation between draft, preview, and live content
- Version tracking for accountability

### Scalability:
- Framework ready for extension versioning
- Can be extended to other content types
- Environment-specific configuration support

## 🚀 Migration

Run the enhanced versioning migration:
```bash
node backend/migrate-enhanced-versioning.js
```

This will:
- Add 'acceptance' to status ENUM
- Add new tracking columns
- Create necessary indexes
- Update column comments

## 🔮 Future Extensions

### Plugin/Extension Versioning:
The current system can be extended to support versioning for:
- Custom plugins
- Theme modifications  
- Third-party integrations
- Marketing campaigns
- A/B testing configurations

### Additional Environments:
Easy to add more environment types:
- `staging`: Pre-acceptance testing
- `beta`: Limited user testing
- `canary`: Gradual rollout testing

## 📊 Monitoring & Analytics

Future enhancements could include:
- Performance impact tracking per version
- User engagement metrics by configuration version
- A/B testing results integration
- Rollback frequency and reasons analysis