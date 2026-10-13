export function PromotionsSection() {
  const promos = [
    {
      icon: "🛵",
      title: "Безкоштовна доставка",
      subtitle: "м. Вишгород",
      desc: "Замовляйте будь-які страви на суму від 250 ₴ у Doma Pizza або Doma Croissants і доставка буде повністю безкоштовною.",
      badge: "Постійно діє",
    },
    {
      icon: "🍱",
      title: "СУПЕР ВИГОДА на СЕТИ",
      subtitle: "Doma Pizza & Sushi",
      desc: "Спеціальні комбо-пропозиції: великі суші-сети та піца-мікси за найвигіднішими цінами для великих компаній.",
      badge: "Топ вигода",
    },
    {
      icon: "☕",
      title: "Ранкова свіжість",
      subtitle: "Doma Croissants",
      desc: "Щодня з 08:00 до 11:00 — свіжий хрусткий круасан та авторська кава за спеціальною ранковою пропозицією.",
      badge: "Щоранку",
    },
    {
      icon: "🎉",
      title: "День Народження з DomaClub",
      subtitle: "Уся мережа",
      desc: "Отримуйте -10% знижки на всі замовлення у день народження, напередодні та наступного дня без лімітів на суму.",
      badge: "-10% свято",
    },
  ];

  return (
    <section id="promotions" className="py-16 sm:py-24 bg-white border-b border-[#EADFCF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12 sm:mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#C8823E]">
            Спеціальні пропозиції
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2C1E14]">
            Акції та вигода у закладах DOMA
          </h2>
          <p className="text-sm sm:text-base text-[#614F42]">
            Ми дбаємо про те, щоб кожне замовлення приносило не тільки гастрономічне задоволення, а й приємну економію
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {promos.map((p) => (
            <div
              key={p.title}
              className="bg-[#FAF7F2] rounded-3xl p-6 border border-[#E8DFC8] flex flex-col justify-between hover:shadow-md transition-shadow space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{p.icon}</span>
                  <span className="text-[10px] font-bold uppercase bg-[#EADFCF] text-[#7A4B1A] px-2.5 py-0.5 rounded-full">
                    {p.badge}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold text-[#9C5B23]">{p.subtitle}</div>
                  <h3 className="font-display text-lg font-bold text-[#2C1E14] mt-0.5">
                    {p.title}
                  </h3>
                </div>
                <p className="text-xs text-[#614F42] leading-relaxed">
                  {p.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
