import { Component, Show, For, createSignal } from 'solid-js';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { t, locale } from '@/shared/i18n/index.js';

const isRtl = () => locale() === 'fa';

// Reusable iOS-style Switch Component
export const ToggleSwitch: Component<{ checked: boolean; onChange: (v: boolean) => void }> = (props) => {
  return (
    <button
      dir="ltr"
      role="switch"
      aria-checked={props.checked}
      aria-label={t('common.toggle')}
      onClick={() => {
        hapticFeedback.impactOccurred('light');
        props.onChange(!props.checked);
      }}
      class={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[#3390ec] focus:ring-offset-2 focus:ring-offset-[#1c1c1c] ${
        props.checked ? 'bg-[#34c759]' : 'bg-[#39393d]'
      }`}
    >
      <span
        class={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${
          props.checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
};

// Reusable Select Field
export const SelectField: Component<{ 
  label: string; 
  value: string; 
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  description?: string;
}> = (props) => {
  const id = `select-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <div class="flex flex-col gap-1.5 w-full">
      <div class="flex items-center justify-between">
        <label for={id} class="text-[15px] font-bold text-white">{props.label}</label>
      </div>
      <div class="relative w-full">
        <select 
          id={id}
          value={props.value}
         
          onChange={(e) => {
            hapticFeedback.selectionChanged();
            props.onChange(e.currentTarget.value);
          }}
          class={`w-full bg-[#2c2c2e] text-white text-[15px] rounded-xl py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-transparent transition-all ${
            isRtl() ? 'pr-4 pl-10 text-right' : 'pl-4 pr-10 text-left'
          }`}
        >
          {props.options.map((opt) => (
            <option value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span class={`material-symbols-outlined absolute top-1/2 -translate-y-1/2 text-[#a0a4ad] pointer-events-none ${
          isRtl() ? 'left-3' : 'right-3'
        }`}>
          expand_more
        </span>
      </div>
      <Show when={props.description}>
        <span class="text-[12px] text-[#a0a4ad] leading-snug px-1">{props.description}</span>
      </Show>
    </div>
  );
};

// Reusable Number Input Field
export const NumberInputField: Component<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}> = (props) => {
  const id = `number-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <div class="flex flex-col gap-1.5 w-full">
      <label for={id} class="text-[15px] font-bold text-white">{props.label}</label>
      <div class="relative w-full">
        <input 
          id={id}
          type="number"
          inputMode="numeric"
          min={props.min}
          max={props.max}
          value={props.value === 0 ? '' : props.value}
          placeholder={props.placeholder || '0'}
         
          onInput={(e) => {
            const val = parseInt(e.currentTarget.value) || 0;
            props.onChange(val);
          }}
          onBlur={() => {
            hapticFeedback.impactOccurred('light');
          }}
          class="w-full bg-[#2c2c2e] text-white text-[15px] rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-transparent transition-all placeholder-[#a0a4ad]"
        />
      </div>
      <Show when={props.description}>
        <span class="text-[12px] text-on-surface-variant leading-snug px-1">{props.description}</span>
      </Show>
    </div>
  );
};

// Reusable String List Field (for tags, usernames, channels, etc.)
export const StringListField: Component<{
  label: string;
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
  placeholder?: string;
  description?: string;
}> = (props) => {
  const [inputValue, setInputValue] = createSignal('');

  const handleAdd = () => {
    const val = inputValue().trim();
    if (val && !props.items.includes(val)) {
      hapticFeedback.impactOccurred('light');
      props.onAdd(val);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const id = `list-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <div class="flex flex-col gap-2 w-full">
      <label for={id} class="text-[15px] font-bold text-white">{props.label}</label>
      
      <div class="flex gap-2">
        <input 
          id={id}
          type="text"
          value={inputValue()}
          onInput={(e) => setInputValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder || 'Type and press enter...'}
         
          class="flex-1 bg-[#2c2c2e] text-white text-[14px] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-transparent transition-all placeholder-on-surface-variant"
        />
        <button 
          onClick={handleAdd}
          disabled={!inputValue().trim()}
          class="w-11 shrink-0 bg-[#3390ec] hover:bg-[#2b7bc9] disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors"
          aria-label="Add item"
        >
          <span class="material-symbols-outlined text-[20px]">add</span>
        </button>
      </div>

      <Show when={props.description}>
        <span class="text-[12px] text-on-surface-variant leading-snug px-1">{props.description}</span>
      </Show>

      <Show when={props.items.length > 0}>
        <div class="flex flex-wrap gap-2 mt-1">
          <For each={props.items}>
            {(item) => (
              <div class="bg-[#2c2c2e] border border-[#3a3a3c] rounded-lg px-3 py-1.5 flex items-center gap-2">
                <span class="text-[13px] text-white">{item}</span>
                <button 
                  onClick={() => {
                    hapticFeedback.impactOccurred('light');
                    props.onRemove(item);
                  }}
                  class="text-on-surface-variant hover:text-[#ff3b30] transition-colors flex items-center justify-center"
                  aria-label="Remove item"
                >
                  <span class="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

// Reusable Inline Button Field (for managing inline keyboard buttons)
export const InlineButtonField: Component<{
  label: string;
  buttons: { id: string; title: string; url: string }[];
  onAdd: (btn: { id: string; title: string; url: string }) => void;
  onRemove: (id: string) => void;
  description?: string;
}> = (props) => {
  const [title, setTitle] = createSignal('');
  const [url, setUrl] = createSignal('');

  const handleAdd = () => {
    const t = title().trim();
    const u = url().trim();
    if (t && u) {
      hapticFeedback.impactOccurred('light');
      props.onAdd({ id: Date.now().toString(), title: t, url: u });
      setTitle('');
      setUrl('');
    }
  };

  return (
    <div class="flex flex-col gap-3 w-full">
      <label class="text-[15px] font-bold text-white">{props.label}</label>
      
      <Show when={props.description}>
        <span class="text-[12px] text-on-surface-variant leading-snug px-1 -mt-1">{props.description}</span>
      </Show>

      <div class="flex flex-col gap-2 bg-[#2c2c2e] p-3 rounded-xl border border-[#3a3a3c]">
        <input 
          type="text"
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
          placeholder="Button Title (e.g. My Channel)"
         
          class="w-full bg-[#1c1c1c] text-white text-[14px] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-transparent transition-all placeholder-on-surface-variant"
        />
        <div class="flex gap-2">
          <input 
            type="url"
            value={url()}
            onInput={(e) => setUrl(e.currentTarget.value)}
            placeholder="URL (e.g. https://t.me/)"
           
            class="flex-1 bg-[#1c1c1c] text-white text-[14px] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-transparent transition-all placeholder-on-surface-variant"
          />
          <button 
            onClick={handleAdd}
            disabled={!title().trim() || !url().trim()}
            class="w-10 shrink-0 bg-[#3390ec] hover:bg-[#2b7bc9] disabled:opacity-50 text-white rounded-lg flex items-center justify-center transition-colors"
            aria-label="Add link"
          >
            <span class="material-symbols-outlined text-[20px]">add</span>
          </button>
        </div>
      </div>

      <Show when={props.buttons.length > 0}>
        <div class="flex flex-col gap-2 mt-1">
          <For each={props.buttons}>
            {(btn) => (
              <div class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-2.5 flex items-center justify-between gap-3 group">
                <div class="flex flex-col min-w-0">
                  <span class="text-[13px] font-bold text-white truncate">{btn.title}</span>
                  <span class="text-[11px] text-[#3390ec] truncate">{btn.url}</span>
                </div>
                <button 
                  onClick={() => {
                    hapticFeedback.impactOccurred('light');
                    props.onRemove(btn.id);
                  }}
                  class="w-8 h-8 rounded-full bg-[#ff3b30]/10 text-[#ff3b30] flex items-center justify-center hover:bg-[#ff3b30]/20 transition-colors shrink-0"
                  aria-label="Remove link"
                >
                  <span class="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

// Reusable Settings Section
export const SettingsSection: Component<{
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  // Active Window
  hasWindow?: boolean;
  windowVal?: string;
  onWindowChange?: (v: string) => void;
  customStart?: string;
  onCustomStart?: (v: string) => void;
  customEnd?: string;
  onCustomEnd?: (v: string) => void;
  // Penalty
  hasPenalty?: boolean;
  penaltyVal?: string;
  onPenaltyChange?: (v: string) => void;
  // Edit Text
  hasEditText?: boolean;
  onEditText?: () => void;
}> = (props) => {
  return (
    <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <div class="flex flex-col flex-1 min-w-0">
          <span class="text-[15px] font-bold text-white">{props.title}</span>
          <span class="text-[12px] text-on-surface-variant leading-snug">{props.description}</span>
        </div>
        <ToggleSwitch checked={props.enabled} onChange={props.onToggle} />
      </div>
      
      <Show when={props.enabled && (props.hasWindow || props.hasPenalty || props.hasEditText)}>
        <div class="h-[1px] bg-[#2a2a2a] w-full my-1"></div>
        
        <Show when={props.hasWindow}>
          <SelectField 
            label={t('generalSettings.activeWindow')}
            value={props.windowVal!}
            onChange={props.onWindowChange!}
            options={[
              { value: 'Always', label: t('generalSettings.optAlways') },
              { value: 'Daytime', label: t('generalSettings.optDaytime') },
              { value: 'Custom', label: t('generalSettings.optCustom') }
            ]}
          />
          <Show when={props.windowVal === 'Custom'}>
            <div class="grid grid-cols-2 gap-3 mt-1">
              <div class="flex flex-col gap-1.5">
                <label class="text-[12px] font-bold text-on-surface-variant">{t('generalSettings.startTime')}</label>
                <input type="time" value={props.customStart} onInput={(e) => props.onCustomStart!(e.currentTarget.value)} class="w-full bg-[#2c2c2e] text-white text-[15px] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3390ec]" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[12px] font-bold text-on-surface-variant">{t('generalSettings.endTime')}</label>
                <input type="time" value={props.customEnd} onInput={(e) => props.onCustomEnd!(e.currentTarget.value)} class="w-full bg-[#2c2c2e] text-white text-[15px] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3390ec]" />
              </div>
            </div>
          </Show>
        </Show>

        <Show when={props.hasPenalty}>
          <div class={props.hasWindow ? "mt-2" : ""}>
            <SelectField 
              label={t('generalSettings.penalty')}
              value={props.penaltyVal!}
              onChange={props.onPenaltyChange!}
              options={[
                { value: 'default', label: t('generalSettings.defaultPenalty') },
                { value: 'delete', label: t('generalSettings.optDelete') },
                { value: 'mute_1h', label: t('generalSettings.optMute1h') },
                { value: 'mute_24h', label: t('generalSettings.optMute24h') },
                { value: 'kick', label: t('generalSettings.optKick') },
                { value: 'ban', label: t('generalSettings.optBan') }
              ]}
            />
          </div>
        </Show>

        <Show when={props.hasEditText}>
          <button 
            class="flex items-center gap-2 text-[#3390ec] text-[13px] font-bold mt-2 pt-1" 
            onClick={() => {
              hapticFeedback.impactOccurred('light');
              props.onEditText?.();
            }}
          >
            <span class="material-symbols-outlined text-[16px]">edit_note</span>
            {t('generalSettings.editText')}
          </button>
        </Show>
      </Show>
    </div>
  );
};
