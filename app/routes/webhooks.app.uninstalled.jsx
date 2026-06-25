import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);
  if (topic === "APP_UNINSTALLED") {
    await db.session.deleteMany({ where: { shop } });
  }
  return new Response();
};
