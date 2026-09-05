import { backButton, hapticFeedback, init, miniApp, themeParams, viewport } from "@telegram-apps/sdk-react";

/**
 * Обгортки над SDK, які не падають поза Telegram.
 *
 * Mini App має працювати і в звичайному браузері (розробка, дебаг), а там
 * половини нативних можливостей немає. Тому кожен виклик — best effort:
 * не вийшло змонтувати кнопку чи смикнути вібрацію — не привід валити застосунок.
 */

let ready = false;

export function initSdk(): void {
  if (ready) return;
  try {
    init();
    if (miniApp.mountSync.isAvailable()) {
      miniApp.mountSync();
      // Прив'язує CSS-змінні --tg-theme-* до реальної теми клієнта
      themeParams.mountSync();
      themeParams.bindCssVars();
    }
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
