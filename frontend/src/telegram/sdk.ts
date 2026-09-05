import { backButton, hapticFeedback, init, miniApp, themeParams, viewport } from "@telegram-apps/sdk-react";

/**
 * Обгортки над SDK, які не падають поза Telegram.
 *
 * Mini App має працювати і в звичайному браузері (розробка, дебаг), а там
 * половини нативних можливостей немає. Тому кожен виклик — best effort:
 * не вийшло змонтувати кнопку чи смикнути вібрацію — не привід валити застосунок.
 */

let ready = false;

/**
 * Прибирає порожні --tg-theme-* зі стилю <html>.
 *
 * Не всі клієнти Telegram надсилають повний набір параметрів теми (найчастіше
 * бракує secondary_bg_color). SDK усе одно прив'язує змінну — з порожнім
 * значенням. Інлайн перебиває наш дефолт із index.css, а підстановка порожнечі
 * робить усю декларацію background недійсною: на темній темі плашки під
 * текстом просто зникають. Знімаємо такі змінні, щоб спрацював дефолт.
 */
function dropEmptyThemeVars(): void {
  const el = document.documentElement;
  for (let i = el.style.length - 1; i >= 0; i--) {
    const name = el.style[i];
    if (name.startsWith("--tg-theme-") && !el.style.getPropertyValue(name).trim()) {
      el.style.removeProperty(name);
    }
  }
}

export function initSdk(): void {
  if (ready) return;
  try {
    init();
    if (miniApp.mountSync.isAvailable()) {
      miniApp.mountSync();
    }
    // Прив'язка теми — окремо від miniApp: якщо mountSync недоступний
    // (старіший клієнт, мок), кольори Telegram інакше не приїхали б зовсім,
    // і застосунок лишався б світлим у темному клієнті.
    try {
      themeParams.mountSync();
      themeParams.bindCssVars();
      dropEmptyThemeVars();
      // Користувач може перемкнути тему на льоту: SDK перепризначить змінні,
      // і порожні можуть повернутись — чистимо після кожної зміни.
      themeParams.state.sub(() => dropEmptyThemeVars());
    } catch { /* теми немає — лишаються значення з index.css */ }
    if (viewport.mount.isAvailable()) {
      void viewport.mount().then(() => {
        if (viewport.bindCssVars.isAvailable()) viewport.bindCssVars();
      }).catch(() => {});
    }
    ready = true;
  } catch {
    // Поза Telegram і без моку — працюємо як звичайний веб-застосунок
  }
}

/** Нативна кнопка «Назад» у шапці Telegram. Повертає функцію відписки. */
export function showBackButton(onClick: () => void): () => void {
  try {
    if (!backButton.mount.isAvailable()) return () => {};
    backButton.mount();
    backButton.show();
    const off = backButton.onClick(onClick);
    return () => {
      off();
      try { backButton.hide(); } catch { /* вже розмонтовано */ }
    };
  } catch {
    return () => {};
  }
}

export function hideBackButton(): void {
  try { if (backButton.isMounted()) backButton.hide(); } catch { /* ignore */ }
}

/** Тактильний відгук на дії: додати в кошик, +/−, видалити. */
export function haptic(style: "light" | "medium" | "heavy" = "light"): void {
  try {
    if (hapticFeedback.impactOccurred.isAvailable()) hapticFeedback.impactOccurred(style);
  } catch { /* ignore */ }
}

export function hapticNotify(type: "error" | "success" | "warning"): void {
  try {
    if (hapticFeedback.notificationOccurred.isAvailable()) hapticFeedback.notificationOccurred(type);
  } catch { /* ignore */ }
}
