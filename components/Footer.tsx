export function Footer() {
  return (
    <footer
      className="mt-auto border-t px-6 py-8"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-xs sm:flex-row" style={{ color: 'var(--fg-muted)' }}>
        <span className="font-display font-semibold" style={{ color: 'var(--fg)' }}>Bounty</span>
        <span>Pay for results, not attempts.</span>
        <span className="font-mono">built at a hackathon · demo mode</span>
      </div>
    </footer>
  );
}
