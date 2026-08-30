import { test, expect, type Page } from '@playwright/test';

const NAMES = ['Alice', 'Bob', 'Carol', 'Dave'];

// Discards the first hand tile if it's this page's turn, or passes on any
// claim prompt. Returns whether an action was taken.
async function actIfPossible(page: Page): Promise<boolean> {
  const passBtn = page.locator('.claim-bar .pass');
  if (await passBtn.isVisible()) {
    await passBtn.click();
    return true;
  }

  const turnText = await page.locator('.info-turn').innerText().catch(() => '');
  if (turnText.includes('Your turn')) {
    const tile = page.locator('.seat--bottom .hand-row .tile--clickable').first();
    if (await tile.count() > 0) {
      await tile.click();
      await tile.click();
      return true;
    }
  }

  return false;
}

async function allEnded(pages: Page[]): Promise<boolean> {
  for (const page of pages) {
    if (!(await page.locator('.overlay .score-table').isVisible().catch(() => false))) return false;
  }
  return true;
}

test('four players play a hand through to an end state', async ({ browser }) => {
  test.setTimeout(90_000);

  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  const [host, ...joiners] = pages;

  await host.goto('/');
  const createForm = host.locator('form', { hasText: 'Create a room' });
  await createForm.getByLabel('Name').fill(NAMES[0]);
  await createForm.getByLabel('Length').selectOption('hand');
  await createForm.getByLabel('Minimum faan').fill('0');
  await createForm.getByRole('button', { name: 'Create' }).click();

  await expect(host.locator('.room-code')).toBeVisible();
  const code = (await host.locator('.room-code').innerText()).trim();

  for (const [i, page] of joiners.entries()) {
    await page.goto(`/r/${code}`);
    const joinForm = page.locator('form', { hasText: 'Join a room' });
    await joinForm.getByLabel('Name').fill(NAMES[i + 1]);
    await joinForm.getByRole('button', { name: 'Join' }).click();
    await expect(page.locator('.room-code')).toHaveText(code);
  }

  const startBtn = host.getByRole('button', { name: 'Start' });
  await expect(startBtn).toBeEnabled();
  await startBtn.click();
  await expect(host.locator('.table')).toBeVisible();

  let finished = false;
  for (let i = 0; i < 400 && !finished; i++) {
    const acted = await Promise.all(pages.map(actIfPossible));
    finished = await allEnded(pages);
    if (!acted.some(Boolean) && !finished) await pages[0].waitForTimeout(50);
  }

  expect(finished).toBe(true);
  for (const page of pages) {
    await expect(page.locator('.slip-title')).toHaveText(/wins|Nobody won|Draw/);
  }
});
