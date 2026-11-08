export default function LoadingState({ rows = 4, rowHeight = 72 }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: rowHeight }} />
      ))}
    </div>
  );
}
