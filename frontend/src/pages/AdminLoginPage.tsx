import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, api, setAdminToken } from "@/api/client";
import { Spinner } from "@/components/ui";

interface AuthSessionResponse {
  session_id: string;
  bot_url: string;
  code?: string;
  expires_in?: number;
}

interface AuthStatusResponse {
  status: "pending" | "approved" | "rejected" | "expired";
  token?: string;
  error?: string;
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

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
          navigate("/admin", { replace: true });
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
    navigate("/admin", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4 text-zinc-100 antialiased">
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
            <div className="space-y-5 text-center">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-xs text-zinc-400">
                <p className="font-medium text-zinc-200">Вхід для персоналу</p>
                <p className="mt-1 leading-relaxed">
                  Натисніть кнопку нижче або відскануйте QR-код для підтвердження доступу у боті Doma.
                </p>
              </div>

              {/* QR код */}
              <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border border-zinc-800 bg-white p-2 shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                    session.bot_url,
                  )}&size=180x180&margin=0`}
                  alt="QR-код для входу"
                  className="h-full w-full rounded-xl object-contain"
                />
              </div>

              {/* Кнопка переходу в бот */}
              <a
                href={session.bot_url}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg transition-transform active:scale-98 hover:bg-blue-500"
              >
                <span>Підтвердити в Telegram</span>
                <span>↗</span>
              </a>

              {session.code && (
                <p className="text-xs text-zinc-500">
                  Або надішліть боту код: <b className="text-zinc-200 tracking-wider text-sm font-mono">{session.code}</b>
                </p>
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
    </div>
  );
}

