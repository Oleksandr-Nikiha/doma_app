interface DomaClubSectionProps {
  onOpenCabinet?: () => void;
}

export function DomaClubSection({ onOpenCabinet }: DomaClubSectionProps) {
  const tiers = [
    { range: "До 100 ₴", percent: "1%", desc: "Базовий кешбек для невеликих покупок" },
    { range: "100 – 700 ₴", percent: "3%", desc: "Найпопулярніший рівень для обідів та перекусів" },
    { range: "700,01 – 1 200 ₴", percent: "4%", desc: "Для замовлень на компанію" },
    { range: "1 200,01 – 1 800 ₴", percent: "5%", desc: "Для свят та дружніх зустрічей" },
    { range: "Від 1 800,01 ₴", percent: "7%", desc: "Максимальний рівень кешбеку" },
  ];

  return (
    <section id="domaclub" className="py-16 sm:py-24 bg-[#FAF7F2] border-b border-[#EADFCF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Заголовок */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12 sm:mb-16">
          <span className="inline-flex items-center gap-1.5 bg-[#FFF2DE] text-[#9C5B23] border border-[#ECD9BF] px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <span>🎁</span>
            <span>Система лояльності DomaGroup</span>
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2C1E14]">
            DOMAClub — накопичуйте бонуси з кожним замовленням
          </h2>
          <p className="text-sm sm:text-base text-[#614F42] leading-relaxed">
            Єдиний бонусний рахунок, закріплений за вашим номером телефону.
            Бонуси діють по всій мережі: <strong>1 бонус = 1 гривня</strong>.
          </p>
        </div>

        {/* Картки кешбеку */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-10">
          {tiers.map((t) => (
            <div
              key={t.range}
              className="bg-white rounded-2xl p-5 border border-[#E8DFC8] shadow-2xs hover:border-[#C8823E] transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="text-xs font-semibold text-[#8D7665]">{t.range}</div>
                <div className="font-display text-3xl font-extrabold text-[#C8823E] mt-1">
                  {t.percent}
                </div>
              </div>
              <p className="text-[11px] text-[#7A695C] leading-snug">
                {t.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Особливі привілеї DomaClub */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Блок Дня Народження */}
          <div className="bg-gradient-to-br from-[#FFF8EE] to-[#F5EFE6] rounded-3xl p-6 sm:p-8 border border-[#EADFCF] shadow-sm flex items-start gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#C8823E] text-white flex items-center justify-center text-2xl sm:text-3xl shrink-0 shadow-sm shadow-[#C8823E]/30">
              🎂
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase text-[#9C5B23] tracking-wide">
                Святковий подарунок
              </span>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-[#2C1E14]">
                -10% до Дня Народження
              </h3>
              <p className="text-sm text-[#614F42] leading-relaxed">
                Святкуйте смачно! Знижка надається автоматично в день вашого народження,
                напередодні та наступного дня. Кількість замовлень та сума — <strong>не обмежені</strong>.
              </p>
            </div>
          </div>

          {/* Блок Списання бонусів */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DFC8] shadow-sm flex items-start gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#2C1E14] text-white flex items-center justify-center text-2xl sm:text-3xl shrink-0 shadow-sm shadow-[#2C1E14]/20">
              💳
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase text-[#7A695C] tracking-wide">
                Оплата бонусами
              </span>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-[#2C1E14]">
                Оплата до 30% вартості замовлення
              </h3>
              <p className="text-sm text-[#614F42] leading-relaxed">
                Накопичені бонуси можна використати для розрахунку за наступні страви
                (до 30% суми чека, або до 15% при наявності акційних позицій).
                Просто повідомте номер телефону під час замовлення.
              </p>
            </div>
          </div>
        </div>

        {/* CTA для приєднання або перевірки бонусів */}
        <div className="mt-8 bg-gradient-to-br from-[#2C1E14] via-[#3D2C1F] to-[#2C1E14] text-white rounded-3xl p-6 sm:p-8 border border-[#4A3B32] shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E29E57]">
              Ваш баланс лояльності
            </span>
            <h3 className="font-display text-xl sm:text-2xl font-bold">
              Вже замовляли в наших закладах?
            </h3>
            <p className="text-xs sm:text-sm text-[#D4C3AC] max-w-xl">
              Увійдіть за номером телефону або через Telegram, щоб переглянути накопичений кешбек, персональну картку клієнта та історію замовлень по всій мережі.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenCabinet}
              className="bg-[#E29E57] hover:bg-[#D48F46] text-[#2C1E14] px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span>👤</span>
              <span>Мій кабінет DomaClub</span>
            </button>
            <a
              href="https://t.me/ncoffee_app_tst_bot"
              target="_blank"
              rel="noreferrer"
              className="bg-white/10 hover:bg-white/15 text-white border border-white/20 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 flex items-center gap-2"
            >
              <span>📱</span>
              <span>Telegram-бот клубу</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
