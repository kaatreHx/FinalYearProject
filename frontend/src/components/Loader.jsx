export default function Loader({ label = "Loading…" }) {
  return (
    <div className="loader">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}
