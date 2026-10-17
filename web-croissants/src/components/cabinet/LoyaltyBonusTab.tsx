interface LoyaltyBonusTabProps {
  bonuses: number;
  phone: string;
  clientCode?: string;
}

export function LoyaltyBonusTab({ bonuses, phone, clientCode }: LoyaltyBonusTabProps) {
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "urban_bites_tst_bot";

  return (
    <div className="space-y-5 text-[#F1F5F9]">
      {/* Картка балансу бонусів */}
      <div className="bg-gradient-to-br from-[#181B22] to-[#251D14] text-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute right-[-10px] bottom-[-20px] text-8xl opacity-15 select-none pointer-events-none">
          🥐
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
              URBAN CLUB • Bakery & Coffee
            </span>
            <div className="flex items-center gap-1.5">
              {clientCode && (
                <span className="text-xs font-mono font-bold bg-[#E69A38]/80 px-2 py-0.5 rounded-full text-white">
                  {clientCode}
                </span>
              )}
              <span className="text-xs bg-white/15 px-2.5 py-0.5 rounded-full text-[#CBD5E1]">
                {phone ? phone : "Гість"}
              </span>
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#E69A38]">
              {bonuses} <span className="text-xl sm:text-2xl font-bold text-white">бонусів</span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              1 бонус = 1 гривня знижки на випічку та спешелті-каву
            </p>
          </div>
        </div>
      </div>

      {/* Як накопичувати та витрачати бонуси */}
      <div className="bg-[#181B22] rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3.5 shadow-xl">
        <div className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] pb-1 border-b border-white/10">
          Як працює єдина бонусна система
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-[#CBD5E1]">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🎁</span>
            <div>
              <strong className="text-white block">50 бонусів кожному клієнту</strong>
              Отримуйте 50 вітальних бонусів одразу після авторизації за номером телефону або через Telegram.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🔄</span>
            <div>
              <strong className="text-white block">5% Кешбек на всі замовлення</strong>
              Накопичуйте 5% від суми кожного замовлення на єдиний баланс по всій мережі Urban Bites.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">💳</span>
            <div>
              <strong className="text-white block">Оплата бонусами на касі та сайті</strong>
              Списуйте накопичені бонуси (до 30% вартості замовлення) на свіжі круасани та каву.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🛵</span>
            <div>
              <strong className="text-white block">Безкоштовна доставка</strong>
              Замовляйте від 250 ₴ по Києву та насолоджуйтесь свіжою випічкою без плати за доставку.
            </div>
          </div>
        </div>
      </div>

      {/* Бот для перевірки бонусів */}
      <div className="p-4 rounded-2xl bg-[#181B22] border border-white/10 flex items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="font-bold text-white">Синхронізація з Telegram</div>
          <p className="text-[#94A3B8]">Авторизуйтеся у боті @{botUsername} для перевірки кешбеку</p>
        </div>
        <a
          href={`https://t.me/${botUsername}?start=cabinet`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 bg-[#E69A38] hover:bg-[#D4892A] text-white px-3.5 py-2 rounded-xl font-bold transition-colors shadow-xs"
        >
          Відкрити бота
        </a>
      </div>
    </div>
  );
}
