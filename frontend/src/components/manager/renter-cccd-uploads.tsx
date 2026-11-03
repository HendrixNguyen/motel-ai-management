"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import FileUpload from "@/components/ui/file-upload";
import { Button } from "@/components/ui/shadcn/button";
import { getRenterCccdUrl, uploadRenterCccd } from "@/lib/api/renters.client";

const MAX_BYTES = 5_000_000;

export default function RenterCccdUploads({
  motelId,
  renterId,
  renterName,
  frontUploaded,
  backUploaded,
}: {
  motelId: string;
  renterId: string;
  renterName: string;
  frontUploaded: boolean;
  backUploaded: boolean;
}) {
  const [uploaded, setUploaded] = useState({ front: frontUploaded, back: backUploaded });
  const [preview, setPreview] = useState<{ side: "front" | "back"; url: string }>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [opening, setOpening] = useState<"front" | "back">();
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  async function upload(side: "front" | "back", file: File) {
    setPending(true);
    setError(undefined);
    try {
      await uploadRenterCccd(motelId, renterId, side, file);
      setUploaded((current) => ({ ...current, [side]: true }));
      setPreview(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải ảnh CCCD");
    } finally {
      setPending(false);
    }
  }

  async function open(side: "front" | "back") {
    setOpening(side);
    setError(undefined);
    try {
      const result = await getRenterCccdUrl(motelId, renterId, side);
      setPreview({ side, url: result.url });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể mở ảnh CCCD");
    } finally {
      setOpening(undefined);
    }
  }

  return (
    <section aria-labelledby="cccd-images" className="mt-6 min-w-0 space-y-4">
      <div>
        <h3 id="cccd-images" className="font-semibold text-text">
          Ảnh CCCD
        </h3>
        <p className="mt-1 text-sm text-text-muted">
          Chỉ quản lý nhà trọ xem được. JPEG hoặc PNG, tối đa 5 MB mỗi mặt.
        </p>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {(["front", "back"] as const).map((side) => (
          <div
            key={side}
            className="min-w-0 space-y-2 rounded-card border border-border bg-canvas p-3"
          >
            <p className="font-semibold text-text">
              Mặt {side === "front" ? "trước" : "sau"} ·{" "}
              {uploaded[side] ? "Đã tải lên" : "Chưa có ảnh"}
            </p>
            <FileUpload
              id={`renter-cccd-${side}`}
              label={`CCCD mặt ${side === "front" ? "trước" : "sau"}`}
              maxBytes={MAX_BYTES}
              pending={pending}
              onFiles={(files) => {
                if (files[0]) void upload(side, files[0]);
              }}
            />
            {uploaded[side] && (
              <Button
                variant="secondary"
                disabled={Boolean(opening)}
                onClick={() => void open(side)}
              >
                {opening === side ? "Đang mở…" : "Xem ảnh"}
              </Button>
            )}
          </div>
        ))}
      </div>
      {preview && (
        <div className="space-y-2 rounded-card border border-border p-3">
          <p className="font-semibold text-text">
            CCCD mặt {preview.side === "front" ? "trước" : "sau"} của {renterName}
          </p>
          <Image
            src={preview.url}
            alt={`CCCD mặt ${preview.side === "front" ? "trước" : "sau"} của ${renterName}`}
            width={800}
            height={500}
            unoptimized
            referrerPolicy="no-referrer"
            className="max-h-96 w-full rounded-input object-contain"
          />
          <Button variant="secondary" onClick={() => setPreview(undefined)}>
            Đóng ảnh
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
