import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Mail, Zap, Users, Link2, BookOpen, PlayCircle, CheckCircle2,
  ArrowRight, Lightbulb, Clock, Target, TrendingUp, ShoppingCart,
  Heart, Gift, Bell, BarChart3, Filter, RefreshCw, Send,
  ChevronDown, ChevronUp, HelpCircle, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FEATURE_GUIDES = {
  campaigns: {
    title: 'Email Campaigns',
    icon: Mail,
    color: 'bg-blue-100 text-blue-600',
    description: 'Send one-time email broadcasts to your customers',
    route: '/admin/marketing/campaigns',
    quickStart: [
      'Click "Create Campaign" to start a new email',
      'Write your subject line and email content',
      'Select a customer segment to target',
      'Preview your email and send or schedule it'
    ],
    tips: [
      { title: 'Best Time to Send', content: 'Tuesdays and Thursdays between 10am-2pm typically see highest open rates.' },
      { title: 'Subject Line Tips', content: 'Keep it under 50 characters. Use personalization like {first_name}. Create urgency without being spammy.' },
      { title: 'Avoid Spam Filters', content: 'Don\'t use ALL CAPS, excessive punctuation!!!, or spam trigger words like "FREE" or "ACT NOW".' }
    ],
    useCases: [
      { name: 'Product Launch', description: 'Announce new products to your entire customer list' },
      { name: 'Sale Announcement', description: 'Promote seasonal sales and discounts' },
      { name: 'Newsletter', description: 'Send regular updates about your store' }
    ]
  },
  automations: {
    title: 'Marketing Automations',
    icon: Zap,
    color: 'bg-purple-100 text-purple-600',
    description: 'Set up automated workflows that run 24/7',
    route: '/admin/marketing/automations',
    quickStart: [
      'Choose a trigger (what starts the automation)',
      'Add steps like emails, delays, or conditions',
      'Test your workflow with a sample customer',
      'Activate to start enrolling customers automatically'
    ],
    tips: [
      { title: 'Start Simple', content: 'Begin with one trigger and 2-3 steps. You can always add more complexity later.' },
      { title: 'Use Delays Wisely', content: 'Space out your emails. 1 day between welcome emails, 3-7 days for cart recovery.' },
      { title: 'Monitor Performance', content: 'Check open rates weekly. Pause automations under 15% open rate and optimize.' }
    ],
    useCases: [
      { name: 'Welcome Series', description: 'Greet new customers and introduce your brand', trigger: 'customer_created' },
      { name: 'Abandoned Cart Recovery', description: 'Win back customers who left items behind', trigger: 'abandoned_cart' },
      { name: 'Post-Purchase Follow-up', description: 'Thank customers and ask for reviews', trigger: 'order_placed' },
      { name: 'Win-Back Campaign', description: 'Re-engage customers who haven\'t purchased in 60+ days', trigger: 'segment_entered' }
    ]
  },
  segments: {
    title: 'Customer Segments',
    icon: Users,
    color: 'bg-green-100 text-green-600',
    description: 'Group customers based on behavior and attributes',
    route: '/admin/marketing/segments',
    quickStart: [
      'Click "Create Segment" to define a new audience',
      'Add filter conditions (e.g., total orders > 3)',
      'Preview to see matching customers',
      'Save and use in campaigns or automations'
    ],
    tips: [
      { title: 'Dynamic vs Static', content: 'Dynamic segments auto-update as customers change. Static segments are fixed lists.' },
      { title: 'Combine Conditions', content: 'Use AND logic for stricter matching, OR for broader audiences.' },
      { title: 'RFM Scoring', content: 'Use the RFM tab to automatically segment by Recency, Frequency, and Monetary value.' }
    ],
    useCases: [
      { name: 'VIP Customers', description: 'Customers with 5+ orders or $500+ lifetime spend' },
      { name: 'At-Risk Customers', description: 'Haven\'t purchased in 90+ days' },
      { name: 'New Subscribers', description: 'Signed up but never purchased' },
      { name: 'Repeat Buyers', description: 'Made 2+ purchases in last 6 months' }
    ]
  },
  integrations: {
    title: 'Marketing Integrations',
    icon: Link2,
    color: 'bg-orange-100 text-orange-600',
    description: 'Connect to Klaviyo, Mailchimp, or HubSpot',
    route: '/admin/marketing/integrations',
    quickStart: [
      'Choose a marketing platform to connect',
      'Enter your API key from that platform',
      'Configure sync settings (contacts, segments)',
      'Enable automatic syncing'
    ],
    tips: [
      { title: 'Choose One Platform', content: 'Using multiple platforms can lead to duplicate emails. Pick one and commit to it.' },
      { title: 'Sync Regularly', content: 'Contact sync runs hourly by default. You can trigger manual sync anytime.' },
      { title: 'Use Platform Features', content: 'If you connect Klaviyo, use their advanced features for flows and templates.' }
    ],
    useCases: [
      { name: 'Advanced Email Design', description: 'Use Klaviyo or Mailchimp for rich drag-and-drop email builders' },
      { name: 'SMS Marketing', description: 'Connect Klaviyo or Postscript for text message campaigns' },
      { name: 'Full CRM', description: 'Use HubSpot for sales pipeline and customer relationship management' }
    ]
  }
};

const AUTOMATION_TEMPLATES = [
  {
    name: 'Welcome Series',
    trigger: 'New Customer Signs Up',
    steps: [
      { type: 'email', delay: 'Immediately', content: 'Welcome email with 10% off coupon' },
      { type: 'delay', delay: '2 days', content: 'Wait for 2 days' },
      { type: 'email', delay: 'After delay', content: 'Brand story and bestsellers' },
      { type: 'delay', delay: '3 days', content: 'Wait for 3 days' },
      { type: 'email', delay: 'After delay', content: 'Customer reviews and social proof' }
    ],
    metrics: { avgOpenRate: '45%', avgConversion: '12%' }
  },
  {
    name: 'Abandoned Cart Recovery',
    trigger: 'Cart Abandoned (1 hour)',
    steps: [
      { type: 'email', delay: '1 hour', content: 'Reminder: Items in your cart' },
      { type: 'delay', delay: '24 hours', content: 'Wait for 24 hours' },
      { type: 'email', delay: 'After delay', content: 'Still thinking? Here\'s 5% off' },
      { type: 'delay', delay: '48 hours', content: 'Wait for 48 hours' },
      { type: 'email', delay: 'After delay', content: 'Last chance - cart expires soon' }
    ],
    metrics: { avgOpenRate: '42%', avgRecoveryRate: '8%' }
  },
  {
    name: 'Post-Purchase Thank You',
    trigger: 'Order Placed',
    steps: [
      { type: 'delay', delay: '30 minutes', content: 'Wait for order confirmation email' },
      { type: 'email', delay: 'After delay', content: 'Personal thank you from founder' },
      { type: 'delay', delay: '7 days', content: 'Wait for delivery' },
      { type: 'email', delay: 'After delay', content: 'How was your order? Leave a review' }
    ],
    metrics: { avgOpenRate: '55%', avgReviewRate: '15%' }
  },
  {
    name: 'Win-Back Campaign',
    trigger: 'No Purchase in 60 Days',
    steps: [
      { type: 'email', delay: 'Immediately', content: 'We miss you! What\'s new at our store' },
      { type: 'delay', delay: '7 days', content: 'Wait for 7 days' },
      { type: 'email', delay: 'After delay', content: 'Exclusive 15% off - just for you' },
      { type: 'delay', delay: '14 days', content: 'Wait for 14 days' },
      { type: 'email', delay: 'After delay', content: 'Last chance: 20% off expires tomorrow' }
    ],
    metrics: { avgOpenRate: '28%', avgWinBackRate: '5%' }
  }
];

const FAQ_ITEMS = [
  {
    question: 'How do I avoid sending duplicate emails?',
    answer: 'The system automatically prevents duplicate sends. Each customer can only receive a campaign once, and automations track enrollment status. If a customer is already in an automation, they won\'t be re-enrolled until they complete or exit.'
  },
  {
    question: 'What\'s the difference between campaigns and automations?',
    answer: 'Campaigns are one-time emails sent manually (like a sale announcement). Automations are triggered workflows that run automatically when customers take actions (like signing up or abandoning a cart).'
  },
  {
    question: 'How often are segments updated?',
    answer: 'Dynamic segments update in real-time as customers change. Static segments only update when you manually recalculate them. RFM scores are recalculated daily at 3 AM.'
  },
  {
    question: 'Can I test automations before activating?',
    answer: 'Yes! Create your automation in draft mode, then use the "Test" feature to send a preview to yourself. You can also manually enroll a test customer to see the full flow.'
  },
  {
    question: 'What email provider do you use?',
    answer: 'We use Brevo (formerly Sendinblue) for reliable email delivery. You can configure your Brevo API key in Store Settings > Email. We also support SendGrid as an alternative.'
  },
  {
    question: 'How do unsubscribes work?',
    answer: 'Every email includes an automatic unsubscribe link. When customers unsubscribe, they\'re added to a global suppression list and won\'t receive any marketing emails. They can still receive transactional emails (order confirmations, etc.).'
  },
  {
    question: 'Can I use my own email templates?',
    answer: 'Yes! You can paste HTML directly into campaigns. For automations, each email step accepts custom HTML. We recommend keeping templates mobile-responsive and under 100KB.'
  },
  {
    question: 'What triggers are available for automations?',
    answer: 'Available triggers include: Customer Created, Abandoned Cart, Order Placed, Order Fulfilled, Tag Added, Segment Entered, and Manual Trigger. Date-based triggers (birthdays, anniversaries) are coming soon.'
  }
];

function FeatureCard({ feature }) {
  const navigate = useNavigate();
  const Icon = feature.icon;
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg">{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(feature.route)}>
            Open <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-2">
            <PlayCircle className="w-4 h-4" />
            Quick Start
          </h4>
          <ol className="space-y-2">
            {feature.quickStart.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-medium flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="text-gray-600">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-gray-500"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show Less' : 'Show Tips & Use Cases'}
          {expanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
        </Button>

        {expanded && (
          <>
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm text-gray-700 mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                Pro Tips
              </h4>
              <div className="space-y-3">
                {feature.tips.map((tip, idx) => (
                  <div key={idx} className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                    <h5 className="font-medium text-sm text-yellow-800">{tip.title}</h5>
                    <p className="text-sm text-yellow-700 mt-1">{tip.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-sm text-gray-700 mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-green-500" />
                Common Use Cases
              </h4>
              <div className="grid gap-2">
                {feature.useCases.map((useCase, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-sm">{useCase.name}</span>
                      <span className="text-sm text-gray-500 ml-2">{useCase.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AutomationTemplate({ template }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`cursor-pointer transition-all ${expanded ? 'ring-2 ring-purple-200' : 'hover:shadow-md'}`}>
      <CardHeader className="pb-2" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{template.name}</CardTitle>
            <CardDescription className="text-xs mt-1">
              Trigger: {template.trigger}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
              {template.metrics.avgOpenRate} open rate
            </Badge>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <div className="border-l-2 border-purple-200 ml-2 mt-4">
            {template.steps.map((step, idx) => (
              <div key={idx} className="relative pl-6 pb-4 last:pb-0">
                <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-purple-500" />
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${step.type === 'email' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    {step.type === 'email' ? <Mail className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                    {step.delay}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">{step.content}</p>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function FAQItem({ item }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">{item.question}</h4>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </div>
      {expanded && (
        <p className="text-sm text-gray-600 mt-3 pt-3 border-t">{item.answer}</p>
      )}
    </div>
  );
}

export default function MarketingHelp() {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Marketing Help Center</h1>
            <p className="text-gray-600">Learn how to grow your store with email marketing and automations</p>
          </div>
        </div>
      </div>

      {/* Quick Stats / Getting Started Banner */}
      <Card className="mb-8 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Ready to grow your revenue?</h2>
              <p className="text-indigo-100 max-w-xl">
                Email marketing generates $42 for every $1 spent. Start with an abandoned cart automation -
                stores recover 5-15% of lost sales with a simple 3-email sequence.
              </p>
            </div>
            <div className="hidden md:flex gap-3">
              <Button
                variant="secondary"
                className="bg-white text-indigo-600 hover:bg-indigo-50"
                onClick={() => navigate('/admin/marketing/automations')}
              >
                <Zap className="w-4 h-4 mr-2" />
                Create Automation
              </Button>
              <Button
                variant="outline"
                className="border-white text-white hover:bg-white/10"
                onClick={() => navigate('/admin/marketing/campaigns')}
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Campaign
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="features" className="space-y-6">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="features" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Feature Guides
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Automation Templates
          </TabsTrigger>
          <TabsTrigger value="faq" className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            FAQ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="features">
          <div className="grid md:grid-cols-2 gap-6">
            {Object.values(FEATURE_GUIDES).map((feature, idx) => (
              <FeatureCard key={idx} feature={feature} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Proven Automation Templates</h2>
            <p className="text-gray-600">
              These templates are based on industry best practices. Click to see the full workflow.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {AUTOMATION_TEMPLATES.map((template, idx) => (
              <AutomationTemplate key={idx} template={template} />
            ))}
          </div>
          <Card className="mt-6 bg-gray-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm text-gray-600">
                    Want to create one of these? Go to Automations and click "From Template"
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/admin/marketing/automations')}>
                  Go to Automations
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Frequently Asked Questions</h2>
            <p className="text-gray-600">
              Common questions about email marketing, automations, and segments.
            </p>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => (
              <FAQItem key={idx} item={item} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Bottom CTA */}
      <Card className="mt-8 border-indigo-200">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Need more help?</h3>
              <p className="text-sm text-gray-600 mt-1">
                Check our blog for detailed tutorials or contact support.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                Read Blog
              </Button>
              <Button variant="outline" size="sm">
                Contact Support
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
