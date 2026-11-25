import { useState } from 'react';
import { uploadProductImage } from '../api.js';

export default function ProductImageAdmin({
  defaultImage,
  defaultThickness,
  loadError,
  onUploaded,
}) {
  const [image, setImage] = useState(defaultImage);
  const [thickness, setThickness] = useState(defaultThickness);
  const [sizeLabel, setSizeLabel] = useState('');
  const [file, setFile] = useState(null);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setUploading(true);
    setStatus(null);

    try {
      const uploadedImage = await uploadProductImage({
        file,
        image,
        thickness,
        sizeLabel,
        token,
      });

      try {
        await onUploaded(uploadedImage);
        setStatus({ type: 'success', message: `Image uploaded: ${uploadedImage.imageUrl}` });
      } catch (error) {
        setStatus({ type: 'error', message: `Image uploaded, but refreshing the image list failed: ${error.message}` });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <details className="product-image-admin">
      <summary>Admin: upload a product photo</summary>
      <form className="product-image-upload-form" onSubmit={submit}>
        <label>Image key
          <input
            required
            value={image}
            onChange={(event) => setImage(event.target.value)}
            placeholder="aerocon-sandwich-partition-panel-75mm-8ft"
          />
        </label>
        <label>Thickness
          <input required value={thickness} onChange={(event) => setThickness(event.target.value)} placeholder="75mm" />
        </label>
        <label>Size label (optional)
          <input value={sizeLabel} onChange={(event) => setSizeLabel(event.target.value)} placeholder="8ft" />
        </label>
        <label>Admin token
          <input
            required
            type="password"
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <label className="product-image-file">Photo
          <input
            required
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </label>
        <button className="button button-primary" type="submit" disabled={uploading || !file}>
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        {loadError && <p className="product-image-upload-status error" role="alert">{loadError}</p>}
        {status && <p className={`product-image-upload-status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>{status.message}</p>}
      </form>
    </details>
  );
}