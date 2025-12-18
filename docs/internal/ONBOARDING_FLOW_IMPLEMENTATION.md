# Store Onboarding Flow - Implementation Guide

## Overview

When a new store owner logs in with 0 stores, show a guided onboarding flow instead of the admin dashboard.

---

## Onboarding Steps

### Step 1: Create Store (Required)
- **Fields:** Store name, store slug
- **Action:** `POST /api/stores/mt` (already exists ✅)
- **Auto-generate slug** from store name

### Step 2: Connect Database (Required)
- **Fields:** Supabase Project URL, Service Role Key
- **Action:** `POST /api/stores/mt/:id/connect-database` (already exists ✅)
- **This provisions tenant DB** with all tables
- **Show helpful hints:** How to get Supabase credentials

### Step 3: Setup Stripe (Skippable)
- **Fields:** Stripe publishable key, secret key
- **Action:** `POST /api/integrations/stripe` (check if exists)
- **Skip button:** Continue without Stripe

### Step 4: Purchase Credits (Skippable)
- **Fields:** Credit amount
- **Action:** `POST /api/credits/mt/purchase`
- **Skip button:** Start with 0 credits

### Step 5: Complete Profile (Required - Last Step)
- **Fields:** Phone, avatar, company details
- **Action:** `PATCH /api/auth/me` or similar
- **Then redirect** to dashboard

---

## Frontend Implementation

### Files to Create/Modify:

#### 1. Update StoreOnboarding.jsx

```jsx
const STEPS = [
  { id: 1, title: 'Create Store', icon: Store, required: true },
  { id: 2, title: 'Connect Database', icon: Database, required: true },
  { id: 3, title: 'Setup Stripe', icon: CreditCard, required: false },
  { id: 4, title: 'Purchase Credits', icon: DollarSign, required: false },
  { id: 5, title: 'Complete Profile', icon: User, required: true },
];

// Progress indicator
<Progress value={(currentStep / STEPS.length) * 100} />

// Step indicators
<div className="flex justify-between mb-8">
  {STEPS.map(step => (
    <StepIndicator
      key={step.id}
      {...step}
      isActive={currentStep === step.id}
      isCompleted={completedSteps.includes(step.id)}
    />
  ))}
</div>

// Step content
{currentStep === 1 && <CreateStoreStep />}
{currentStep === 2 && <ConnectDatabaseStep />}
{currentStep === 3 && <SetupStripeStep />}
{currentStep === 4 && <PurchaseCreditsStep />}
{currentStep === 5 && <CompleteProfileStep />}

// Navigation
<div className="flex gap-3">
  {currentStep > 1 && (
    <Button onClick={() => setCurrentStep(prev => prev - 1)}>
      Back
    </Button>
  )}

  {STEPS[currentStep - 1].skippable && (
    <Button variant="outline" onClick={handleSkip}>
      Skip
    </Button>
  )}

  <Button onClick={handleNext}>
    {currentStep === STEPS.length ? 'Complete Setup' : 'Continue'}
  </Button>
</div>
```

#### 2. Add Route Guard in Auth Flow

```javascript
// In your auth success handler (after login)
const handleAuthSuccess = async (userData) => {
  // Fetch user's stores
  const storesResponse = await api.get('/api/stores/mt/dropdown');

  const storeCount = storesResponse.data?.length || 0;

  if (storeCount === 0) {
    // No stores - redirect to onboarding
    navigate('/admin/store-onboarding');
  } else {
    // Has stores - go to dashboard
    navigate('/admin/dashboard');
  }
};
```

#### 3. Conditional Layout Rendering

```jsx
// In AdminLayout.jsx or similar
import { useStores } from '@/hooks/useStores';

function AdminLayout({ children }) {
  const { stores, loading } = useStores();
  const hasStores = stores.length > 0;

  // If no stores, render minimal layout (no sidebar/nav)
  if (!hasStores && location.pathname !== '/admin/store-onboarding') {
    return <Navigate to="/admin/store-onboarding" replace />;
  }

  return (
    <div className="admin-layout">
      {/* Only show navigation if user has stores */}
      {hasStores && (
        <>
          <Sidebar />
          <StoreSelector />
          <Navigation />
        </>
      )}

      <main>
        {children}
      </main>
    </div>
  );
}
```

---

## Backend Updates Needed

### 1. Add Store ID to Login Response

Currently login returns just `storeId`. Frontend might need store status too:

```javascript
// backend/src/routes/auth.js (in login response)
data: {
  user: {...},
  token: "...",
  store: {
    id: storeId,
    status: "pending_database", // or "active"
    needsOnboarding: status === "pending_database"
  }
}
```

### 2. Profile Update Endpoint

```javascript
// backend/src/routes/auth.js
PATCH /api/auth/profile
- Update phone, avatar, company details
- For master DB agency users
```

---

## User Experience Flow

```
┌─────────────────────────────────────┐
│ User Logs In                        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Check: Do they have stores?         │
│ GET /api/stores/mt/dropdown         │
└─────────────────────────────────────┘
       ↓ No (0 stores)        ↓ Yes (1+ stores)
┌──────────────────┐    ┌──────────────────┐
│  ONBOARDING      │    │   DASHBOARD      │
│                  │    │                  │
│ [Progress Bar]   │    │ ✓ Sidebar        │
│ Step 1/5         │    │ ✓ Navigation     │
│                  │    │ ✓ Store Selector │
│ Create Store:    │    │ ✓ Full Features  │
│ [Name Input]     │    └──────────────────┘
│ [Slug Input]     │
│ [Continue →]     │
│                  │
│ NO Sidebar       │
│ NO Navigation    │
│ NO Store Selector│
└──────────────────┘
      ↓ Complete Steps
┌──────────────────┐
│ Redirect to      │
│ Dashboard        │
└──────────────────┘
```

---

## Implementation Checklist

### Backend (Already Done):
- ✅ `POST /api/stores/mt` - Create store
- ✅ `POST /api/stores/mt/:id/connect-database` - Connect database
- ✅ `POST /api/credits/mt/purchase` - Purchase credits
- ⏳ `PATCH /api/auth/profile` - Update profile (need to add)
- ⏳ `POST /api/integrations/stripe` - Setup Stripe (check if exists)

### Frontend (To Do):
- ⏳ Create enhanced StoreOnboarding.jsx with 5 steps
- ⏳ Add step progress indicator
- ⏳ Add skip buttons for optional steps
- ⏳ Add route: `/admin/store-onboarding`
- ⏳ Add route guard in auth flow (check store count)
- ⏳ Hide navigation/sidebar when on onboarding page
- ⏳ Export StoreOnboarding from pages/index

---

## Next Steps

**Should I:**
1. Create the full enhanced StoreOnboarding.jsx component with all 5 steps
2. Add the route to App.jsx
3. Create the route guard logic
4. Add missing backend endpoints (profile update, Stripe setup)

**Or would you prefer to:**
- Take over the frontend implementation yourself
- Just need the backend endpoints ready

**What would you like me to do?**
