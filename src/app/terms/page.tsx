import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white/90">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-[#9D8BA7] transition-colors mb-8">
          <ArrowLeft size={14} />
          Back to home
        </Link>

        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-white/40 mb-8">Last updated: March 2025</p>

        <div className="prose prose-invert prose-sm sm:prose-base max-w-none space-y-6 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Aether (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">2. Description of Service</h2>
            <p>
              Aether is an AI-powered memory management application that allows users to capture, organize, and retrieve their thoughts, notes, voice recordings, links, and images. The Service includes features such as AI-powered search, auto-tagging, summarization, and intelligent recaps.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">3. Account Registration</h2>
            <p>
              To use Aether, you must create an account by providing your name, email address, and a password. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 13 years old to create an account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Store content that is illegal, harmful, threatening, abusive, or defamatory</li>
              <li>Attempt to gain unauthorized access to other users&apos; accounts or data</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Use automated systems to access the Service without authorization</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">5. Your Content</h2>
            <p>
              You retain ownership of all content you store in Aether (&quot;Your Content&quot;). By using the Service, you grant Aether a limited, non-exclusive license to process, store, and display Your Content solely for the purpose of providing the Service to you.
            </p>
            <p>
              You are solely responsible for Your Content and ensure that it does not violate any applicable laws or third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">6. Free & Paid Plans</h2>
            <p>
              Aether offers both free and paid subscription plans. The Seed plan is free with limited features. The Bloom plan is a paid subscription that provides unlimited access to all features.
            </p>
            <p>
              Paid subscriptions are billed on a monthly or annual basis. All fees are non-refundable except as required by law or as described in our refund policy. We reserve the right to change our pricing with 30 days&apos; notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">7. Intellectual Property</h2>
            <p>
              The Service, including its original content, features, and functionality, is owned by Aether and is protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">8. Limitation of Liability</h2>
            <p>
              Aether is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind. To the fullest extent permitted by law, Aether shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.
            </p>
            <p>
              Our total liability to you for any claims arising from these Terms or the Service shall not exceed the amount you paid us in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">9. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Aether and its officers, directors, employees, and agents from any claims, damages, losses, costs, or expenses arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">10. Termination</h2>
            <p>
              You may delete your account at any time through the Settings page. We may suspend or terminate your account if you violate these Terms. Upon termination, your right to use the Service will immediately cease, and we will delete your data in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of significant changes by email or through the Service. Your continued use of the Service after any changes constitutes your acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">13. Contact Us</h2>
            <p>
              If you have questions about these Terms, please contact us at{' '}
              <a href="mailto:legal@aether.app" className="text-[#9D8BA7] hover:underline">legal@aether.app</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
