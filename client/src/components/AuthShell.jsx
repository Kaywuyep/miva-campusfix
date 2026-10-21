import Logo from "./Logo";

// Two-column frame shared by the login and registration pages
export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth">
      <section className="auth-panel">
        <div className="brand brand-light">
          <Logo variant="full" size={190} />
        </div>
        <div className="auth-pitch">
          <h1>One place for every campus maintenance request.</h1>
          <p>
            Report a fault in under a minute, attach a photo, and follow it from
            submission to completion — no more phone calls, paper forms or lost
            WhatsApp messages.
          </p>
          <ul>
            <li>Electricity, plumbing, furniture &amp; hostel issues</li>
            <li>Live status updates and notifications</li>
            <li>Every job tracked and accountable</li>
          </ul>
        </div>
        <small>University Works &amp; Services Department</small>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <Logo
            variant="full"
            tone="light"
            size={150}
            className="auth-mobile-logo"
          />
          <h2>{title}</h2>
          <p className="muted">{subtitle}</p>
          {children}
        </div>
      </section>
    </div>
  );
}
