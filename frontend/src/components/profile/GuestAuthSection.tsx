import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { retrieveLaunchParams } from "@telegram-apps/sdk-react";

import { hasTelegramAuth } from "@/api/client";
import { usePhoneLogin } from "@/api/queries";
import { ScreenTitle } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function GuestAuthSection() {
  const navigate = useNavigate();
  const phoneLogin = usePhoneLogin();
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [loginPhone, setLoginPhone] = useState("+380");
  const [loginName, setLoginName] = useState("");

  const tgUserId = (() => {
    try {
      return retrieveLaunchParams().tgWebAppData?.user?.id ?? null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="pb-8">
      <ScreenTitle>Профіль</ScreenTitle>
      <div className="app-rise space-y-4 px-4">
        <div className="app-card rounded-2xl p-5 text-center">
          <div className="mb-3 text-4xl">{hasTelegramAuth() ? "👋" : "👤"}</div>
          <h2 className="text-lg font-bold">
            {showPhoneLogin ? "Вхід в акаунт" : "Авторизація в Urban Bites"}
          </h2>
          <p className="mt-2 text-xs leading-relaxed opacity-70">
            {showPhoneLogin
              ? "Введіть номер телефону для швидкого входу та відновлення бонусів URBAN CLUB."
              : "Увійдіть або зареєструйтесь, щоб накопичувати бонуси, зберігати адреси та швидко повторювати замовлення."}
          </p>

          {!showPhoneLogin && (
            <div
              className="mt-4 rounded-xl p-3.5 text-left text-xs"
              style={{ background: "var(--app-surface-2)" }}
            >
              <p className="mb-1.5 text-sm font-semibold">🎁 Переваги URBAN CLUB:</p>
              <ul className="list-inside list-disc space-y-1 opacity-80">
                <li>+50 вітальних бонусів одразу на баланс</li>
                <li>Єдиний бонусний рахунок у всій мережі Urban Bites</li>
                <li>Автозбереження адрес доставки</li>
                <li>Історія та швидке повторення замовлень</li>
              </ul>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {showPhoneLogin ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (loginPhone.trim().length < 9) return;
                  phoneLogin.mutate(
                    {
                      phone: loginPhone.trim(),
                      full_name: loginName.trim() || undefined,
                      telegram_id: tgUserId,
                    },
                    {
                      onSuccess: () => {
                        hapticNotify("success");
                        setShowPhoneLogin(false);
                      },
                      onError: () => hapticNotify("error"),
                    },
                  );
                }}
                className="space-y-3 rounded-xl p-4 text-left"
                style={{ background: "var(--app-surface-2)" }}
              >
                <label className="block">
                  <span className="block text-xs font-bold mb-1 opacity-80">
                    Номер телефону *
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="+380671234567"
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none font-semibold"
                    style={{
                      background: "var(--app-surface)",
                      color: "var(--tg-theme-text-color)",
                    }}
                    autoFocus
                  />
                </label>

                <label className="block">
                  <span className="block text-xs font-medium mb-1 opacity-70">
                    Ваше ім'я (необов'язково)
                  </span>
                  <input
                    type="text"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    placeholder="Олександр"
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
                    style={{
                      background: "var(--app-surface)",
                      color: "var(--tg-theme-text-color)",
                    }}
                  />
                </label>

                {phoneLogin.isError && (
                  <p className="text-xs text-red-500 font-medium">{phoneLogin.error.message}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPhoneLogin(false)}
                    className="rounded-xl px-4 py-2.5 text-xs font-semibold opacity-70 hover:opacity-100"
                  >
                    ← Назад
                  </button>
                  <button
                    type="submit"
                    disabled={loginPhone.trim().length < 9 || phoneLogin.isPending}
                    className="flex-1 rounded-xl py-2.5 text-xs font-bold shadow-xs disabled:opacity-40"
                    style={{
                      background: "var(--tg-theme-button-color)",
                      color: "var(--tg-theme-button-text-color)",
                    }}
                  >
                    {phoneLogin.isPending ? "Входимо…" : "Увійти"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    haptic("light");
                    setShowPhoneLogin(true);
                  }}
                  className="app-press flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-md transition-transform active:scale-98"
                  style={{
                    background: "var(--tg-theme-button-color)",
                    color: "var(--tg-theme-button-text-color)",
                  }}
                >
                  <span>🔑</span>
                  <span>Увійти за номером телефону</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    haptic("light");
                    navigate("/register?mode=register");
                  }}
                  className="app-press flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] py-3 text-sm font-semibold transition-transform active:scale-98"
                  style={{
                    background: "var(--app-surface)",
                    color: "var(--tg-theme-text-color)",
                  }}
                >
                  <span>📝</span>
                  <span>Зареєструватися</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
