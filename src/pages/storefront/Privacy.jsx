import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Lock, Eye, Database, Globe, Mail } from 'lucide-react';

export default function Privacy() {
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
              <Shield className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Privacy Policy</h1>
            <p className="text-slate-600">Last updated: January 10, 2025</p>
          </div>

          {/* Privacy Content */}
          <div className="prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 mb-4">
                <Eye className="w-6 h-6 text-indigo-600" />
                1. Introduction
              </h2>
              <p className="text-slate-600 leading-relaxed">
                DainoStore ("we", "our", or "us") is committed to protecting your privacy. This Privacy
                Policy explains how we collect, use, disclose, and safeguard your information when you
                use our e-commerce platform service. Please read this policy carefully to understand our
                practices regarding your personal data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 mb-4">
                <Database className="w-6 h-6 text-indigo-600" />
                2. Information We Collect
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                We collect information that you provide directly to us, as well as information collected
                automatically when you use our Service.
              </p>

              <h3 className="text-xl font-semibold text-slate-800 mb-3">Information You Provide:</h3>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
                <li>Account information (name, email address, password)</li>
                <li>Profile information (business name, address, phone number)</li>
                <li>Payment information (processed securely through our payment providers)</li>
                <li>Store content (products, images, descriptions you upload)</li>
                <li>Communications with us (support requests, feedback)</li>
              </ul>

              <h3 className="text-xl font-semibold text-slate-800 mb-3">Information Collected Automatically:</h3>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>Device information (IP address, browser type, operating system)</li>
                <li>Usage data (pages visited, features used, time spent)</li>
                <li>Cookies and similar tracking technologies</li>
                <li>Analytics data to improve our Service</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-slate-600 leading-relaxed mb-4">We use the information we collect to:</p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>Provide, maintain, and improve our Service</li>
                <li>Process transactions and send related information</li>
                <li>Send you technical notices, updates, and support messages</li>
                <li>Respond to your comments, questions, and customer service requests</li>
                <li>Monitor and analyze trends, usage, and activities</li>
                <li>Detect, investigate, and prevent fraudulent transactions and abuse</li>
                <li>Personalize and improve your experience</li>
                <li>Send promotional communications (with your consent)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 mb-4">
                <Globe className="w-6 h-6 text-indigo-600" />
                4. Information Sharing
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                We do not sell your personal information. We may share your information in the following
                circumstances:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li><strong>Service Providers:</strong> With third parties who perform services on our behalf (payment processing, hosting, analytics)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                <li><strong>With Your Consent:</strong> When you have given us permission to share your information</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 mb-4">
                <Lock className="w-6 h-6 text-indigo-600" />
                5. Data Security
              </h2>
              <p className="text-slate-600 leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your
                personal information against unauthorized access, alteration, disclosure, or destruction.
                These measures include encryption, secure servers, and regular security assessments.
                However, no method of transmission over the Internet is 100% secure, and we cannot
                guarantee absolute security.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. Data Retention</h2>
              <p className="text-slate-600 leading-relaxed">
                We retain your personal information for as long as necessary to provide our services,
                comply with legal obligations, resolve disputes, and enforce our agreements. When you
                delete your account, we will delete or anonymize your personal information within 30 days,
                unless retention is required by law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">7. Your Rights</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Depending on your location, you may have the following rights regarding your personal data:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your personal data</li>
                <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                <li><strong>Objection:</strong> Object to certain processing of your data</li>
                <li><strong>Withdrawal:</strong> Withdraw consent where processing is based on consent</li>
              </ul>
              <p className="text-slate-600 leading-relaxed mt-4">
                To exercise these rights, please contact us using the information provided below.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">8. Cookies</h2>
              <p className="text-slate-600 leading-relaxed">
                We use cookies and similar tracking technologies to collect and track information about
                your activity on our Service. Cookies are small data files stored on your device. You can
                instruct your browser to refuse all cookies or indicate when a cookie is being sent.
                However, if you do not accept cookies, some portions of our Service may not function properly.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">9. Third-Party Links</h2>
              <p className="text-slate-600 leading-relaxed">
                Our Service may contain links to third-party websites or services that are not operated
                by us. We have no control over and assume no responsibility for the content, privacy
                policies, or practices of any third-party sites or services. We encourage you to review
                the privacy policy of every site you visit.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">10. Children's Privacy</h2>
              <p className="text-slate-600 leading-relaxed">
                Our Service is not intended for children under 18 years of age. We do not knowingly
                collect personal information from children under 18. If you are a parent or guardian
                and believe your child has provided us with personal information, please contact us
                so we can delete such information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">11. International Data Transfers</h2>
              <p className="text-slate-600 leading-relaxed">
                Your information may be transferred to and maintained on servers located outside of your
                state, province, country, or other governmental jurisdiction where data protection laws
                may differ. By using our Service, you consent to such transfers. We ensure appropriate
                safeguards are in place to protect your information in accordance with this Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">12. Changes to This Policy</h2>
              <p className="text-slate-600 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes
                by posting the new Privacy Policy on this page and updating the "Last updated" date.
                You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 mb-4">
                <Mail className="w-6 h-6 text-indigo-600" />
                13. Contact Us
              </h2>
              <p className="text-slate-600 leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <p className="text-slate-700">
                  <strong>Email:</strong> privacy@dainostore.com<br />
                  <strong>Website:</strong> www.dainostore.com
                </p>
              </div>
            </section>
          </div>

          {/* Footer Links */}
          <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap justify-center gap-6 text-sm">
            <Link to="/terms" className="text-indigo-600 hover:text-indigo-700 hover:underline">
              Terms of Service
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
