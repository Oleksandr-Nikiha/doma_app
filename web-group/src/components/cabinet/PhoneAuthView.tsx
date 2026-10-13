import { TelegramLoginWidget, type TelegramUser } from "./TelegramLoginWidget.tsx";

interface PhoneAuthViewProps {
  onTelegramAuth: (user: TelegramUser) => void;
  onCancel?: () => void;
  authReason?: "cabinet" | "checkout" | null;
}

export function PhoneAuthView({
  onTelegramAuth,
  onCancel,
  authReason,
}: PhoneAuthViewProps) {
  return (
    <div className="space-y-5 animate-in fade-in duration-150 py-1">
      <div className="text-center space-y-1">
        <h3 className="font-display text-lg sm:text-xl font-bold text-[#2C1E14]">
          {authReason === "checkout"
            ? "Швидкий вхід для замовлення"
            : "Авторизація в DomaClub"}
        </h3>
        <p className="text-xs text-[#7A695C] max-w-sm mx-auto">
          Увійдіть через Telegram, щоб переглядати баланс бонусів DOMA CLUB, історію замовлень по всій мережі та збережені адреси
        </p>
      </div>

      {/* Головна картка входу через Telegram */}
      <div className="bg-[#FFF9F2] p-6 rounded-2xl border border-[#EADFCF] flex flex-col items-center justify-center gap-4 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-[#2AABEE]/10 flex items-center justify-center text-2xl text-[#2AABEE]">
          ✈️
        </div>

        <div className="space-y-1">
          <h4 className="text-sm font-bold text-[#2C1E14]">
            Офіційний Telegram Login
          </h4>
          <p className="text-[11px] text-[#7A695C]">
            Натисніть кнопку нижче для безпечної авторизації в 1 клік
          </p>
        </div>

        <div className="pt-1 pb-1">
          <TelegramLoginWidget
            botName="ncoffee_app_tst_bot"
            onAuth={onTelegramAuth}
            buttonSize="large"
            cornerRadius={20}
          />
        </div>

        <p className="text-[11px] text-[#8C7A6B] max-w-xs">
          Авторизація через Telegram безпечна: ми не отримуємо доступу до ваших повідомлень або приватних даних.
        </p>
      </div>

      {/* Переваги Telegram входу */}
      <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E8DEC8] text-xs space-y-2 text-[#5B4636]">
        <div className="flex items-start gap-2">
          <span className="text-base shrink-0">⚡</span>
          <span><strong>Без паролів та SMS:</strong> миттєвий вхід без очікування кодів</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-base shrink-0">🎁</span>
          <span><strong>Бонуси та знижки:</strong> баланс і кешбек синхронізуються з усіма закладами мережі</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-base shrink-0">📍</span>
          <span><strong>Збереження адреси:</strong> спільна адреса доставки для Doma Pizza та Doma Croissants</span>
        </div>
      </div>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-center text-xs text-[#7A695C] hover:text-[#2C1E14] font-semibold pt-1 cursor-pointer"
        >
          ← Повернутися до кабінету
        </button>
      )}
    </div>
  );
}
