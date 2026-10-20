import { defineConfig } from 'vitest/config';
// Long scripted playthroughs run 5–7 s on CI runners; give them headroom.
export default defineConfig({ test: { testTimeout: 60000 } });
