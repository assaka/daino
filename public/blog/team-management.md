# Team Management and Permissions

Add team members, set up roles, and control who can access what in your store.

---

## Overview

DainoStore's team management lets you:
- Invite team members
- Create custom roles
- Set granular permissions
- Track activity
- Manage access securely

---

## Adding Team Members

### Inviting Users

1. Go to **Settings > Team**
2. Click **Invite Member**
3. Enter:
   - Email address
   - Name
   - Role
4. Click **Send Invite**

### Invitation Process

1. Team member receives email
2. They click invitation link
3. Create account or sign in
4. Access granted automatically

### Invitation Status

| Status | Meaning |
|--------|---------|
| Pending | Invitation sent, not accepted |
| Accepted | User has joined |
| Expired | Link expired (resend needed) |

---

## Roles and Permissions

### Default Roles

| Role | Access Level |
|------|--------------|
| Owner | Full access, billing |
| Admin | Full access, no billing |
| Manager | Most features, limited settings |
| Staff | Day-to-day operations |
| Read Only | View only, no changes |

### Permission Categories

| Category | Covers |
|----------|--------|
| Catalog | Products, categories, inventory |
| Orders | Order management, fulfillment |
| Customers | Customer data, CRM |
| Marketing | Campaigns, segments, email |
| Analytics | Reports, dashboards |
| Settings | Store configuration |
| Team | User management |
| Billing | Subscription, payments |

### Creating Custom Roles

1. Go to **Settings > Team > Roles**
2. Click **Create Role**
3. Name the role
4. Select permissions
5. Save

### Permission Levels

For each area:

| Level | Ability |
|-------|---------|
| None | No access |
| View | Read only |
| Edit | View and modify |
| Full | Edit, create, delete |

---

## Permission Examples

### Customer Service Role

```
Orders: Full
Customers: Edit
Products: View
Marketing: None
Settings: None
Analytics: View
```

### Marketing Manager Role

```
Marketing: Full
Customers: View
Analytics: Full
Products: View
Orders: View
Settings: None
```

### Warehouse Staff Role

```
Orders: Edit
Products: Edit (inventory only)
Everything else: None
```

### Content Editor Role

```
Products: Edit (descriptions only)
Marketing: Edit
Analytics: View
Everything else: None
```

---

## Managing Team Members

### Viewing Team

1. Go to **Settings > Team**
2. See all members:
   - Name
   - Email
   - Role
   - Status
   - Last active

### Editing Members

1. Click on team member
2. Update:
   - Role
   - Permissions
   - Status
3. Save changes

### Removing Members

1. Click member menu
2. Select **Remove**
3. Confirm action

Access is revoked immediately.

### Transferring Ownership

If you need to change the owner:
1. Contact support
2. Verify identity
3. Ownership transferred

---

## Activity Tracking

### Audit Log

Track all team actions:

| Logged Data |
|-------------|
| Who made change |
| What was changed |
| When it happened |
| Previous value |
| New value |

### Viewing Activity

1. Go to **Settings > Team > Activity**
2. Filter by:
   - Team member
   - Date range
   - Action type
3. Export if needed

### Important Actions Logged

- Order status changes
- Price modifications
- Product edits
- Customer data access
- Settings changes
- Login/logout

---

## Security Settings

### Two-Factor Authentication

Require 2FA for team:

1. Go to **Settings > Security**
2. Enable **Require 2FA for team**
3. Team must set up 2FA

### Session Management

Control active sessions:

| Setting | Options |
|---------|---------|
| Session timeout | 1hr, 4hr, 8hr, 24hr |
| Remember me | Enable/disable |
| Concurrent sessions | Allow multiple |

### IP Restrictions

Limit access by IP:

1. Go to **Settings > Security > IP Allow List**
2. Add allowed IP addresses
3. Team can only access from those IPs

### Password Requirements

Set password policy:

| Requirement | Options |
|-------------|---------|
| Minimum length | 8, 12, 16 characters |
| Complexity | Letters, numbers, symbols |
| Expiration | 30, 60, 90 days |
| History | Can't reuse last X passwords |

---

## Role-Based Access Control

### How RBAC Works

```
User -> Role -> Permissions -> Access
```

- Users assigned to roles
- Roles contain permissions
- Permissions grant access

### Multiple Roles

Users can have multiple roles:
- Permissions combine
- Most permissive wins
- Allows flexibility

### Custom Permissions

Override role permissions:
1. Edit team member
2. Go to **Custom Permissions**
3. Adjust as needed
4. Save

---

## Department Organization

### Creating Departments

Organize team by function:

| Department | Members |
|------------|---------|
| Sales | Sales reps, managers |
| Support | Customer service team |
| Marketing | Marketing team |
| Operations | Warehouse, fulfillment |

### Department Benefits

- Filter activity by department
- Assign ownership by department
- Department-specific dashboards

---

## Team Notifications

### Notification Settings

Configure what team sees:

| Notification | Options |
|--------------|---------|
| New orders | Email, in-app, none |
| Low stock | Email, in-app, none |
| Customer inquiries | Email, in-app, none |
| Team changes | Email only |

### Per-Member Settings

Each member controls their notifications:
1. Click profile icon
2. Go to **Notification Preferences**
3. Configure alerts
4. Save

---

## Best Practices

### Role Design

1. **Principle of least privilege** - Minimum needed access
2. **Role-based, not user-based** - Easier to manage
3. **Regular reviews** - Audit permissions quarterly
4. **Document roles** - What each role does

### Security

1. **Require 2FA** - All team members
2. **Strong passwords** - Enforce policy
3. **Remove access quickly** - When people leave
4. **Monitor activity** - Review logs

### Onboarding

1. **Create account** - Invite new member
2. **Assign role** - Appropriate permissions
3. **Training** - How to use their features
4. **Document** - Role responsibilities

### Offboarding

1. **Revoke access** - Immediately
2. **Transfer ownership** - Reassign their items
3. **Audit activity** - Review recent actions
4. **Update documentation** - Remove from lists

---

## Common Scenarios

### Temporary Access

For contractors or temps:
1. Create time-limited role
2. Set expiration date
3. Access auto-revoked

### Multi-Store Access

If managing multiple stores:
- Separate team per store
- Some roles access all stores
- Per-store permissions

### External Partners

For agencies or partners:
1. Create partner role
2. Limit to specific areas
3. Track all activity

---

## Troubleshooting

### Can't Access Feature

**Check**:
- User's role has permission?
- Custom permissions set?
- Feature enabled for store?

### Invite Not Received

**Solutions**:
- Check spam folder
- Verify email address
- Resend invitation
- Try different email

### Permission Changes Not Working

**Try**:
- User log out and back in
- Clear browser cache
- Wait a few minutes
- Contact support

---

## Team Reports

### Available Reports

| Report | Shows |
|--------|-------|
| Activity Summary | Actions per member |
| Login History | Sign-in records |
| Changes Made | Audit trail |
| Permission Usage | What features used |

### Generating Reports

1. Go to **Settings > Team > Reports**
2. Select report type
3. Choose date range
4. Generate or export

---

## Next Steps

After setting up your team:

1. **Create roles** - Match your organization
2. **Invite members** - Add your team
3. **Enable security** - 2FA, password policy
4. **Set notifications** - Appropriate alerts
5. **Document** - Role responsibilities

See our Custom Domain Setup guide to configure your store domain.
