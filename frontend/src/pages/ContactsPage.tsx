import { ErrorBox, ScreenTitle, Spinner } from "@/components/ui";
import { useLocations } from "@/api/queries";

export function ContactsPage() {
  const { data, isPending, error, refetch } = useLocations();

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;

  return (
    <div className="pb-4">
      <ScreenTitle>Контакти</ScreenTitle>
      <div className="space-y-3 px-4">
        {data.map((loc) => (
          <section
            key={loc.id}
            className="rounded-2xl p-4"
            style={{ background: "var(--app-surface)" }}
          >
            <h2 className="font-semibold">{loc.name}</h2>
            <p className="mt-1 text-sm opacity-70">{loc.address}</p>
            <div className="mt-3 flex flex-col gap-2">
              {loc.phones.map((phone) => (
                <a
                  key={phone}
                  href={`tel:${phone}`}
                  className="text-sm font-medium"
                  style={{ color: "var(--tg-theme-link-color, var(--tg-theme-button-color))" }}
                >
                  {phone}
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
