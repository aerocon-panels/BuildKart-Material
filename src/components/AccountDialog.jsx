import { useState } from 'react';

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const card = { background: '#fff', color: '#0b1b2e', borderRadius: 14, padding: 24,
  width: '100%', maxWidth: 420, boxSizing: 'border-box' };
const btn = { width: '100%', padding: '12px 16px', borderRadius: 8, border: 'none',
  background: '#d97706', color: '#fff', fontSize: 16, cursor: 'pointer', marginTop: 10 };
const btnLight = { ...btn, background: '#eef1f5', color: '#0b1b2e' };
const input = { width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1',
  fontSize: 16, marginTop: 6, boxSizing: 'border-box' };

export default function AccountDialog({ onCustomerLogin, onAdminSuccess, onClose }) {
  const [mode, setMode] = useState('choose');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function adminLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Login failed');
      onAdminSuccess();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Account</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>×</button>
        </div>

        {mode === 'choose' && (
          <>
            <button type="button" style={btn} onClick={onCustomerLogin}>Customer login</button>
            <button type="button" style={btnLight} onClick={() => setMode('admin')}>Admin login</button>
          </>
        )}

        {mode === 'admin' && (
          <form onSubmit={adminLogin}>
            <label style={{ display: 'block', marginTop: 12 }}>Username
              <input style={input} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </label>
            <label style={{ display: 'block', marginTop: 12 }}>Password
              <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </label>
            {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
            <button type="submit" style={btn} disabled={busy}>{busy ? 'Checking…' : 'Login as Admin'}</button>
            <button type="button" style={btnLight} onClick={() => { setMode('choose'); setError(''); }}>Back</button>
          </form>
        )}
      </div>
    </div>
  );
}