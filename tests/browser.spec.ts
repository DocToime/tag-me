import { test, expect, type Page } from "@playwright/test";
async function installClock(page: Page) {
  await page.clock.install();
  // Only runFor advances trial time. DOM assertions and automation round-trips
  // must not introduce simulated long frames or shift the solver's schedule.
  await page.clock.pauseAt(new Date(Date.now() + 1000));
}
async function tutorial(page: Page) {
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
}
async function solve(page: Page, n: number, scored: number) {
  await page.clock.runFor(3100);
  const digits: number[] = [];
  for (let i = 0; i < n + scored; i++) {
    const mole = page.locator(".playfield .mole-svg");
    await expect(mole).toHaveCount(1);
    const digit = Number(await mole.locator("text").textContent());
    if (i >= n && digits[i - n] === digit) await page.keyboard.press("Space");
    digits.push(digit);
    await page.clock.runFor(2750);
  }
  await page.clock.runFor(100);
}
test("dashboard, responsive layout, tutorial and preferences", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start training" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Settings & data" }).click();
  await expect(
    page.getByRole("button", { name: "Match device", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByLabel("Time with each number").selectOption("3000");
  await page.getByRole("switch", { name: "Sound cues" }).click();
  await page.reload();
  await page.screenshot({
    path: "test-results/dashboard-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Settings & data" }).click();
  await expect(page.getByLabel("Time with each number")).toHaveValue("3000");
  await expect(
    page.getByRole("switch", { name: "Sound cues" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() => document.documentElement.dataset.theme),
  ).toBe("dark");
  await page.screenshot({
    path: "test-results/settings-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await page.getByRole("button", { name: "Settings & data" }).click();
  await expect(
    page.getByRole("button", { name: "Light", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() => document.documentElement.dataset.theme),
  ).toBe("light");
  await page.getByRole("button", { name: "Match device", exact: true }).click();
  expect(
    await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    ),
  ).toBeNull();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(async () =>
      page.evaluate(
        () => getComputedStyle(document.documentElement).backgroundColor,
      ),
    )
    .toBe("rgb(18, 26, 22)");
  await page.emulateMedia({ colorScheme: "light" });
  await expect
    .poll(async () =>
      page.evaluate(
        () => getComputedStyle(document.documentElement).backgroundColor,
      ),
    )
    .toBe("rgb(250, 251, 247)");
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await page.getByRole("button", { name: "Increase memory level" }).click();
  await page.getByRole("button", { name: "Increase memory level" }).click();
  await expect(page.locator(".digit-history .example-digit > span")).toHaveText(
    ["2", "5", "8", "2"],
  );
  await page.getByRole("button", { name: /^Match/ }).click();
  await expect(page.getByText("Correct — these numbers match.")).toBeVisible();
  await page.getByRole("button", { name: "My garden", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("completes practice and a training block, persists and exports results", async ({
  page,
}) => {
  await installClock(page);
  await page.goto("/");
  await page.getByLabel("Session length").selectOption("1");
  await page.getByRole("button", { name: "Start training" }).click();
  await tutorial(page);
  await solve(page, 1, 12);
  await expect(
    page.getByRole("heading", { name: "Practice passed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start scored round" }).click();
  await page.clock.runFor(3100);
  await page.screenshot({
    path: "test-results/gameplay-desktop.png",
    fullPage: true,
  });
  await page.clock.runFor(1000);
  await page.getByRole("button", { name: "Stop round" }).click();
  await expect(
    page.getByRole("heading", { name: "Round stopped" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restart round" }).click();
  await solve(page, 1, 60);
  await expect(
    page.getByRole("heading", { name: "Session complete" }),
  ).toBeVisible();
  await expect(page.getByText("18 of 18 targets caught")).toBeVisible();
  await expect(page.locator(".block-result").first()).toContainText(
    "18 of 18 targets caught",
  );
  await expect(page.locator(".interrupted-details")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.screenshot({
    path: "test-results/results-desktop.png",
    fullPage: true,
  });
  await expect(page.getByRole("status")).toContainText("Saved on this device");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export session" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("recall-garden-sessions.json");
  await page.reload();
  await page.getByRole("button", { name: "My progress", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Memory training/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/progress-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Memory training/ }).click();
  await expect(page.getByText("18 of 18 targets caught")).toBeVisible();
});
test("silent practice fails, tab loss interrupts and reload recovers session", async ({
  page,
}) => {
  await installClock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Start training" }).click();
  await tutorial(page);
  await page.clock.runFor(3000 + 13 * 2750 + 100);
  await expect(
    page.getByRole("heading", { name: "Practice needs a retry" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start scored round" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Try practice again" }).click();
  await page.clock.runFor(3100);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator(".break-page > p")).toContainText(
    "Window lost focus",
  );
  await expect(page.getByRole("status")).toContainText("Saved on this device");
  await page.reload();
  await page.getByRole("button", { name: "My progress", exact: true }).click();
  await page.getByRole("button", { name: /Memory training/ }).click();
  await expect(page.getByText(/The page closed or reloaded/)).toBeVisible();
});
test("assessment freezes settings and deletion clears local history", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore assessment" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Begin assessment" }).click();
  await page.getByRole("button", { name: "Finish for now" }).click();
  await page.getByRole("button", { name: "Settings & data" }).click();
  await page.getByRole("button", { name: "Delete local data" }).click();
  await expect(page.getByRole("dialog")).toContainText("all 1 sessions");
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.getByRole("button", { name: "My progress", exact: true }).click();
  await expect(page.getByText("0 sessions", { exact: true })).toBeVisible();
});

test("aimed mobile practice supports pointer and mapped keys; Space can stop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installClock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Settings & data" }).click();
  await page.getByLabel("Response style").selectOption("aimed");
  await page.getByRole("button", { name: "My garden", exact: true }).click();
  await page.getByRole("button", { name: "Start training" }).click();
  await tutorial(page);
  await page.clock.runFor(3100);
  const digits: number[] = [];
  for (let i = 0; i < 13; i++) {
    const active = page.locator(".hole.occupied");
    const digit = Number(await active.locator("text").textContent());
    if (i >= 1 && digits[i - 1] === digit) {
      if (i % 2) await active.click();
      else {
        const name = await active.getAttribute("aria-label");
        await page.keyboard.press(name!.slice(-1).toLowerCase());
      }
    }
    digits.push(digit);
    if (i === 3)
      await page.screenshot({
        path: "test-results/gameplay-mobile.png",
        fullPage: true,
      });
    await page.clock.runFor(2750);
  }
  await expect(
    page.getByRole("heading", { name: "Practice passed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start scored round" }).click();
  await page.clock.runFor(3100);
  await page.getByRole("button", { name: "Stop round" }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("heading", { name: "Round stopped" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("storage failure stays visible and in-memory results can still be exported", async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = function () {
      throw new Error("Simulated storage unavailable");
    };
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Storage unavailable");
  await page.getByRole("button", { name: "Start training" }).click();
  await page.getByRole("button", { name: "Finish for now" }).click();
  await expect(page.getByRole("status")).toContainText("Save failed");
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export session" }).click();
  expect((await promise).suggestedFilename()).toBe(
    "recall-garden-sessions.json",
  );
});

test("two strong rounds adapt N and require new-level practice", async ({
  page,
}) => {
  test.setTimeout(180000);
  await installClock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Start training" }).click();
  await tutorial(page);
  await solve(page, 1, 12);
  await page.getByRole("button", { name: "Start scored round" }).click();
  await solve(page, 1, 60);
  await page.getByRole("button", { name: "Continue · 1-back" }).click();
  await solve(page, 1, 60);
  await expect(
    page.getByText("Two strong rounds. Ready for the next level."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue · 2-back" }).click();
  await expect(page.getByText("2 turns ago", { exact: true })).toBeVisible();
  await tutorial(page);
  await solve(page, 2, 12);
  await expect(
    page.getByRole("heading", { name: "Practice passed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Finish for now" }).click();
  await page.getByRole("button", { name: "Back to my garden" }).click();
  await expect(page.locator(".level-options .chosen")).toContainText("2-back");
});

test("assessment battery keeps feedback neutral and advances through all N levels", async ({
  page,
}) => {
  test.setTimeout(240000);
  await installClock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Explore assessment" }).click();
  await page.getByRole("button", { name: "Begin assessment" }).click();
  for (const n of [1, 2, 3]) {
    await tutorial(page);
    await solve(page, n, 12);
    await page.getByRole("button", { name: "Start scored round" }).click();
    await page.clock.runFor(3100 + n * 2750);
    await page.keyboard.press("Space");
    await page.clock.runFor(2000);
    await expect(page.locator(".feedback")).not.toContainText(
      /Correct|No match|Missed match/,
    );
    // Start the scored attempt afresh after the feedback check.
    await page.getByRole("button", { name: "Stop round" }).click();
    await page.getByRole("button", { name: "Restart round" }).click();
    await solve(page, n, 60);
    if (n < 3)
      await page
        .getByRole("button", { name: `Continue · ${n + 1}-back` })
        .click();
  }
  await expect(
    page.getByRole("heading", { name: "Session complete" }),
  ).toBeVisible();
  await expect(page.getByText("18 of 18 targets caught")).toHaveCount(3);
});

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  try {
    const records = await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("recall-garden-v1", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return new Promise((resolve, reject) => {
        const request = database
          .transaction("sessions")
          .objectStore("sessions")
          .getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
    await info.attach("session-diagnostics", {
      body: JSON.stringify(records, null, 2),
      contentType: "application/json",
    });
  } catch {
    /* A storage-failure test intentionally prevents this attachment. */
  }
});

test("real-clock play keeps a responded-to digit visible and keyboard stop works", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start training" }).click();
  await tutorial(page);
  await expect(page.locator(".playfield")).toHaveAttribute(
    "data-phase",
    "visible",
    { timeout: 6000 },
  );
  const digit = await page.locator(".playfield .mole-svg text").textContent();
  await page.locator(".hole.occupied").click({ force: true });
  await page.keyboard.press("Space");
  await expect(page.locator(".match-button")).toHaveClass(/acknowledged/);
  await expect(page.locator(".playfield .mole-svg text")).toHaveText(digit!);
  await page.getByRole("button", { name: "Stop round" }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("heading", { name: "Round stopped" }),
  ).toBeVisible();
});
