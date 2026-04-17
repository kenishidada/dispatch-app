"use client";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

export function AssignmentLogPanel() {
  const { assignmentLog } = useDeliveryStore();
  const copy = () => {
    const text = assignmentLog.map((e) => `[段階${e.step}: ${e.title}] ${e.message}`).join("\n");
    navigator.clipboard.writeText(text);
  };
  if (assignmentLog.length === 0) return null;
  return (
    <section className="rounded border p-3 space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm">振り分けログ</h3>
        <button onClick={copy} type="button" className="text-xs border rounded px-2 py-0.5">コピー</button>
      </div>
      <ul className="text-xs space-y-1 font-mono">
        {assignmentLog.map((e, i) => (
          <li key={i}><span className="text-gray-500">[段階{e.step}: {e.title}]</span> {e.message}</li>
        ))}
      </ul>
    </section>
  );
}
