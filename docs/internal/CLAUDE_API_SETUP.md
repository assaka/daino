# Claude API Integration Setup

## Overview

The plugin system now uses Claude AI (Anthropic) to generate plugins with natural language. This enables:
- **No-Code AI Mode**: Fully automated plugin generation from templates
- **Guided Builder Mode**: AI-assisted configuration
- **Developer Mode**: AI code suggestions and debugging

## Prerequisites

You need an Anthropic API key to enable AI features.

## Getting Your API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Create a new API key
5. Copy the key (starts with `sk-ant-...`)

## Configuration

### Backend Setup

Add the following to your `backend/.env` file:

```env
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
```

### Environment Variables

The backend uses the following environment variable:
- `ANTHROPIC_API_KEY` - Your Anthropic API key (required for AI features)

## Verifying Setup

### Check AI Service Status

Visit the status endpoint:
```bash
curl https://your-backend-url.com/api/plugins/ai/status
```

Expected response:
```json
{
  "available": true,
  "model": "claude-3-5-sonnet-20241022",
  "message": "AI service is ready"
}
```

### Test API Generation

```bash
curl -X POST https://your-backend-url.com/api/plugins/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "nocode-ai",
    "prompt": "Create a product review system",
    "context": {}
  }'
```

## API Endpoints

### `/api/plugins/ai/generate`
Generate complete plugin from description
- **Method**: POST
- **Body**: `{ mode, prompt, context }`
- **Response**: Generated plugin code and configuration

### `/api/plugins/ai/suggest-code`
Get code suggestions for existing code
- **Method**: POST
- **Body**: `{ fileName, currentCode, prompt }`
- **Response**: Improved code suggestion

### `/api/plugins/ai/ask`
Ask questions about plugin development
- **Method**: POST
- **Body**: `{ question, pluginContext }`
- **Response**: AI answer

### `/api/plugins/ai/template`
Generate from pre-built templates
- **Method**: POST
- **Body**: `{ templateId, customization }`
- **Response**: Generated plugin

### `/api/plugins/ai/chat`
Stream AI conversation (SSE)
- **Method**: POST
- **Body**: `{ messages, mode }`
- **Response**: Server-Sent Events stream

### `/api/plugins/ai/status`
Check if AI service is available
- **Method**: GET
- **Response**: Service status

## Usage in Frontend

The AI assistant is automatically enabled in all 3 modes:

### No-Code AI Mode
```javascript
import FullyAIPluginBuilder from '@/components/plugins/FullyAIPluginBuilder';

<FullyAIPluginBuilder
  onSave={handleSave}
  onCancel={handleCancel}
  onSwitchMode={handleSwitchMode}
/>
```

### Guided Builder Mode
```javascript
import NoCodePluginBuilder from '@/components/plugins/NoCodePluginBuilder';

<NoCodePluginBuilder
  onSave={handleSave}
  onCancel={handleCancel}
  onSwitchMode={handleSwitchMode}
/>
```

### Developer Mode
```javascript
import DeveloperPluginEditor from '@/components/plugins/DeveloperPluginEditor';

<DeveloperPluginEditor
  plugin={plugin}
  onSave={handleSave}
  onClose={handleClose}
  onSwitchMode={handleSwitchMode}
/>
```

## Example Plugins

The system includes 3 example plugins for demonstration:

1. **Product Reviews** (No-Code AI) - `hamid2-product-reviews`
2. **Loyalty Points System** (Guided Builder) - `hamid2-loyalty-points`
3. **Advanced Email Campaigns** (Developer) - `hamid2-email-campaigns-pro`

## Troubleshooting

### "AI service not available"
- Check if `ANTHROPIC_API_KEY` is set in backend `.env`
- Verify the API key is valid
- Restart the backend server

### "Failed to generate plugin"
- Check backend logs for detailed error
- Verify you have API credits in your Anthropic account
- Try with a simpler prompt

### Rate Limits
- Claude API has rate limits based on your plan
- Default: 5 requests/minute for free tier
- Upgrade plan if needed: https://console.anthropic.com/settings/plans

## Cost Management

Claude API usage is billed per token:
- **Input tokens**: ~$3 per million tokens
- **Output tokens**: ~$15 per million tokens

Average plugin generation:
- Simple plugin: ~2,000 tokens (~$0.04)
- Complex plugin: ~8,000 tokens (~$0.15)

## Security Notes

- Never commit `.env` files with API keys
- Use environment variables in production
- Rotate API keys regularly
- Monitor usage in Anthropic Console

## Support

For issues related to:
- **API Integration**: Open issue on GitHub
- **Claude API**: Contact Anthropic support
- **Plugin System**: See `PLUGIN_BUILDER_MODES.md`

## Deployment

### Render.com
Add environment variable in Render dashboard:
```
Key: ANTHROPIC_API_KEY
Value: sk-ant-api03-your-actual-key-here
```

### Vercel (Frontend)
Not needed - API calls go through backend

### Docker
Add to `docker-compose.yml`:
```yaml
environment:
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

## Updates

Check for model updates:
- Current model: `claude-3-5-sonnet-20241022`
- Update `pluginAIService.js` to use newer models when available
- Monitor Anthropic changelog: https://docs.anthropic.com/en/release-notes/overview
