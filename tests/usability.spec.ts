import { test, expect, type Page, type Locator } from "@playwright/test";

async function clock(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
}
async function fits(locator: Locator, page: Page) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}
async function start(page: Page, aimed = false) {
  await page.goto("/");
  if (aimed) {
    await page.getByRole("button", { name: "Settings & data" }).click();
    await page.getByLabel("Response style").selectOption("aimed");
    await page.getByRole("button", { name: "My garden", exact: true }).click();
  }
  await page.getByRole("button", { name: "Start training" }).click();
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
}

test.describe("responsive play", () => {
  test.use({ hasTouch: true });
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [375, 667],
    [390, 844],
    [430, 932],
    [667, 375],
    [844, 390],
    [768, 1024],
    [1024, 768],
    [1280, 720],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
  ]) {
    for (const aimed of [false, true]) {
      test(`${width}x${height} ${aimed ? "aimed" : "fixed"}: controls fit through all phases`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await clock(page);
        await start(page, aimed);
        const board = page.locator(".playfield");
        const response = page.locator(aimed ? ".input-hint" : ".match-button");
        const check = async () => {
          await fits(board, page);
          for (const hole of await page.locator(".hole").all()) {
            await fits(hole, page);
            const box = (await hole.boundingBox())!;
            const field = (await board.boundingBox())!;
            expect(box.y + box.height).toBeLessThanOrEqual(
              field.y + field.height,
            );
          }
          await fits(response, page);
          await fits(page.getByRole("button", { name: "Stop round" }), page);
          expect(
            await page.evaluate(() => ({
              x: scrollX,
              y: scrollY,
              w: document.documentElement.scrollWidth,
              h: document.documentElement.scrollHeight,
            })),
          ).toEqual({ x: 0, y: 0, w: width, h: height });
        };
        await check();
        const original = await board.boundingBox();
        await page.clock.runFor(3100);
        await expect(board).toHaveAttribute("data-phase", "visible");
        await check();
        const digit = await page.locator(".hole.occupied text").boundingBox();
        await fits(page.locator(".hole.occupied text"), page);
        expect(digit!.height).toBeGreaterThanOrEqual(20);
        const target = await page
          .locator(aimed ? ".hole.occupied" : ".match-button")
          .boundingBox();
        await page.touchscreen.tap(
          target!.x + target!.width / 2,
          target!.y + target!.height / 2,
        );
        await check();
        if (!aimed) await expect(response).toHaveClass(/acknowledged/);
        await page.clock.runFor(2000);
        await expect(board).toHaveAttribute("data-phase", "blank");
        await check();
        expect(await board.boundingBox()).toEqual(original);
        if (!aimed && [320, 390, 844, 1280].includes(width))
          await page.screenshot({
            path: `test-results/improved-${width}x${height}-play.png`,
          });
      });
    }
  }
});

test("small home keeps setup and start visible without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await fits(page.getByRole("button", { name: "Start training" }), page);
  await fits(page.getByLabel("Session length"), page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.locator(".level-options button").nth(2).click();
  await expect(page.locator(".level-options button").nth(2)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".home-heading p")).toContainText("3 turns ago");
  await page.getByRole("button", { name: "Start training" }).click();
  await fits(
    page.getByRole("button", { name: "Start practice", exact: true }),
    page,
  );
  await expect(page.locator(".digit-history .example-digit > span")).toHaveText(
    ["2", "5", "8", "2"],
  );
});

test("navigation remains named and selected at every old breakpoint", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [320, 680, 681, 768, 900, 901]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      page.getByRole("link", { name: "Recall Garden home" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "My garden", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    for (const name of ["My progress", "Settings & data"])
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toBeVisible();
    await expect(
      page
        .getByRole("navigation")
        .getByRole("button", { name: "How to play", exact: true }),
    ).toBeVisible();
  }
});

test("assessment and deletion dialogs return keyboard focus to their openers", async ({
  page,
}) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Explore assessment" });
  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Close assessment" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Begin assessment" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await page.getByRole("button", { name: "Settings & data" }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeFocused();
  const deletion = page.getByRole("button", { name: "Delete local data" });
  await deletion.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Keep my data" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(deletion).toBeFocused();
});

test("material board changes interrupt even when the viewport does not change", async ({
  page,
}) => {
  await clock(page);
  await start(page);
  await page.clock.runFor(3100);
  await page
    .locator(".playfield")
    .evaluate((el) => ((el as HTMLElement).style.width = "60%"));
  await page.clock.runFor(100);
  await expect(
    page.getByRole("heading", { name: "Round stopped" }),
  ).toBeVisible();
  await expect(page.locator(".break-page > p")).toContainText(
    "Playfield size changed",
  );
});

test("returning players still pass practice, with compact continuation and specific retry advice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await clock(page);
  await start(page);
  await page.clock.runFor(3100);
  const digits: number[] = [];
  for (let i = 0; i < 13; i++) {
    const digit = Number(
      await page.locator(".hole.occupied text").textContent(),
    );
    if (i > 0 && digits[i - 1] === digit) await page.keyboard.press("Space");
    digits.push(digit);
    await page.clock.runFor(2750);
  }
  await expect(
    page.getByRole("heading", { name: "Practice passed" }),
  ).toBeVisible();
  await fits(page.getByRole("button", { name: "Start scored round" }), page);
  await expect(page.locator(".break-details")).not.toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Finish for now" }).click();
  await expect(page.getByRole("status")).toContainText("Saved on this device");
  await page.reload();
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.locator(".playfield")).toHaveAttribute(
    "data-phase",
    "countdown",
  );
  await expect(
    page.getByRole("button", { name: "Start scored round" }),
  ).toHaveCount(0);
  await page.clock.runFor(3000 + 13 * 2750 + 100);
  await expect(
    page.getByRole("heading", { name: "Practice needs a retry" }),
  ).toBeVisible();
  await expect(page.locator(".break-page > p")).toContainText(
    "0 of 6 matches caught",
  );
  await fits(page.getByRole("button", { name: "Try practice again" }), page);
});
