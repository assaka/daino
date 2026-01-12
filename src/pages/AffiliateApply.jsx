import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "@/api/client";
import { Loader2, UserPlus, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function AffiliateApply() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    company_name: "",
    phone: "",
    website_url: "",
    affiliate_type: "individual",
    application_notes: ""
  });

  useEffect(() => {
    // Pre-fill email from query param if provided
    const email = searchParams.get('email');
    if (email) {
      setFormData(prev => ({ ...prev, email }));
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiClient.post('/affiliates/apply', formData);
      if (response?.success) {
        setSubmitted(true);
        toast({ title: "Application submitted successfully!" });
      } else {
        throw new Error(response?.error || 'Failed to submit application');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit application",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for applying to our affiliate program. We'll review your application and get back to you within 24-48 hours.
          </p>
          <Button onClick={() => navigate('/')}>
            Return to Homepage
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Affiliate Program</span>
          </div>
          <Button variant="ghost" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Join Our Affiliate Program
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Earn commissions by referring new store owners to our platform. Get up to 20% on every successful referral.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid sm:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary">10-20%</span>
            </div>
            <h3 className="font-semibold mb-2">Competitive Commissions</h3>
            <p className="text-sm text-gray-600">Earn up to 20% commission on all referral purchases</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary">30</span>
            </div>
            <h3 className="font-semibold mb-2">30-Day Cookie</h3>
            <p className="text-sm text-gray-600">Referrals tracked for 30 days after clicking your link</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary">$50</span>
            </div>
            <h3 className="font-semibold mb-2">Low Payout Threshold</h3>
            <p className="text-sm text-gray-600">Request payout when you reach $50 in earnings</p>
          </Card>
        </div>

        {/* Application Form */}
        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-6">Apply Now</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="affiliate_type">Affiliate Type *</Label>
                <Select
                  value={formData.affiliate_type}
                  onValueChange={(value) => setFormData({ ...formData, affiliate_type: value })}
                >
                  <SelectTrigger id="affiliate_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="influencer">Influencer</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name (if applicable)</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Your Company Ltd."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website_url">Website / Social Media URL</Label>
              <Input
                id="website_url"
                type="url"
                value={formData.website_url}
                onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                placeholder="https://yourwebsite.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="application_notes">Tell us about yourself</Label>
              <Textarea
                id="application_notes"
                value={formData.application_notes}
                onChange={(e) => setFormData({ ...formData, application_notes: e.target.value })}
                placeholder="How do you plan to promote our platform? What's your audience size?"
                rows={4}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Application
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* FAQ */}
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-2">How do I get paid?</h3>
              <p className="text-sm text-gray-600">
                We use Stripe Connect for payouts. Once approved, you'll set up your Stripe account and receive payments directly.
              </p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold mb-2">When do I earn commission?</h3>
              <p className="text-sm text-gray-600">
                You earn commission when someone signs up using your referral link and makes a credit purchase or subscription payment.
              </p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold mb-2">How long is the cookie duration?</h3>
              <p className="text-sm text-gray-600">
                Our referral cookies last 30 days. If someone clicks your link and signs up within 30 days, you get credit.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
