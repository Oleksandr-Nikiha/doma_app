import { Outlet } from "react-router-dom";

import { TabBar } from "@/components/TabBar";

/** Каркас із нижньою навігацією. Екрани-деталі (товар) рендеряться без неї. */
export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
