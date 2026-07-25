import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  const goLogin = () => navigate('/login');
  const goRegister = () => navigate('/login#register');

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-shell landing-nav">
          <Link className="landing-brand" to="/">
            <span className="landing-brand-mark">F</span>
            FreeLedger
          </Link>

          <nav className="landing-links" aria-label="Landing navigation">
            <a href="#why">Why FreeLedger</a>
            <a href="#experience">Experience</a>
            <a href="#safety">Safety</a>
          </nav>

          <div className="landing-actions">
            <button className="landing-button landing-button-light" onClick={goLogin}>
              Sign in
            </button>
            <button className="landing-button landing-button-primary" onClick={goRegister}>
              Get started
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-shell landing-hero-grid">
            <div className="landing-hero-copy">
              <div className="landing-kicker">
                <i aria-hidden="true" />
                A calmer way to work
              </div>
              <h1>
                Great work.
                <br />
                <em>Clear agreements.</em>
              </h1>
              <p>
                FreeLedger brings clients and independent talent together with protected payments,
                portable reputation, and none of the usual platform friction.
              </p>
              <div className="landing-hero-actions">
                <button className="landing-button landing-button-primary landing-button-large" onClick={goRegister}>
                  Find meaningful work
                </button>
                <button className="landing-button landing-button-light landing-button-large" onClick={goRegister}>
                  Meet verified talent
                </button>
              </div>
              <div className="landing-proof">
                <span><i>✓</i>No platform commission</span>
                <span><i>✓</i>Protected payments</span>
                <span><i>✓</i>Your reputation stays yours</span>
              </div>
            </div>

            <div className="landing-visual" aria-label="FreeLedger workspace preview">
              <div className="landing-visual-blob" />
              <div className="landing-workspace">
                <div className="landing-workspace-top">
                  <div className="landing-workspace-title">
                    <span>F</span>
                    Your workspace
                  </div>
                  <strong>Everything on track</strong>
                </div>
                <div className="landing-workspace-body">
                  <p className="landing-eyebrow">Good morning, Maya</p>
                  <h3>Product experience design</h3>
                  <div className="landing-project-card">
                    <div className="landing-project-head">
                      <div>
                        <h4>Website redesign</h4>
                        <p>Clear scope - Protected agreement</p>
                      </div>
                      <span>In progress</span>
                    </div>
                    <div className="landing-flow">
                      <i />
                    </div>
                    <div className="landing-phases">
                      <div className="landing-phase is-ready">
                        <small>Research</small>
                        <b>Approved</b>
                      </div>
                      <div className="landing-phase is-ready">
                        <small>Design system</small>
                        <b>Approved</b>
                      </div>
                      <div className="landing-phase">
                        <small>Prototype</small>
                        <b>In review</b>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="landing-notice">
                <span>✓</span>
                <div>
                  <b>Work approved</b>
                  <small>Your payment is on its way</small>
                </div>
              </div>
            </div>
          </div>
        </section>


        <section className="landing-section landing-section-soft" id="why">
          <div className="landing-shell">
            <div className="landing-section-head">
              <span className="landing-section-label">Why FreeLedger</span>
              <h2>Professional freedom without the uncertainty.</h2>
              <p>
                Everything is designed to make independent work feel more human, transparent,
                and secure.
              </p>
            </div>
            <div className="landing-cards">
              <article className="landing-card">
                <div className="landing-card-icon">F</div>
                <h3>Reputation that belongs to you</h3>
                <p>Your verified work history moves with you, so your credibility never gets trapped inside a platform.</p>
              </article>
              <article className="landing-card">
                <div className="landing-card-icon">✓</div>
                <h3>Agreements everyone understands</h3>
                <p>Scope, milestones, and expectations stay visible, creating clarity before the work begins.</p>
              </article>
              <article className="landing-card">
                <div className="landing-card-icon">+</div>
                <h3>More value stays with you</h3>
                <p>Direct relationships replace heavy marketplace commissions and unnecessary intermediaries.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-section" id="experience">
          <div className="landing-shell landing-story-grid">
            <div className="landing-story-copy">
              <span className="landing-section-label">Simple by design</span>
              <h2>From first conversation to final approval.</h2>
              <p>
                The infrastructure stays quietly in the background while you focus on the
                relationship and the work itself.
              </p>
              <div className="landing-note">
                <i>F</i>
                Technology should create confidence, not complexity.
              </div>
            </div>
            <div className="landing-journey">
              <article>
                <span>01</span>
                <div>
                  <h3>Build a trustworthy presence</h3>
                  <p>Share your experience, skills, and verified professional history.</p>
                </div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <h3>Shape the agreement together</h3>
                  <p>Make the scope, deliverables, and expectations clear for everyone.</p>
                </div>
              </article>
              <article>
                <span>03</span>
                <div>
                  <h3>Work with payment protection</h3>
                  <p>Know that the agreement is secured before you invest your time.</p>
                </div>
              </article>
              <article>
                <span>04</span>
                <div>
                  <h3>Approve, deliver, and move forward</h3>
                  <p>Close the project cleanly and carry your reputation into the next one.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-section" id="safety">
          <div className="landing-shell">
            <div className="landing-safety">
              <div>
                <span className="landing-section-label">Confidence built in</span>
                <h2>Protection should feel effortless.</h2>
                <p>
                  FreeLedger gives both sides a shared source of truth, without turning every
                  project into a technical exercise.
                </p>
              </div>
              <div className="landing-safety-list">
                <div><i>✓</i>Payment protected before work begins</div>
                <div><i>✓</i>Terms that stay clear and visible</div>
                <div><i>✓</i>Approval tied to meaningful milestones</div>
                <div><i>✓</i>Identity and work history you control</div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-cta" id="start">
          <div className="landing-shell">
            <div className="landing-cta-box">
              <h2>Work should feel this clear.</h2>
              <p>Find the right collaboration and move forward with confidence.</p>
              <div className="landing-cta-actions">
                <button className="landing-button landing-button-primary landing-button-large" onClick={goRegister}>
                  Explore opportunities
                </button>
                <button className="landing-button landing-button-light landing-button-large" onClick={goRegister}>
                  Find the right person
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell">
          <div className="landing-footer-top">
            <div className="landing-footer-about">
              <Link className="landing-brand" to="/">
                <span className="landing-brand-mark">F</span>
                FreeLedger
              </Link>
              <p>Borderless professional relationships, protected agreements, and reputation you truly own.</p>
            </div>
            <div className="landing-footer-links">
              <div>
                <h4>Product</h4>
                <button onClick={goRegister}>Find work</button>
                <button onClick={goRegister}>Hire talent</button>
                <a href="#experience">How it works</a>
              </div>
              <div>
                <h4>Resources</h4>
                <a href="#why">Benefits</a>
                <a href="#safety">Safety</a>
                <button onClick={goLogin}>Sign in</button>
              </div>
              <div>
                <h4>Company</h4>
                <a href="#why">About</a>
                <a href="#safety">Privacy</a>
                <a href="#safety">Terms</a>
              </div>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <span>FreeLedger. All rights reserved.</span>
            <span>Built for independent work.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
