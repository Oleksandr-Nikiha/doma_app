export function PartnershipSection() {
  return (
    <section id="partnership" className="py-16 sm:py-24 bg-[#FAF7F2] border-b border-[#EADFCF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Текстова частина */}
          <div className="lg:col-span-7 space-y-6">
            <span className="inline-flex items-center gap-1.5 bg-[#FFF2DE] text-[#9C5B23] border border-[#ECD9BF] px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <span>🤝</span>
              <span>B2B & Партнерам</span>
            </span>

            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2C1E14]">
              Партнерство, франшиза та співпраця з DomaGroup
            </h2>

            <div className="space-y-4 text-sm sm:text-base text-[#614F42] leading-relaxed">
              <p>
                DomaGroup відкрита до довгострокової співпраці з кав'ярнями, локальними закладами,
                постачальниками якісних інгредієнтів та орендодавцями.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-white p-5 rounded-2xl border border-[#E8DFC8] space-y-2">
                  <div className="text-xl">🥐</div>
                  <h4 className="font-bold text-sm text-[#2C1E14]">Постачання для кав'ярень</h4>
                  <p className="text-xs text-[#7A695C]">
                    Свіжі готові круасани або заморожені напівфабрикати преміальної якості щодня.
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#E8DFC8] space-y-2">
                  <div className="text-xl">📍</div>
                  <h4 className="font-bold text-sm text-[#2C1E14]">Оренда та розвиток</h4>
                  <p className="text-xs text-[#7A695C]">
                    Розглядаємо привабливі локації у Вишгороді та передмісті Києва для відкриття нових точок.
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#7A695C]">
                Маєте цікаву пропозицію? Напишіть нам на електронну пошту або зв'яжіться телефоном.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <a
                href="mailto:domagroup.inc@gmail.com?subject=Пропозиція%20співпраці"
                className="bg-[#2C1E14] hover:bg-[#3D2C1F] text-white px-6 py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center gap-2"
              >
                <span>✉️</span>
                <span>Надіслати пропозицію</span>
              </a>
              <span className="text-xs text-[#7A695C]">
                domagroup.inc@gmail.com
              </span>
            </div>
          </div>

          {/* Візуальна плашка */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DFC8] shadow-sm space-y-6">
            <h3 className="font-display text-xl font-bold text-[#2C1E14]">
              Чому обирають співпрацю з нами:
            </h3>
            <ul className="space-y-4 text-sm text-[#614F42]">
              <li className="flex items-start gap-3">
                <span className="text-emerald-600 font-bold text-base shrink-0">✓</span>
                <span>Власне високотехнологічне виробництво хлібобулочних виробів та соусів.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-600 font-bold text-base shrink-0">✓</span>
                <span>Стабільний графік постачання щоранку без перебоїв.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-600 font-bold text-base shrink-0">✓</span>
                <span>Гнучкі оптові ціни та сертифіковані натуральні інгредієнти.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-600 font-bold text-base shrink-0">✓</span>
                <span>Маркетингова підтримка та спільне просування бренду.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
