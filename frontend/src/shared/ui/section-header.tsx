import { Component, JSX } from 'solid-js';

interface SectionHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
  gradient: string;
  shadowColor: string;
  children?: JSX.Element;
}

export const SectionHeader: Component<SectionHeaderProps> = (props) => (
  <div class="text-center mb-6">
    <div
      class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3"
      style={{ background: `linear-gradient(to bottom right, ${props.gradient})`, 'box-shadow': `0 8px 24px ${props.shadowColor}` }}
    >
      <span class="material-symbols-outlined text-white text-2xl" style={{ 'font-variation-settings': '"FILL" 1' }}>{props.icon}</span>
    </div>
    <h1 class="text-xl font-black text-white">{props.title}</h1>
    {props.subtitle && <p class="text-on-surface-variant text-xs mt-1 max-w-[260px] mx-auto">{props.subtitle}</p>}
    {props.children}
  </div>
);
