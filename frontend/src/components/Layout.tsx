import { Outlet } from "react-router-dom";

import { TabBar } from "@/components/TabBar";
import { WebHeader } from "@/components/WebHeader";

/** Каркас із нижньою навігацією. Екрани-деталі (товар) рендеряться без неї. */
export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--tg-theme-bg-color)]">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <WebHeader />
        <main
          className="flex-1"
          style={{ paddingBottom: "calc(var(--app-tabbar-height) + env(safe-area-inset-bottom) + 12px)" }}
        >
          <Outlet />
        </main>
        <TabBar />
      </div>
    </div>
  );
}
