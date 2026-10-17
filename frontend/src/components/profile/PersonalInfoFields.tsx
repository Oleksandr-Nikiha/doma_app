import { useState } from "react";
import {
  closeMiniApp,
  haptic,
  hapticNotify,
  openTelegramLink,
  requestTelegramContact,
} from "@/telegram/sdk";

interface PersonalInfoFieldsProps {
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  isPhoneVerified: boolean;
  verifiedPhone: string;
  botUsername?: string | null;
  onFieldChange: () => void;
  onRefetchUser: () => Promise<void>;
}

export function PersonalInfoFields({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  phone,
  setPhone,
  isPhoneVerified,
  verifiedPhone,
  botUsername,
  onFieldChange,
  onRefetchUser,
}: PersonalInfoFieldsProps) {
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);

  const inputStyle = {
    background: "var(--app-surface)",
    color: "var(--tg-theme-text-color)",
  };

  const handleVerifyPhone = async () => {
    haptic("light");
    setIsVerifyingPhone(true);
    try {
      const contactResult = await requestTelegramContact();
      if (contactResult) {
        hapticNotify("success");
        await onRefetchUser();
        setTimeout(() => {
          void onRefetchUser();
        }, 600);
        return;
      }
      if (contactResult === false) {
        // Користувач скасував нативне вікно запиту контакту
        return;
      }
    } catch (e) {
      console.warn("requestTelegramContact error:", e);
    } finally {
      setIsVerifyingPhone(false);
    }

    // Fallback: якщо нативний метод не підтримується — відкриваємо чат і закриваємо Mini App
    const activeBot = botUsername || "urban_bites_tst_bot";
    const verifyUrl = `https://t.me/${activeBot}?start=verify_phone`;
    openTelegramLink(verifyUrl);
    setTimeout(() => {
      closeMiniApp();
    }, 100);
  };

  return (
    <section className="app-rise space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider opacity-50">Мої дані</p>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium opacity-60">Прізвище</span>
          <input
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              onFieldChange();
            }}
            placeholder="Шевченко"
            className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none transition-shadow focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
            style={inputStyle}
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium opacity-60">Імʼя</span>
          <input
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              onFieldChange();
            }}
            placeholder="Олександр"
            required
            className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none transition-shadow focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
            style={inputStyle}
          />
        </label>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium opacity-60">№ Телефону</span>
            {isPhoneVerified ? (
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                ✓ Верифіковано (🔒 закріплено)
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-amber-500 flex items-center gap-1">
                ⚠️ Не верифіковано
              </span>
            )}
          </div>
          <input
            type="tel"
            inputMode="tel"
            value={isPhoneVerified ? verifiedPhone : phone}
            onChange={(e) => {
              if (!isPhoneVerified) {
                setPhone(e.target.value);
                onFieldChange();
              }
            }}
            disabled={isPhoneVerified}
            placeholder="+380671234567"
            className={`mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none transition-shadow ${
              isPhoneVerified
                ? "opacity-60 cursor-not-allowed select-none"
                : "focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
            }`}
            style={inputStyle}
          />

          {!isPhoneVerified && (
            <div
              className="rounded-2xl p-3.5 text-xs leading-relaxed border space-y-2.5 mt-2"
              style={{
                background: "color-mix(in srgb, #f59e0b 8%, var(--app-surface))",
                borderColor: "color-mix(in srgb, #f59e0b 25%, transparent)",
              }}
            >
              <p className="opacity-80">
                Номер не верифіковано. Ви можете підтвердити його в 1 клік через Telegram або перейти в чат бота.
              </p>
              <button
                type="button"
                disabled={isVerifyingPhone}
                onClick={handleVerifyPhone}
                className="app-press flex items-center justify-center gap-1.5 w-full rounded-xl py-2.5 px-3 text-xs font-bold text-white transition shadow-sm disabled:opacity-50"
                style={{ background: "var(--tg-theme-button-color)" }}
              >
                <span>📱</span>
                <span>{isVerifyingPhone ? "Очікування підтвердження..." : "Підтвердити номер телефону"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  const activeBot = botUsername || "urban_bites_tst_bot";
                  const verifyUrl = `https://t.me/${activeBot}?start=verify_phone`;
                  openTelegramLink(verifyUrl);
                  setTimeout(() => {
                    closeMiniApp();
                  }, 100);
                }}
                className="app-press text-[11px] underline opacity-70 hover:opacity-100 block mx-auto text-center pt-0.5"
              >
                Або відкрити чат з ботом →
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
