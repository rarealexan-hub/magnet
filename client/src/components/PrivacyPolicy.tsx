import { ArrowLeft } from "lucide-react";

interface Props {
  onBack: () => void;
}

export function PrivacyPolicy({ onBack }: Props) {
  return (
    <div className="privacy-page">
      <div className="privacy-container">
        <button className="privacy-back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>

        <div className="privacy-header">
          <h1 className="privacy-title">Privacy Policy</h1>
          <p className="privacy-updated">Last updated: September 11, 2026</p>
        </div>

        <div className="privacy-body">
          <p className="privacy-intro">
            Magnet ("we", "us", "our") is a dating profile analysis service. This policy explains what data we collect, how we use it, and your rights. We keep this short and plain — no legal maze.
          </p>

          <section className="privacy-section">
            <h2>What we collect</h2>
            <ul>
              <li><strong>Email address</strong> — when you create an account or sign in. Used for account management only.</li>
              <li><strong>Photos and screenshots you upload</strong> — stored privately so a reviewer can check your audit and you can view your report later.</li>
              <li><strong>Profile text</strong> — bios, prompts, and answers you enter into the form. Used solely to generate your analysis.</li>
              <li><strong>Analysis results</strong> — your Magnet Score and report, saved to your account so you can access them from your dashboard.</li>
            </ul>
          </section>

          <section className="privacy-section">
            <h2>How we use your data</h2>
            <ul>
              <li>To generate and deliver your profile analysis.</li>
              <li>To save your results to your account dashboard.</li>
              <li>To send you account-related emails (e.g. password reset). We do not send marketing emails without your explicit consent.</li>
            </ul>
            <p>We do not sell, rent, or share your personal data with third parties for their own marketing purposes.</p>
          </section>

          <section className="privacy-section">
            <h2>Third-party services</h2>
            <ul>
              <li><strong>OpenAI</strong> — your photos and profile text are sent to OpenAI's API to power the analysis. OpenAI processes this data under their own privacy policy and API usage terms. They do not use API data to train their models.</li>
            </ul>
          </section>

          <section className="privacy-section">
            <h2>Data retention</h2>
            <p>
               A person on the Magnet team reviews and edits every full audit before it is released. Photos are deleted 30 days after your report is released, or after 60 days if an audit is never released. Report text stays with your account until you ask us to delete it. You can request immediate removal of photos, your account, or all associated data at any time.
            </p>
          </section>

          <section className="privacy-section">
            <h2>Your rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access the data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and all associated data.</li>
              <li>Withdraw consent at any time by deleting your account.</li>
            </ul>
          </section>

          <section className="privacy-section">
            <h2>Security</h2>
            <p>
              We use industry-standard encryption (HTTPS/TLS) for all data in transit. Passwords are hashed and never stored in plain text.
            </p>
          </section>

          <section className="privacy-section">
            <h2>Contact</h2>
            <p>
              Questions about your data or this policy? Email us at <a href="mailto:hello@trymagnetapp.com" className="privacy-link">hello@trymagnetapp.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
