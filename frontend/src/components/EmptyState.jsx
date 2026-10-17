export default function EmptyState({ title, message, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">◌</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
