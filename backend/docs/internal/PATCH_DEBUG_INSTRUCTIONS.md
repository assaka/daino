# Diff Tab Debugging Instructions

The backend is working correctly - we have verified:
- ✅ Database has 1 active customization for `src/pages/Cart.jsx`
- ✅ Database has 1 snapshot with proper diff data
- ✅ Service layer generates 1 patch with diff hunks
- ✅ API endpoint returns proper response format

The issue is in the frontend. To debug:

## Step 1: Open Browser Console
1. Open the application in your browser
2. Open Developer Tools (F12)
3. Go to Console tab

## Step 2: Test File Selection
1. Navigate to the AI Context Window or Code Editor
2. Click on `src/pages/Cart.jsx` file in the file tree
3. Watch the console for these logs:

### Expected FileTreeNavigator Logs:
```
🔍 Fetching hybrid customization patches for file: src/pages/Cart.jsx
📡 API URL: hybrid-patches/src%2Fpages%2FCart.jsx
🔐 Auth token available: true
📡 API Response received: [object]
📋 Response type: object
📋 Response keys: success,data,message
📋 Found 1 hybrid customization patches for src/pages/Cart.jsx: [...]
✅ Loaded 1 hybrid patches for src/pages/Cart.jsx, dispatched hybridPatchesLoaded event
```

### Expected DiffPreviewSystem Logs:
```
🎯 DiffPreviewSystem received hybridPatchesLoaded event: [...]
📋 Hybrid patches loaded in DiffPreviewSystem: [...]
🔍 Checking latest patch for diffHunks: {...}
✅ Setting hybrid patches in DiffPreviewSystem
```

## Step 3: Check for Issues

### If you see authentication error:
```
❌ Failed to fetch hybrid customization patches for src/pages/Cart.jsx: [401 error]
🔐 Auth token available: false
```
**Fix**: Authentication issue - need to log in or check token

### If you see empty response:
```
📭 No hybrid customization data returned for src/pages/Cart.jsx
📋 Condition check results:
   - hybridPatchData exists: true
   - hybridPatchData.success: false
```
**Fix**: API response format issue

### If FileTreeNavigator works but DiffPreviewSystem doesn't receive event:
```
✅ Loaded 1 hybrid patches for src/pages/Cart.jsx, dispatched hybridPatchesLoaded event
[No DiffPreviewSystem logs]
```
**Fix**: Event listener not attached or component not mounted

### If DiffPreviewSystem receives event but wrong file:
```
🔄 Event is for different file or no match:
   eventForFile: src/pages/Cart.jsx
   currentFile: some-other-file.jsx
```
**Fix**: File path mismatch - DiffPreviewSystem fileName prop issue

### If patches have no diffHunks:
```
❌ Latest patch has no diffHunks, not setting patches
```
**Fix**: Service layer diffHunks generation issue

## Step 4: Expected Result
After fixing the issue, you should see the Diff tab display:
- Hybrid Customization Diff header
- File name: `src/pages/Cart.jsx`  
- Stats: "2 changes +1 additions -1 deletions"
- Expandable diff hunk showing the code change

## Current Status
Enhanced debugging has been added to both components. Select `src/pages/Cart.jsx` and check the console logs to identify the exact failure point.