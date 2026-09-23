import { type Component, createSignal, For } from 'solid-js';
import { layaT, USERNAME_I18N, SEMANTIC_CATEGORIES } from '@/shared/i18n/laya-i18n.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	onSelectHandle: (handle: string) => void;
}

export const LayaCategoriesExplorer: Component<Props> = (props) => {
	const [activeCategory, setActiveCategory] = createSignal<string>('crypto_web3');

	const currentCat = () =>
		SEMANTIC_CATEGORIES.find((c) => c.id === activeCategory()) || SEMANTIC_CATEGORIES[0];

	const handleCategoryClick = (id: string) => {
		try {
			haptic.selection();
		} catch {}
		setActiveCategory(id);
	};

	return (
		<div class="w-full flex flex-col gap-3.5 text-start">
			{/* Header */}
			<div class="flex items-center justify-between px-1">
				<div class="flex items-center gap-2">
					<div class="w-7 h-7 rounded-lg bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center text-[#0098EA]">
						<span class="material-symbols-outlined text-[17px]">psychology</span>
					</div>
					<div class="flex flex-col">
						<span class="text-[12px] font-mono font-black text-white uppercase tracking-wider">
							{layaT(USERNAME_I18N.categoriesTitle)}
						</span>
						<span class="text-[9px] font-mono text-white/40">
							{layaT(USERNAME_I18N.categoriesSubtitle)}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-[#0098EA] bg-[#0098EA]/10 border border-[#0098EA]/30 px-2 py-0.5 rounded-md">
					SYSTEM 1
				</span>
			</div>

			{/* Horizontal Scrolling Pill Tabs */}
			<div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
				<For each={SEMANTIC_CATEGORIES}>
					{(cat) => {
						const isSelected = () => cat.id === activeCategory();
						return (
							<button
								type="button"
								onClick={() => handleCategoryClick(cat.id)}
								class={`px-3 py-1.5 rounded-[14px] text-[11px] font-mono font-bold whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 active:scale-95 border ${
									isSelected()
										? 'bg-[#0098EA]/20 border-[#0098EA]/60 text-white shadow-[0_0_15px_rgba(0,152,234,0.3)]'
										: 'bg-[#12141C]/80 border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5'
								}`}
							>
								<span
									class="material-symbols-outlined text-[15px]"
									style={{ color: isSelected() ? cat.color : undefined }}
								>
									{cat.icon}
								</span>
								<span>{layaT(cat.title)}</span>
							</button>
						);
					}}
				</For>
			</div>

			{/* Active Category Detail Card */}
			<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[24px] p-4 flex flex-col gap-3 shadow-xl relative overflow-hidden">
				<div
					class="absolute -right-12 -top-12 w-32 h-32 blur-3xl rounded-full pointer-events-none opacity-20"
					style={{ background: currentCat().color }}
				/>

				{/* Category Overview */}
				<div class="flex items-start justify-between gap-2 border-b border-white/5 pb-2.5">
					<div class="flex flex-col">
						<div class="flex items-center gap-2">
							<span class="text-[13px] font-black text-white font-mono">
								{layaT(currentCat().title)}
							</span>
							<span
								class="text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded-[6px] border"
								style={{
									'background-color': `${currentCat().color}15`,
									'border-color': `${currentCat().color}40`,
									color: currentCat().color,
								}}
							>
								{currentCat().badge}
							</span>
						</div>
						<p class="text-[10px] text-white/60 mt-1 leading-relaxed">
							{layaT(currentCat().resonance)}
						</p>
					</div>
				</div>

				{/* Persona Fit Pill */}
				<div class="flex items-center justify-between text-[10px] font-mono bg-[#08090D] border border-white/5 rounded-[12px] px-3 py-2">
					<span class="text-white/40">
						{layaT(USERNAME_I18N.targetBuyerPersona)}
					</span>
					<span class="text-amber-400 font-bold truncate max-w-[60%]">
						{layaT(currentCat().targetPersona)}
					</span>
				</div>

				{/* Handles Grid */}
				<div class="grid grid-cols-2 gap-2 pt-1">
					<For each={currentCat().handles}>
						{(item) => (
							<button
								type="button"
								onClick={() => {
									try {
										haptic.impact('light');
									} catch {}
									props.onSelectHandle(item.name);
								}}
								class="p-2.5 rounded-[16px] bg-[#08090D] hover:bg-[#0098EA]/10 border border-white/5 hover:border-[#0098EA]/40 text-start flex flex-col gap-1 transition-all active:scale-[0.97] group cursor-pointer"
							>
								<div class="flex items-center justify-between w-full">
									<span class="text-white font-mono font-black text-[13px] group-hover:text-[#0098EA] transition-colors" dir="ltr">
										@{item.name}
									</span>
									<span class="text-[8px] font-mono text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
										{item.tag}
									</span>
								</div>
								<div class="flex items-center justify-between w-full text-[10px] font-mono">
									<span class="text-emerald-400 font-bold">~{item.estTon} TON</span>
									<span class="text-white/30 text-[9px] group-hover:text-[#0098EA] transition-colors">
										{layaT(USERNAME_I18N.valuateCta)}
									</span>
								</div>
							</button>
						)}
					</For>
				</div>
			</div>
		</div>
	);
};
