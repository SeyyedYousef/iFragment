import { hapticFeedback } from '@tma.js/sdk-solid';
import { type Component, createSignal, For, Show } from 'solid-js';
import { locale, t } from '@/shared/i18n/index.js';

const isRtl = () => locale() === 'fa';

// Reusable Fragment-styled iOS Switch Component
export const ToggleSwitch: Component<{ checked: boolean; onChange: (v: boolean) => void }> = (
	props,
) => {
	return (
		<button
			type="button"
			dir="ltr"
			role="switch"
			aria-checked={props.checked}
			aria-label={t('common.toggle')}
			onClick={() => {
				hapticFeedback.impactOccurred('light');
				props.onChange(!props.checked);
			}}
			class={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#2990ff] focus:ring-offset-2 focus:ring-offset-[#141a22] ${
				props.checked ? 'bg-[#4cd964] border-[#4cd964]/40' : 'bg-[#232d3a] border-white/[0.1]'
			}`}
		>
			<span
				class={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
					props.checked ? 'translate-x-[21px]' : 'translate-x-[1px]'
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
				<label for={id} class="text-[13.5px] font-semibold text-white">
					{props.label}
				</label>
			</div>
			<div class="relative w-full">
				<select
					id={id}
					value={props.value}
					onChange={(e) => {
						hapticFeedback.selectionChanged();
						props.onChange(e.currentTarget.value);
					}}
					class={`w-full bg-[#141a22] text-white text-[14px] font-medium rounded-[10px] py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-[#2990ff]/50 focus:border-[#2990ff] border border-white/[0.08] transition-all ${
						isRtl() ? 'pr-3.5 pl-10 text-right' : 'pl-3.5 pr-10 text-left'
					}`}
				>
					<For each={props.options}>{(opt) => <option value={opt.value}>{opt.label}</option>}</For>
				</select>
				<span
					class={`material-symbols-outlined absolute top-1/2 -translate-y-1/2 text-[#8c9ba5] pointer-events-none text-[18px] ${
						isRtl() ? 'left-3' : 'right-3'
					}`}
				>
					expand_more
				</span>
			</div>
			<Show when={props.description}>
				<span class="text-[11.5px] text-[#8c9ba5] leading-snug px-0.5">{props.description}</span>
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
			<label for={id} class="text-[13.5px] font-semibold text-white">
				{props.label}
			</label>
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
						const val = parseInt(e.currentTarget.value, 10) || 0;
						props.onChange(val);
					}}
					onBlur={() => {
						hapticFeedback.impactOccurred('light');
					}}
					class="w-full bg-[#141a22] text-white font-mono tabular-nums text-[14px] rounded-[10px] py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-[#2990ff]/50 focus:border-[#2990ff] border border-white/[0.08] transition-all placeholder-[#60707c]"
				/>
			</div>
			<Show when={props.description}>
				<span class="text-[11.5px] text-[#8c9ba5] leading-snug px-0.5">{props.description}</span>
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
			<label for={id} class="text-[13.5px] font-semibold text-white">
				{props.label}
			</label>

			<div class="flex gap-2">
				<input
					id={id}
					type="text"
					value={inputValue()}
					onInput={(e) => setInputValue(e.currentTarget.value)}
					onKeyDown={handleKeyDown}
					placeholder={props.placeholder || 'Type and press enter...'}
					class="flex-1 bg-[#141a22] text-white text-[13.5px] rounded-[10px] px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2990ff]/50 focus:border-[#2990ff] border border-white/[0.08] transition-all placeholder-[#60707c]"
				/>
				<button
					type="button"
					onClick={handleAdd}
					disabled={!inputValue().trim()}
					class="w-10 shrink-0 frag-btn-primary disabled:opacity-45 rounded-[10px] flex items-center justify-center"
					aria-label={t('settingsControls.addItem')}
				>
					<span class="material-symbols-outlined text-[19px]">add</span>
				</button>
			</div>

			<Show when={props.description}>
				<span class="text-[11.5px] text-[#8c9ba5] leading-snug px-0.5">{props.description}</span>
			</Show>

			<Show when={props.items.length > 0}>
				<div class="flex flex-wrap gap-1.5 mt-0.5">
					<For each={props.items}>
						{(item) => (
							<div class="frag-inset rounded-[8px] px-2.5 py-1 flex items-center gap-1.5">
								<span class="text-[12.5px] font-medium text-white">{item}</span>
								<button
									type="button"
									onClick={() => {
										hapticFeedback.impactOccurred('light');
										props.onRemove(item);
									}}
									class="text-[#8c9ba5] hover:text-[#ff5c6c] transition-colors flex items-center justify-center"
									aria-label={t('settingsControls.removeItem')}
								>
									<span class="material-symbols-outlined text-[15px]">close</span>
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
		const btnTitle = title().trim();
		const btnUrl = url().trim();
		if (btnTitle && btnUrl) {
			hapticFeedback.impactOccurred('light');
			props.onAdd({ id: Date.now().toString(), title: btnTitle, url: btnUrl });
			setTitle('');
			setUrl('');
		}
	};

	return (
		<div class="flex flex-col gap-2.5 w-full">
			<div class="text-[13.5px] font-semibold text-white">{props.label}</div>

			<Show when={props.description}>
				<span class="text-[11.5px] text-[#8c9ba5] leading-snug px-0.5 -mt-1">
					{props.description}
				</span>
			</Show>

			<div class="flex flex-col gap-2 frag-inset p-3 rounded-[12px]">
				<input
					type="text"
					value={title()}
					onInput={(e) => setTitle(e.currentTarget.value)}
					placeholder="Button Title (e.g. My Channel)"
					class="w-full bg-[#11161d] text-white text-[13.5px] rounded-[9px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2990ff]/50 focus:border-[#2990ff] border border-white/[0.08] transition-all placeholder-[#60707c]"
				/>
				<div class="flex gap-2">
					<input
						type="url"
						value={url()}
						onInput={(e) => setUrl(e.currentTarget.value)}
						placeholder="URL (e.g. https://t.me/)"
						class="flex-1 bg-[#11161d] text-white font-mono text-[13px] rounded-[9px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2990ff]/50 focus:border-[#2990ff] border border-white/[0.08] transition-all placeholder-[#60707c]"
					/>
					<button
						type="button"
						onClick={handleAdd}
						disabled={!title().trim() || !url().trim()}
						class="w-10 shrink-0 frag-btn-primary disabled:opacity-45 rounded-[9px] flex items-center justify-center"
						aria-label={t('settingsControls.addLink')}
					>
						<span class="material-symbols-outlined text-[19px]">add</span>
					</button>
				</div>
			</div>

			<Show when={props.buttons.length > 0}>
				<div class="flex flex-col gap-1.5 mt-0.5">
					<For each={props.buttons}>
						{(btn) => (
							<div class="frag-inset rounded-[10px] p-2.5 flex items-center justify-between gap-3 group">
								<div class="flex flex-col min-w-0">
									<span class="text-[13px] font-semibold text-white truncate">{btn.title}</span>
									<span class="text-[11px] font-mono text-[#2990ff] truncate">{btn.url}</span>
								</div>
								<button
									type="button"
									onClick={() => {
										hapticFeedback.impactOccurred('light');
										props.onRemove(btn.id);
									}}
									class="w-8 h-8 rounded-[8px] bg-[#ff5c6c]/10 border border-[#ff5c6c]/20 text-[#ff5c6c] flex items-center justify-center hover:bg-[#ff5c6c]/20 transition-colors shrink-0"
									aria-label={t('settingsControls.removeLink')}
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
		<div class="frag-card rounded-[14px] p-4 flex flex-col gap-3">
			<div class="flex items-center justify-between gap-3">
				<div class="flex flex-col flex-1 min-w-0">
					<span class="text-[14px] font-semibold text-white">{props.title}</span>
					<span class="text-[12px] text-[#8c9ba5] leading-snug mt-0.5">{props.description}</span>
				</div>
				<ToggleSwitch checked={props.enabled} onChange={props.onToggle} />
			</div>

			<Show when={props.enabled && (props.hasWindow || props.hasPenalty || props.hasEditText)}>
				<div class="h-px bg-white/[0.06] w-full my-0.5" />

				<Show when={props.hasWindow}>
					<SelectField
						label={t('generalSettings.activeWindow')}
						value={props.windowVal!}
						onChange={props.onWindowChange!}
						options={[
							{ value: 'Always', label: t('generalSettings.optAlways') },
							{ value: 'Daytime', label: t('generalSettings.optDaytime') },
							{ value: 'Custom', label: t('generalSettings.optCustom') },
						]}
					/>
					<Show when={props.windowVal === 'Custom'}>
						<div class="grid grid-cols-2 gap-2.5 mt-1">
							<div class="flex flex-col gap-1">
								<div class="text-[11.5px] font-medium text-[#8c9ba5]">
									{t('generalSettings.startTime')}
								</div>
								<input
									type="time"
									value={props.customStart}
									onInput={(e) => props.onCustomStart!(e.currentTarget.value)}
									class="w-full bg-[#141a22] text-white font-mono text-[14px] rounded-[10px] border border-white/[0.08] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2990ff]/50 focus:border-[#2990ff]"
								/>
							</div>
							<div class="flex flex-col gap-1">
								<div class="text-[11.5px] font-medium text-[#8c9ba5]">
									{t('generalSettings.endTime')}
								</div>
								<input
									type="time"
									value={props.customEnd}
									onInput={(e) => props.onCustomEnd!(e.currentTarget.value)}
									class="w-full bg-[#141a22] text-white font-mono text-[14px] rounded-[10px] border border-white/[0.08] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2990ff]/50 focus:border-[#2990ff]"
								/>
							</div>
						</div>
					</Show>
				</Show>

				<Show when={props.hasPenalty}>
					<div class={props.hasWindow ? 'mt-1' : ''}>
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
								{ value: 'ban', label: t('generalSettings.optBan') },
							]}
						/>
					</div>
				</Show>

				<Show when={props.hasEditText}>
					<button
						type="button"
						class="inline-flex items-center gap-1.5 text-[#2990ff] hover:text-[#4aa3ff] text-[13px] font-semibold mt-1 pt-1 self-start"
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
