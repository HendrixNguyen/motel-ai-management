import type { MotelResponse } from "@/lib/api/types";
import Dropdown from "./dropdown";

export default function MotelSwitcher({ motels, selectedId, onChange, disabled = false }: { motels: MotelResponse[]; selectedId?: string; onChange: (id: string) => void; disabled?: boolean }) {
  const options = motels.map((motel) => ({ value: motel.id, label: motel.name }));
  return (
    <label htmlFor="motel-selector-button" className="block min-w-0">
      <span className="sr-only">Nhà trọ</span>
      <Dropdown
        id="motel-selector"
        options={options}
        value={selectedId ?? ""}
        onChange={onChange}
        placeholder={motels.length ? "Chọn nhà trọ" : "Chưa có nhà trọ"}
        disabled={motels.length === 0 || disabled}
      />
    </label>
  );
}
