export default function EmptyState({ icon: Icon, title, text, actionLabel, onAction }) {
  return (
    <section className="empty-state">
      <div className="empty-icon">
        <Icon size={46} strokeWidth={1.8} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {actionLabel && (
        <button className="btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}
