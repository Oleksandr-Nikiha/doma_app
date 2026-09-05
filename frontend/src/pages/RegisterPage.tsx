import { useState } from "react";
import { retrieveLaunchParams } from "@telegram-apps/sdk-react";

import { useRegister } from "@/api/queries";
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

export function RegisterPage() {
  const register = useRegister();
  const [fullName, setFullName] = useState(telegramFullName);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const canSubmit = fullName.trim().length > 1 && phone.trim().length >= 9;

  const inputStyle = {
    background: "var(--tg-theme-secondary-bg-color)",
    color: "var(--tg-theme-text-color)",
  };

  return (
    <form
      className="flex min-h-screen flex-col px-4 pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        register.mutate(
          {
            full_name: fullName.trim(),
            phone: phone.trim(),
            delivery_address: address.trim() || null,
          },
          { onError: () => hapticNotify("error"), onSuccess: () => hapticNotify("success") },
        );
      }}
    >
      <h1 className="text-2xl font-bold">Вітаємо в Doma 👋</h1>
      <p className="mt-2 text-sm opacity-70">
        Розкажіть, як до вас звертатись і куди везти замовлення. Це одноразово.
      </p>

      <div className="mt-6 space-y-3">
        <label className="block">
          <span className="text-sm font-medium opacity-70">Ім'я</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Олександр"
            className="mt-1 w-full rounded-xl px-4 py-3 outline-none"
            style={inputStyle}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium opacity-70">Телефон</span>
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

        <label className="block">
          <span className="text-sm font-medium opacity-70">Адреса доставки</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Вишгород, вул. Шевченка 1, кв. 2"
            className="mt-1 w-full rounded-xl px-4 py-3 outline-none"
            style={inputStyle}
          />
          <span className="mt-1 block text-xs opacity-50">
            Необов'язково — можна вказати пізніше або забрати самовивозом
          </span>
        </label>
      </div>

      {register.isError && (
        <p className="mt-3 text-sm text-red-500">{register.error.message}</p>
      )}

      <div className="flex-1" />

      <button
        type="submit"
        disabled={!canSubmit || register.isPending}
        className="mb-4 mt-6 w-full rounded-xl py-3 font-semibold disabled:opacity-40"
        style={{
          background: "var(--tg-theme-button-color)",
          color: "var(--tg-theme-button-text-color)",
          marginBottom: "calc(1rem + env(safe-area-inset-bottom))",
        }}
      >
        {register.isPending ? "Зберігаємо…" : "Зберегти"}
      </button>
    </form>
  );
}
