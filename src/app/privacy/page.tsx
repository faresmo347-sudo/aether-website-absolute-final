import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white/90">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-[#9D8BA7] transition-colors mb-8">
          <ArrowLeft size={14} />
          Back to home
        </Link>

        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-white/40 mb-8">Last updated: March 2025</p>

        <div className="prose prose-invert prose-sm sm:prose-base max-w-none space-y-6 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">1. Introduction</h2>
            <p>
              Aether (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered memory management application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">2. Information We Collect</h2>
            <p><strong>Account Information:</strong> When you create an account, we collect your name, email address, and password (stored as a hash).</p>
            <p><strong>Memory Content:</strong> We store the content you save in Aether, including text notes, voice recordings (transcribed to text), links, and images. This is the core functionality of the service.</p>
            <p><strong>Usage Data:</strong> We collect information about how you use Aether, including feature usage, session duration, and interaction patterns.</p>
            <p><strong>Device Information:</strong> We automatically collect device type, operating system, browser type, and IP address for security and performance purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve the Aether service</li>
              <li>Process and store your memories securely</li>
              <li>Generate AI-powered summaries, tags, and insights</li>
              <li>Send you daily and weekly recaps (if enabled)</li>
              <li>Communicate about your account or service updates</li>
              <li>Monitor and improve service performance and reliability</li>
              <li>Detect and prevent fraud or unauthorized access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">4. Data Storage & Security</h2>
            <p>
              Your data is stored on secure servers with industry-standard encryption. We use Supabase (PostgreSQL) for data storage with encryption at rest and in transit. Your memories are private and encrypted — only you can access your data.
            </p>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">5. AI Processing</h2>
            <p>
              Aether uses AI to process your memories for features like auto-tagging, summarization, and semantic search. This processing happens on our secure servers. Your memory content is never used to train AI models or shared with third-party AI providers for training purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">6. Data Sharing</h2>
            <p>We do not sell, trade, or rent your personal information or memory content to third parties. We may share data only in the following circumstances:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>With your explicit consent</li>
              <li>To comply with legal obligations</li>
              <li>To protect our rights or safety</li>
              <li>With service providers who assist in operating our platform (under strict data protection agreements)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access your personal data and memories</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and all associated data</li>
              <li>Export your data in a portable format</li>
              <li>Opt out of communications</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">8. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. If you delete your account, we will delete all your personal data and memory content within 30 days, except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">9. Children&apos;s Privacy</h2>
            <p>
              Aether is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:privacy@aether.app" className="text-[#9D8BA7] hover:underline">privacy@aether.app</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
