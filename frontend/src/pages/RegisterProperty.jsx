import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

const EMPTY = {
  title: "",
  description: "",
  location: "",
  propertyType: "Residential",
  areaSqft: "",
};

export default function RegisterProperty() {
  const [form, setForm] = useState(EMPTY);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Free the preview object URLs when they change or the page unmounts.
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  /** Pick up to 6 photos and build local previews. */
  const onPickImages = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 6);
    setImages(files);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!docs.length) throw new Error("Please attach at least one ownership document.");

      // Photos and ownership documents require a multipart request, so we send FormData.
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("location", form.location);
      fd.append("propertyType", form.propertyType);
      if (form.areaSqft) fd.append("areaSqft", String(Number(form.areaSqft)));
      for (const file of images) fd.append("images", file);
      for (const file of docs) fd.append("documents", file);

      const { property } = await api.postForm("/api/properties", fd);
      navigate(`/properties/${property.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="narrow">
      <div className="card">
        <h1>Register a property</h1>
        <p className="muted">
          Submit your property details. The government reviews the submission, and once approved it
          is minted as an NFT to your wallet.
        </p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form className="form" onSubmit={submit}>
          <div className="field">
            <label>Property title</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Riverside Plot 21"
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Property type</label>
              <select
                value={form.propertyType}
                onChange={(e) => setForm({ ...form, propertyType: e.target.value })}
              >
                <option>Residential</option>
                <option>Commercial</option>
                <option>Agricultural</option>
                <option>Industrial</option>
                <option>Land</option>
              </select>
            </div>
            <div className="field">
              <label>Area (sqft)</label>
              <input
                type="number"
                min="0"
                value={form.areaSqft}
                onChange={(e) => setForm({ ...form, areaSqft: e.target.value })}
                placeholder="e.g. 2200"
              />
            </div>
          </div>
          <div className="field">
            <label>Location</label>
            <input
              required
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="City, district"
            />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              rows="4"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the property, boundaries, and any notes."
            />
          </div>
          <div className="field">
            <label>Photos (up to 6)</label>
            <input type="file" accept="image/*" multiple onChange={onPickImages} />
            <small className="muted">
              Shown on your property page and in the marketplace so buyers can see the property.
            </small>
          </div>
          {previews.length > 0 && (
            <div className="thumb-grid">
              {previews.map((src, i) => (
                <img key={src} src={src} alt={`Preview ${i + 1}`} className="thumb-preview" />
              ))}
            </div>
          )}
          <div className="field">
            <label>Ownership documents (required)</label>
            <input
              type="file"
              multiple
              required
              accept="image/*,.pdf"
              onChange={(e) => setDocs(Array.from(e.target.files || []).slice(0, 5))}
            />
            <small className="muted">
              Proof that you own the land — e.g. the ownership certificate or deed (image or PDF).
              Stored off-chain; only you, the government, and an accepted buyer can view it.
            </small>
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Submitting…" : "Submit for verification"}
          </button>
        </form>
      </div>
    </div>
  );
}
