import { test, expect, type Page } from "@playwright/test";
async function installClock(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
}
async function solveDual(page: Page, n: number, scored: number) {
  await page.clock.runFor(3100);
  const holes: number[] = [];
  const digits: number[] = [];
  for (let i = 0; i < n + scored; i++) {
    const mole = page.locator(".playfield .mole-svg");
    await expect(mole).toHaveCount(1);
    const occupied = page.locator(".hole.occupied");
    const hole = Number(await occupied.getAttribute("data-hole"));
    const digit = Number(await occupied.locator("text").textContent());
    if (i >= n) {
      if (holes[i - n] === hole) await page.keyboard.press("a");
      if (digits[i - n] === digit) await page.keyboard.press("l");
    }
    holes.push(hole);
    digits.push(digit);
    await page.clock.runFor(2750);
  }
  await page.clock.runFor(100);
}
test("dual practice prepares, scores two streams, and saves", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Dual memory", exact: true }).click();
  await installClock(page);
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(
    page.getByRole("heading", { name: "How to play Dual" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await expect(page.locator(".playfield")).toHaveAttribute("data-task", "dual");
  await expect(
    page.getByRole("button", { name: "Location match" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Number match" }),
  ).toBeVisible();
  await solveDual(page, 1, 12);
  await expect(page.getByRole("heading", { name: /Practice/ })).toBeVisible();
  await expect(page.getByText(/location matches/i)).toBeVisible();
  expect(errors).toEqual([]);
});
test("dual Location and Number controls fit a 320×568 phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByRole("button", { name: "Dual memory", exact: true }).click();
  await installClock(page);
  await page.getByRole("button", { name: "Start training" }).click();
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  const location = page.getByRole("button", { name: "Location match" });
  const number = page.getByRole("button", { name: "Number match" });
  await expect(page.locator(".playfield")).toHaveAttribute("data-task", "dual");
  await expect(location).toBeVisible();
  await expect(number).toBeVisible();
  const loc = await location.boundingBox();
  const num = await number.boundingBox();
  expect(loc).toBeTruthy();
  expect(num).toBeTruthy();
  expect(loc!.y + loc!.height).toBeLessThanOrEqual(568);
  expect(num!.x + num!.width).toBeLessThanOrEqual(321);
});
