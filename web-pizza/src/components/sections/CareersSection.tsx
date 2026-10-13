export function CareersSection() {
  return (
    <section
      id="careers"
      className="bg-white py-16 sm:py-20 border-t border-[#EADFCF]"
      style={{
        scrollMarginTop:
          "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 16px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="bg-gradient-to-br from-[#2C1E14] to-[#4A3425] text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-[#3D2C1F] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/10 text-[#E8DFC8] px-3.5 py-1.5 rounded-full text-xs font-semibold">
              <span>💼</span>
              <span>Кар'єра в Doma Pizza & Sushi</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
              Рушаймо в Дома Піца & Суші! Шукаємо людей у команду
            </h2>
            <p className="text-[#D4C3AC] text-sm sm:text-base leading-relaxed max-w-2xl">
              Ми швидко розвиваємося і шукаємо енергійних та відповідальних колег.
              Відкрита позиція: <strong className="text-white">Працівник бригади ресторану</strong> —
              від <strong className="text-[#E29E57]">1000 ₴ за зміну + БОНУСИ ВІД ПРОДАЖУ</strong>.
            </p>
            <div className="flex flex-wrap gap-4 pt-2 text-xs text-[#E8DFC8]">
              <span>✓ Оплачуване навчання</span>
              <span>✓ Гнучкий графік змін</span>
              <span>✓ Смачні обіди та знижки</span>
              <span>✓ Кар'єрний ріст у DomaGroup</span>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-center">
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSd89y1NvhZNHfuzBynttut1wk58yS1tmyK8VtkHcKnt3k56QA/viewform?usp=sf_link"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto text-center bg-[#C8823E] hover:bg-[#B36F2D] text-white font-bold py-4 px-8 rounded-2xl shadow-lg transition-transform active:scale-95 text-base cursor-pointer"
            >
              📝 Заповнити форму кандидата
            </a>
            <div className="text-xs text-[#B8A796] mt-2 text-center lg:text-right w-full">
              Відповідаємо протягом 1-2 робочих днів
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

