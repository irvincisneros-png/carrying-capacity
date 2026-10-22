// Carrying Capacity - browser client entry.
import './ui/styles.css';
import './ui/learn.css';
import './ui/rail.css';
import { App } from './ui/app';

const root = document.getElementById('app')!;
const loading = document.getElementById('loading');

function boot(): void {
  try {
    const app = new App(root);
    void app;
  } catch (e) {
    console.error(e);
    root.innerHTML = '<div style="padding:40px;font:18px system-ui;color:#2d241e">Sorry, this computer could not start the 3D view (WebGL2 is needed). Try another browser or update your graphics drivers.</div>';
  }
  if (loading) {
    loading.style.opacity = "0";
    loading.style.pointerEvents = "none";
    setTimeout(() => loading.remove(), 700);
  }
}

// let the loading card paint first
setTimeout(boot, 30);
