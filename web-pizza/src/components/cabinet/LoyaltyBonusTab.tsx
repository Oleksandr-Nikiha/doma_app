interface LoyaltyBonusTabProps {
  bonuses: number;
  phone: string;
}

export function LoyaltyBonusTab({ bonuses, phone }: LoyaltyBonusTabProps) {
  return (
    <div className="space-y-5">
      {/* Картка балансу бонусів */}
      <div className="bg-gradient-to-br from-[#2C1E14] to-[#4D3627] text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-[#3D2C1F] relative overflow-hidden">
        <div className="absolute right-[-10px] bottom-[-20px] text-8xl opacity-15 select-none pointer-events-none">
          🍕
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D4C3AC]">
              Клуб Doma Pizza & Sushi
            </span>
            <span className="text-xs bg-white/15 px-2.5 py-0.5 rounded-full text-[#E8DFC8]">
              {phone ? phone : "Гість"}
            </span>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#E29E57]">
              {bonuses} <span className="text-xl sm:text-2xl font-bold text-white">бонусів</span>
            </div>
            <p className="text-xs text-[#D4C3AC] mt-1">
              1 бонус = 1 гривня знижки на замовлення улюблених страв
            </p>
          </div>
        </div>
      </div>

      {/* Як накопичувати та витрачати бонуси */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#EADFCF] space-y-3.5 shadow-2xs">
        <div className="text-xs font-bold uppercase tracking-wider text-[#8D7B6D] pb-1 border-b border-[#F0E6D8]">
          Як працює програма лояльності
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-[#4A3B32]">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🎁</span>
            <div>
              <strong className="text-[#2C1E14] block">Кешбек за кожне замовлення</strong>
              Отримуйте до 5% від вартості кожного замовлення на свій бонусний рахунок за номером телефону.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🛵</span>
            <div>
              <strong className="text-[#2C1E14] block">Безкоштовна доставка</strong>
              Замовляйте від 250 ₴ у Вишгороді та насолоджуйтесь улюбленими стравами без плати за доставку.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🎂</span>
            <div>
              <strong className="text-[#2C1E14] block">Подарунок до дня народження</strong>
              Святкова піца або фірмовий десерт до вашого свята за попереднім замовленням.
            </div>
          </div>
        </div>
      </div>

      {/* Бот для перевірки бонусів */}
      <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EADFCF] flex items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="font-bold text-[#2C1E14]">Бажаєте отримувати бонуси миттєво?</div>
          <p className="text-[#7A695C]">Авторизуйтеся у нашому Telegram-боті для повної синхронізації</p>
        </div>
        <a
          href="https://t.me/ncoffee_app_tst_bot"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 bg-[#C8823E] hover:bg-[#B36F2D] text-white px-3.5 py-2 rounded-xl font-bold transition-colors shadow-xs"
        >
          Відкрити бота
        </a>
      </div>
    </div>
  );
}

