import { configDefaults, defineConfig } from 'vitest/config';
// Long scripted playthroughs run 5–7 s on CI runners; give them headroom. Agent worktrees are not this checkout's tests.
export default defineConfig({ test: { testTimeout: 60000, exclude: [...configDefaults.exclude, '.claude/**'] } });
