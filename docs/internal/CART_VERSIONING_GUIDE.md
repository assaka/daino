# Cart Slot Editor - Versioning System Guide

## 🎯 Overview

The Cart Slot Editor now includes a comprehensive versioning system that allows you to:
- Work on draft configurations without affecting the live site
- Publish changes when ready
- View version history of all published configurations
- Revert to any previous version

## 📍 Where to Find the Features

### 🚀 Publish Function
**Location**: Right sidebar in Cart Slots Editor (edit mode only)

The **PublishPanel** component displays:
- Current publish status (Draft/Published/Unpublished)
- Publish button (when draft changes exist)
- Auto-save indicators in the top toolbar

### 📚 Version History
**Location**: Same sidebar - click "Show Version History" button

Features:
- Lists all published versions chronologically
- Shows version numbers and publish dates
- "Revert" button for each version (except reverted ones)
- Indicates reverted versions with red badges

## 🔄 How the Workflow Works

### 1. **Draft Creation**
- When you open CartSlotsEditor → automatically creates/loads draft
- If published version exists → draft is based on latest published
- If no published version → draft uses default settings
- Only one draft per user/store/page combination

### 2. **Auto-Save System**
- All changes are automatically saved to draft (2-second debounce)
- "Draft Changes" badge appears in toolbar when unsaved changes exist
- "Auto-saving..." badge shows during save operations

### 3. **Publishing**
- Click "Publish Changes" button in sidebar
- Converts draft status to "published"
- Timestamps the publication
- Makes changes live on storefront immediately

### 4. **Version Management**
- Each publish creates a new version number
- Version history shows only published versions
- Revert creates new published version based on selected version
- Higher version numbers are marked as "reverted"

## 🛒 Storefront Integration

### Cart.jsx Changes
The storefront Cart component now:
- **Always uses latest published configuration** (never drafts)
- Falls back to default config when no published version exists
- Auto-updates when new versions are published
- Maintains backward compatibility

## 🔧 Technical Implementation

### Database Schema
New `slot_configurations` fields:
- `status`: `'draft'` | `'published'` | `'reverted'`
- `version_number`: Integer version counter
- `page_type`: Type of page (`'cart'`, etc.)
- `published_at`: Timestamp of publication
- `published_by`: User who published
- `parent_version_id`: Reference to parent version

### API Endpoints
- `GET /api/slot-configurations/draft/:storeId/:pageType` - Get/create draft
- `GET /api/slot-configurations/published/:storeId/:pageType` - Get published config
- `PUT /api/slot-configurations/draft/:configId` - Update draft
- `POST /api/slot-configurations/publish/:configId` - Publish draft
- `GET /api/slot-configurations/history/:storeId/:pageType` - Version history
- `POST /api/slot-configurations/revert/:versionId` - Revert to version

### React Components
- **`PublishPanel.jsx`** - Main publish interface with history
- **`useDraftConfiguration.js`** - React hook for draft management
- **`slotConfigurationService.js`** - API client service

## 🚦 Usage Instructions

### For Editors:
1. **Make Changes**: Edit slots normally - changes auto-save as drafts
2. **Check Status**: Look for "Draft Changes" badge in toolbar
3. **Publish**: Click "Publish Changes" in sidebar when ready
4. **Review History**: Click "Show Version History" to see past versions
5. **Revert**: Click "Revert" next to any version to go back

### For Developers:
1. **Migration**: Run `node migrate-supabase-versioning.js` for production
2. **Local Dev**: Use `node create-versioned-slot-configurations.js`
3. **Integration**: Import and use `PublishPanel` component
4. **API**: Use `slotConfigurationService` for programmatic access

## ✅ Status Indicators

| Status | Meaning | Action Available |
|--------|---------|------------------|
| 🟢 **Published** | No unpublished changes | None |
| 🟡 **Draft changes ready** | Unpublished edits exist | Publish |
| 🔴 **Unpublished draft** | Draft exists, nothing published | Publish |
| ⚫ **No configuration** | No draft or published version | Auto-creates draft |

## 🎉 Benefits

- **Safe Editing**: Work on changes without affecting live site
- **Version Control**: Full history of all changes
- **Easy Rollback**: Revert to any previous version instantly
- **Team Collaboration**: See who published what and when
- **Auto-Save**: Never lose your work
- **Performance**: Optimized database queries with proper indexing