import { existsSync, readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
test("production dist emits a Pages-scoped manifest.json", () => {
  expect(existsSync("dist/manifest.json")).toBe(true);
  expect(existsSync("dist/manifest.webmanifest")).toBe(false);
  expect(existsSync("dist/sw.js")).toBe(true);
  const manifest = JSON.parse(readFileSync("dist/manifest.json", "utf8")) as {
    start_url: string;
    scope: string;
  };
  expect(manifest.start_url).toBe("/tag-me/");
  expect(manifest.scope).toBe("/tag-me/");
  const html = readFileSync("dist/index.html", "utf8");
  expect(html).not.toMatch(/src="\/sw\.js"/);
  expect(html).toContain("/tag-me/");
});
test("cached shell reloads offline and can start a round", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tag-me/", { waitUntil: "load" });
  await expect(
    page.getByRole("heading", { name: "Ready for a round?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start training" }),
  ).toBeEnabled();
  const script = await page.evaluate(() =>
    navigator.serviceWorker.ready.then(
      (registration) => registration.active?.scriptURL ?? "",
    ),
  );
  expect(script).toContain("/tag-me/sw.js");
  expect(errors).toEqual([]);
  await context.setOffline(true);
  await page.reload({ waitUntil: "load" });
  await expect(
    page.getByRole("heading", { name: "Ready for a round?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start training" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start training" }).click();
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await expect(page.locator(".play-page")).toBeVisible();
  await expect(page.getByText("Get ready")).toBeVisible();
});
