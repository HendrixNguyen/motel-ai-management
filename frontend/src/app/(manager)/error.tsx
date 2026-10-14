"use client";

import Button from "@/components/ui/button";

/** Next 16 supplies retry() to refetch the failed segment, rather than only clearing its state. */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="space-y-4 rounded-card border border-border bg-surface p-6">
      <h1 className="font-heading text-2xl font-bold text-text">Không thể tải nội dung</h1>
      <p>Kiểm tra kết nối và thử lại.</p>
      <Button onClick={retry}>Thử lại</Button>
    </div>
  );
}
