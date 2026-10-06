"use client";

/** Next 16 supplies retry() to refetch the failed segment, rather than only clearing its state. */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="space-y-4 rounded-card border border-border bg-surface p-6">
      <h1 className="font-heading text-2xl font-bold text-text">Không thể tải nội dung</h1>
      <p>Kiểm tra kết nối và thử lại.</p>
      <button type="button" onClick={retry} className="min-h-11 cursor-pointer rounded-input bg-primary px-4 py-2 font-semibold text-surface hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Thử lại</button>
    </div>
  );
}
