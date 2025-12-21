# Authentication Test Scenarios

## All Possible Login State Combinations

### 1. No one logged in
- ✅ Can access `/auth` (store owner login)
- ✅ Can access `/customerauth` (customer login)
- ✅ `/dashboard` → redirects to `/auth`
- ✅ `/customerdashboard` → redirects to appropriate auth

### 2. Only Customer logged in (customer is active session)
- ✅ `/customerauth` → redirects to storefront (already logged in)
- ✅ `/auth` → accessible (can login as store owner)
- ✅ `/customerdashboard` → shows customer dashboard
- ✅ `/dashboard` → blocked by RoleProtectedRoute → redirects to `/customerdashboard`

### 3. Only Store Owner logged in (store owner is active session)
- ✅ `/auth` → redirects to dashboard (already logged in)
- ✅ `/customerauth` → accessible (can login as customer)
- ✅ `/dashboard` → shows store owner dashboard
- ✅ `/customerdashboard` → blocked by RoleProtectedRoute → redirects to `/dashboard`

### 4. Both logged in, Customer active session
- ✅ `/customerauth` → redirects to storefront (customer active)
- ✅ `/auth` → accessible (store owner not active)
- ✅ `/customerdashboard` → shows customer dashboard
- ✅ `/dashboard` → blocked by RoleProtectedRoute → redirects to `/customerdashboard`

### 5. Both logged in, Store Owner active session
- ✅ `/auth` → redirects to dashboard (store owner active)
- ✅ `/customerauth` → accessible (customer not active)
- ✅ `/dashboard` → shows store owner dashboard
- ✅ `/customerdashboard` → blocked by RoleProtectedRoute → redirects to `/dashboard`

## Key Logic
- Auth pages only redirect if that specific role is the ACTIVE session
- RoleProtectedRoute handles cross-role access blocking
- Users can always switch between roles by visiting the other auth page
- Dual sessions are maintained - logging in doesn't clear the other role's session

## Fixed Issues
- ✅ Store owner can now login even when customer is active session
- ✅ Customer can login even when store owner is active session
- ✅ Both roles maintain independent sessions
- ✅ Auth pages are accessible for role switching
- ✅ Logging in doesn't automatically override currently active session
- ✅ Added UI role switcher for explicit session switching

## How Role Activation Works

### Login Behavior (Non-Disruptive)
- **Customer login**: Only becomes active if no session exists OR customer was already active
- **Store owner login**: Only becomes active if no session exists OR store owner was already active
- **Existing active session is preserved** when other role logs in

### Role Switching Options
1. **Via Auth Pages**: Visit `/auth` or `/customerauth` to switch roles
2. **Via RoleSwitcher UI**: Use the floating role switcher widget (top-right)
3. **Programmatic**: Use `activateRoleSession(role)` function

### RoleSwitcher Widget
- Only shows when both customer and store owner are logged in
- Displays current active session with badge
- Allows one-click switching between roles
- Automatically navigates to appropriate dashboard after switch