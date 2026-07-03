/* eslint-disable jsx-a11y/anchor-is-valid */
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <>
      <nav className="nav">
        <Link className="nav-logo" to="/">
          <div className="nav-logo-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          FreeLedger
        </Link>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How It Works</a>
          <Link to="/login">Freelancers</Link>
        </div>
        <div className="nav-actions">
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/login')}>Log In</button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/login#register')}>Get Started</button>
        </div>
      </nav>

      <section>
        <div className="hero">
          <div className="hero-text">
            <div className="hero-badge"><span></span> Web3 · Decentralized · No Middlemen</div>
            <h1>Decentralized<br />Freelancing<br /><em>Without Middlemen</em></h1>
            <p>Hire talent or find projects with secure smart contracts and decentralized identity. No hidden fees, no gatekeepers.</p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>Connect Wallet</button>
              <button className="btn btn-outline btn-lg" onClick={() => navigate('/login')}>Explore Jobs</button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="chain-nodes">
              <div className="node">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              </div>
              <div className="chain-line"></div>
              <div className="node">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
              </div>
              <div className="chain-line"></div>
              <div className="node">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div className="chain-line"></div>
              <div className="node">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="section-header">
          <div className="section-label">Why FreeLedger</div>
          <h2 className="section-title">Built for the future of work</h2>
          <p className="section-sub">Experience the first truly peer-to-peer professional ecosystem powered by blockchain.</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>
            </div>
            <h3>Secure Identity</h3>
            <p>Build your decentralized profile with blockchain-backed credentials that you own.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3>Smart Contract Escrow</h3>
            <p>Funds are locked safely and released automatically upon milestone completion.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            </div>
            <h3>Decentralized Storage</h3>
            <p>Your work and portfolio live on IPFS — permanent, uncensorable, and always accessible.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </div>
            <h3>Fair Marketplace</h3>
            <p>Transparent matching algorithms highlight your skills and ensure fair opportunities.</p>
          </div>
        </div>
      </section>

      <div className="how-section" id="how">
        <div className="how-inner">
          <div>
            <div className="section-label">Process</div>
            <h2 className="section-title">How It Works</h2>
            <p className="section-sub" style={{marginBottom: 40}}>Four simple steps to start working in the decentralized economy.</p>
            <div className="how-steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-content">
                  <h4>Connect Wallet</h4>
                  <p>Link MetaMask, Phantom, etc. to securely authenticate without passwords.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-content">
                  <h4>Browse Opportunities</h4>
                  <p>Explore a global list of projects or browse top talent using our on-chain verification.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-content">
                  <h4>Secure Agreement</h4>
                  <p>Smart contracts handle the escrow and enforce terms automatically.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">4</div>
                <div className="step-content">
                  <h4>Complete &amp; Get Paid</h4>
                  <p>Deliver work through IPFS. Payment is released instantly once milestones are approved.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="how-visual">
            <h3>Platform Snapshot</h3>
            <div className="stat-row">
              <div className="stat-box"><div className="val">2.4K</div><div className="lbl">Active Projects</div></div>
              <div className="stat-box"><div className="val">98%</div><div className="lbl">Success Rate</div></div>
            </div>
            <div className="progress-item">
              <div className="progress-label"><span>Smart Contract Volume</span><span>84%</span></div>
              <div className="progress-bar"><div className="progress-fill" style={{width: '84%'}}></div></div>
            </div>
            <div className="progress-item">
              <div className="progress-label"><span>Developer Demand</span><span>91%</span></div>
              <div className="progress-bar"><div className="progress-fill" style={{width: '91%'}}></div></div>
            </div>
            <div className="progress-item">
              <div className="progress-label"><span>On-time Delivery</span><span>76%</span></div>
              <div className="progress-bar"><div className="progress-fill" style={{width: '76%'}}></div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="cta-section">
        <div className="cta-inner">
          <h2>Ready to join the revolution?</h2>
          <p>Start working on projects that define the next generation of the internet.</p>
          <button className="btn btn-white btn-lg" onClick={() => navigate('/login#register')}>Join FreeLedger Today →</button>
        </div>
      </div>

      <footer className="footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link className="nav-logo" to="/" style={{color: '#fff'}}>
              <div className="nav-logo-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              FreeLedger
            </Link>
            <p>The future of decentralized work. No fees, no middlemen, no compromise. Powered by blockchain smart contracts.</p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <a href="#">Find Talent</a>
            <a href="#">Find Work</a>
            <a href="#">Smart Escrow</a>
            <a href="#">Token</a>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <a href="#">Documentation</a>
            <a href="#">Help Center</a>
            <a href="#">Blog</a>
            <a href="#">Changelog</a>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Governance</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2024 FreeLedger DAO. All rights reserved.</p>
          <div className="footer-socials">
            <div className="social-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.48 4.48 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>
            </div>
            <div className="social-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
