import { formatPrice } from "@/components/ui";

interface OrderSummaryOption {
  name: string;
}

interface OrderSummaryItem {
  id: number;
  product_name: string;
  variant_label: string;
  qty: number;
  subtotal: number;
  options: OrderSummaryOption[];
}

interface CheckoutOrderSummaryProps {
  items: OrderSummaryItem[];
  subtotal: number;
}

export function CheckoutOrderSummary({ items, subtotal }: CheckoutOrderSummaryProps) {
  return (
    <div className="app-card rounded-2xl p-3.5 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider opacity-60">Склад замовлення</p>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between text-xs py-1 border-b last:border-0"
          style={{ borderColor: "var(--app-border)" }}
        >
          <div className="min-w-0 pr-2">
            <p className="font-medium truncate">{item.product_name}</p>
            <p className="text-[11px] opacity-60">
              {item.variant_label} × {item.qty}
              {item.options.length > 0 && ` (${item.options.map((o) => o.name).join(", ")})`}
            </p>
          </div>
          <span className="font-semibold shrink-0">{formatPrice(item.subtotal)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2 text-base font-bold">
        <span>Разом</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
    </div>
  );
}

