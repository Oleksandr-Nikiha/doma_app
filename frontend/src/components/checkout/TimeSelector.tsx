import { SegmentedControl } from "@/components/ui";
import { haptic } from "@/telegram/sdk";

interface TimeSelectorProps {
  fulfillmentType: "delivery" | "pickup";
  timeMode: "asap" | "scheduled";
  onTimeModeChange: (val: "asap" | "scheduled") => void;
  scheduledDate: string;
  onScheduledDateChange: (val: string) => void;
  scheduledTime: string;
  onScheduledTimeChange: (val: string) => void;
  todayStr: string;
  tomorrowStr: string;
  locStartTime: string;
  locEndTime: string;
  effectiveMinTime: string;
  isTodayClosedForScheduled: boolean;
}

export function TimeSelector({
  fulfillmentType,
  timeMode,
  onTimeModeChange,
  scheduledDate,
  onScheduledDateChange,
  scheduledTime,
  onScheduledTimeChange,
  todayStr,
  tomorrowStr,
  locStartTime,
  locEndTime,
  effectiveMinTime,
  isTodayClosedForScheduled,
}: TimeSelectorProps) {
  const actionLabel = fulfillmentType === "delivery" ? "доставки" : "самовивозу";

  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider opacity-60">
        Час {actionLabel}
      </label>
      <SegmentedControl
        value={timeMode}
        onChange={(val) => {
          haptic("light");
          onTimeModeChange(val);
        }}
        options={[
          { value: "asap", label: "Якнайшвидше", icon: "⚡" },
          { value: "scheduled", label: "На певний час", icon: "⏰" },
        ]}
      />

      {timeMode === "scheduled" && (
        <div className="mt-2.5 space-y-3">
          {/* Вибір дати */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold opacity-70">
              📅 Дата {actionLabel}:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  onScheduledDateChange(todayStr);
                }}
                disabled={isTodayClosedForScheduled}
                className={`app-press flex-1 rounded-xl py-2 px-3 text-xs font-semibold border transition ${
                  scheduledDate === todayStr
                    ? "border-blue-500 bg-blue-500/15 text-blue-500 font-bold"
                    : "border-[var(--app-border)] opacity-70 hover:opacity-100"
                } ${isTodayClosedForScheduled ? "opacity-30 cursor-not-allowed line-through" : ""}`}
              >
                Сьогодні
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  onScheduledDateChange(tomorrowStr);
                }}
                className={`app-press flex-1 rounded-xl py-2 px-3 text-xs font-semibold border transition ${
                  scheduledDate === tomorrowStr
                    ? "border-blue-500 bg-blue-500/15 text-blue-500 font-bold"
                    : "border-[var(--app-border)] opacity-70 hover:opacity-100"
                }`}
              >
                Завтра
              </button>
              <input
                type="date"
                min={todayStr}
                value={scheduledDate}
                onChange={(e) => {
                  if (e.target.value) {
                    haptic("light");
                    onScheduledDateChange(e.target.value);
                  }
                }}
                className="rounded-xl border border-[var(--app-border)] p-2 text-xs font-semibold outline-none cursor-pointer"
                style={{ background: "var(--app-surface-2)" }}
                title="Обрати іншу дату"
              />
            </div>
          </div>

          {isTodayClosedForScheduled && (
            <div
              className="rounded-xl p-3 text-xs leading-relaxed flex items-start gap-2 border"
              style={{
                background: "color-mix(in srgb, #f59e0b 10%, transparent)",
                color: "#d97706",
                borderColor: "color-mix(in srgb, #f59e0b 30%, transparent)",
              }}
            >
              <span className="text-sm">⚠️</span>
              <div>
                <p className="font-semibold">Прийом замовлень на сьогодні завершено</p>
                <p className="mt-0.5 opacity-90">
                  З урахуванням часу приготування (30 хв) заклад вже зачиняється о {locEndTime}. Будь ласка, оберіть дату «Завтра» або спосіб «Якнайшвидше».
                </p>
              </div>
            </div>
          )}

          {/* Вибір часу */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold opacity-70">
              ⏰ Час (години роботи: {locStartTime} – {locEndTime}):
            </label>
            <input
              type="time"
              value={scheduledTime}
              min={effectiveMinTime}
              max={locEndTime}
              onChange={(e) => onScheduledTimeChange(e.target.value)}
              required
              className="w-full max-w-xs rounded-xl border border-[var(--app-border)] p-3 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-blue-500"
              style={{ background: "var(--app-surface-2)", color: "var(--tg-theme-text-color)" }}
            />
            <p className="text-[11px] opacity-60">
              {scheduledDate === todayStr ? (
                <span>Найраніший час: <b>{effectiveMinTime}</b> (зараз + 30 хв)</span>
              ) : (
                <span>Робочі години: з {locStartTime} до {locEndTime}</span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

