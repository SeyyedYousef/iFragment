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
      class={`w-full h-full transition-opacity duration-200 ease-out motion-reduce:transition-none ${isVisible() ? 'opacity-100' : 'opacity-0'}`}
    >
      {props.children}
    </div>
  );
};
