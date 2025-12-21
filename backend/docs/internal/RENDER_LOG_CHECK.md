# Render Log Debugging for File Deletion

## What to Check in Render Logs

Since CORS is now working, the DELETE request IS reaching the backend. Check Render logs for these entries:

### Expected Log Output

```
🗑️ DELETE /registry/:id/files called
   req.params: { id: 'eea24e22-7bc7-457e-8403-df53758ebf76' }
   req.body: { path: '/README.md' }
📝 Normalized path: README.md
```

### Possible Scenarios:

#### 1. README.md is Protected
```
❌ Attempted to delete critical file
Response: 400 "Cannot delete critical files (manifest.json, README.md)"
```
**Solution:** Don't delete README.md or manifest.json

#### 2. File Not in Any Table
```
🎯 Attempting to delete from plugin_scripts, fileName: README.md
✅ Deleted script from plugin_scripts: README.md
📊 Delete operation result: { deleted: true, attemptedTable: 'plugin_scripts' }
```
If you see `deleted: true` but file still appears, the FileTree hasn't reloaded.

#### 3. Table Doesn't Exist
```
❌ plugin_entities delete error: relation "plugin_entities" does not exist
❌ File not found in any table
Response: 404 "File not found or could not be deleted. Attempted table: plugin_entities"
```
**Solution:** Create the tables with `node backend/run-core-plugin-tables.js`

#### 4. File Not Found in Database
```
🎯 Attempting to delete from plugin_entities, entityName: SomeEntity
✅ Deleted entity from plugin_entities: SomeEntity
   Delete result: [] (0 rows affected)
📊 Delete operation result: { deleted: false }
Response: 404 "File not found"
```
**Solution:** File exists in FileTree but not in database (metadata issue)

## How to Check Render Logs

1. Go to https://dashboard.render.com
2. Find `daino-backend-fzhu` service
3. Click "Logs" tab
4. Look for recent DELETE request
5. Find the detailed logs we added

## Quick Test

Try deleting a non-critical file like:
- `components/CartAlertWidget.jsx`
- `events/cart_viewed.js`
- `entities/HamidCart.json`

Then check if logs show `deleted: true` or `deleted: false`.

## Common Issues

### Issue: File shows in FileTree but not deleted
**Cause:** File exists in JSON but not in database tables
**Fix:** Migration from old to new structure incomplete

### Issue: deleted: true but file still appears
**Cause:** Frontend FileTree not reloaded
**Fix:** Should auto-reload after delete (already in code)

### Issue: Table not found error
**Cause:** plugin_entities/plugin_controllers tables don't exist
**Fix:** Run `node backend/run-core-plugin-tables.js` on production

## Next Steps

1. **Check Render logs** for the DELETE request
2. **Find the exact error** from backend
3. **Share the logs** so we can fix the specific issue
4. **Test with non-protected file** to isolate the problem
