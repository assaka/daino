# Content Management with CMS

Create and manage custom pages, content blocks, and navigation using DainoStore's built-in CMS.

---

## Overview

The CMS (Content Management System) lets you:
- Create custom pages
- Build reusable content blocks
- Manage navigation menus
- Add landing pages
- Control page layouts

No coding required for most tasks.

---

## Pages

### Types of Pages

| Page Type | Purpose |
|-----------|---------|
| Static pages | About, Contact, FAQ |
| Landing pages | Marketing campaigns |
| Policy pages | Terms, Privacy, Returns |
| Blog posts | Articles and guides |

### Creating a Page

1. Go to **Content > Pages**
2. Click **Add Page**
3. Fill in:

| Field | Description |
|-------|-------------|
| Title | Page title |
| Slug | URL path (/about-us) |
| Content | Page content |
| Template | Layout to use |
| Status | Draft or Published |

### Page Editor

Use the visual editor:
- Rich text formatting
- Image insertion
- Link creation
- Code blocks
- Tables

### Page Settings

| Setting | Purpose |
|---------|---------|
| Meta title | SEO title |
| Meta description | SEO description |
| Featured image | Social sharing |
| Template | Page layout |
| Access | Public or restricted |

---

## Content Blocks

### What Are Blocks?

Reusable content pieces:
- Appear on multiple pages
- Edit once, update everywhere
- Include in templates

### Block Types

| Block Type | Use Case |
|------------|----------|
| Text | Announcements, notices |
| HTML | Custom code |
| Image | Banner, featured image |
| Product | Featured products |
| Collection | Product grid |
| CTA | Call-to-action button |

### Creating Blocks

1. Go to **Content > Blocks**
2. Click **Add Block**
3. Choose block type
4. Configure content
5. Set identifier
6. Save

### Using Blocks

Insert blocks in pages:
```
{{block identifier="announcement-banner"}}
```

Or in templates:
- Add to header/footer
- Include in sidebars
- Place in product pages

---

## Templates

### Page Templates

Control page layout:

| Template | Layout |
|----------|--------|
| Default | Standard page |
| Full width | No sidebar |
| Landing | Marketing page |
| FAQ | Accordion style |
| Contact | With form |

### Customizing Templates

1. Go to **Content > Templates**
2. Select template
3. Edit layout zones
4. Add blocks to zones
5. Save

### Template Zones

Common zones:
- Header
- Hero
- Main content
- Sidebar
- Footer

---

## Navigation

### Menu Types

| Menu | Location |
|------|----------|
| Main menu | Primary navigation |
| Footer menu | Footer links |
| Mobile menu | Mobile navigation |
| Account menu | User account |

### Editing Menus

1. Go to **Content > Navigation**
2. Select menu
3. Add/edit items:

| Field | Purpose |
|-------|---------|
| Label | Display text |
| Link | URL or page |
| Icon | Optional icon |
| Order | Position |
| Parent | For submenus |

### Menu Item Types

| Type | Links To |
|------|----------|
| Page | CMS page |
| Category | Product category |
| Collection | Product collection |
| Product | Specific product |
| URL | External link |
| Anchor | Page section |

### Nested Menus

Create dropdowns:

```
Products
  - T-Shirts
  - Hoodies
  - Accessories
About
  - Our Story
  - Team
  - Press
```

---

## Homepage Customization

### Homepage Sections

Common sections:
- Hero banner
- Featured products
- Category grid
- Testimonials
- Newsletter signup
- Instagram feed

### Editing Homepage

1. Go to **Content > Homepage**
2. Add/arrange sections
3. Configure each section
4. Preview changes
5. Publish

### Section Options

For each section:

| Option | Purpose |
|--------|---------|
| Enable/disable | Show or hide |
| Order | Position on page |
| Content | What to display |
| Style | Appearance options |

---

## Blog/Articles

### Blog Setup

1. Go to **Content > Blog**
2. Configure settings:
   - Blog URL (/blog)
   - Posts per page
   - Enable comments
   - Author display

### Writing Posts

1. Go to **Content > Blog > Posts**
2. Click **New Post**
3. Write content
4. Set:
   - Featured image
   - Category/tags
   - Publish date
   - Author

### Blog Categories

Organize posts:
1. Go to **Content > Blog > Categories**
2. Add categories
3. Assign to posts

---

## Media Library

### Managing Media

1. Go to **Content > Media**
2. Upload files:
   - Images
   - Documents
   - Videos

### Image Options

| Feature | Description |
|---------|-------------|
| Alt text | Accessibility/SEO |
| Caption | Display text |
| Resize | Multiple sizes |
| Optimize | Compression |

### Using Media

Insert in content:
- Editor insert button
- Media picker
- Drag and drop

---

## SEO for Content

### Page-Level SEO

For each page:
- Custom meta title
- Meta description
- Canonical URL
- Social sharing image

### URL Structure

Best practices:
- Short, descriptive URLs
- Include keywords
- Avoid special characters
- Use hyphens

### Structured Data

Automatic schema for:
- Organization
- Breadcrumbs
- FAQ pages
- Article pages

---

## Access Control

### Page Visibility

| Option | Who Can See |
|--------|-------------|
| Public | Everyone |
| Logged in | Registered users |
| Customer group | Specific groups |
| Password | With password |

### Protected Pages

For members-only content:
1. Edit page
2. Set access to restricted
3. Choose who can access
4. Save

---

## Multi-Language Content

### Translating Pages

1. Edit page
2. Click **Translations**
3. Select language
4. Enter translated content
5. Save

### Language-Specific Pages

Create different versions:
- Different content per language
- Same URL structure
- Automatic language switching

---

## Scheduling

### Schedule Publishing

1. Set page to Draft
2. Choose publish date/time
3. Save
4. Page goes live automatically

### Schedule Unpublishing

For time-limited content:
1. Edit page
2. Set end date
3. Content hides automatically

---

## Page Analytics

### Tracking Page Performance

View in Analytics:
- Page views
- Time on page
- Bounce rate
- Exit rate

### Content Reports

| Report | Shows |
|--------|-------|
| Top pages | Most viewed |
| Entry pages | Landing pages |
| Exit pages | Last pages viewed |
| Search queries | What users search |

---

## Advanced Features

### Custom Code

Add custom HTML/CSS/JS:
1. Edit page
2. Switch to code view
3. Add custom code
4. Save

### Includes

Include reusable snippets:
```
{{include "snippet-name"}}
```

### Dynamic Content

Use variables:
```
Welcome, {{customer.first_name}}!
```

### Conditional Content

Show based on conditions:
```
{{#if customer.logged_in}}
  Member content here
{{else}}
  Guest content here
{{/if}}
```

---

## Best Practices

### Content

1. **Clear headings** - Organize with H1, H2, H3
2. **Short paragraphs** - Easy to scan
3. **Visual content** - Images, videos
4. **Call to action** - What should visitors do?
5. **Mobile friendly** - Test on phones

### SEO

1. **Unique content** - No duplicates
2. **Keywords** - Natural inclusion
3. **Internal links** - Connect related content
4. **Meta data** - Custom for each page
5. **Fast loading** - Optimize images

### Maintenance

1. **Regular review** - Keep content fresh
2. **Fix broken links** - Check periodically
3. **Update info** - Policies, contact info
4. **Archive old** - Remove outdated content

---

## Troubleshooting

### Page Not Showing

**Check**:
- Page published?
- URL correct?
- Access settings?
- Navigation linked?

### Content Not Displaying

**Verify**:
- Block enabled?
- Template configured?
- No syntax errors?
- Cache cleared?

### Slow Loading

**Solutions**:
- Optimize images
- Reduce video
- Minimize code
- Check hosting

---

## Next Steps

After setting up content:

1. **Create essential pages** - About, Contact, Policies
2. **Set up navigation** - Menus configured
3. **Customize homepage** - Engaging layout
4. **Add blog** - Regular content
5. **Test everything** - All links work

See our Inventory Management guide for stock control.
