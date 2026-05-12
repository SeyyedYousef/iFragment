import { Component, createSignal, For, onMount } from 'solid-js';
import { Motion } from '@motionone/solid';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Toast: Component<ToastProps> = (props) => {
  onMount(() => {
    const timer = setTimeout(props.onClose, 4000);
    return () => clearTimeout(timer);
  });

  const bgClass = () => {
    switch (props.type) {
      case 'success': return 'bg-[#34c759]';
      case 'error': return 'bg-[#ff3b30]';
      case 'info': return 'bg-[#3390ec]';
      default: return 'bg-[#3390ec]';
    }
  };

  const icon = () => {
    switch (props.type) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'info': return 'info';
      default: return 'info';
    }
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      class={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] px-6 py-3.5 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.4)] flex items-center gap-3 border border-white/10 ${bgClass()}`}
    >
      <span class="material-symbols-outlined text-white text-[20px]">{icon()}</span>
      <span class="text-white text-[14px] font-bold">{props.message}</span>
    </Motion.div>
  );
};

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const [toasts, setToasts] = createSignal<ToastItem[]>([]);

export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const id = Date.now();
  setToasts([...toasts(), { id, message, type }]);
};

export const ToastContainer: Component = () => {
  return (
    <div class="fixed inset-0 pointer-events-none z-[200] flex flex-col items-center justify-end pb-24 gap-3">
      <For each={toasts()}>
        {(toast: ToastItem) => (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToasts(toasts().filter(t => t.id !== toast.id))} 
          />
        )}
      </For>
    </div>
  );
};
