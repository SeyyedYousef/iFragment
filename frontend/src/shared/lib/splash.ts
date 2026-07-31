/**
 * کنترل چرخه عمر Splash Screen.
 * splash در index.html رندر می‌شود (قبل از باندل JS)، اینجا فقط حذفش می‌کنیم.
 */

const MIN_VISIBLE_MS = 650; // جلوگیری از "پرش" وقتی اپ خیلی سریع لود می‌شود
const FADE_MS = 450;        // باید با transition در CSS هماهنگ باشد

let alreadyHidden = false;

export function hideSplash(immediate = false): void {
  if (alreadyHidden) return;
  alreadyHidden = true;

  const el = document.getElementById('app-splash');
  if (!el) return;

  const startedAt: number = (window as unknown as { __SPLASH_START__?: number }).__SPLASH_START__
    ?? Date.now();
  const elapsed = Date.now() - startedAt;
  const delay = immediate ? 0 : Math.max(0, MIN_VISIBLE_MS - elapsed);

  window.setTimeout(() => {
    el.classList.add('splash-hidden');
    // حذف کامل از DOM بعد از پایان انیمیشن تا حافظه و لایه رندر آزاد شود
    window.setTimeout(() => el.remove(), FADE_MS + 60);
  }, delay);
}

/** مدت زمان واقعی بوت اپ — مفید برای ارسال به Sentry به‌عنوان متریک */
export function getBootDuration(): number {
  const startedAt = (window as unknown as { __SPLASH_START__?: number }).__SPLASH_START__;
  return startedAt ? Date.now() - startedAt : 0;
}
