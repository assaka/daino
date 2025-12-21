# AI Studio Testing Guide

## Prerequisites

1. **Backend Running**: Render backend at `https://backend.dainostore.com`
2. **Frontend Running**: Vercel frontend at `https://www..dainostore.com`
3. **Database**: Supabase database with tables
4. **Environment**: `ANTHROPIC_API_KEY` set in backend

## Database Check

Run this script to verify tables exist:
```bash
node backend/check-and-create-ai-tables.js
```

Expected output:
- ✅ plugin_marketplace table exists
- ✅ ai_usage_logs table exists
- ✅ credit_transactions table exists
- Count of existing plugins

## Testing Checklist

### 1. AI Studio Access (Both Methods)

**Method 1: Standalone Page**
- [ ] Navigate to `/admin/ai-studio`
- [ ] Should see full-page chat interface
- [ ] Header shows "AI Studio" with badge
- [ ] Chat window loads immediately

**Method 2: Global Panel**
- [ ] Press `Ctrl+K` (or `Cmd+K`) from anywhere
- [ ] Floating button visible (bottom-right, purple gradient)
- [ ] Panel slides in from right
- [ ] Can toggle fullscreen/partial
- [ ] ESC closes panel
- [ ] Click outside closes panel (partial mode)

### 2. Chat Interface

**Basic Chat**
- [ ] Type: "Hello" → AI responds conversationally
- [ ] Type: "What can you do?" → AI lists capabilities
- [ ] Message history preserved
- [ ] Scroll works correctly
- [ ] Input auto-focuses after send

### 3. Plugin Generation

**Create Plugin**
- [ ] Type: "Create a customer wishlist plugin"
- [ ] AI detects intent: plugin generation
- [ ] Shows loading state
- [ ] Returns plugin preview in chat
- [ ] Preview shows:
  - Plugin name, description
  - Features list
  - Explanation
  - "View Code" toggle (collapsed by default)
  - "Install" button
- [ ] Toggle code → Shows generated files
- [ ] Credits deducted (50 credits)
- [ ] Credit usage shown in message

**Modify Plugin**
- [ ] From Plugins page → "My Plugins" tab
- [ ] Click "Edit in AI Studio" on a plugin
- [ ] AI Studio opens with plugin context
- [ ] Type: "Add email notifications"
- [ ] AI modifies plugin code
- [ ] Shows updated preview

### 4. Translation (Entity-Based)

**Translate Entities**
- [ ] Type: "Translate all products to French"
- [ ] AI detects intent: translation
- [ ] Parses: entities=[products], languages=[fr]
- [ ] Returns translation summary
- [ ] Shows entity counts and languages
- [ ] Credits deducted (20 credits)

**Multi-Entity Translation**
- [ ] Type: "Translate products and categories to French and German"
- [ ] AI parses multiple entities and languages
- [ ] Executes translations
- [ ] Shows detailed results

**Content Creation + Translation**
- [ ] Type: "Create blog article about winter sale and translate to all active languages"
- [ ] AI creates content + translates
- [ ] Shows created content
- [ ] Shows translation summary

### 5. Layout Generation

**Generate Layout**
- [ ] Type: "Add a hero section to the homepage with video background"
- [ ] AI detects intent: layout generation
- [ ] Generates layout config code
- [ ] Shows config preview in chat
- [ ] Credits deducted (40 credits)

**Modify Layout**
- [ ] Type: "Add a newsletter signup section"
- [ ] AI generates additional config
- [ ] Can copy code
- [ ] Can save to file (TODO)

### 6. Code Editing

**Generate Patch**
- [ ] Type: "Add error handling to the fetchUserData function"
- [ ] Provide source code
- [ ] AI generates RFC 6902 JSON patch
- [ ] Shows patch in chat
- [ ] Can copy patch
- [ ] Credits deducted (25 credits)

### 7. Plugins Page

**Navigation**
- [ ] Navigate to `/plugins` or `/admin/plugins`
- [ ] Page loads successfully
- [ ] Title shows "Plugins" (not "Plugin Marketplace")

**Tabs**
- [ ] "All Plugins" tab shows all plugins
- [ ] "Marketplace" tab shows marketplace plugins
- [ ] "Installed" tab shows installed plugins
- [ ] "My Plugins" tab shows user-created plugins
- [ ] Badge counts correct on tabs

**Actions**
- [ ] "Create with AI" button → Opens AI Studio (Ctrl+K)
- [ ] "Install from GitHub" button → Opens GitHub dialog
- [ ] "Edit in AI Studio" button on My Plugins → Opens AI Studio with context
- [ ] Plugin cards render correctly
- [ ] Install/Uninstall buttons work
- [ ] Configure button works

### 8. Credit System

**Credit Tracking**
- [ ] Check user credits in database
- [ ] Generate plugin → Credits deducted
- [ ] Credit transaction recorded in `credit_transactions`
- [ ] Usage logged in `ai_usage_logs`
- [ ] Insufficient credits → Error message shown

**Credit Display**
- [ ] Credits shown in chat messages
- [ ] User credits visible somewhere (sidebar/header?)

### 9. Existing Data Integration

**Existing Plugins**
- [ ] Previous plugins still visible in Plugins page
- [ ] Can install/uninstall existing plugins
- [ ] Plugin code accessible
- [ ] Hooks/Events still work

**Existing Translations**
- [ ] Translation entities accessible
- [ ] Can view existing translations
- [ ] AI can translate entities
- [ ] Translations saved to correct tables

**Existing Layouts**
- [ ] Layout configs (*_config.js) accessible
- [ ] AI can read existing configs
- [ ] AI can modify configs
- [ ] Configs saved correctly

### 10. Error Handling

**API Errors**
- [ ] 500 errors shown with helpful message
- [ ] Insufficient credits → Clear error
- [ ] Invalid input → Validation message
- [ ] Network errors → Retry or error state

**UI Errors**
- [ ] Loading states work
- [ ] Error messages display correctly
- [ ] Can recover from errors
- [ ] Reset/retry functionality works

## Known Issues to Fix

1. **Marketplace API 500 Error**:
   - `/api/plugins/marketplace` returning 500
   - Likely: `plugin_marketplace` table doesn't exist in production
   - Fix: Run migration on Render database

2. **Auth Middleware**:
   - Routes use `authMiddleware` instead of `authenticateToken`
   - Need to verify which middleware is correct
   - Check if user auth is working

3. **TODO Items**:
   - Plugin installation from AI Studio
   - Layout save to file
   - Entity translation actual implementation
   - Code patch application

## Success Criteria

✅ AI Studio accessible both ways (page + panel)
✅ Chat interface responsive and intuitive
✅ Plugin generation works end-to-end
✅ Translation detects entities and languages
✅ Layout generation returns config
✅ Credits deducted correctly
✅ Existing plugins preserved and accessible
✅ No breaking changes to existing features

## Next Steps After Testing

1. Fix any bugs found
2. Implement TODO items
3. Complete entity translation backend
4. Add plugin installation flow
5. Add layout save functionality
6. Optimize performance
7. Add error recovery
8. User acceptance testing
