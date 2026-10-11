import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CROISSANTS_LOCATION_ID,
  fetchCategories,
  fetchLocationInfo,
  fetchProductsByCategory,
} from "./api/client.ts";
import { CartDrawer } from "./components/CartDrawer.tsx";
import { CategoryNav } from "./components/CategoryNav.tsx";
import { CheckoutModal } from "./components/CheckoutModal.tsx";
import { Footer } from "./components/Footer.tsx";
import { Header } from "./components/Header.tsx";
import { Hero } from "./components/Hero.tsx";
import { OrderTrackingModal, LAST_ORDER_STORAGE_KEY } from "./components/OrderTrackingModal.tsx";
import { ProductCard } from "./components/ProductCard.tsx";
import { ProductModal } from "./components/ProductModal.tsx";
import type { Category, LocationInfo, ProductListItem } from "./types/catalog.ts";
import type { OrderOut } from "./types/order.ts";

export function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeNavId, setActiveNavId] = useState<string | number | null>(null);
  const [productsByCategory, setProductsByCategory] = useState<Record<number, ProductListItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);

  // Стан пошуку
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Модальні вікна
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Відстеження замовлення наживо
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<number | null>(null);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [initialTrackingOrder, setInitialTrackingOrder] = useState<OrderOut | null>(null);
  const [isNewlyCreatedOrder, setIsNewlyCreatedOrder] = useState(false);

  // Ініціалізація трекінгу з URL (?order=123) та збереженого замовлення в localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_ORDER_STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed && !isNaN(parsed)) {
          setLastOrderId(parsed);
        }
      }
    } catch {}

    const params = new URLSearchParams(window.location.search);
    const orderParam = params.get("order");
    if (orderParam) {
      const parsed = parseInt(orderParam, 10);
      if (parsed && !isNaN(parsed)) {
        setTrackingOrderId(parsed);
        setIsTrackingOpen(true);
      }
    }
  }, []);

  const handleOpenTracking = (orderId?: number | null) => {
    const targetId = orderId || lastOrderId;
    if (!targetId) return;
    setTrackingOrderId(targetId);
    setIsNewlyCreatedOrder(false);
    setIsTrackingOpen(true);

    const url = new URL(window.location.href);
    url.searchParams.set("order", String(targetId));
    window.history.replaceState({}, "", url.toString());
  };

  const handleCloseTracking = () => {
    setIsTrackingOpen(false);
    setInitialTrackingOrder(null);
    setIsNewlyCreatedOrder(false);

    const url = new URL(window.location.href);
    url.searchParams.delete("order");
    window.history.replaceState({}, "", url.toString());
  };

  const handleOrderCreatedSuccess = (order: OrderOut) => {
    setLastOrderId(order.id);
    setTrackingOrderId(order.id);
    setInitialTrackingOrder(order);
    setIsNewlyCreatedOrder(true);
    setIsTrackingOpen(true);

    const url = new URL(window.location.href);
    url.searchParams.set("order", String(order.id));
    window.history.replaceState({}, "", url.toString());
  };

  // 1. Завантаження категорій та страв для всіх кореневих категорій
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([fetchCategories(CROISSANTS_LOCATION_ID), fetchLocationInfo(CROISSANTS_LOCATION_ID)])
      .then(async ([cats, loc]) => {
        if (!isMounted) return;
        setCategories(cats);
        setLocationInfo(loc);

        const rootCats = cats.filter((c) => c.parent_id === null);
        if (rootCats.length > 0) {
          setActiveNavId(rootCats[0].id);
        }

        // Завантажуємо страви для всіх категорій одночасно (62 страви разом)
        const productsMap: Record<number, ProductListItem[]> = {};
        await Promise.all(
          rootCats.map(async (cat) => {
            try {
              const items = await fetchProductsByCategory(cat.id);
              productsMap[cat.id] = items;
            } catch (err) {
              console.error(`Помилка для категорії ${cat.id}`, err);
              productsMap[cat.id] = [];
            }
          }),
        );

        if (!isMounted) return;
        setProductsByCategory(productsMap);
      })
      .catch((err) => {
        console.error("Помилка завантаження даних", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const rootCategories = categories.filter((c) => c.parent_id === null);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredProductsByCategory = useMemo(() => {
    if (!normalizedSearch) return productsByCategory;
    const res: Record<number, ProductListItem[]> = {};
    for (const [catIdStr, items] of Object.entries(productsByCategory)) {
      const catId = Number(catIdStr);
      res[catId] = items.filter(
        (item) =>
          item.name.toLowerCase().includes(normalizedSearch) ||
          (item.category_name && item.category_name.toLowerCase().includes(normalizedSearch)),
      );
    }
    return res;
  }, [productsByCategory, normalizedSearch]);

  const totalSearchResults = useMemo(() => {
    if (!normalizedSearch) return 0;
    return Object.values(filteredProductsByCategory).reduce(
      (sum, list) => sum + list.length,
      0,
    );
  }, [filteredProductsByCategory, normalizedSearch]);

  const visibleCategories = useMemo(() => {
    if (!normalizedSearch) return rootCategories;
    return rootCategories.filter(
      (cat) => (filteredProductsByCategory[cat.id]?.length || 0) > 0,
    );
  }, [rootCategories, filteredProductsByCategory, normalizedSearch]);

  // Рефи для блокування scrollspy під час програмного скролу після кліку
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Обчислення повної висоти закріплених панелей (шапка + навігація категорій)
  const getStickyNavHeight = useCallback(() => {
    const headerEl = document.querySelector("header");
    const navEl = document.querySelector("[data-category-nav]");
    const headerH = headerEl ? headerEl.getBoundingClientRect().height : 96;
    const navH = navEl ? navEl.getBoundingClientRect().height : 56;
    return Math.round(headerH + navH);
  }, []);

  // Scrollspy: визначає активну категорію або інформаційну секцію під час скролу сторінки
  const updateActiveCategoryOnScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    if (rootCategories.length === 0) return;

    // Якщо користувач доскролив до самого низу сторінки — активні контакти
    const scrollBottom = window.innerHeight + window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    if (scrollBottom >= docHeight - 80) {
      setActiveNavId((prev) => (prev !== "contacts" ? "contacts" : prev));
      return;
    }

    const stickyHeight = getStickyNavHeight();
    const focalY = stickyHeight + 40;

    let currentActive: string | number = rootCategories[0].id;

    // 1. Категорії страв каталогу
    for (const cat of rootCategories) {
      const el = document.getElementById(`category-${cat.id}`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top <= focalY) {
        currentActive = cat.id;
      }
    }

    // 2. Інформаційні секції (Про нас, Доставка, Вакансії, Контакти)
    const sections: Array<{ id: string; elementId: string }> = [
      { id: "about", elementId: "about" },
      { id: "delivery", elementId: "delivery" },
      { id: "careers", elementId: "careers" },
      { id: "contacts", elementId: "contacts" },
    ];

    for (const sec of sections) {
      const el = document.getElementById(sec.elementId);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top <= focalY) {
        currentActive = sec.id;
      }
    }

    setActiveNavId((prev) => (prev !== currentActive ? currentActive : prev));
  }, [rootCategories, getStickyNavHeight]);

  // Якщо користувач сам починає ручний скрол колесом чи пальцем — знімаємо блокування
  useEffect(() => {
    const handleUserInteraction = () => {
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false;
        if (scrollTimeoutRef.current !== null) {
          window.clearTimeout(scrollTimeoutRef.current);
        }
      }
    };

    window.addEventListener("wheel", handleUserInteraction, { passive: true });
    window.addEventListener("touchmove", handleUserInteraction, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleUserInteraction);
      window.removeEventListener("touchmove", handleUserInteraction);
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Слухач скролу вікна (throttled через requestAnimationFrame для високої частоти оновлення)
  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      setShowScrollTop(window.scrollY > 400);
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateActiveCategoryOnScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [updateActiveCategoryOnScroll]);

  // Скрол до меню з головного банера
  const handleScrollToMenu = () => {
    const el = document.getElementById("menu");
    if (!el) return;
    const stickyHeight = getStickyNavHeight();
    const targetY = Math.max(
      0,
      el.getBoundingClientRect().top + window.scrollY - (stickyHeight + 16),
    );
    window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  // Плавний перехід до категорії або розділу сайту з підсвічуванням
  const handleSelectNav = (id: string | number) => {
    if (searchQuery) {
      setSearchQuery("");
    }
    setActiveNavId(id);
    isProgrammaticScrollRef.current = true;

    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    const targetElId = typeof id === "number" ? `category-${id}` : String(id);
    const target = document.getElementById(targetElId);
    if (target) {
      const stickyHeight = getStickyNavHeight();
      const targetY = Math.max(
        0,
        target.getBoundingClientRect().top + window.scrollY - (stickyHeight + 16),
      );
      window.scrollTo({ top: targetY, behavior: "smooth" });
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      updateActiveCategoryOnScroll();
    }, 850);
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#FAF7F2]">
      {/* Шапка сайту */}
      <Header
        onOpenCart={() => setIsCartOpen(true)}
        phone={locationInfo?.phones[0] || "+380 93 112 77 33"}
        address={locationInfo?.address || "Вишгород, просп. Шевченка, 2Д"}
        activeNavId={activeNavId}
        onSelectNav={handleSelectNav}
        lastOrderId={lastOrderId}
        onOpenTracking={() => handleOpenTracking()}
      />

      {/* Головний банер (Hero) */}
      <Hero onScrollToMenu={handleScrollToMenu} />

      {/* Навігація категоріями та пошук (липка плашка) */}
      {rootCategories.length > 0 && (
        <CategoryNav
          categories={categories}
          activeNavId={activeNavId}
          onSelectNav={handleSelectNav}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}

      {/* Секція Меню з усіма категоріями */}
      <main
        id="menu"
        className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-8 sm:py-12 space-y-12 sm:space-y-16"
        style={{
          scrollMarginTop:
            "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 16px)",
        }}
      >
        {/* Панель результатів пошуку */}
        {normalizedSearch && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E8DFC8] flex items-center justify-between gap-4 shadow-xs">
            <div>
              <div className="text-xs font-bold text-[#8D7B6D] uppercase tracking-wider">
                Результати пошуку
              </div>
              <div className="text-base sm:text-lg font-bold text-[#2C1E14] mt-0.5">
                За запитом «{searchQuery}» знайдено:{" "}
                <span className="text-[#C8823E] font-extrabold">
                  {totalSearchResults}{" "}
                  {totalSearchResults === 1 ? "страву" : "позицій"}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSearchQuery("")}
              type="button"
              className="text-xs sm:text-sm font-bold bg-[#F3EDE2] hover:bg-[#EADFCF] text-[#4A3B32] px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              ✕ Очистити пошук
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl border border-[#E8DFC8] overflow-hidden p-3 sm:p-4 space-y-2.5 sm:space-y-3 animate-pulse"
              >
                <div className="aspect-[4/3] bg-[#EADFCF] rounded-xl w-full"></div>
                <div className="h-4 sm:h-5 bg-[#EADFCF] rounded-md w-3/4"></div>
                <div className="h-3 sm:h-4 bg-[#EADFCF] rounded-md w-1/2"></div>
                <div className="h-7 sm:h-8 bg-[#EADFCF] rounded-xl w-full mt-2 sm:mt-4"></div>
              </div>
            ))}
          </div>
        ) : normalizedSearch && totalSearchResults === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-14 text-center border border-[#E8DFC8] space-y-4 max-w-lg mx-auto shadow-xs">
            <div className="text-5xl">🥐🔍</div>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-[#2C1E14]">
              Нічого не знайдено за запитом «{searchQuery}»
            </h3>
            <p className="text-sm text-[#7A695C] leading-relaxed">
              Спробуйте змінити пошукове слово або переглянути всі категорії нашого свіжого меню
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="bg-[#C8823E] hover:bg-[#B36F2D] text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              Показати повне меню
            </button>
          </div>
        ) : (
          visibleCategories.map((category) => {
            const items = filteredProductsByCategory[category.id] || [];
            return (
              <section
                key={category.id}
                id={`category-${category.id}`}
                className="space-y-4 sm:space-y-6"
                style={{
                  scrollMarginTop:
                    "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 16px)",
                }}
              >
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#EADFCF] pb-3 sm:pb-4">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    {category.icon && (
                      <span className="text-2xl sm:text-4xl">{category.icon}</span>
                    )}
                    <h2 className="font-display text-xl sm:text-3xl font-extrabold text-[#2C1E14]">
                      {category.name}
                    </h2>
                  </div>
                  <div className="text-xs font-semibold text-[#8D7B6D] bg-[#F3EDE2] px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full">
                    {items.length} {items.length === 1 ? "страва" : "позицій"}
                  </div>
                </div>

                {items.length === 0 ? (
                  <p className="text-sm text-[#7A695C] italic">Позиції готуються до публікації...</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                    {items.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onSelect={(id) => setSelectedProductId(id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </main>

      {/* Секція Про пекарню */}
      <section
        id="about"
        className="bg-white py-16 sm:py-20 border-t border-[#EADFCF]"
        style={{
          scrollMarginTop:
            "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 16px)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 bg-[#F3EDE2] text-[#9C5B23] px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                <span>🥐</span>
                <span>Перша пекарня задоволення</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2C1E14] leading-tight">
                Doma Croissants — справжня майстерня смаку
              </h2>
              <div className="space-y-4 text-[#614F42] leading-relaxed text-sm sm:text-base">
                <p>
                  <strong className="text-[#2C1E14]">Doma Croissants</strong> – це справжня майстерня смаку,
                  що втілює найкращі традиції відомого бренду Doma Pizza&Sushi.
                </p>
                <p>
                  Наша команда спадкоємців кулінарних витворів мистецтва взяла найкраще з попередніх проектів,
                  додала унікальний шарм та створила власний шедевр – великі хрусткі круасани.
                  Що б ви обрали – витончений круасан з насиченою начинкою або класичний смак у непідвладному
                  часу обличчі, у нас ви завжди знайдете ідеальний варіант за вигідною ціною.
                </p>
                <p>
                  Наша історія розпочалася <strong className="text-[#2C1E14]">03.08.2023 року</strong> в нашому рідному місті –
                  Вишгороді. Тут, серед джерел натхнення та творчого спалаху, ми зробили перший крок до створення
                  неперевершеного досвіду смаку.
                </p>
              </div>

              {/* Ключові факти */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#EADFCF]">
                <div>
                  <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#C8823E]">
                    03.08.23
                  </div>
                  <div className="text-xs text-[#7A695C] mt-0.5">Рідне місто Вишгород</div>
                </div>
                <div>
                  <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#C8823E]">
                    від 250 ₴
                  </div>
                  <div className="text-xs text-[#7A695C] mt-0.5">Безкоштовна доставка</div>
                </div>
                <div>
                  <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#C8823E]">
                    08:00
                  </div>
                  <div className="text-xs text-[#7A695C] mt-0.5">Свіжа випічка щоранку</div>
                </div>
                <div>
                  <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#C8823E]">
                    100%
                  </div>
                  <div className="text-xs text-[#7A695C] mt-0.5">Натуральне масло</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 gap-4">
              <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-xl bg-[#FAF7F2]">
                <img
                  src="https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=600&q=80"
                  alt="Круасани Doma"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-xl bg-[#FAF7F2] mt-8">
                <img
                  src="https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80"
                  alt="Кава та випічка"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Секція Доставка та оплата */}
      <section
        id="delivery"
        className="bg-[#FAF7F2] py-16 sm:py-20 border-t border-[#EADFCF]"
        style={{
          scrollMarginTop:
            "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 16px)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C8823E]">
              Швидко та смачно
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#2C1E14]">
              Доставка та самовивіз у Вишгороді
            </h2>
            <p className="text-[#614F42] text-sm sm:text-base">
              Насолоджуйтесь хрусткими круасанами та гарячими стравами вдома, в офісі чи на прогулянці
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DFC8] shadow-xs space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF8EE] text-[#C8823E] flex items-center justify-center text-2xl font-bold">
                🛵
              </div>
              <h3 className="font-display text-xl font-bold text-[#2C1E14]">
                Кур'єрська доставка
              </h3>
              <p className="text-sm text-[#614F42] leading-relaxed">
                Працює щодня з <strong>10:00 до 20:00</strong>. Доставка по м. Вишгород
                <strong> безкоштовна при замовленні від 250 ₴</strong>.
              </p>
              <div className="text-xs font-semibold text-[#8D7665]">
                Замовлення: <a href="tel:+380931127733" className="text-[#C8823E] underline font-bold">+380 93 112 77 33</a>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DFC8] shadow-xs space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF8EE] text-[#C8823E] flex items-center justify-center text-2xl font-bold">
                🛍️
              </div>
              <h3 className="font-display text-xl font-bold text-[#2C1E14]">
                Самовивіз без черги
              </h3>
              <p className="text-sm text-[#614F42] leading-relaxed">
                Пекарня працює щодня з <strong>08:00 до 20:00</strong> за адресою:
                <strong> просп. Шевченка, 2Д</strong>. Замовляйте на сайті заздалегідь.
              </p>
              <div className="text-xs font-semibold text-[#8D7665]">
                Приготуємо свіжим до вашого приходу!
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DFC8] shadow-xs space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF8EE] text-[#C8823E] flex items-center justify-center text-2xl font-bold">
                💳
              </div>
              <h3 className="font-display text-xl font-bold text-[#2C1E14]">
                Зручна оплата
              </h3>
              <p className="text-sm text-[#614F42] leading-relaxed">
                Оплачуйте готівкою або банківською карткою кур'єру під час отримання,
                або на касі закладу під час самовивозу.
              </p>
              <div className="text-xs font-semibold text-[#8D7665]">
                Безпечно, прозоро та швидко.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Секція Вакансії */}
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
                <span>Кар'єра в Doma Croissants</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
                Рушаймо в ДомаКруасани! Шукаємо людей у команду
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
                className="w-full sm:w-auto text-center bg-[#C8823E] hover:bg-[#B36F2D] text-white font-bold py-4 px-8 rounded-2xl shadow-lg transition-transform active:scale-95 text-base"
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

      {/* Футер */}
      <Footer />

      {/* Модалка товару */}
      {selectedProductId && (
        <ProductModal
          productId={selectedProductId}
          onClose={() => setSelectedProductId(null)}
        />
      )}

      {/* Слайдер кошика */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onOpenCheckout={() => setIsCheckoutOpen(true)}
      />

      {/* Модалка чекауту */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={handleOrderCreatedSuccess}
      />

      {/* Модалка відстеження замовлення наживо */}
      <OrderTrackingModal
        isOpen={isTrackingOpen}
        orderId={trackingOrderId}
        initialOrder={initialTrackingOrder}
        isNewlyCreated={isNewlyCreatedOrder}
        onClose={handleCloseTracking}
      />

      {/* Плаваюча кнопка швидкого повернення Нагору */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Піднятися нагору"
          className="fixed bottom-6 right-5 sm:bottom-8 sm:right-8 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#2C1E14] text-white shadow-xl hover:bg-[#3D2C1F] flex items-center justify-center font-bold text-base sm:text-lg active:scale-90 transition-all cursor-pointer border border-[#E8DFC8]/40 animate-in fade-in zoom-in-75 duration-200"
        >
          ⬆️
        </button>
      )}
    </div>
  );
}

