import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useRef, useState } from "react";
import { Page, Card, Button, Text, BlockStack, ProgressBar, Banner } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getSettings } from "../services/api.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const cfg = await getSettings(prisma, session.shop);
  return json({ configured: !!cfg.b2b_url_key && !!cfg.b2b_private_key });
};

export default function B2bPage() {
  const { configured } = useLoaderData();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [summary, setSummary] = useState("");
  const cancelRef = useRef(false);

  async function run() {
    setBusy(true);
    cancelRef.current = false;
    const totals = { scanned: 0, changed: 0, unchanged: 0, missing: 0, total: 0 };
    let start = 0, more = true;
    while (more) {
      if (cancelRef.current) { setStatusText("Cancelled"); break; }
      const body = new FormData();
      body.append("start", String(start));
      body.append("limit", "200");
      let d;
      try {
        const res = await fetch("/api/sync", { method: "POST", body, credentials: "same-origin" });
        d = await res.json();
      } catch (e) { setStatusText("Error"); break; }
      if (d.error) { setStatusText("Error: " + d.error); break; }
      totals.scanned += d.scanned || 0;
      totals.changed += d.changed || 0;
      totals.unchanged += d.unchanged || 0;
      totals.missing += d.missing || 0;
      totals.total = d.total || totals.total;
      setStatusText(`Syncing ${totals.scanned}${totals.total ? "/" + totals.total : ""}`);
      setSummary(`Changed: ${totals.changed} · Unchanged: ${totals.unchanged} · Not in catalog: ${totals.missing}`);
      if (totals.total > 0) setProgress(Math.min(100, Math.round((totals.scanned / totals.total) * 100)));
      more = !!d.more;
      start = d.next;
    }
    if (!cancelRef.current) { setStatusText("Done: " + totals.scanned); setProgress(100); }
    setBusy(false);
  }

  return (
    <Page>
      <TitleBar title="OneCatalog — Prices & stock" />
      <BlockStack gap="400">
        <Text as="p"><Link to="/app/settings">B2B settings (keys, strategy, priorities)</Link></Text>
        {!configured && <Banner tone="warning">B2B keys are not set — fill url_key and private_key in Settings.</Banner>}
        <Card>
          <BlockStack gap="300">
            <Button variant="primary" onClick={run} disabled={busy}>Synchronize now</Button>
            {busy && <Button tone="critical" onClick={() => { cancelRef.current = true; }}>Cancel</Button>}
            {(busy || statusText) && (
              <BlockStack gap="200">
                <Text as="p" fontWeight="bold">{statusText}</Text>
                <ProgressBar progress={progress} size="small" />
                <Text as="p">{summary}</Text>
              </BlockStack>
            )}
            <Text as="p" tone="subdued">Runs page-by-page in the browser. Only changed products are written (scan-and-diff).</Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
