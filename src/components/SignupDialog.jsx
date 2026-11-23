import { useState } from 'react';

export default function SignupDialog({ onSubmit, onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (name.trim().length < 2) return setError('Please enter your name.');
    if (!/^\d{10}$/.test(phone)) return setError('Enter a valid 10-digit phone number.');
    setSaving(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), phone });
    } catch {
      setError('Could not sign up. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="signup-backdrop" role="dialog" aria-modal="true">
      <form className="signup-box" onSubmit={handleSubmit}>
        <h3>Sign up to view your cart</h3>
        <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          placeholder="Phone number (10 digits)"
          inputMode="numeric"
          maxLength={10}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
        />
        {error && <p className="signup-error">{error}</p>}
        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Sign up & view cart'}
        </button>
        <button type="button" className="button button-outline" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
}