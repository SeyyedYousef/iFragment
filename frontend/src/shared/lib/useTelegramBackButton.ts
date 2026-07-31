import { backButton } from '@tma.js/sdk-solid';
import { onMount, onCleanup } from 'solid-js';
import { useNavigate } from '@solidjs/router';

export function useTelegramBackButton(target?: string | number): void {
  const navigate = useNavigate();

  onMount(() => {
    try {
      backButton.show();
      const handler = () => {
        if (typeof target === 'string') {
          navigate(target);
        } else if (typeof target === 'number') {
          navigate(target);
        } else {
          navigate(-1);
        }
      };
      backButton.onClick(handler);
      onCleanup(() => {
        backButton.offClick(handler);
        backButton.hide();
      });
    } catch (e) {
      console.warn('Telegram backButton is not available', e);
    }
  });
}
