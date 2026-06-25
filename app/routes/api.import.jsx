import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { importByPublicId } from "../services/importer.server";

// Сервер-экшен: импорт порции public_id (§6). Возвращает {results, log}.
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const form = await request.formData();
  const ids = form.getAll("ids").map((s) => String(s).trim()).filter(Boolean);

  const results = [];
  for (const publicId of ids) {
    let r;
    try {
      r = await importByPublicId({ admin, prisma, shop, publicId });
    } catch (e) {
      r = { status: "error", publicId, message: e?.message || String(e) };
    }
    results.push(r);
    await prisma.importLog.create({
      data: { shop, publicId: r.publicId || "", status: r.status || "", message: r.message || "" },
    });
  }

  const rows = await prisma.importLog.findMany({ where: { shop }, orderBy: { id: "desc" }, take: 50 });
  return json({
    results,
    log: rows.reverse().map((x) => ({ public_id: x.publicId, status: x.status, message: x.message })),
  });
};
