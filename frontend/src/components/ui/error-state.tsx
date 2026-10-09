import Button from "./button";

export default function ErrorState({ title = "Có lỗi xảy ra", description, onRetry, retryLabel = "Thử lại" }: { title?: string; description: string; onRetry?: () => void; retryLabel?: string }) {
  return <div role="alert" aria-live="assertive" className="min-w-0 rounded-card border border-danger bg-danger-bg p-6 text-danger">
    <h2 className="font-heading text-lg font-semibold">{title}</h2>
    <p className="mt-2 break-words">{description}</p>
    {onRetry && <div className="mt-4"><Button variant="danger" onClick={onRetry}>{retryLabel}</Button></div>}
  </div>;
}
