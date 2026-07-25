import { fishingLinks } from '../data'

const ICONS = {
  fish: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 12c0-3.5 4-7 10-8-1 2-1.5 4-1.5 6s.5 4 1.5 6c-6-1-10-4.5-10-8z" />
      <path d="M6.5 12L2 9m4.5 3L2 15" />
      <circle cx="16" cy="10" r="0.5" fill="currentColor" />
    </svg>
  ),
  external: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
  ),
}

export default function FishingReportPanel() {
  return (
    <div className="conditions-panel fishing-panel">
      <div className="cond-header">
        <div>
          <p className="brand-mark">SoundCaptain</p>
          <h2>Fishing Reports</h2>
          <p className="cond-location">
            No live data here — these are the shops and sites that publish reports for the Sound.
          </p>
        </div>
      </div>

      <section className="cond-card">
        <header className="cond-card-head">
          <h3>
            <span className="cond-card-icon">{ICONS.fish}</span>
            Reports &amp; Tackle Shops
          </h3>
        </header>
        <p className="cond-note">
          Species, bait, and hot spots change week to week — check these before you head out.
        </p>
        <div className="cond-links">
          {fishingLinks.map((link) => (
            <a
              key={link.id}
              className="cond-link"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="cond-link-label">
                {link.label}
                <span className="cond-link-icon">{ICONS.external}</span>
              </span>
              <span className="cond-link-desc">{link.description}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
