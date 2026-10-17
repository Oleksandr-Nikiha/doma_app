interface LoyaltyBonusTabProps {
  bonuses: number;
  phone: string;
  clientCode?: string;
}

export function LoyaltyBonusTab({ bonuses, phone, clientCode }: LoyaltyBonusTabProps) {
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "urban_bites_tst_bot";

  return (
    <div className="space-y-5 animate-in fade-in duration-150 text-[#F1F5F9]">
      {/* Картка балансу бонусів */}
      <div className="bg-gradient-to-br from-[#12161A] via-[#1E232B] to-[#12161A] text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-white/10 relative overflow-hidden">
        <div className="absolute right-[-10px] bottom-[-20px] text-8xl opacity-15 select-none pointer-events-none">
          ✨
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
              URBAN CLUB • МЕРЕЖА URBAN BITES
            </span>
            <div className="flex items-center gap-1.5">
              {clientCode && (
                <span className="text-xs font-mono font-bold bg-amber-500 px-2 py-0.5 rounded-full text-[#0F1115]">
                  {clientCode}
                </span>
              )}
              <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-full text-[#CBD5E1]">
                {phone ? phone : "Гість"}
              </span>
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-amber-400">
              {bonuses} <span className="text-xl sm:text-2xl font-bold text-white">бонусів</span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              1 бонус = 1 гривня знижки у Urban Pizza & Sushi та Urban Bakery & Coffee
            </p>
          </div>
        </div>
      </div>

      {/* Як накопичувати та витрачати бонуси */}
      <div className="bg-[#181B22] rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3.5 shadow-2xs">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-400 pb-1 border-b border-white/10">
          Як працює єдина програма лояльності
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-[#CBD5E1]">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🎁</span>
            <div>
              <strong className="text-white block">50 бонусів кожному новому учаснику</strong>
              Миттєве нарахування 50 вітальних бонусів при першому вході на будь-якому сайті або в боті.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">💳</span>
            <div>
              <strong className="text-white block">Оплата бонусами до 30%</strong>
              Розраховуйтесь накопиченими бонусами за піцу, суші, бургери та випічку (до 30% вартості замовлення).
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🔄</span>
            <div>
              <strong className="text-white block">Кешбек до 7% на єдиний рахунок</strong>
              Отримуйте від 1% до 7% від вартості кожного виконаного замовлення на свій баланс URBAN CLUB.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🛵</span>
            <div>
              <strong className="text-white block">Безкоштовна доставка</strong>
              Замовлення від 250 ₴ доставляються по всьому Києву безкоштовно з будь-якого закладу.
            </div>
          </div>
        </div>
      </div>

      {/* Бот для перевірки бонусів */}
      <div className="p-4 rounded-2xl bg-[#181B22] border border-white/10 flex items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="font-bold text-white">Миттєва синхронізація з Telegram</div>
          <p className="text-[#94A3B8]">Авторизуйтеся у боті @{botUsername} для перегляду чеків та кешбеку в 1 клік</p>
        </div>
        <a
          href={`https://t.me/${botUsername}?start=cabinet`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 bg-amber-500 hover:bg-amber-400 text-[#0F1115] px-3.5 py-2 rounded-xl font-extrabold transition-colors shadow-xs"
        >
          Відкрити бота
        </a>
      </div>
    </div>
  );
}
