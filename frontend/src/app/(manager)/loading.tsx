export default function Loading() {
  return (
    <div role="status" aria-label="Đang tải nội dung" className="space-y-6">
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <div className="h-8 w-48 rounded-input bg-border" />
        <div className="h-44 rounded-card bg-border" />
      </div>
    </div>
  );
}
