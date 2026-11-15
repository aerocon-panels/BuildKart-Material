import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function SettingsDialog({ settings, onSave, onClose }) {
  const [form, setForm] = useState(settings);

  useEffect(() => setForm(settings), [settings]);

  function submit(event) {
    event.preventDefault();
    onSave({
      ...form,
      phone: form.phone.replace(/[^\d]/g, ''),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="settings-dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="form-heading">
          <div><span className="eyebrow">STORE PROFILE</span><h2 id="settings-title">Contact & payment settings</h2></div>
          <button type="button" className="quiet-button" aria-label="Close settings" onClick={onClose}><X size={20} /></button>
        </div>
        <p className="dialog-intro">These details appear in quotation messages and PDFs. They are saved only in this browser.</p>
        <label>Store name<input required value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} /></label>
        <label>WhatsApp number (country code + number)
          <input required inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="918317666756" />
        </label>
        <label>UPI ID<input value={form.upi} onChange={(event) => setForm({ ...form, upi: event.target.value })} placeholder="name@bank" /></label>
        <label>Store / dispatch location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
        <label>GSTIN (optional)<input value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value })} /></label>
        <div className="form-actions">
          <button type="button" className="button button-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary">Save settings</button>
        </div>
      </form>
    </div>
  );
}
