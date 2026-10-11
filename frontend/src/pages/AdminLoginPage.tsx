import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, api, setAdminToken } from "@/api/client";
import { Spinner } from "@/components/ui";
import { isTelegramWebApp } from "@/telegram/env";
import { haptic, openTelegramLink } from "@/telegram/sdk";

interface AuthSessionResponse {
  session_id: string;
  bot_url: string;
  tg_url?: string;
  code?: string;
  expires_in?: number;
}

interface AuthStatusResponse {
  status: "pending" | "approved" | "rejected" | "expired";
  token?: string;
  error?: string;
}

function isMobileOrTablet(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isMobileUA || isIPad;
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  const [copied, setCopied] = useState(false);

  // Створюємо нову сесію авторизації
  const initSession = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<AuthSessionResponse>("/admin/auth/session");
      setSession(res);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.detail
          : "Не вдалося ініціалізувати сесію входу. Перевірте підключення до сервера.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const extractBotUsername = (url: string): string => {
    try {
      const match = url.match(/t\.me\/([^/?]+)/);
      const parsed = match ? match[1] : "ncoffee_app_tst_bot";
      return parsed === "domapizza_bot" ? "ncoffee_app_tst_bot" : parsed;
    } catch {
      return "ncoffee_app_tst_bot";
    }
  };

  const handleCopyCode = async () => {
    if (!session?.code) return;
    try {
      await navigator.clipboard.writeText(session.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const botUsername = session ? extractBotUsername(session.bot_url) : "ncoffee_app_tst_bot";
  const startParam = session?.code ? `admin_${session.code}` : (session ? `admin_${session.session_id}` : "");
  const webBotUrl = `https://t.me/${botUsername}?start=${startParam}`;
  const appBotUrl = session?.tg_url || `tg://resolve?domain=${botUsername}&start=${startParam}`;

  const handleQrClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    haptic("light");

    if (isTelegramWebApp()) {
      openTelegramLink(webBotUrl);
      return;
    }

    // Для мобільного браузера:
    try {
      window.location.href = appBotUrl;
      setTimeout(() => {
        window.location.href = webBotUrl;
      }, 1500);
    } catch {
      window.location.href = webBotUrl;
    }
  };

  useEffect(() => {
    void initSession();
  }, []);

  // Опитуємо статус сесії
  useEffect(() => {
    if (!session?.session_id) return;

    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await api.get<AuthStatusResponse>(
          `/admin/auth/session/${session.session_id}`,
        );

        if (!active) return;

        if (res.status === "approved" && res.token) {
          clearInterval(interval);
          setAdminToken(res.token);
          navigate("/admin" + window.location.search, { replace: true });
        } else if (res.status === "rejected" || res.status === "expired") {
          clearInterval(interval);
          setError(
            res.error || (res.status === "expired" ? "Час дії сесії вичерпано" : "Вхід відхилено"),
          );
        }
      } catch {
        // ігноруємо помилки опитування
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [session?.session_id, navigate]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = manualToken.trim();
    if (!token) return;
    setAdminToken(token);
    navigate("/admin" + window.location.search, { replace: true });
  };

  const isMobile = isMobileOrTablet();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4 text-zinc-100 antialiased">
      {/* Кнопка повернення до меню */}
      {isTelegramWebApp() && (
        <div className="mb-4 flex w-full max-w-md items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="app-press inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <span>← 🍽️</span>
            <span>До меню ресторану</span>
          </button>
        </div>
      )}

      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-xl">
        {/* Логотип */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-3xl shadow-inner border border-amber-500/20">
            🍕
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Doma Admin</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Панель керування меню та закладами
          </p>
        </div>

        {/* Основний вміст */}
        <div className="mt-8 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Spinner />
              <p className="mt-3 text-xs text-zinc-400">Створення сесії входу...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-center">
              <p className="text-sm font-semibold text-rose-400">{error}</p>
              <button
                onClick={() => void initSession()}
                className="mt-3 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-700"
              >
                Спробувати знову
              </button>
            </div>
          ) : session ? (
            <div className="space-y-4 text-center">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3.5 text-xs text-zinc-400">
                <p className="font-medium text-zinc-200">Вхід для персоналу</p>
                <p className="mt-1 leading-relaxed">
                  {isMobile
                    ? "Натисніть на QR-код для переходу в бот або надішліть код."
                    : "Відскануйте QR-код камерою телефону або надішліть код боту."}
                </p>
              </div>

              {/* QR код (клікабельний на смартфоні/планшеті або в Telegram) */}
              {isMobile || isTelegramWebApp() ? (
                <button
                  type="button"
                  onClick={handleQrClick}
                  className="app-press mx-auto block h-48 w-48 rounded-2xl border-2 border-blue-500/50 bg-white p-2 shadow-lg transition-transform active:scale-95 hover:border-blue-400 cursor-pointer"
                  title="Натисніть для переходу в Telegram"
                >
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                      webBotUrl,
                    )}&size=180x180&margin=0`}
                    alt="QR-код для входу"
                    className="h-full w-full rounded-xl object-contain pointer-events-none select-none"
                  />
                </button>
              ) : (
                <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border border-zinc-800 bg-white p-2 shadow-inner">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                      webBotUrl,
                    )}&size=180x180&margin=0`}
                    alt="QR-код для входу"
                    className="h-full w-full rounded-xl object-contain pointer-events-none select-none"
                  />
                </div>
              )}

              {/* Швидка кнопка підтвердження та підказка */}
              <div className="space-y-2 pt-1">
                {(isMobile || isTelegramWebApp()) && (
                  <button
                    type="button"
                    onClick={handleQrClick}
                    className="app-press inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition-all active:scale-98"
                  >
                    <span>📱</span>
                    <span>Підтвердити вхід у Telegram</span>
                    <span>↗</span>
                  </button>
                )}

                {isTelegramWebApp() && (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        haptic("light");
                        navigate("/admin", { replace: true });
                      }}
                      className="app-press inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <span>⚡</span>
                      <span>Увійти з поточного акаунта Telegram</span>
                    </button>
                  </div>
                )}

                <p className="text-[11px] text-zinc-400">
                  {isMobile || isTelegramWebApp() ? (
                    <span>Натисніть на QR-код або кнопку вище для переходу в бот</span>
                  ) : (
                    <span>📷 Відскануйте QR-код камерою смартфона</span>
                  )}
                </p>
              </div>

              {/* Блок з 6-значним кодом */}
              {session.code && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 text-center">
                  <p className="text-[11px] text-zinc-400">
                    Або надішліть боту{" "}
                    <a
                      href={`https://t.me/${botUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      @{botUsername}
                    </a>{" "}
                    код:
                  </p>
                  <div className="mt-1.5 flex items-center justify-center gap-3">
                    <span className="font-mono text-xl font-bold tracking-widest text-amber-400">
                      {session.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyCode()}
                      className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      {copied ? "✓ Скопійовано" : "Скопіювати"}
                    </button>
                  </div>
                </div>
              )}

              {/* Індикатор очікування */}
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 pt-1">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                </span>
                <span>Очікуємо підтвердження у боті...</span>
              </div>
            </div>
          ) : null}

          {/* Вхід за токеном вручну */}
          <div className="border-t border-zinc-800/80 pt-4 text-center">
            {!showManualInput ? (
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Ввести токен доступу вручну
              </button>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="Вставте admin token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!manualToken.trim()}
                  className="w-full rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                >
                  Увійти за токеном
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {!isTelegramWebApp() && (
        <div className="mt-4 text-center">
          <p className="text-xs text-zinc-500">
            Клієнтське меню та замовлення доступні виключно через{" "}
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline inline-flex items-center gap-1 font-medium"
            >
              <span>Telegram-бот</span>
              <span>↗</span>
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

