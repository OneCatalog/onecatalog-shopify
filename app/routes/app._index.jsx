import { Page, Layout, Card, Text, BlockStack } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function Index() {
  return (
    <Page>
      <TitleBar title="OneCatalog Import" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">OneCatalog Import</Text>
              <Text as="p">
                Use the navigation: Import (pick &amp; import products), Prices &amp; stock (B2B sync),
                Import log. Set your OneCatalog API token in settings first.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
