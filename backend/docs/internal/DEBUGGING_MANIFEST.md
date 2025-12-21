# Debugging Missing manifest.json in FileTree

## Backend Deployed: 27ec355e

This commit includes:
- Backend adds manifest.json to source_code array (line 875-881)
- Loads manifest from plugin_registry.manifest column
- Adds as file object with name: 'manifest.json'

## What to Check in Browser Console

When you open the Cart Hamid plugin in AI Studio, check console for:

### 1. API Response
```javascript
📦 Plugin API Response: { ... }
📄 Source Code Files: Array(X)
```

**Look for:** Does the source_code array include an object with `name: 'manifest.json'`?

### 2. Backend Logs (Render)
```
📦 Sending response for eea24e22-...
  📄 Generated Files: X
  📜 Scripts from DB: 2
  📡 Events from DB: 1
  🗄️  Entities from DB: 1
  🎮 Controllers from DB: 3
  🔄 Migrations from DB: X
  📚 Docs from DB: 1
```

**Look for:** Is manifest.json being added to the allFiles array?

### 3. FileTree Building
```javascript
🌳 Building file tree from files: Array(X)
📊 Total files to process: X
```

**Check:** Does this count include manifest.json?

## Expected Backend Code Path

```javascript
// Line 837: Load manifest from plugin_registry.manifest column
const manifest = typeof plugin[0].manifest === 'string'
  ? JSON.parse(plugin[0].manifest)
  : (plugin[0].manifest || {});

// Line 875-881: Add manifest.json to allFiles
allFiles.push({
  name: 'manifest.json',
  code: JSON.stringify(manifest, null, 2),
  doc_type: 'manifest',
  format: 'json'
});

// This should appear in response.data.source_code
```

## Frontend Code Path

```javascript
// Line 228: Get source_code from API
const allFiles = pluginData.source_code || [];

// Line 234: Build tree (should include manifest.json)
const tree = buildDynamicTree(allFiles);
```

## Possible Issues

### Issue 1: manifest.json not in source_code array
**Check:** Browser console → Plugin API Response → source_code array
**If missing:** Backend code not adding it (check Render logs)

### Issue 2: buildDynamicTree not handling root files
**Check:** Does buildDynamicTree handle files without "/" in name?
**Fix:** Ensure root files go to tree.children directly

### Issue 3: Caching
**Try:** Hard refresh (Ctrl+Shift+R)
**Try:** Clear browser cache
**Try:** Incognito mode

## Quick Test

In browser console, run:
```javascript
// Check API response
const response = await apiClient.get('plugins/registry/eea24e22-7bc7-457e-8403-df53758ebf76');
console.log('Source code files:', response.source_code);
console.log('Has manifest.json?', response.source_code.some(f => f.name === 'manifest.json'));
```

## Expected Result

Should see in console:
```
Has manifest.json? true
```

And in FileTree:
```
📁 Cart Hamid
  📄 manifest.json
  📄 README.md
  📁 components/
  ...
```
