import Button from "./button";

export default function ImagePreview({ src, alt, onRemove }: { src: string; alt: string; onRemove: () => void }) {
  return <div className="relative w-fit"><img src={src} alt={alt} className="max-h-48 max-w-full rounded-input object-contain" /><Button type="button" variant="danger" size="sm" aria-label="Xóa ảnh" onClick={onRemove}>Xóa</Button></div>;
}
