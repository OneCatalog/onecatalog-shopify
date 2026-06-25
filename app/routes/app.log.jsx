import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, DataTable, Text, BlockStack } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const rows = await prisma.importLog.findMany({
    where: { shop: session.shop },
    orderBy: { id: "desc" },
    take: 200,
  });
  return json({
    rows: rows.map((r) => ({
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      publicId: r.publicId,
      status: r.status,
      message: r.message || "",
    })),
  });
};

export default function LogPage() {
  const { rows } = useLoaderData();
  const tableRows = rows.map((r) => [r.createdAt, r.publicId, r.status, r.message]);
  return (
    <Page>
      <TitleBar title="OneCatalog — Import log" />
      <BlockStack gap="300">
        <Card>
          {rows.length ? (
            <DataTable
              columnContentTypes={["text", "text", "text", "text"]}
              headings={["Time", "public_id", "Status", "Message"]}
              rows={tableRows}
            />
          ) : (
            <Text as="p">No entries yet.</Text>
          )}
        </Card>
        <Text as="p" tone="subdued">Last 200 catalog import results (created / updated / error).</Text>
      </BlockStack>
    </Page>
  );
}
