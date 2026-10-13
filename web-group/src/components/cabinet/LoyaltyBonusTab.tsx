interface LoyaltyBonusTabProps {
  bonuses: number;
  phone: string;
}

export function LoyaltyBonusTab({ bonuses, phone }: LoyaltyBonusTabProps) {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Картка балансу бонусів */}
      <div className="bg-gradient-to-br from-[#2C1E14] via-[#4A3B32] to-[#2C1E14] text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-[#3D2C1F] relative overflow-hidden">
        <div className="absolute right-[-10px] bottom-[-20px] text-8xl opacity-15 select-none pointer-events-none">
          ✨
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#E29E57]">
              DOMA CLUB • МЕРЕЖА DOMA
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
              1 бонус = 1 гривня знижки у Doma Pizza & Sushi та Doma Croissants
            </p>
          </div>
        </div>
      </div>

      {/* Як накопичувати та витрачати бонуси */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#EADFCF] space-y-3.5 shadow-2xs">
        <div className="text-xs font-bold uppercase tracking-wider text-[#8D7B6D] pb-1 border-b border-[#F0E6D8]">
          Як працює єдина програма лояльності
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-[#4A3B32]">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🎁</span>
            <div>
              <strong className="text-[#2C1E14] block">Кешбек 1% – 7% за кожне замовлення</strong>
              Отримуйте від 1% до 7% від суми чека на єдиний рахунок за номером телефону у будь-якому закладі мережі.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">💳</span>
            <div>
              <strong className="text-[#2C1E14] block">Оплата бонусами до 30%</strong>
              Розраховуйтесь накопиченими бонусами за піцу, суші, бургери та випічку (до 30% вартості замовлення).
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🎂</span>
            <div>
              <strong className="text-[#2C1E14] block">-10% до Дня Народження</strong>
              Святкова знижка 10% у день народження, напередодні та наступного дня без обмежень на кількість та суму.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🛵</span>
            <div>
              <strong className="text-[#2C1E14] block">Безкоштовна доставка</strong>
              Замовлення від 250 ₴ доставляються по всьому Вишгороду безкоштовно з будь-якого закладу.
            </div>
          </div>
        </div>
      </div>

      {/* Бот для перевірки бонусів */}
      <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EADFCF] flex items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="font-bold text-[#2C1E14]">Миттєва синхронізація з Telegram</div>
          <p className="text-[#7A695C]">Авторизуйтеся у боті для перегляду чеків та кешбеку в 1 клік</p>
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
