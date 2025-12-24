# CRM: Managing Sales Pipelines and Deals

Use DainoStore's CRM to track leads, manage deals, and grow relationships with high-value customers.

---

## Overview

The built-in CRM helps you:
- Track sales opportunities
- Manage customer relationships
- Visualize your sales pipeline
- Forecast revenue
- Collaborate on deals

Ideal for B2B, wholesale, or high-touch retail businesses.

---

## CRM Basics

### Key Concepts

| Term | Definition |
|------|------------|
| Lead | Potential customer, not yet qualified |
| Contact | Person with contact information |
| Company | Business organization |
| Deal | Sales opportunity with value |
| Pipeline | Stages deals move through |
| Activity | Actions (calls, emails, meetings) |

### When to Use CRM

Best for:
- Wholesale accounts
- B2B customers
- High-value purchases
- Custom orders
- Long sales cycles
- Account management

---

## Setting Up Pipelines

### Default Pipeline

DainoStore includes a default pipeline:

```
Lead -> Qualified -> Proposal -> Negotiation -> Won/Lost
```

### Creating Custom Pipelines

1. Go to **CRM > Settings > Pipelines**
2. Click **Add Pipeline**
3. Configure:
   - Name
   - Stages
   - Default values

### Pipeline Examples

**E-commerce Wholesale**:
```
Inquiry -> Sample Request -> Quote Sent ->
  Negotiation -> PO Received -> Fulfilled -> Account Active
```

**Custom Products**:
```
Initial Contact -> Requirements -> Design ->
  Quote -> Approval -> Production -> Delivery
```

**Enterprise Sales**:
```
Lead -> Discovery -> Demo -> Proposal ->
  Security Review -> Legal -> Closed Won
```

### Stage Configuration

For each stage:

| Setting | Purpose |
|---------|---------|
| Name | Stage label |
| Probability | Win likelihood (%) |
| Order | Position in pipeline |
| Color | Visual indicator |

---

## Managing Deals

### Creating Deals

1. Go to **CRM > Deals**
2. Click **Add Deal**
3. Fill in details:

| Field | Description |
|-------|-------------|
| Title | Deal name |
| Value | Expected revenue |
| Company | Associated business |
| Contact | Primary person |
| Pipeline | Which pipeline |
| Stage | Current stage |
| Close Date | Expected close |
| Owner | Assigned sales rep |

### Deal View Options

**Kanban Board**:
- Drag and drop between stages
- Visual pipeline overview
- Quick actions

**List View**:
- Sortable columns
- Bulk actions
- Filtering

**Table View**:
- Detailed data
- Custom columns
- Export friendly

### Moving Deals

**On Kanban**:
- Drag card to new stage
- Drop to update

**In Deal Record**:
- Edit stage field
- Add stage notes
- Log activity

---

## Contacts and Companies

### Adding Contacts

1. Go to **CRM > Contacts**
2. Click **Add Contact**
3. Enter:
   - Name
   - Email
   - Phone
   - Company
   - Title/Role
   - Notes

### Company Records

Link contacts to companies:

| Field | Example |
|-------|---------|
| Company Name | Acme Corp |
| Industry | Retail |
| Size | 50-200 employees |
| Website | acme.com |
| Address | Business address |

### Relationships

Connect records:
- Contact belongs to Company
- Deal linked to Contact and Company
- Multiple contacts per company
- Multiple deals per company

---

## Activities and Tasks

### Logging Activities

Track all interactions:

| Activity Type | When to Use |
|---------------|-------------|
| Call | Phone conversations |
| Email | Email exchanges |
| Meeting | In-person or virtual |
| Note | General notes |
| Task | To-do items |

### Creating Activities

1. Open deal or contact
2. Click **Log Activity**
3. Select type
4. Add details
5. Save

### Task Management

Assign follow-ups:

| Field | Purpose |
|-------|---------|
| Description | What needs doing |
| Due Date | When it's due |
| Assignee | Who handles it |
| Priority | Urgency level |
| Deal/Contact | Link to record |

### Activity Timeline

All activities appear in timeline:
- Chronological order
- Filterable by type
- Shows who did what

---

## Pipeline Analytics

### Dashboard Metrics

| Metric | What It Shows |
|--------|---------------|
| Total Pipeline | Sum of all deal values |
| Deals by Stage | Count per stage |
| Win Rate | Won / (Won + Lost) |
| Average Deal Size | Total value / Deals |
| Sales Velocity | Revenue per time period |

### Pipeline Reports

**Pipeline Summary**:
- Deals per stage
- Value per stage
- Movement trends

**Sales Forecast**:
- Expected closes by date
- Weighted by probability
- Revenue projection

**Activity Report**:
- Activities per rep
- Response times
- Engagement rates

---

## Deal Workflows

### Automation Rules

Automate common actions:

**Stage change triggers**:
- Send email when deal moves to Quote stage
- Create task when entering Negotiation
- Notify manager on Won

**Time-based rules**:
- Reminder if no activity in 7 days
- Alert for stale deals
- Follow-up scheduling

### Setting Up Automation

1. Go to **CRM > Automation**
2. Click **Add Rule**
3. Configure:
   - Trigger condition
   - Actions to take
   - Filters (optional)

---

## Team Collaboration

### Assigning Deals

Distribute work:
- Assign owner to each deal
- Transfer between reps
- Set up round-robin

### Visibility Settings

| Setting | Who Sees |
|---------|----------|
| Public | All team members |
| Team | Same team only |
| Private | Owner only |

### Collaboration Features

- @mention team members
- Share notes
- Activity feed
- Deal comments

---

## Email Integration

### Connected Email

Link your email:

1. Go to **CRM > Settings > Email**
2. Connect email account
3. Sync options:
   - Track sent emails
   - Log received emails
   - Auto-associate with deals

### Email Templates

Create reusable templates:

```
Subject: {deal.company} - Quote for {deal.title}

Hi {contact.first_name},

Please find attached our quote for {deal.title}.

The total investment is {deal.value}.

Let me know if you have questions.

Best,
{user.name}
```

### Email Tracking

See when emails are:
- Opened
- Link clicked
- Replied to

---

## Customer Integration

### Linking to Store Customers

Connect CRM with e-commerce:

| CRM | Store |
|----|-------|
| Contact | Customer |
| Company | Customer Group |
| Deal Won | Order |

### Order History in CRM

See purchase history:
- Previous orders
- Total spend
- Order frequency
- Favorite products

### Convert Deal to Order

When deal closes:
1. Click **Convert to Order**
2. Products auto-populated
3. Apply agreed pricing
4. Complete order

---

## Reporting and Analytics

### Standard Reports

| Report | Shows |
|--------|-------|
| Pipeline Report | Current pipeline state |
| Activity Report | Team activities |
| Win/Loss Analysis | Close rates |
| Sales Forecast | Future revenue |
| Leaderboard | Rep performance |

### Custom Reports

Build your own:

1. Go to **CRM > Reports**
2. Click **Create Report**
3. Select data source
4. Add filters
5. Choose metrics
6. Save

### Export Data

Export for analysis:
- Deals to CSV
- Contacts to CSV
- Activities to CSV
- Full CRM export

---

## Mobile CRM

### Mobile Features

Access CRM on mobile:
- View deals
- Update stages
- Log activities
- Add notes
- Check notifications

### On-the-Go Updates

Quick actions:
- Log call after meeting
- Update deal on site visit
- Add contact from business card
- Check pipeline before meeting

---

## Best Practices

### Pipeline Management

1. **Keep stages clear** - Define what each means
2. **Move deals forward** - Stale deals hurt accuracy
3. **Update values** - Keep revenue accurate
4. **Close lost deals** - Don't let them linger
5. **Regular reviews** - Weekly pipeline meetings

### Activity Logging

1. **Log everything** - Complete history
2. **Be specific** - What was discussed
3. **Set follow-ups** - Never drop the ball
4. **Use templates** - Consistency
5. **Timely entry** - Log same day

### Data Quality

1. **Complete records** - Fill all fields
2. **No duplicates** - Merge if found
3. **Regular cleanup** - Archive old data
4. **Verify accuracy** - Check periodically

---

## Troubleshooting

### Common Issues

**Deals not moving**:
- Check automation rules
- Verify stage configuration
- Review permissions

**Missing activities**:
- Check email sync settings
- Verify integration connection
- Review logging habits

**Inaccurate forecasts**:
- Update deal probabilities
- Set realistic close dates
- Mark lost deals properly

---

## Next Steps

After setting up CRM:

1. **Configure pipeline** - Match your sales process
2. **Import contacts** - Add existing relationships
3. **Create deals** - Start tracking opportunities
4. **Set up automation** - Streamline workflows
5. **Train team** - Everyone uses consistently

See our Team Management guide for permission setup.
