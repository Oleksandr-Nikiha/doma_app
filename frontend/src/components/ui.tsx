import { useState, type ReactNode } from "react";

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
    <div className="app-card app-rise mx-4 my-6 rounded-2xl p-4 text-sm">
      <p className="font-medium">Не вдалося завантажити</p>
      <p className="mt-1 opacity-70">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="app-press mt-3 rounded-lg px-4 py-2 text-sm font-medium"
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
    <div className="app-rise flex flex-col items-center px-6 py-16 text-center">
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

/**
 * Заголовок секції всередині екрана: підкатегорія або заклад.
 *
 * Липкий і з акцентною рискою — у списку на 25 позицій інакше не видно, в якій
 * ти секції, а дрібний сірий капслок губився серед карток. Підкладка
 * напівпрозора з розмиттям, щоб текст не зливався з тим, що проїжджає під ним.
 */
export function SectionHeading({ children, sticky = true }: { children: ReactNode; sticky?: boolean }) {
  return (
    <h2
      className={`${sticky ? "sticky top-0 z-10" : ""} mb-2 flex items-center gap-2 px-4 py-2 text-[15px] font-bold`}
      style={
        sticky
          ? { background: "var(--app-veil)", backdropFilter: "blur(12px)" }
          : undefined
      }
    >
      <span
        className="h-4 w-1 shrink-0 rounded-full"
        style={{ background: "var(--tg-theme-button-color)" }}
        aria-hidden
      />
      {children}
    </h2>
  );
}

/**
 * Картинка товару зі скелетоном і проявленням.
 *
 * Фото тягнуться зі сторонього домену й приходять урозсип; без плейсхолдера
 * список стрибає, а картки блимають. Помилку завантаження ловимо окремо —
 * інакше лишалась би порожня рамка.
 */
export function Thumb({
  src,
  className = "",
  rounded = "rounded-xl",
  fallback = "🍕",
  eager = false,
}: {
  src: string | null;
  className?: string;
  rounded?: string;
  fallback?: string;
  /** Головне фото екрана вантажимо одразу; мініатюри списку — лінюче. */
  eager?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">(src ? "loading" : "failed");

  if (state === "failed") {
    return (
      <div
        className={`flex items-center justify-center opacity-40 ${rounded} ${className}`}
        style={{ background: "var(--app-skeleton)" }}
        aria-hidden
      >
        {fallback}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{ background: state === "loading" ? "var(--app-skeleton)" : undefined }}
    >
      <img
        src={src ?? ""}
        alt=""
        loading={eager ? "eager" : "lazy"}
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
        className="h-full w-full object-cover transition-opacity duration-300"
        style={{ opacity: state === "ready" ? 1 : 0 }}
      />
    </div>
  );
}

export function formatPrice(value: number): string {
  // Ціни в каталозі цілі; копійки показуємо лише якщо вони справді є
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return `${value.toFixed(hasCents ? 2 : 0)} ₴`;
}
