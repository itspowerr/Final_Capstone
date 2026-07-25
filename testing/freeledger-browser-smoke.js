const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = 'http://127.0.0.1:3000';
const API = 'http://127.0.0.1:8000/api';
const outDir = path.resolve(__dirname, 'browser-screenshots');
fs.mkdirSync(outDir, { recursive: true });

const results = [];

async function record(name, type, fn) {
  const started = Date.now();
  try {
    const remarks = await fn();
    results.push({ name, type, status: 'PASS', remarks: remarks || 'Completed as expected.', ms: Date.now() - started });
  } catch (error) {
    results.push({ name, type, status: 'FAIL', remarks: error.message, ms: Date.now() - started });
  }
}

async function makeClientUser() {
  const email = `browser.client.${Date.now()}@example.com`;
  const password = 'Password123!';
  const register = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username: 'Browser Client Tester', role: 'client' }),
  });
  if (!register.ok) throw new Error(`Could not create browser test user: HTTP ${register.status}`);
  return { email, password };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const testUser = await makeClientUser();

  await record('Homepage renders in browser', 'System Testing', async () => {
    const response = await page.goto(`${ROOT}/`, { waitUntil: 'networkidle' });
    if (!response || response.status() !== 200) throw new Error(`Expected HTTP 200, got ${response && response.status()}`);
    await page.getByText('FreeLedger').first().waitFor({ timeout: 5000 });
    await page.screenshot({ path: path.join(outDir, 'homepage-desktop.png'), fullPage: true });
    return 'Root route loaded with HTTP 200 and FreeLedger branding visible.';
  });

  await record('Landing sign-in navigation opens login form', 'System Testing', async () => {
    await page.goto(`${ROOT}/`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await page.waitForURL('**/login', { timeout: 5000 });
    await page.getByPlaceholder('you@example.com').waitFor({ timeout: 5000 });
    return 'Sign-in button changed the client-side route to /login and displayed login inputs.';
  });

  await record('Empty login form displays validation messages', 'System Testing', async () => {
    await page.locator('button[type="submit"]').click();
    await page.getByText('Please enter a valid email.').waitFor({ timeout: 5000 });
    await page.getByText('Password is required.').waitFor({ timeout: 5000 });
    return 'Empty email/password showed configured validation messages.';
  });

  await record('Invalid credentials display API error', 'Integration Testing', async () => {
    await page.getByPlaceholder('you@example.com').fill(testUser.email);
    await page.locator('input[type="password"]').fill('WrongPassword123!');
    await page.locator('button[type="submit"]').click();
    await page.getByText(/invalid/i).waitFor({ timeout: 8000 });
    return 'Login form called backend and displayed invalid credential error.';
  });

  await record('Valid client login redirects to dashboard', 'Integration Testing', async () => {
    await page.getByPlaceholder('you@example.com').fill(testUser.email);
    await page.locator('input[type="password"]').fill(testUser.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/client/dashboard', { timeout: 10000 });
    await page.getByText(/client workspace/i).waitFor({ timeout: 10000 });
    return 'Valid login stored session and redirected to /client/dashboard.';
  });

  await record('Dashboard navigation reaches jobs, contracts, messages, and profile', 'System Testing', async () => {
    await page.getByRole('link', { name: /jobs/i }).click();
    await page.waitForURL('**/client/explore-jobs', { timeout: 5000 });
    await page.getByRole('link', { name: /contracts/i }).click();
    await page.waitForURL('**/client/my-contracts', { timeout: 5000 });
    await page.getByRole('link', { name: /messages/i }).click();
    await page.waitForURL('**/client/messages', { timeout: 5000 });
    await page.locator('.user-chip').click();
    await page.getByRole('button', { name: /^profile$/i }).click();
    await page.waitForURL('**/client/profile', { timeout: 5000 });
    return 'Authenticated client navigation reached Jobs, Contracts, Messages, and Profile routes.';
  });

  await record('Logout returns user to login page', 'System Testing', async () => {
    await page.locator('.user-chip').click();
    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('**/login', { timeout: 5000 });
    return 'Logout menu redirected to /login.';
  });

  await record('Direct browser access to authenticated route loads app shell', 'System Testing', async () => {
    const response = await page.goto(`${ROOT}/client/dashboard`, { waitUntil: 'domcontentloaded' });
    if (!response || response.status() !== 200) throw new Error(`Expected browser HTTP 200 app shell, got ${response && response.status()}`);
    await page.screenshot({ path: path.join(outDir, 'direct-route-browser-200.png'), fullPage: true });
    return 'Direct browser request to /client/dashboard returned the React app shell with HTTP 200.';
  });

  for (const [label, width, height] of [
    ['desktop', 1440, 900],
    ['tablet', 768, 1024],
    ['mobile', 390, 844],
  ]) {
    await record(`Responsive homepage smoke check - ${label}`, 'System Testing', async () => {
      await page.setViewportSize({ width, height });
      const response = await page.goto(`${ROOT}/`, { waitUntil: 'networkidle' });
      if (!response || response.status() !== 200) throw new Error(`Expected HTTP 200, got ${response && response.status()}`);
      await page.getByText('FreeLedger').first().waitFor({ timeout: 5000 });
      await page.screenshot({ path: path.join(outDir, `homepage-${label}.png`), fullPage: true });
      return `${label} viewport rendered homepage and branding.`;
    });
  }

  await browser.close();

  const jsonPath = path.resolve(__dirname, 'freeledger-browser-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  const rows = results.map(r => `<tr><td>${r.name}</td><td>${r.type}</td><td>${r.status}</td><td>${r.remarks}</td><td>${r.ms} ms</td></tr>`).join('\n');
  fs.writeFileSync(path.resolve(__dirname, 'browser-test-report.html'), `<!doctype html><html><body><h1>FreeLedger Browser Smoke Test Report</h1><table border="1" cellspacing="0" cellpadding="6"><thead><tr><th>Scenario</th><th>Type</th><th>Status</th><th>Remarks</th><th>Execution Time</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);

  const failed = results.filter(r => r.status !== 'PASS');
  console.table(results);
  if (failed.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});


