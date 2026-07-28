export let runtimeConfig = {};

export async function loadConfig() {
  try {
    const res = await fetch('/config.json', {
      cache: 'no-store',
      headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    runtimeConfig = await res.json();
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    console.warn('Config fetch failed (expected in dev):', err.message);
  }
}
