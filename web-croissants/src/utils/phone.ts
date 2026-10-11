/**
 * Утиліти форматування та валідації номерів телефонів України
 */

export function formatPhoneNumber(val: string): string {
  if (!val) return "";

  // Витягуємо лише цифри
  const digits = val.replace(/\D/g, "");

  // Якщо користувач видалив усе
  if (digits.length === 0) return "";

  // Визначаємо значущу частину (без префіксів 380, 38 або ведучого 0)
  let rest = digits;
  if (digits.startsWith("380")) {
    rest = digits.slice(3);
  } else if (digits.startsWith("0")) {
    rest = digits.slice(1);
  } else if (digits.startsWith("38")) {
    rest = digits.slice(2);
  }

  // Обмежуємо максимум 9 цифрами (код оператора + номер: XX XXX XX XX)
  rest = rest.slice(0, 9);

  let formatted = "+380";
  if (rest.length > 0) {
    formatted += ` (${rest.slice(0, 2)}`;
  }
  if (rest.length >= 2) {
    formatted += `) ${rest.slice(2, 5)}`;
  }
  if (rest.length >= 5) {
    formatted += `-${rest.slice(5, 7)}`;
  }
  if (rest.length >= 7) {
    formatted += `-${rest.slice(7, 9)}`;
  }

  return formatted;
}

export function normalizeE164Phone(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (digits.startsWith("380") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `+38${digits}`;
  }
  if (digits.length === 9) {
    return `+380${digits}`;
  }
  if (digits.length === 12) {
    return `+${digits}`;
  }
  return val.trim();
}

export function isValidUkrainianPhone(val: string): boolean {
  const digits = val.replace(/\D/g, "");
  if (digits.startsWith("380") && digits.length === 12) {
    return true;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return true;
  }
  if (digits.length === 9) {
    return true;
  }
  return false;
}

