import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { processPage } from "../services/b2bsync.server";

// Сервер-экшен: обработать одну страницу B2B-фида (scan-and-diff, §13).
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const start = parseInt(form.get("start") || "0", 10) || 0;
  const limit = Math.max(1, parseInt(form.get("limit") || "200", 10) || 200);
  const res = await processPage({ admin, prisma, shop: session.shop, start, limit });
  return json(res);
};
