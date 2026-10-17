import { haptic } from "@/telegram/sdk";

interface CancelOrderModalProps {
  orderId: number;
  isOpen: boolean;
  isCancelling: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CancelOrderModal({
  orderId,
  isOpen,
  isCancelling,
  onClose,
  onConfirm,
}: CancelOrderModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm app-fade">
      <div
        className="w-full max-w-xs rounded-2xl p-5 shadow-2xl text-center space-y-4"
        style={{
          background: "var(--tg-theme-bg-color, #ffffff)",
          color: "var(--tg-theme-text-color, #000000)",
        }}
      >
        <div className="text-4xl">⚠️</div>
        <div>
          <h3 className="text-base font-bold">Скасувати замовлення?</h3>
          <p className="mt-1 text-xs opacity-70 leading-relaxed">
            Ви дійсно бажаєте скасувати замовлення #{orderId}? Цю дію неможливо відмінити.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              haptic("light");
              onClose();
            }}
            disabled={isCancelling}
            className="app-press flex-1 rounded-xl py-2.5 text-xs font-semibold"
            style={{
              background: "var(--app-surface-2, rgba(0,0,0,0.05))",
            }}
          >
            Залишити
          </button>
          <button
            type="button"
            onClick={() => {
              haptic("medium");
              onConfirm();
            }}
            disabled={isCancelling}
            className="app-press flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition"
            style={{
              background: "#ef4444",
            }}
          >
            {isCancelling ? "Скасування..." : "Так, скасувати"}
          </button>
        </div>
      </div>
    </div>
  );
}
