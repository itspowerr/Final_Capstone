import { loadConfig } from './config/runtime';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

async function bootstrap() {
  try {
    await loadConfig();
  } catch (err) {
    console.error('Failed to load runtime configuration:', err);
    const rootEl = document.getElementById('root');
    rootEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#f7f9fc">
        <div style="text-align:center;padding:40px">
          <div style="font-size:48px;margin-bottom:16px">&#9888;&#65039;</div>
          <h2 style="margin:0 0 8px;color:#101828">Configuration Error</h2>
          <p style="color:#667085;margin:0 0 24px">Unable to load application configuration. Please try refreshing the page.</p>
          <button onclick="location.reload()" style="padding:10px 24px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Refresh Page</button>
        </div>
      </div>
    `;
    return;
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}

bootstrap();
