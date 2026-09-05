import type { ReactNode } from "react";

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40"
        role="status"
        aria-label="Завантаження"
      />
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-4 my-6 rounded-xl p-4 text-sm" style={{ background: "var(--tg-theme-secondary-bg-color)" }}>
      <p className="font-medium">Не вдалося завантажити</p>
      <p className="mt-1 opacity-70">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          Спробувати ще раз
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="text-5xl">{icon}</div>
      <p className="mt-4 font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm opacity-60">{hint}</p>}
    </div>
  );
}

/** Заголовок екрана. Кнопку «назад» дає сам Telegram, тож тут лише текст. */
export function ScreenTitle({ children }: { children: ReactNode }) {
  return <h1 className="px-4 pb-2 pt-4 text-xl font-bold">{children}</h1>;
}

export function formatPrice(value: number): string {
  // Ціни в каталозі цілі; копійки показуємо лише якщо вони справді є
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return `${value.toFixed(hasCents ? 2 : 0)} ₴`;
}
