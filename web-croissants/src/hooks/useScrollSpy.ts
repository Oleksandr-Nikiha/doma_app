import { useCallback, useEffect, useRef, useState } from "react";
import type { Category } from "../types/catalog.ts";

interface UseScrollSpyOptions {
  categories: Category[];
  searchQuery?: string;
  onClearSearch?: () => void;
}

export function useScrollSpy({
  categories,
  searchQuery = "",
  onClearSearch,
}: UseScrollSpyOptions) {
  const [activeNavId, setActiveNavId] = useState<string | number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const rootCategories = categories.filter((c) => c.parent_id === null);

  // Встановлення першої активної категорії при завантаженні
  useEffect(() => {
    if (rootCategories.length > 0 && activeNavId === null) {
      setActiveNavId(rootCategories[0].id);
    }
  }, [rootCategories, activeNavId]);

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

  // Слухач скролу вікна (throttled через requestAnimationFrame)
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
    if (searchQuery && onClearSearch) {
      onClearSearch();
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return {
    activeNavId,
    setActiveNavId,
    showScrollTop,
    handleSelectNav,
    handleScrollToMenu,
    scrollToTop,
  };
}

