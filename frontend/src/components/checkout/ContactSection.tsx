interface ContactSectionProps {
  contactName: string;
  onContactNameChange: (val: string) => void;
  contactPhone: string;
  onContactPhoneChange: (val: string) => void;
}

export function ContactSection({
  contactName,
  onContactNameChange,
  contactPhone,
  onContactPhoneChange,
}: ContactSectionProps) {
  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold uppercase tracking-wider opacity-60">
        Контакти одержувача
      </label>
      <div>
        <label className="mb-1 block text-xs font-medium opacity-70">Ім'я *</label>
        <input
          type="text"
          value={contactName}
          onChange={(e) => onContactNameChange(e.target.value)}
          placeholder="Ваше ім'я"
          required
          className="w-full rounded-xl p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
          style={{ background: "var(--app-surface-2)" }}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium opacity-70">Телефон *</label>
        <input
          type="tel"
          value={contactPhone}
          onChange={(e) => onContactPhoneChange(e.target.value)}
          placeholder="+380..."
          required
          className="w-full rounded-xl p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
          style={{ background: "var(--app-surface-2)" }}
        />
      </div>
    </div>
  );
}

