export default function Loading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite">
      <div className="h-4 w-28 rounded bg-muted" />
      <div className="h-10 w-72 max-w-full rounded bg-muted" />
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 rounded-2xl border bg-card" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border bg-card" />
    </div>
  );
}
