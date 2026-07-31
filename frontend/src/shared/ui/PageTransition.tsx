import { Component, JSX, createSignal, createEffect, onMount } from 'solid-js';
import { useLocation } from '@solidjs/router';

export const PageTransition: Component<{ children: JSX.Element }> = (props) => {
  const location = useLocation();
  const [isVisible, setIsVisible] = createSignal(false);

  createEffect((prev) => {
    if (location.pathname !== prev) {
      setIsVisible(false);
      setTimeout(() => {
        setIsVisible(true);
      }, 20);
    }
    return location.pathname;
  }, undefined);

  onMount(() => {
    setIsVisible(true);
  });

  return (
    <div 
      class={`w-full h-full transition-all duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none ${isVisible() ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      {props.children}
    </div>
  );
};
