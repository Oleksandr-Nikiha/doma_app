import { useState } from "react";

import {
  useAdminBroadcastRecipientsCount,
  useAdminBroadcasts,
  useCreateBroadcast,
} from "@/api/queries";
import type { BroadcastSegment } from "@/api/types";
import { EmptyState, ErrorBox, Spinner } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";

const SEGMENT_OPTIONS: {
  id: BroadcastSegment;
  label: string;
  desc: string;
  icon: string;
}[] = [
  {
    id: "all",
    label: "Всі клієнти",
    desc: "Усі зареєстровані користувачі з номером телефону",
    icon: "👥",
  },
  {
    id: "active_30d",
    label: "Активні за 30 днів",
    desc: "Зробили хоча б 1 замовлення за останній місяць",
    icon: "⚡",
  },
  {
    id: "inactive",
    label: "Давно не замовляли",
    desc: "Не замовляли понад 30 днів або взагалі без замовлень",
    icon: "💤",
  },
  {
    id: "top_orders",
    label: "Топ-замовники (VIP)",
    desc: "Постійні клієнти (від 2-х успішних замовлень)",
    icon: "👑",
  },
];

export function BroadcastsTab() {
  const [segment, setSegment] = useState<BroadcastSegment>("all");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [lastSentInfo, setLastSentInfo] = useState<{ title: string; count: number } | null>(null);

  // Дані отримувачів та історія
  const { data: recipientsData, isPending: isCountPending } =
    useAdminBroadcastRecipientsCount(segment);
  const { data: broadcasts = [], isPending: isListPending, error: listError } =
    useAdminBroadcasts();
  const createBroadcastMutation = useCreateBroadcast();

  const recipientCount = recipientsData?.count ?? 0;

  const handleSegmentChange = (s: BroadcastSegment) => {
    haptic("light");
    setSegment(s);
  };

  const handleOpenConfirm = () => {
    if (!title.trim() || !text.trim()) {
      alert("Будь ласка, вкажіть назву кампанії та текст повідомлення");
      return;
    }
    if (recipientCount === 0) {
      alert("В обраному сегменті немає отримувачів");
      return;
    }
    if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl)) {
      alert("Для кнопки потрібно вказати і текст, і посилання URL");
      return;
    }
    haptic("medium");
    setIsConfirmOpen(true);
  };

  const handleSendBroadcast = async () => {
    try {
      const currentTitle = title.trim();
      const currentCount = recipientCount;

      await createBroadcastMutation.mutateAsync({
        title: currentTitle,
        text: text.trim(),
        image_url: imageUrl.trim() || null,
        button_text: buttonText.trim() || null,
        button_url: buttonUrl.trim() || null,
        segment,
      });

      setLastSentInfo({ title: currentTitle, count: currentCount });
      hapticNotify("success");
      setIsConfirmOpen(false);
      // Очищаємо форму після запуску
      setTitle("");
      setText("");
      setImageUrl("");
      setButtonText("");
      setButtonUrl("");
    } catch (err: any) {
      hapticNotify("error");
      alert(err.message || "Помилка при запуску розсилки");
    }
  };

  return (
    <div className="space-y-6 pb-12 px-4 md:px-8 max-w-6xl mx-auto">
      {/* Сповіщення про успішний запуск розсилки */}
      {lastSentInfo && (
        <div
          className="rounded-2xl p-4 border border-emerald-500/40 bg-emerald-500/15 flex items-center justify-between gap-3 shadow-md"
          style={{ color: "var(--tg-theme-text-color, #ffffff)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl">✅</span>
            <div className="min-w-0">
              <p className="font-bold text-sm">
                Розсилку «{lastSentInfo.title}» успішно запущено!
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                Повідомлення надсилаються у фоні для {lastSentInfo.count} клієнтів. Статус оновлюється в списку нижче.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLastSentInfo(null)}
            className="p-1.5 rounded-xl hover:bg-emerald-500/20 text-xs shrink-0 font-bold opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Блок створення нової розсилки */}
      <div className="app-card rounded-2xl p-4 md:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📢</span>
            <div>
              <h3 className="text-base font-bold tracking-tight">Нова розсилка клієнтам</h3>
              <p className="text-xs opacity-60">
                Повідомлення буде надіслано від імені Telegram-бота
              </p>
            </div>
          </div>
        </div>

        {/* Вибір сегмента аудиторії */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider opacity-60">
            1. Сегмент аудиторії
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {SEGMENT_OPTIONS.map((opt) => {
              const isSelected = segment === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSegmentChange(opt.id)}
                  className={`app-press flex flex-col justify-between p-3 rounded-xl text-left transition-all border ${
                    isSelected
                      ? "border-emerald-500 shadow-sm"
                      : "border-[var(--app-border)] opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    background: isSelected ? "var(--app-surface-2)" : "transparent",
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-lg">{opt.icon}</span>
                    {isSelected && (
                      <span className="text-emerald-500 text-xs font-black">✓ Обрано</span>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="font-bold text-xs">{opt.label}</p>
                    <p className="text-[10px] opacity-60 leading-tight mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Плашка розміру аудиторії */}
          <div
            className="flex items-center justify-between p-3 rounded-xl text-xs"
            style={{ background: "var(--app-surface-2)" }}
          >
            <span className="opacity-75">Потенційна аудиторія вибраного сегмента:</span>
            <span className="font-bold text-emerald-500 flex items-center gap-1.5">
              {isCountPending ? (
                <span className="opacity-50">Підрахунок...</span>
              ) : (
                <>
                  <span>👥 {recipientCount} клієнтів</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Форма контенту розсилки та Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
          {/* Ліва колонка: поля вводу (7 cols) */}
          <div className="lg:col-span-7 space-y-3.5">
            <label className="block text-xs font-bold uppercase tracking-wider opacity-60">
              2. Вміст повідомлення
            </label>

            <div>
              <label className="block text-xs font-semibold mb-1 opacity-80">
                Назва кампанії (внутрішня для адмінів)
              </label>
              <input
                type="text"
                placeholder="наприклад: Знижка -20% на всі піци у п'ятницю"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs border border-[var(--app-border)] bg-[var(--app-surface-2)] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold opacity-80">
                  Текст повідомлення
                </label>
                <span className="text-[10px] opacity-50">Підтримує HTML (&lt;b&gt;, &lt;i&gt;)</span>
              </div>
              <textarea
                rows={5}
                placeholder="Привіт! 🔥 Тільки цього вікенду замовляй улюблені страви зі знижкою..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full rounded-xl p-3 text-xs border border-[var(--app-border)] bg-[var(--app-surface-2)] focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 opacity-80">
                URL зображення / банера (опціонально)
              </label>
              <input
                type="url"
                placeholder="https://example.com/promo-banner.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs border border-[var(--app-border)] bg-[var(--app-surface-2)] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold mb-1 opacity-80">
                  Текст інлайн-кнопки
                </label>
                <input
                  type="text"
                  placeholder="🍕 Відкрити меню"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-xs border border-[var(--app-border)] bg-[var(--app-surface-2)] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 opacity-80">
                  Посилання кнопки (URL)
                </label>
                <input
                  type="url"
                  placeholder="https://t.me/..."
                  value={buttonUrl}
                  onChange={(e) => setButtonUrl(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-xs border border-[var(--app-border)] bg-[var(--app-surface-2)] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenConfirm}
                disabled={createBroadcastMutation.isPending || !title.trim() || !text.trim()}
                className="app-press w-full py-3 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none"
              >
                <span>🚀</span>
                <span>Надіслати розсилку ({recipientCount} клієнтам)</span>
              </button>
            </div>
          </div>

          {/* Права колонка: Інтерактивний Telegram Live Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider opacity-60">
              Попередній перегляд (Preview)
            </label>
            <div
              className="rounded-2xl p-4 border border-[var(--app-border)] flex flex-col justify-between min-h-[300px]"
              style={{ background: "var(--app-surface-2)" }}
            >
              <div>
                <div className="flex items-center gap-2 mb-3 opacity-60 text-[11px]">
                  <span>🤖 Doma Bot</span>
                  <span>•</span>
                  <span>сьогодні</span>
                </div>

                {/* Бульбашка повідомлення в стилі Telegram */}
                <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] overflow-hidden shadow-sm">
                  {imageUrl.trim() && (
                    <div className="w-full aspect-video bg-black/5 overflow-hidden">
                      <img
                        src={imageUrl.trim()}
                        alt="Прев'ю банера"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  <div className="p-3.5 space-y-2">
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">
                      {text.trim() || (
                        <span className="opacity-40 italic">
                          Тут з'явиться текст вашого повідомлення...
                        </span>
                      )}
                    </p>
                    <div className="text-[10px] text-right opacity-40">12:00</div>
                  </div>
                </div>

                {/* Інлайн-кнопка */}
                {buttonText.trim() && (
                  <div className="mt-1.5">
                    <div className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-center text-sky-500 bg-sky-500/10 border border-sky-500/20 flex items-center justify-center gap-1.5">
                      <span>{buttonText.trim()}</span>
                      <span className="text-[10px] opacity-60">↗</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 text-center">
                <span className="text-[10px] opacity-40">
                  Так повідомлення виглядатиме у чаті користувача
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Історія проведених розсилок */}
      <div className="app-card rounded-2xl p-4 md:p-6 space-y-4">
        <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
          <span>📋</span>
          <span>Історія маркетингових кампаній</span>
        </h3>

        {isListPending ? (
          <Spinner />
        ) : listError ? (
          <ErrorBox message={(listError as Error).message} />
        ) : broadcasts.length === 0 ? (
          <EmptyState
            icon="📢"
            title="Розсилок ще не було"
            hint="Створіть першу кампанію, щоб повідомити клієнтів про акції та новинки."
          />
        ) : (
          <div className="space-y-3">
            {broadcasts.map((b) => {
              const isExpanded = expandedId === b.id;

              const getStatusBadge = () => {
                if (b.status === "sending") {
                  return (
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse">
                      ⏳ Відправляється...
                    </span>
                  );
                }
                if (b.status === "failed") {
                  return (
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30">
                      ❌ Помилка
                    </span>
                  );
                }
                return (
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                    ✅ Завершено
                  </span>
                );
              };

              const segmentObj = SEGMENT_OPTIONS.find((s) => s.id === b.segment);

              return (
                <div
                  key={b.id}
                  className="rounded-2xl p-4 border border-[var(--app-border)] space-y-3 shadow-sm transition-all"
                  style={{ background: "var(--app-surface-2)" }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-sm truncate">{b.title}</span>
                      <span
                        className="rounded-lg px-2.5 py-0.5 text-[11px] font-semibold shrink-0 bg-[var(--app-surface)] border border-[var(--app-border)]"
                      >
                        {segmentObj?.icon} {segmentObj?.label || b.segment}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge()}
                      <span className="text-[11px] opacity-60 font-medium">
                        {new Date(b.created_at).toLocaleDateString("uk-UA", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Статистика відправки */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--app-border)]">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span>
                        Отримувачів: <strong className="font-bold">{b.total_recipients}</strong>
                      </span>
                      <span>
                        Успішно: <strong className="font-bold text-emerald-500">{b.sent_count}</strong>
                      </span>
                      {b.failed_count > 0 && (
                        <span>
                          Помилок/блок: <strong className="font-bold text-rose-500">{b.failed_count}</strong>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        haptic("light");
                        setExpandedId(isExpanded ? null : b.id);
                      }}
                      className="text-xs text-emerald-500 font-bold hover:underline"
                    >
                      {isExpanded ? "Приховати текст ▲" : "Показати текст ▼"}
                    </button>
                  </div>

                  {/* Розгорнутий перегляд тексту */}
                  {isExpanded && (
                    <div
                      className="p-4 rounded-xl text-xs space-y-3 mt-2 leading-relaxed border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--tg-theme-text-color)] shadow-inner"
                      style={{ color: "var(--tg-theme-text-color, #ffffff)" }}
                    >
                      {b.image_url && (
                        <div className="max-w-sm rounded-lg overflow-hidden border border-[var(--app-border)]">
                          <img src={b.image_url} alt="Банер" className="w-full object-cover" />
                        </div>
                      )}
                      <p className="whitespace-pre-wrap font-medium leading-relaxed text-xs opacity-95">
                        {b.text}
                      </p>
                      {b.button_text && b.button_url && (
                        <div className="pt-1">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/15 text-sky-500 border border-sky-500/20">
                            🔘 {b.button_text}: {b.button_url}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Модальне вікно підтвердження відправки */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-[var(--app-border)] bg-white dark:bg-[#1c1c1e]"
            style={{
              background: "var(--tg-theme-bg-color, #ffffff)",
              color: "var(--tg-theme-text-color, #000000)",
            }}
          >
            <div className="flex items-center gap-2.5 text-amber-500">
              <span className="text-2xl">⚠️</span>
              <h4 className="text-base font-bold text-[var(--tg-theme-text-color,inherit)]">
                Підтвердження розсилки
              </h4>
            </div>

            <p className="text-xs leading-relaxed opacity-90 text-[var(--tg-theme-text-color,inherit)]">
              Ви збираєтеся надіслати повідомлення <strong>«{title}»</strong> для{" "}
              <strong className="text-emerald-500">{recipientCount} клієнтів</strong> у сегменті{" "}
              <strong>{SEGMENT_OPTIONS.find((s) => s.id === segment)?.label}</strong>.
            </p>

            <p className="text-[11px] opacity-70 text-[var(--tg-theme-text-color,inherit)]">
              Відправка почнеться негайно у фоні через Telegram-бота з дотриманням рейт-лімітів.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="app-press rounded-xl px-4 py-2.5 text-xs font-semibold opacity-80 hover:opacity-100 transition-opacity"
                style={{
                  background: "var(--app-surface-2)",
                  color: "var(--tg-theme-text-color, inherit)",
                }}
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleSendBroadcast}
                disabled={createBroadcastMutation.isPending}
                className="app-press rounded-xl px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-all"
              >
                {createBroadcastMutation.isPending ? "Запуск..." : "Так, розпочати розсилку"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
