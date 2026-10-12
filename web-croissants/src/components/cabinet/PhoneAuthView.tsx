import { useState } from "react";
import {
  loginWithPhone,
  requestPhoneCode,
  type UserOut,
} from "../../api/client.ts";
import {
  formatPhoneOnInput,
  handlePhoneKeyDown,
  isValidUkrainianPhone,
  normalizeE164Phone,
} from "../../utils/phone.ts";
import { TelegramLoginWidget, type TelegramUser } from "./TelegramLoginWidget.tsx";

interface PhoneAuthViewProps {
  onSuccess: (user: UserOut) => void;
  onTelegramAuth: (user: TelegramUser) => void;
  onCancel?: () => void;
  authReason?: "cabinet" | "checkout" | null;
}

export function PhoneAuthView({
  onSuccess,
  onTelegramAuth,
  onCancel,
  authReason,
}: PhoneAuthViewProps) {
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"code" | "password">("code");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneOnInput(e.target.value, phone);
    setPhone(formatted);
  };

  const handleSendCode = async () => {
    setError(null);
    if (!isValidUkrainianPhone(phone)) {
      setError("Вкажіть коректний мобільний номер (+380...)");
      return;
    }
    setLoading(true);
    try {
      const clean = normalizeE164Phone(phone);
      const res = await requestPhoneCode(clean);
      setIsCodeSent(true);
      if (res.sent_to_telegram) {
        setSuccessMsg("Код надіслано у ваш Telegram-бот!");
      } else if (res.code) {
        setSuccessMsg(`Ваш код для входу: ${res.code}`);
      } else {
        setSuccessMsg("Код сформовано!");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка відправки коду");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidUkrainianPhone(phone)) {
      setError("Вкажіть коректний мобільний номер (+380...)");
      return;
    }

    const clean = normalizeE164Phone(phone);

    if (mode === "code" && !code.trim()) {
      setError("Введіть 4-значний код підтвердження");
      return;
    }

    if (mode === "password" && !password.trim()) {
      setError("Введіть ваш пароль або PIN");
      return;
    }

    setLoading(true);
    try {
      const user = await loginWithPhone({
        phone: clean,
        code: mode === "code" ? code.trim() : undefined,
        password: mode === "password" ? password.trim() : undefined,
      });
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка входу");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="text-center space-y-1">
        <h3 className="font-display text-lg sm:text-xl font-bold text-[#2C1E14]">
          {authReason === "checkout"
            ? "Авторизація для замовлення"
            : "Авторизація в Doma Croissants"}
        </h3>
        <p className="text-xs text-[#7A695C]">
          {authReason === "checkout"
            ? "Увійдіть, щоб оформити замовлення, зберегти адресу та отримати бонуси"
            : "Увійдіть, щоб бачити історію замовлень, накопичені бонуси та збережені адреси"}
        </p>
      </div>

      {authReason === "checkout" && (
        <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-900 text-xs flex items-center gap-2.5 font-medium shadow-2xs">
          <span className="text-lg shrink-0">🥐</span>
          <span className="leading-snug">
            <strong>Ваш кошик збережено!</strong> Після входу ви одразу перейдете до підтвердження замовлення.
          </span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Швидкий вхід через Telegram */}
      <div className="bg-[#FFF9F2] p-4 rounded-2xl border border-[#EADFCF] flex flex-col items-center justify-center gap-2.5 text-center shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xl">✈️</span>
          <span className="text-xs font-bold text-[#2C1E14]">Вхід через Telegram (в 1 клік)</span>
        </div>
        <TelegramLoginWidget
          botName="ncoffee_app_tst_bot"
          onAuth={onTelegramAuth}
          buttonSize="large"
          cornerRadius={20}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#E2D5C3]" />
        <span className="text-[11px] font-bold text-[#8C7A6B] uppercase tracking-wider">
          або за номером телефону
        </span>
        <div className="flex-1 h-px bg-[#E2D5C3]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#6B533E] mb-1">
            Номер телефону
          </label>
          <input
            type="tel"
            required
            value={phone}
            onChange={handlePhoneChange}
            onKeyDown={handlePhoneKeyDown}
            placeholder="+380 (XX) XXX-XX-XX"
            className="w-full bg-[#FAF7F2] border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30 font-mono"
          />
        </div>

        {/* Перемикач типу входу */}
        <div className="flex items-center gap-2 bg-[#F3EDE2] p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode("code")}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              mode === "code"
                ? "bg-[#2C1E14] text-white shadow-2xs"
                : "text-[#6B533E] hover:text-[#2C1E14]"
            }`}
          >
            За кодом (SMS / Бот)
          </button>
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              mode === "password"
                ? "bg-[#2C1E14] text-white shadow-2xs"
                : "text-[#6B533E] hover:text-[#2C1E14]"
            }`}
          >
            За паролем / PIN
          </button>
        </div>

        {mode === "code" ? (
          <div className="space-y-3">
            {!isCodeSent ? (
              <button
                type="button"
                disabled={loading}
                onClick={handleSendCode}
                className="w-full bg-[#E29E57] hover:bg-[#D48F45] text-[#2C1E14] py-2.5 rounded-xl font-bold text-sm shadow-xs transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Надсилаємо код..." : "Отримати 4-значний код"}
              </button>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#6B533E]">
                  Введіть 4-значний код
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="1234"
                    className="flex-1 bg-[#FAF7F2] border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-center font-mono text-lg tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
                  />
                  <button
                    type="submit"
                    disabled={loading || code.length < 4}
                    className="bg-[#2C1E14] hover:bg-[#3D2C1F] text-white px-5 rounded-xl font-bold text-sm shadow-xs transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "..." : "Увійти"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  className="text-[11px] text-[#9C5B23] hover:underline font-semibold"
                >
                  Надіслати код повторно
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#6B533E] mb-1">
                Пароль або PIN-код
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введіть ваш пароль"
                className="w-full bg-[#FAF7F2] border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2C1E14] hover:bg-[#3D2C1F] text-white py-2.5 rounded-xl font-bold text-sm shadow-xs transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Входимо..." : "Увійти за паролем"}
            </button>
          </div>
        )}

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-center text-xs text-[#7A695C] hover:text-[#2C1E14] font-semibold pt-1"
          >
            ← Повернутися до кабінету
          </button>
        )}
      </form>
    </div>
  );
}
