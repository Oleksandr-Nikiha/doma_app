/**
 * Утиліти для роботи з робочим часом закладу Urban Bakery & Coffee
 * Пекарня: 08:00 – 21:00 щодня
 * Кур'єрська доставка: 10:00 – 21:00 щодня
 */

export interface WorkingHoursInfo {
  isBakeryOpen: boolean;
  isDeliveryOpen: boolean;
  currentKyivTime: string;
  statusText: string;
  shortStatusText: string;
  badgeColor: "emerald" | "amber" | "rose";
  checkoutNotice: string | null;
}

export function getWorkingHoursInfo(): WorkingHoursInfo {
  try {
    const now = new Date();
    // Розрахунок часу в зоні Europe/Kyiv
    const kyivDateStr = now.toLocaleString("en-US", { timeZone: "Europe/Kyiv" });
    const kyivDate = new Date(kyivDateStr);

    const hours = kyivDate.getHours();
    const minutes = kyivDate.getMinutes();
    const currentTotalMinutes = hours * 60 + minutes;

    const timeFormatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

    // Пекарня: 08:00 (480 хв) – 21:00 (1260 хв)
    const isBakeryOpen = currentTotalMinutes >= 480 && currentTotalMinutes < 1260;

    // Доставка: 10:00 (600 хв) – 21:00 (1260 хв)
    const isDeliveryOpen = currentTotalMinutes >= 600 && currentTotalMinutes < 1260;

    if (isDeliveryOpen) {
      return {
        isBakeryOpen: true,
        isDeliveryOpen: true,
        currentKyivTime: timeFormatted,
        statusText: "Відчинено • Доставка та самовивіз працюють",
        shortStatusText: "Відчинено до 21:00",
        badgeColor: "emerald",
        checkoutNotice: null,
      };
    }

    if (isBakeryOpen && !isDeliveryOpen) {
      return {
        isBakeryOpen: true,
        isDeliveryOpen: false,
        currentKyivTime: timeFormatted,
        statusText: "Пекарня відчинена • Доставка розпочнеться о 10:00",
        shortStatusText: "Самовивіз (доставка з 10:00)",
        badgeColor: "amber",
        checkoutNotice:
          "Зверніть увагу: кур'єрська доставка працює з 10:00 до 21:00. Самовивіз доступний прямо зараз!",
      };
    }

    return {
      isBakeryOpen: false,
      isDeliveryOpen: false,
      currentKyivTime: timeFormatted,
      statusText: "Зачинено до 08:00 • Приймаємо передзамовлення",
      shortStatusText: "Зачинено (до 08:00)",
      badgeColor: "amber",
      checkoutNotice:
        "Пекарня зараз зачинена (працюємо щодня з 08:00 до 21:00). Ваше замовлення буде прийнято як передзамовлення та випечено свіжим зранку!",
    };
  } catch {
    return {
      isBakeryOpen: true,
      isDeliveryOpen: true,
      currentKyivTime: "",
      statusText: "Щодня 08:00 – 20:00",
      shortStatusText: "Щодня 08:00 – 20:00",
      badgeColor: "emerald",
      checkoutNotice: null,
    };
  }
}
