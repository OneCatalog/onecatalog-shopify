import { redirect } from "@remix-run/node";

// Лендинг: если пришли с ?shop=... — уводим в встроенное приложение.
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return null;
};

export default function Index() {
  return null;
}
