import { expect, test } from "@playwright/test";

test("admin session and import preview", async ({ page }) => {
  await page.route("http://localhost:3000/**", async (route) => {
    const url = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        url.endsWith("/dashboard")
          ? { pending: 1, partial: 0, failed: 0, offersByLabel: { boa: 2 } }
          : { items: [] }
      )
    });
  });
  await page.goto("/");
  await page.getByLabel("Chave administrativa").fill("playwright-admin-key");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  await page.getByRole("button", { name: "Importar JSON" }).click();
  await page.getByLabel("JSON de importação").fill(
    JSON.stringify({
      schemaVersion: 1,
      source: { name: "E2E", kind: "import" },
      messages: [
        { text: "RTX 4060 R$ 1.899", capturedAt: "2026-07-14T12:00:00.000Z" },
        { text: "", capturedAt: "invalid" }
      ]
    })
  );
  await page.getByRole("button", { name: "Validar e visualizar" }).click();
  await expect(page.getByText("1 item válido")).toBeVisible();
  await expect(page.getByText("1 item inválido")).toBeVisible();
});
