"use client";
import { useAutoAssign } from "@/features/assignment/hooks/useAutoAssign";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

export function RerunButton() {
  const { runAssign } = useAutoAssign();
  const { isProcessing, clearAssignmentResults } = useDeliveryStore();
  const rerun = async () => {
    clearAssignmentResults();
    await runAssign();
  };
  return (
    <button
      onClick={rerun}
      disabled={isProcessing}
      type="button"
      className="border rounded px-3 py-1 text-sm disabled:opacity-50"
    >
      {isProcessing ? "実行中..." : "振り分けをやり直す"}
    </button>
  );
}
