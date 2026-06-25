import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useRef, useState } from "react";
import { Page, Card, Button, TextField, Text, BlockStack, InlineStack, ProgressBar, Banner } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getSettings } from "../services/api.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const cfg = await getSettings(prisma, session.shop);
  return json({
    pickerBase: cfg.picker_base || "https://tools.onecatalog.net",
    token: cfg.api_token || "",
    step: cfg.step,
    configured: !!cfg.api_token,
  });
};

function splitIds(s) {
  return String(s || "").split(/[\s,;]+/).filter(Boolean);
}

export default function ImportPage() {
  const { pickerBase, token, step, configured } = useLoaderData();
  const [ids, setIds] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [summary, setSummary] = useState("");
  const cancelRef = useRef(false);

  async function runImport(list) {
    list = (list || []).map((s) => String(s).trim()).filter(Boolean);
    if (!list.length) return;
    setBusy(true);
    cancelRef.current = false;
    const counts = { created: 0, updated: 0, error: 0 };
    const chunks = [];
    for (let i = 0; i < list.length; i += step) chunks.push(list.slice(i, i + step));
    let done = 0;
    for (const c of chunks) {
      if (cancelRef.current) { setStatusText("Cancelled: " + done + "/" + list.length); break; }
      const body = new FormData();
      c.forEach((id) => body.append("ids", id));
      try {
        const res = await fetch("/api/import", { method: "POST", body, credentials: "same-origin" });
        const d = await res.json();
        (d.results || []).forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
      } catch (e) {
        counts.error += c.length;
      }
      done += c.length;
      setProgress(Math.round((Math.min(done, list.length) / list.length) * 100));
      setStatusText("Importing " + Math.min(done, list.length) + "/" + list.length);
      setSummary(`Created: ${counts.created || 0} · Updated: ${counts.updated || 0} · Errors: ${counts.error || 0}`);
    }
    if (!cancelRef.current) setStatusText("Done " + done + "/" + list.length);
    setBusy(false);
    try { localStorage.setItem("oc-import-last", JSON.stringify({ ts: Date.now(), statusText, summary })); } catch (e) {}
  }

  async function openPickerClick() {
    const mod = await import("../picker.client.js");
    mod.openPicker({ pickerBase, token }, (selected) => runImport(selected));
  }

  return (
    <Page>
      <TitleBar title="OneCatalog — Import" />
      <BlockStack gap="400">
        {!configured && <Banner tone="warning">API token is not set. Open Settings and enter the token first.</Banner>}
        <Card>
          <BlockStack gap="300">
            <Button variant="primary" onClick={openPickerClick} disabled={busy}>
              Select products (OneCatalog)
            </Button>
            <TextField
              label="or paste a list of identifiers (public_id) — comma/space/newline separated"
              multiline={4}
              value={ids}
              onChange={setIds}
              disabled={busy}
              autoComplete="off"
            />
            <InlineStack gap="200">
              <Button onClick={() => runImport(splitIds(ids))} disabled={busy}>Import</Button>
              {busy && <Button tone="critical" onClick={() => { cancelRef.current = true; }}>Cancel</Button>}
            </InlineStack>
            {(busy || statusText) && (
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="bold">{statusText}</Text>
                <ProgressBar progress={progress} size="small" />
                <Text as="p">{summary}</Text>
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
