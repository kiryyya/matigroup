import { Suspense } from "react";
import HomeClient from "./home-client";

export default function Home() {
  // Оборачиваем клиентский компонент с useSearchParams в Suspense,
  // чтобы избежать ошибок prerender'а на сервере
  return (
    <Suspense fallback={null}>
      <HomeClient />
    </Suspense>
  );
}
