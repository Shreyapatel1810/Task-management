export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <aside className="auth__brand">
        <div className="auth__logo">
          <span className="auth__logo-mark">✓</span> TaskFlow
        </div>
        <h2>Plan it. Track it. Finish it.</h2>
        <p>A simple place to organise your work and get things done.</p>
      </aside>

      <main className="auth__panel">
        <div className="auth__card">
          <h1>{title}</h1>
          <p className="auth__subtitle">{subtitle}</p>
          {children}
          <p className="auth__footer">{footer}</p>
        </div>
      </main>
    </div>
  );
}