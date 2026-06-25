import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import { useState } from "react";
import { Page, Card, FormLayout, TextField, Select, Checkbox, Button, Banner, BlockStack, Text } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const KEYS = [
  "api_base", "api_token", "lang", "step", "new_active", "picker_base",
  "import_brand", "import_tags", "import_country", "import_collections", "collection_target",
];
const DEFAULTS = {
  api_base: "https://api.onecatalog.net/wiki/v1", api_token: "", lang: "en", step: "10",
  new_active: "1", picker_base: "https://tools.onecatalog.net",
  import_brand: "0", import_tags: "0", import_country: "0", import_collections: "0",
  collection_target: "metafield",
  // B2B (§13) — используются на странице Prices & stock; задаются здесь же.
  b2b_base: "https://api.onecatalog.net/b2b/v1", b2b_url_key: "", b2b_private_key: "",
  b2b_strategy: "min", b2b_region_priority: "", b2b_supplier_priority: "",
  b2b_supplier_fixed: "0", b2b_promo_as_sale: "1", b2b_manage_stock: "1",
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const rows = await prisma.setting.findMany({ where: { shop: session.shop } });
  const map = { ...DEFAULTS };
  for (const r of rows) map[r.key] = r.value ?? "";
  return json({ values: map });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const all = [...KEYS, "b2b_base", "b2b_url_key", "b2b_private_key", "b2b_strategy",
    "b2b_region_priority", "b2b_supplier_priority", "b2b_supplier_fixed", "b2b_promo_as_sale", "b2b_manage_stock"];
  for (const key of all) {
    const value = String(form.get(key) ?? "");
    await prisma.setting.upsert({
      where: { shop_key: { shop: session.shop, key } },
      update: { value },
      create: { shop: session.shop, key, value },
    });
  }
  return json({ ok: true });
};

export default function SettingsPage() {
  const { values } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const [v, setV] = useState(values);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: typeof val === "boolean" ? (val ? "1" : "0") : val }));

  function save() {
    const fd = new FormData();
    Object.entries(v).forEach(([k, val]) => fd.append(k, val ?? ""));
    submit(fd, { method: "post" });
  }

  return (
    <Page>
      <TitleBar title="OneCatalog — Settings" />
      <BlockStack gap="400">
        {actionData?.ok && <Banner tone="success">Settings saved.</Banner>}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Wiki API (catalog import)</Text>
            <FormLayout>
              <TextField label="Wiki API base URL" value={v.api_base} onChange={set("api_base")} autoComplete="off" />
              <TextField label="API token (X-API-Key)" value={v.api_token} onChange={set("api_token")} autoComplete="off" />
              <TextField label="Product language" value={v.lang} onChange={set("lang")} autoComplete="off" />
              <TextField label="Import step (batch, min 10)" type="number" value={v.step} onChange={set("step")} autoComplete="off" />
              <Checkbox label="New products active (on create only)" checked={v.new_active === "1"} onChange={set("new_active")} />
              <TextField label="Picker base URL" value={v.picker_base} onChange={set("picker_base")} autoComplete="off" />
            </FormLayout>
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Reference entities (off by default; native-first)</Text>
            <FormLayout>
              <Checkbox label="Import brand → vendor" checked={v.import_brand === "1"} onChange={set("import_brand")} />
              <Checkbox label="Import tags → product tags" checked={v.import_tags === "1"} onChange={set("import_tags")} />
              <Checkbox label="Import country → metafield" checked={v.import_country === "1"} onChange={set("import_country")} />
              <Checkbox label="Import collections" checked={v.import_collections === "1"} onChange={set("import_collections")} />
              <Select label="Collections target" options={[{label:"Metafield",value:"metafield"},{label:"Custom collection",value:"collection"}]} value={v.collection_target} onChange={set("collection_target")} />
            </FormLayout>
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">B2B — prices & stock (§13)</Text>
            <FormLayout>
              <TextField label="B2B API base URL" value={v.b2b_base} onChange={set("b2b_base")} autoComplete="off" />
              <TextField label="Retailer key (url_key)" value={v.b2b_url_key} onChange={set("b2b_url_key")} autoComplete="off" />
              <TextField label="Private key" value={v.b2b_private_key} onChange={set("b2b_private_key")} autoComplete="off" />
              <Select label="Price strategy" options={[{label:"Minimum",value:"min"},{label:"Supplier priority",value:"priority"},{label:"Fixed supplier",value:"supplier"}]} value={v.b2b_strategy} onChange={set("b2b_strategy")} />
              <TextField label="Region priority (ids, comma)" value={v.b2b_region_priority} onChange={set("b2b_region_priority")} autoComplete="off" />
              <TextField label="Supplier priority (ids, comma)" value={v.b2b_supplier_priority} onChange={set("b2b_supplier_priority")} autoComplete="off" />
              <TextField label="Fixed supplier id" type="number" value={v.b2b_supplier_fixed} onChange={set("b2b_supplier_fixed")} autoComplete="off" />
              <Checkbox label="Promo as compare-at price" checked={v.b2b_promo_as_sale === "1"} onChange={set("b2b_promo_as_sale")} />
              <Checkbox label="Manage stock" checked={v.b2b_manage_stock === "1"} onChange={set("b2b_manage_stock")} />
            </FormLayout>
          </BlockStack>
        </Card>
        <div><Button variant="primary" onClick={save}>Save</Button></div>
      </BlockStack>
    </Page>
  );
}
