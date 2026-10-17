import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { retrieveLaunchParams } from "@telegram-apps/sdk-react";

import { usePhoneLogin, useRegister } from "@/api/queries";
import type { User } from "@/api/types";
import { AddressSelector } from "@/components/delivery/AddressSelector";
import { useBackButton } from "@/hooks/useBackButton";
import { hapticNotify } from "@/telegram/sdk";

/** Ім'я з Telegram — як підказка в полі; користувач може змінити. */
function telegramFullName(): string {
  try {
    const user = retrieveLaunchParams().tgWebAppData?.user;
    return [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  } catch {
    return "";
  }
}

function telegramUserId(): number | null {
  try {
    const user = retrieveLaunchParams().tgWebAppData?.user;
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export interface RegisterPageProps {
  onRegistered?: (user?: User) => void;
}

export function RegisterPage({ onRegistered }: RegisterPageProps = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "login" ? "login" : "register";
  const [mode, setMode] = useState<"register" | "login">(initialMode);

  useBackButton(() => {
    if (onRegistered) {
      navigate(-1);
    } else {
      navigate("/");
    }
  });

  const register = useRegister();
  const phoneLogin = usePhoneLogin();

  const [fullName, setFullName] = useState(telegramFullName);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const canSubmitRegister = fullName.trim().length > 1 && phone.trim().length >= 9;
  const canSubmitLogin = phone.trim().length >= 9;

  const inputStyle = {
    background: "var(--app-surface)",
    color: "var(--tg-theme-text-color)",
  };

  const handleSuccess = (user?: User) => {
    hapticNotify("success");
    if (onRegistered) {
      onRegistered(user);
    } else {
      navigate("/profile");
    }
  };

  return (
    <div className="flex min-h-screen flex-col px-4 pt-6">
      {/* Перемикач Вхід / Реєстрація */}
      <div
        className="mb-5 flex rounded-2xl p-1 text-sm font-semibold shadow-2xs"
        style={{ background: "var(--app-surface-2)" }}
      >
        <button
          type="button"
          onClick={() => setMode("login")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 transition-all"
          style={
            mode === "login"
              ? {
                  background: "var(--tg-theme-button-color)",
                  color: "var(--tg-theme-button-text-color)",
                  boxShadow: "var(--app-shadow)",
                }
              : { opacity: 0.7 }
          }
        >
          <span>🔑</span>
          <span>Вхід за номером</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 transition-all"
          style={
            mode === "register"
              ? {
                  background: "var(--tg-theme-button-color)",
                  color: "var(--tg-theme-button-text-color)",
                  boxShadow: "var(--app-shadow)",
                }
              : { opacity: 0.7 }
          }
        >
          <span>📝</span>
          <span>Реєстрація</span>
        </button>
      </div>

      {mode === "login" ? (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmitLogin) return;
            phoneLogin.mutate(
              {
                phone: phone.trim(),
                full_name: fullName.trim() || undefined,
                telegram_id: telegramUserId(),
              },
              {
                onError: () => hapticNotify("error"),
                onSuccess: handleSuccess,
              },
            );
          }}
        >
          <h1 className="text-2xl font-bold">Вхід в Urban Bites 🔑</h1>
          <p className="mt-2 text-sm opacity-70">
            Введіть номер телефону, щоб миттєво відновити доступ до вашого профілю та бонусів URBAN CLUB.
          </p>

          <div className="mt-6 space-y-3">
            <label className="block">
              <span className="text-sm font-medium opacity-70">Номер телефону *</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                inputMode="tel"
                placeholder="+380671234567"
                className="mt-1 w-full rounded-xl px-4 py-3 outline-none"
                style={inputStyle}
                autoFocus
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium opacity-70">
                Ваше ім'я <span className="text-xs opacity-50">(необов'язково)</span>
              </span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Олександр"
                className="mt-1 w-full rounded-xl px-4 py-3 outline-none"
                style={inputStyle}
              />
            </label>
          </div>

          {phoneLogin.isError && (
            <p className="mt-3 text-sm text-red-500">{phoneLogin.error.message}</p>
          )}

          <div
            className="mt-5 rounded-2xl border border-[var(--app-border)] p-3.5 text-xs opacity-75"
            style={{ background: "var(--app-surface)" }}
          >
            🎁 При вході автоматично синхронізуються ваші замовлення та бонуси URBAN CLUB.
          </div>

          <div className="flex-1" />

          <button
            type="submit"
            disabled={!canSubmitLogin || phoneLogin.isPending}
            className="mb-3 mt-6 w-full rounded-xl py-3 font-semibold disabled:opacity-40"
            style={{
              background: "var(--tg-theme-button-color)",
              color: "var(--tg-theme-button-text-color)",
            }}
          >
            {phoneLogin.isPending ? "Входимо…" : "Увійти в акаунт"}
          </button>

          <button
            type="button"
            onClick={() => setMode("register")}
            className="mb-4 text-center text-xs opacity-60 hover:opacity-100"
            style={{ marginBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            Ще не маєте акаунта? <span className="font-semibold underline">Зареєструватися</span>
          </button>
        </form>
      ) : (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmitRegister) return;
            register.mutate(
              {
                full_name: fullName.trim(),
                phone: phone.trim(),
                delivery_address: address.trim() || null,
              },
              {
                onError: () => hapticNotify("error"),
                onSuccess: handleSuccess,
              },
            );
          }}
        >
          <h1 className="text-2xl font-bold">Вітаємо в Urban Bites 👋</h1>
          <p className="mt-2 text-sm opacity-70">
            Розкажіть, як до вас звертатись і куди везти замовлення. Це одноразово.
          </p>

          <div className="mt-6 space-y-3">
            <label className="block">
              <span className="text-sm font-medium opacity-70">Ім'я *</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Олександр"
                className="mt-1 w-full rounded-xl px-4 py-3 outline-none"
                style={inputStyle}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium opacity-70">Телефон *</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                inputMode="tel"
                placeholder="+380671234567"
                className="mt-1 w-full rounded-xl px-4 py-3 outline-none"
                style={inputStyle}
              />
            </label>

            <div
              className="rounded-2xl border border-[var(--app-border)] p-3.5"
              style={{ background: "var(--app-surface)" }}
            >
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider opacity-60">
                Адреса доставки (необов'язково)
              </span>
              <AddressSelector required={false} onChange={(full) => setAddress(full)} />
              <span className="mt-2 block text-xs opacity-50">
                Можна вказати пізніше або обрати самовивіз при оформленні замовлення
              </span>
            </div>
          </div>

          {register.isError && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-red-500">{register.error.message}</p>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-xs font-semibold text-[var(--tg-theme-button-color)] underline"
              >
                Вже маєте акаунт? Спробувати увійти за номером телефону →
              </button>
            </div>
          )}

          <div className="flex-1" />

          <button
            type="submit"
            disabled={!canSubmitRegister || register.isPending}
            className="mb-3 mt-6 w-full rounded-xl py-3 font-semibold disabled:opacity-40"
            style={{
              background: "var(--tg-theme-button-color)",
              color: "var(--tg-theme-button-text-color)",
            }}
          >
            {register.isPending ? "Зберігаємо…" : "Зберегти"}
          </button>

          <button
            type="button"
            onClick={() => setMode("login")}
            className="mb-4 text-center text-xs opacity-60 hover:opacity-100"
            style={{ marginBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            Вже реєструвалися раніше? <span className="font-semibold underline">Увійти</span>
          </button>
        </form>
      )}
    </div>
  );
}
