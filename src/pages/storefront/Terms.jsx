import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Shield, Scale, AlertCircle } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo_red.svg" alt="DainoStore" className="h-8" />
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Title */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
              <FileText className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Terms of Service</h1>
            <p className="text-slate-600">Last updated: January 10, 2025</p>
          </div>

          {/* Terms Content */}
          <div className="prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 mb-4">
                <Scale className="w-6 h-6 text-indigo-600" />
                1. Agreement to Terms
              </h2>
              <p className="text-slate-600 leading-relaxed">
                By accessing or using DainoStore's services, you agree to be bound by these Terms of Service.
                If you do not agree to these terms, please do not use our services. These terms apply to all
                visitors, users, and others who access or use the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 mb-4">
                <Shield className="w-6 h-6 text-indigo-600" />
                2. Use of Service
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                DainoStore provides an e-commerce platform that allows users to create and manage online stores.
                You agree to use the Service only for lawful purposes and in accordance with these Terms.
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>You must be at least 18 years old to use this Service</li>
                <li>You are responsible for maintaining the security of your account</li>
                <li>You must provide accurate and complete information when creating an account</li>
                <li>You may not use the Service for any illegal or unauthorized purpose</li>
                <li>You must not transmit any malicious code or interfere with the Service</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. Account Registration</h2>
              <p className="text-slate-600 leading-relaxed">
                To access certain features of the Service, you must register for an account. When you register,
                you agree to provide accurate, current, and complete information. You are solely responsible
                for the activity that occurs on your account, and you must keep your account password secure.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">4. Payment Terms</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Some aspects of the Service may be provided for a fee. You agree to pay all fees associated
                with your use of the Service. Fees are non-refundable except as required by law or as
                explicitly stated in these Terms.
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>Subscription fees are billed in advance on a monthly or annual basis</li>
                <li>You authorize us to charge your payment method for all fees incurred</li>
                <li>Failure to pay may result in suspension or termination of your account</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. Intellectual Property</h2>
              <p className="text-slate-600 leading-relaxed">
                The Service and its original content, features, and functionality are owned by DainoStore
                and are protected by international copyright, trademark, patent, trade secret, and other
                intellectual property laws. You retain ownership of any content you upload to the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. User Content</h2>
              <p className="text-slate-600 leading-relaxed">
                You are responsible for all content that you upload, post, or otherwise make available
                through the Service. You grant DainoStore a non-exclusive, worldwide, royalty-free license
                to use, reproduce, and display your content solely for the purpose of providing the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">7. Prohibited Activities</h2>
              <p className="text-slate-600 leading-relaxed mb-4">You agree not to:</p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on the rights of others</li>
                <li>Sell counterfeit or illegal products through your store</li>
                <li>Engage in fraudulent activities</li>
                <li>Attempt to gain unauthorized access to the Service</li>
                <li>Use the Service to distribute spam or malware</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">8. Termination</h2>
              <p className="text-slate-600 leading-relaxed">
                We may terminate or suspend your account and access to the Service immediately, without
                prior notice or liability, for any reason, including if you breach these Terms. Upon
                termination, your right to use the Service will immediately cease.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">9. Limitation of Liability</h2>
              <p className="text-slate-600 leading-relaxed">
                In no event shall DainoStore, its directors, employees, partners, agents, suppliers, or
                affiliates be liable for any indirect, incidental, special, consequential, or punitive
                damages, including loss of profits, data, or other intangible losses, resulting from your
                use of the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">10. Disclaimer</h2>
              <p className="text-slate-600 leading-relaxed">
                The Service is provided on an "AS IS" and "AS AVAILABLE" basis. DainoStore makes no
                warranties, expressed or implied, regarding the Service's operation or the information,
                content, or materials included therein.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">11. Changes to Terms</h2>
              <p className="text-slate-600 leading-relaxed">
                We reserve the right to modify or replace these Terms at any time. If a revision is
                material, we will provide at least 30 days' notice prior to any new terms taking effect.
                What constitutes a material change will be determined at our sole discretion.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 mb-4">
                <AlertCircle className="w-6 h-6 text-indigo-600" />
                12. Contact Us
              </h2>
              <p className="text-slate-600 leading-relaxed">
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <p className="text-slate-700">
                  <strong>Email:</strong> legal@dainostore.com<br />
                  <strong>Website:</strong> www.dainostore.com
                </p>
              </div>
            </section>
          </div>

          {/* Footer Links */}
          <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap justify-center gap-6 text-sm">
            <Link to="/privacy" className="text-indigo-600 hover:text-indigo-700 hover:underline">
              Privacy Policy
            </Link>
            <Link to="/signup" className="text-indigo-600 hover:text-indigo-700 hover:underline">
              Create Account
            </Link>
            <Link to="/admin/auth" className="text-indigo-600 hover:text-indigo-700 hover:underline">
              Sign In
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
