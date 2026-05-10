import { Component, Show } from 'solid-js';

interface Props {
  isLoading: boolean;
  message?: string;
}

export const GlobalLoading: Component<Props> = (props) => {
  return (
    <Show when={props.isLoading}>
      <div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm">
        <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <Show when={props.message}>
          <p class="mt-4 text-white font-medium">{props.message}</p>
        </Show>
      </div>
    </Show>
  );
};
