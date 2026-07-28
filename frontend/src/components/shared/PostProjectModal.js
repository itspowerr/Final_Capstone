import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { parseEther } from 'ethers';
import api from '../../services/api.js';
import { getProvider, getSigner, getContract, ensureCorrectNetwork } from '../../services/web3.js';
import { GIG_ESCROW_ABI } from '../../services/contractAbi.js';
import config from '../../config';
import '../../css/post-project-modal.css';

const DEMO_FREELANCERS = [
  { id: 'fl_1', name: 'Alex Rivera', role: 'UI/UX Designer', initials: 'AR', color: '#6366f1' },
  { id: 'fl_2', name: 'Sarah Chen', role: 'Full Stack Dev', initials: 'SC', color: '#10b981' },
  { id: 'fl_3', name: 'Jordan Smith', role: 'Marketing', initials: 'JS', color: '#f59e0b' },
  { id: 'fl_4', name: 'Maya Patel', role: 'Graphic Designer', initials: 'MP', color: '#ef4444' },
];

const categories = ['Development', 'Design', 'Marketing', 'Writing', 'Smart Contracts', 'Data & Analytics'];
const contractTypes = ['Fixed Price', 'Hourly', 'Milestone'];

const emptyMilestone = { description: '', amount: '', dueDate: '' };

export default function PostProjectModal({ isOpen, onClose }) {
  const [form, setForm] = useState({
    title: '', category: 'Development', description: '', budget: '', contractType: 'Fixed Price',
    skills: '', freelancerId: '', freelancerName: '',
    milestones: [{ ...emptyMilestone }],
  });
  const [freelancerSearch, setFreelancerSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [postError, setPostError] = useState(null);
  const [posting, setPosting] = useState(false);
  const [walletStatus, setWalletStatus] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      if (!window.ethereum) {
        setWalletStatus('no-wallet');
        return;
      }
      try {
        const provider = getProvider();
        const accounts = await provider.listAccounts();
        setWalletStatus(accounts.length > 0 ? 'connected' : 'disconnected');
      } catch {
        setWalletStatus('disconnected');
      }
    })();
  }, [isOpen]);

  const filteredFreelancers = DEMO_FREELANCERS.filter((f) =>
    f.name.toLowerCase().includes(freelancerSearch.toLowerCase()) ||
    f.role.toLowerCase().includes(freelancerSearch.toLowerCase())
  );

  const selectFreelancer = (f) => {
    setForm({ ...form, freelancerId: f.id, freelancerName: f.name });
    setFreelancerSearch(f.name);
    setShowDropdown(false);
  };

  const addMilestone = () => {
    setForm({ ...form, milestones: [...form.milestones, { ...emptyMilestone }] });
  };

  const removeMilestone = (i) => {
    setForm({ ...form, milestones: form.milestones.filter((_, idx) => idx !== i) });
  };

  const updateMilestone = (i, field, value) => {
    const ms = [...form.milestones];
    ms[i][field] = value;
    setForm({ ...form, milestones: ms });
  };

  const resetForm = () => {
    setForm({
      title: '', category: 'Development', description: '', budget: '', contractType: 'Fixed Price',
      skills: '', freelancerId: '', freelancerName: '',
      milestones: [{ ...emptyMilestone }],
    });
    setFreelancerSearch('');
    setFormErrors({});
    setPostError(null);
  };

  const connectWallet = async () => {
    try {
      const provider = getProvider();
      await provider.send('eth_requestAccounts', []);
      setWalletStatus('connected');
    } catch (err) {
      setPostError('MetaMask connection cancelled or failed.');
    }
  };

  function showToast(msg, icon) {
    setToast({ msg, icon: icon || '+' });
    setTimeout(() => setToast(null), 2500);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPostError(null);

    if (!window.ethereum) {
      setPostError('MetaMask is not installed. Please install the MetaMask browser extension.');
      return;
    }
    if (walletStatus !== 'connected') {
      setPostError('Please connect your MetaMask wallet before posting.');
      return;
    }

    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (!form.description.trim()) errs.description = 'Description is required.';
    if (!form.budget) errs.budget = 'Budget is required.';
    let hasValidMilestone = false;
    form.milestones.forEach((m, i) => {
      if (!m.description.trim() && !m.amount && !m.dueDate) return;
      if (!m.description.trim()) errs[`ms_desc_${i}`] = true;
      if (!m.amount) errs[`ms_amt_${i}`] = true;
      if (m.description.trim() && m.amount) hasValidMilestone = true;
    });
    if (!hasValidMilestone) errs.milestones = 'At least one milestone with description and amount is required.';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPosting(true);

    const skills = form.skills.split(',').map(s => s.trim()).filter(Boolean);
    const budget = parseFloat(form.budget);
    const validMilestones = form.milestones
      .filter(m => m.description.trim() && m.amount)
      .map(m => ({
        description: m.description.trim(),
        amount: parseFloat(m.amount) || 0,
        due_date: m.dueDate ? new Date(m.dueDate).toISOString() : null,
      }));
    const totalAmount = validMilestones.reduce((sum, m) => sum + m.amount, 0);

    if (Math.abs(totalAmount - budget) > 0.001) {
      setPostError(`Milestone amounts (${totalAmount.toFixed(4)} ETH) must sum to total budget (${budget.toFixed(4)} ETH).`);
      setPosting(false);
      return;
    }

    // Step 1: Save job + contract in backend (backend deploys on-chain)
    let jobId = null;
    try {
      setPostError('Saving to database...');
      const jobResp = await api.post('/jobs', {
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        budget: budget,
        skills: skills,
        duration_days: 30,
      });
      jobId = jobResp.data.id;

      const freelancerId = form.freelancerId.trim();
      const contractPayload = {
        job_id: jobId,
        ...(freelancerId ? { freelancer_id: freelancerId } : {}),
        title: form.title.trim(),
        description: form.description.trim(),
        total_amount: budget,
        milestones: validMilestones,
      };

      await api.post('/contracts', contractPayload);

      showToast('Project posted successfully!', '+');
      setTimeout(() => {
        resetForm();
        onClose();
      }, 1000);
    } catch (err) {
      const msg = err.response?.data?.detail?.message || err.response?.data?.detail || err.message || 'Failed to post project';
      setPostError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setPosting(false);
    }
  };

  const close = (e) => {
    if (e.target === e.currentTarget) {
      resetForm();
      onClose();
    }
  };

  return (
    <div className={`modal-overlay${isOpen ? ' open' : ''}`} onClick={close}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => { resetForm(); onClose(); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        <div className="modal-title">Post a New Project</div>
        <p className="modal-subtitle">Fill in the details to find the right talent.</p>

        {walletStatus === 'disconnected' && (
          <div className="form-warning" style={{ marginBottom: 12, padding: '12px 16px', background: '#fff3cd', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ flex: 1 }}>Connect your wallet to post projects on-chain.</span>
            <button className="btn btn-sm btn-primary" onClick={connectWallet}>Connect Wallet</button>
          </div>
        )}
        {walletStatus === 'no-wallet' && (
          <div className="form-warning" style={{ marginBottom: 12, padding: '12px 16px', background: '#f8d7da', borderRadius: 8, fontSize: 13 }}>
            MetaMask not detected. Please install the MetaMask browser extension.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Project Title</label>
              <input className="form-input" type="text" placeholder="e.g. Build a DeFi Dashboard" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              {formErrors.title && <div className="form-error-msg">{formErrors.title}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={3} placeholder="Describe the project scope, deliverables, and requirements…" style={{ resize: 'vertical' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            {formErrors.description && <div className="form-error-msg">{formErrors.description}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Budget (ETH)</label>
              <input className="form-input" type="number" step="0.01" placeholder="e.g. 10" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              {formErrors.budget && <div className="form-error-msg">{formErrors.budget}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Contract Type</label>
              <select className="form-input" value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
                {contractTypes.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Required Skills <span className="form-label-muted">(comma separated)</span></label>
            <input className="form-input" placeholder="e.g. Solidity, React, Node.js" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
          </div>

          <div className="form-group-relative" ref={dropdownRef}>
            <label className="form-label">Freelancer <span className="form-label-muted">(enter user ID)</span></label>
            <input className="form-input" type="text" placeholder="e.g. usr_fcfeb358eb43" value={freelancerSearch} onChange={(e) => { setFreelancerSearch(e.target.value); setForm({ ...form, freelancerId: e.target.value, freelancerName: e.target.value }); }} />
          </div>

          <div className="milestones-section">
            <h3>Milestones <span className="form-label-muted">(required)</span></h3>
            {formErrors.milestones && <div className="form-error-msg" style={{ marginBottom: 8 }}>{formErrors.milestones}</div>}
            {form.milestones.map((ms, i) => (
              <div key={i} className="milestone-card">
                <div className="milestone-header">
                  <span>Milestone {i + 1}</span>
                  {form.milestones.length > 1 && (
                    <button type="button" className="btn-remove-milestone" onClick={() => removeMilestone(i)}>Remove</button>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input className="form-input" type="text" placeholder="e.g. UI Wireframes" value={ms.description} onChange={(e) => updateMilestone(i, 'description', e.target.value)} />
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Amount (ETH)</label>
                    <input className="form-input" type="number" step="0.01" placeholder="e.g. 5" value={ms.amount} onChange={(e) => updateMilestone(i, 'amount', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Due Date</label>
                    <input className="form-input" type="date" value={ms.dueDate} onChange={(e) => updateMilestone(i, 'dueDate', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm" onClick={addMilestone}>+ Add Milestone</button>
          </div>

          {postError && <div className="form-error-msg" style={{ marginBottom: 8, textAlign: 'center' }}>{postError}</div>}
          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 8 }} disabled={posting}>
            {posting ? 'Posting...' : 'Post Project →'}
          </button>
        </form>
      </div>

      {toast && createPortal(
        <div className="toast show" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#101828', color: '#fff', padding: '12px 24px', borderRadius: '12px',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 12px 32px rgba(16,24,40,0.2)',
          fontFamily: "var(--landing-body)", fontSize: 14, fontWeight: 700, zIndex: 99999,
        }}>
          <span className="toast-icon">{toast.icon}</span>
          <span>{toast.msg}</span>
        </div>,
        document.body
      )}
    </div>
  );
}
