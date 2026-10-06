export default function Loading() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">Đang tải nội dung</span>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <div className="h-8 w-48 rounded-input bg-border" />
        <div className="h-44 rounded-card bg-border" />
      </div>
    </div>
  );
}
