# DainoStore AI Studio - Future Implementation TODO

## 🎯 Overview
This document tracks future implementation tasks for DainoStore AI Studio features that will be built after the core plugin architecture is complete.

---

## 📦 2. Code Generation & Storage System

### **Current State**
- ✅ AI Studio UI component created
- ✅ Frontend chat interface ready
- ⏳ Code generation backend pending

### **Future Implementation**

#### **Database Schema for Generated Code**
```sql
-- Store all AI-generated code in database
CREATE TABLE ai_generated_code (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  user_id UUID REFERENCES users(id),

  -- Code metadata
  component_type VARCHAR(50),  -- 'plugin', 'theme', 'component', 'hook', 'route'
  name VARCHAR(255),
  description TEXT,

  -- Generated code storage
  code_files JSON,  -- { "Controller.js": "...", "routes.js": "...", "model.js": "..." }

  -- AI metadata
  prompt TEXT,
  ai_model VARCHAR(50),
  generation_timestamp TIMESTAMP,

  -- Status & deployment
  status VARCHAR(20),  -- 'draft', 'testing', 'deployed', 'archived'
  is_active BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,

  -- Relationships
  parent_id UUID,  -- For versioning
  dependencies JSON,  -- Required plugins/packages

  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Store individual files
CREATE TABLE ai_code_files (
  id UUID PRIMARY KEY,
  generated_code_id UUID REFERENCES ai_generated_code(id),

  file_path VARCHAR(500),  -- 'plugins/stripe-payment/Controller.js'
  file_type VARCHAR(50),   -- 'controller', 'route', 'model', 'view', 'hook'
  content TEXT,            -- Actual code

  language VARCHAR(20),    -- 'javascript', 'jsx', 'sql'

  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### **Plugin Architecture Integration**

**When creating a plugin with AI:**

```javascript
User: "Create a Stripe payment plugin with subscriptions"

AI generates:
├── plugins/
│   └── stripe-payment/
│       ├── manifest.json          // Plugin metadata
│       ├── Controller.js          // Payment logic
│       ├── routes.js              // API endpoints
│       ├── model.js               // Database schema
│       ├── hooks/
│       │   ├── beforeCheckout.js  // Pre-checkout validation
│       │   └── afterPayment.js    // Post-payment processing
│       ├── views/
│       │   ├── SettingsPanel.jsx  // Admin UI
│       │   └── PaymentForm.jsx    // Frontend UI
│       └── tests/
│           └── payment.test.js

All stored in database → Activated → Deployed to runtime
```

#### **Code Generation Flow**

```
1. User prompt → AI Studio
   ↓
2. AI analyzes context & requirements
   ↓
3. Generate code structure:
   - Controllers (business logic)
   - Routes (API endpoints)
   - Models (database schemas)
   - Hooks (lifecycle events)
   - Views (UI components)
   ↓
4. Store in ai_generated_code table
   ↓
5. User reviews code in AI Studio "Code" tab
   ↓
6. User can:
   - Edit code manually
   - Request AI modifications
   - Test in sandbox
   - Deploy to production
   ↓
7. On deploy:
   - Create plugin record
   - Store code files
   - Register hooks/routes
   - Activate plugin
```

#### **Required Services**

**`backend/src/services/ai-code-generator.js`**
```javascript
class AICodeGenerator {
  async generatePlugin(prompt, type, userId, storeId) {
    // 1. Analyze prompt
    const analysis = await this.analyzePrompt(prompt);

    // 2. Generate file structure
    const files = await this.generateFiles(analysis);

    // 3. Store in database
    const record = await this.storeGeneratedCode({
      files,
      userId,
      storeId,
      type: 'plugin',
      ...analysis
    });

    // 4. Return for preview
    return record;
  }

  async generateComponent(prompt, context) {
    // Generate React components
  }

  async generateHook(prompt, hookType) {
    // Generate lifecycle hooks
  }

  async modifyCode(codeId, modifications) {
    // AI-assisted code editing
  }
}
```

**`backend/src/routes/ai-code.js`**
```javascript
POST   /api/ai/generate-plugin
POST   /api/ai/generate-component
POST   /api/ai/generate-hook
PUT    /api/ai/code/:id/modify
POST   /api/ai/code/:id/test
POST   /api/ai/code/:id/deploy
GET    /api/ai/code/:id/preview
```

#### **Integration Points**

1. **Plugin System**: Generated code becomes plugins
2. **Hook System**: AI can create custom hooks
3. **Route System**: AI can add new API endpoints
4. **Component System**: AI generates React components
5. **Database**: All code stored, versioned, deployable

#### **Timeline**
- 🔄 After plugin architecture is complete
- 🔄 After hook system is implemented
- 🔄 After dynamic route registration is ready

---

## 🎨 3. Preview System Architecture

### **Current State**
- ✅ Preview tab exists in AI Studio UI
- ⏳ Preview rendering system pending

### **Future Implementation**

#### **Preview System Options**

**Option A: Sandboxed iFrame (Recommended)**
```javascript
// Real-time preview in isolated environment
<iframe
  src={`/preview/${storeId}?sandbox=true&generated_code=${codeId}`}
  sandbox="allow-scripts allow-same-origin"
  className="w-full h-full"
/>

// Backend serves preview with generated code injected
GET /preview/:storeId?generated_code=xxx
  → Loads store
  → Injects AI-generated components
  → Returns preview HTML
```

**Benefits:**
- ✅ Isolated from production
- ✅ Real-time updates
- ✅ No deployment needed
- ✅ Safe testing environment

**Implementation:**
```javascript
// backend/src/routes/preview.js
router.get('/preview/:storeId', async (req, res) => {
  const { generated_code } = req.query;

  if (generated_code) {
    // Load AI-generated code
    const code = await AIGeneratedCode.findByPk(generated_code);

    // Inject into store template
    const previewHtml = await generatePreviewHtml(store, code);

    res.send(previewHtml);
  } else {
    // Normal store preview
    res.render('storefront', { store });
  }
});
```

**Option B: Temporary Deployment**
```javascript
// Deploy to temporary URL for preview
POST /api/ai/code/:id/deploy-preview
  → Creates temporary URL: preview-abc123.daino.dev
  → Deploys code to preview environment
  → Returns URL

// Preview lasts 24 hours, auto-deleted
```

**Option C: Client-Side Rendering**
```javascript
// Render generated components in AI Studio itself
// Use React.lazy() to dynamically load generated code

const GeneratedComponent = React.lazy(() =>
  import(`data:text/javascript,${generatedCode}`)
);

<Suspense fallback={<Loading />}>
  <GeneratedComponent />
</Suspense>
```

#### **Preview Features**

```
┌─────────────────────────────────────────┐
│ Preview Tab                             │
├─────────────────────────────────────────┤
│ [Mobile] [Tablet] [Desktop]   [Refresh]│
│                                          │
│ ┌────────────────────────────────────┐  │
│ │                                    │  │
│ │  Live Preview of Generated Store   │  │
│ │                                    │  │
│ │  [AI-generated component renders]  │  │
│ │                                    │  │
│ └────────────────────────────────────┘  │
│                                          │
│ [◀ Before] [Compare] [After ▶]         │
│                                          │
│ Modifications:                           │
│ ✓ Added Stripe checkout                 │
│ ✓ Changed header layout                 │
│ ✓ Added product carousel                │
│                                          │
│ [Deploy to Production] [Discard]        │
└─────────────────────────────────────────┘
```

#### **Preview System Components**

**`backend/src/services/preview-service.js`**
```javascript
class PreviewService {
  async generatePreview(generatedCodeId, storeId) {
    // Load store base
    const store = await Store.findByPk(storeId);

    // Load AI-generated code
    const code = await AIGeneratedCode.findByPk(generatedCodeId);

    // Merge code with store
    const preview = await this.mergeCodeWithStore(store, code);

    // Return preview URL or HTML
    return preview;
  }

  async createPreviewEnvironment(codeId) {
    // Create isolated preview environment
    // Deploy to temporary subdomain
    // Return URL
  }

  async compareVersions(beforeId, afterId) {
    // Visual diff of before/after
  }
}
```

#### **Timeline**
- 🔄 After plugin system allows runtime injection
- 🔄 After sandboxed preview environment is created
- 🔄 After code storage system is implemented

---

## 🎯 5. Landing Page Updates

### **Current State**
- ✅ Landing page exists at `/` route
- ⏳ AI Studio showcase section pending

### **Future Implementation**

#### **Add AI Studio Hero Section**

**Location**: Insert after current hero, before features

```jsx
{/* Current Hero */}
<HeroSection />

{/* NEW: AI Studio Showcase */}
<AIDemoSection />

{/* Rest of landing page */}
<FeaturesSection />
<TestimonialsSection />
...
```

#### **AI Demo Section Design**

```jsx
// src/components/landing/AIDemoSection.jsx

<section className="py-20 bg-gradient-to-r from-purple-50 via-blue-50 to-cyan-50">
  <div className="max-w-7xl mx-auto px-4">

    {/* Headline */}
    <div className="text-center mb-12">
      <Badge className="mb-4">🤖 Powered by AI</Badge>
      <h2 className="text-4xl md:text-5xl font-bold mb-4">
        Build Your Store in Minutes,
        <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          {" "}Not Months
        </span>
      </h2>
      <p className="text-xl text-gray-600 max-w-3xl mx-auto">
        Just describe what you want. Our AI builds it for you.
        No code. No complexity. Just results.
      </p>
    </div>

    {/* Live Demo */}
    <div className="grid md:grid-cols-2 gap-8 items-center">

      {/* Left: Chat Interface Mockup */}
      <Card className="p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b">
          <Wand2 className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold">DainoStore AI Studio</h3>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex justify-end">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 rounded-lg max-w-[80%]">
              Create a luxury fashion store with dark theme
            </div>
          </div>
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg max-w-[80%]">
              ✓ Store layout generated<br/>
              ✓ Dark theme applied<br/>
              ✓ Stripe payments configured<br/>
              ✓ Live at yourstore.com
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500">
          ⚡ Built in 2 minutes
        </div>
      </Card>

      {/* Right: Before/After or Feature List */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold">What Our AI Can Do:</h3>
        <ul className="space-y-4">
          <li className="flex items-start gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
            <div>
              <strong>Design Complete Stores</strong>
              <p className="text-gray-600">From homepage to checkout</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
            <div>
              <strong>Generate Plugins</strong>
              <p className="text-gray-600">Payments, shipping, custom features</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
            <div>
              <strong>Translate Everything</strong>
              <p className="text-gray-600">50+ languages instantly</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
            <div>
              <strong>Optimize Content</strong>
              <p className="text-gray-600">SEO, descriptions, images</p>
            </div>
          </li>
        </ul>

        <Button size="lg" className="w-full bg-gradient-to-r from-purple-600 to-blue-600">
          Try AI Studio Free
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>

    {/* Stats */}
    <div className="grid grid-cols-3 gap-8 mt-12 text-center">
      <div>
        <div className="text-4xl font-bold text-purple-600">10K+</div>
        <div className="text-gray-600">Stores Built</div>
      </div>
      <div>
        <div className="text-4xl font-bold text-blue-600">2 min</div>
        <div className="text-gray-600">Average Build Time</div>
      </div>
      <div>
        <div className="text-4xl font-bold text-cyan-600">95%</div>
        <div className="text-gray-600">Satisfaction Rate</div>
      </div>
    </div>

  </div>
</section>
```

#### **Video Demo Section**

```jsx
{/* Video Demo */}
<section className="py-20 bg-gray-900 text-white">
  <div className="max-w-5xl mx-auto px-4">
    <h2 className="text-3xl font-bold text-center mb-8">
      Watch AI Build a Store in 2 Minutes
    </h2>

    <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
      <video
        controls
        poster="/demo-thumbnail.jpg"
        className="w-full h-full"
      >
        <source src="/demos/ai-store-builder.mp4" type="video/mp4" />
      </video>
    </div>

    <p className="text-center mt-6 text-gray-400">
      No editing. No speedup. This is real-time AI building.
    </p>
  </div>
</section>
```

#### **Comparison Table**

```jsx
{/* vs Competition */}
<section className="py-20">
  <div className="max-w-6xl mx-auto px-4">
    <h2 className="text-3xl font-bold text-center mb-12">
      Why DainoStore AI?
    </h2>

    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2">
            <th className="text-left p-4">Feature</th>
            <th className="text-center p-4">Lovable</th>
            <th className="text-center p-4">Bolt</th>
            <th className="text-center p-4 bg-purple-50">DainoStore AI</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="p-4">E-commerce Focused</td>
            <td className="text-center">❌</td>
            <td className="text-center">❌</td>
            <td className="text-center bg-purple-50">✅</td>
          </tr>
          <tr className="border-b">
            <td className="p-4">No-code</td>
            <td className="text-center">⚠️</td>
            <td className="text-center">❌</td>
            <td className="text-center bg-purple-50">✅</td>
          </tr>
          <tr className="border-b">
            <td className="p-4">Hosting Included</td>
            <td className="text-center">❌</td>
            <td className="text-center">❌</td>
            <td className="text-center bg-purple-50">✅</td>
          </tr>
          <tr className="border-b">
            <td className="p-4">Payments Built-in</td>
            <td className="text-center">❌</td>
            <td className="text-center">❌</td>
            <td className="text-center bg-purple-50">✅</td>
          </tr>
          <tr className="border-b">
            <td className="p-4">AI Translations</td>
            <td className="text-center">❌</td>
            <td className="text-center">❌</td>
            <td className="text-center bg-purple-50">✅</td>
          </tr>
          <tr className="border-b font-bold">
            <td className="p-4">Price</td>
            <td className="text-center">$20/mo</td>
            <td className="text-center">$20/mo</td>
            <td className="text-center bg-purple-50">$29/mo*</td>
          </tr>
        </tbody>
      </table>
      <p className="text-sm text-gray-500 mt-4">
        * Everything included - hosting, payments, unlimited products
      </p>
    </div>
  </div>
</section>
```

#### **Files to Update**

1. **`src/pages/storefront/Landing.jsx`**
   - Add `<AIDemoSection />` component
   - Add video demo section
   - Add comparison table

2. **`src/components/landing/AIDemoSection.jsx`** (NEW)
   - Create AI demo showcase
   - Animated chat interface
   - Feature highlights

3. **`public/demos/ai-store-builder.mp4`** (NEW)
   - Record 2-minute demo video
   - Show real AI building a store
   - Add to landing page

#### **Timeline**
- 🔄 After AI Studio backend is functional
- 🔄 After demo video is recorded
- 🔄 After initial user testing

---

## 📋 Implementation Priority

### **Phase 1: Foundation** (Current Sprint)
- ✅ AI Studio UI component
- ✅ USP documentation
- ⏳ AI chat API backend
- ⏳ Basic translation integration

### **Phase 2: Plugin Architecture** (Next Sprint)
- 🔄 Plugin system with hooks
- 🔄 Dynamic route registration
- 🔄 Code storage in database
- 🔄 Plugin activation/deactivation

### **Phase 3: Code Generation** (After Phase 2)
- 🔄 AI code generator service
- 🔄 Plugin generation from prompts
- 🔄 Component generation
- 🔄 Hook generation

### **Phase 4: Preview System** (After Phase 3)
- 🔄 Sandboxed preview environment
- 🔄 Real-time preview updates
- 🔄 Before/after comparison
- 🔄 Deploy preview to temp URL

### **Phase 5: Marketing** (After Phase 4)
- 🔄 Landing page AI section
- 🔄 Demo video production
- 🔄 Comparison tables
- 🔄 Product Hunt launch

---

## 🔗 Related Documents

- `CATALYST_AI_USP.md` - Marketing & positioning
- `src/components/admin/DainoStoreAIStudio.jsx` - UI component
- `backend/src/services/translation-service.js` - Translation AI (already integrated)

---

## 📝 Notes

- All AI-generated code MUST be stored in database
- No direct file system writes for security
- Preview system must be sandboxed
- Code generation happens after plugin architecture is complete
- Landing page updates are cosmetic and can be done anytime

---

**Last Updated**: January 2025
**Status**: Planning Phase
**Owner**: Development Team
