const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = 'http://127.0.0.1:3000';
const API = 'http://127.0.0.1:8000/api';
const outDir = path.resolve(__dirname, 'browser-screenshots');
fs.mkdirSync(outDir, { recursive: true });

async function apiPost(url, body, token) {
  const res = await fetch(`${API}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${url} failed with HTTP ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function register(email, role) {
  return apiPost('/auth/register', {
    email,
    password: 'Password123!',
    username: `${role} E2E Tester`,
    role,
  });
}

async function main() {
  const stamp = Date.now();
  const clientEmail = `e2e.client.${stamp}@example.com`;
  const freelancerEmail = `e2e.freelancer.${stamp}@example.com`;
  const jobTitle = `E2E Proposal Test Job ${stamp}`;
  const result = {
    name: 'Freelancer workflow: login, browse jobs, open details, submit proposal, receive confirmation',
    type: 'End-to-End Testing',
    status: 'FAIL',
    remarks: '',
    ms: 0,
  };
  const started = Date.now();

  try {
    const client = await register(clientEmail, 'client');
    await register(freelancerEmail, 'freelancer');
    await apiPost('/jobs', {
      title: jobTitle,
      description: 'Temporary automated E2E job used for FreeLedger frontend testing.',
      budget: 3,
      category: 'Development',
      skills: ['React', 'Testing'],
      duration_days: 5,
      milestones: [{ title: 'Frontend test milestone', amount: 3 }],
    }, client.access_token);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${ROOT}/`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await page.getByPlaceholder('you@example.com').fill(freelancerEmail);
    await page.locator('input[type="password"]').fill('Password123!');
    await page.getByText('Freelancer').click();
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/freelancer/dashboard', { timeout: 10000 });
    await page.getByRole('link', { name: /find jobs/i }).click();
    await page.waitForURL('**/freelancer/jobs', { timeout: 5000 });
    await page.getByPlaceholder(/search title/i).fill(jobTitle);
    await page.getByText(jobTitle).first().click();
    await page.getByPlaceholder(/short cover letter/i).fill('I can complete this frontend testing task with clear reporting.');
    await page.getByPlaceholder(/bid amount/i).fill('2.5');
    await page.getByPlaceholder(/est\. days/i).fill('4');
    await page.getByRole('button', { name: /apply now/i }).click();
    await page.getByText(/application submitted/i).waitFor({ timeout: 10000 });
    await page.screenshot({ path: path.join(outDir, 'freelancer-e2e-proposal-confirmation.png'), fullPage: true });
    await browser.close();

    result.status = 'PASS';
    result.remarks = 'Freelancer logged in, browsed jobs, opened created job details, submitted proposal, and saw confirmation.';
  } catch (error) {
    result.remarks = error.message;
  } finally {
    result.ms = Date.now() - started;
    fs.writeFileSync(path.resolve(__dirname, 'freeledger-freelancer-e2e-result.json'), JSON.stringify(result, null, 2));
    console.table([result]);
    if (result.status !== 'PASS') process.exitCode = 1;
  }
}

main();
