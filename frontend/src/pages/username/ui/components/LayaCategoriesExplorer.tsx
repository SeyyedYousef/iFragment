import { type Component, createSignal, For } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { layaT, SEMANTIC_CATEGORIES, USERNAME_I18N } from '@/shared/i18n/laya-i18n.js';
import { haptic } from '@/shared/lib/haptic.js';
import {
	FragHandle,
	FragNftTile,
	FragSectionHeader,
	TonAmount,
} from '@/shared/ui/fragment/FragmentPrimitives.js';

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
		<div class="w-full flex flex-col gap-3 text-start">
			<div class="flex items-baseline justify-between px-0.5">
				<div class="flex flex-col">
					<span class="text-[14px] font-semibold text-white tracking-[-0.01em]">
						{layaT(USERNAME_I18N.categoriesTitle)}
					</span>
					<span class="text-[11px] text-[#8c9ba5] mt-0.5">
						{layaT(USERNAME_I18N.categoriesSubtitle)}
					</span>
				</div>
				<span class="text-[11px] font-mono text-[#60707c]">{t('valuation.layaSystem1')}</span>
			</div>

			{/* Horizontal category switcher */}
			<div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-0.5 px-0.5">
				<For each={SEMANTIC_CATEGORIES}>
					{(cat) => {
						const isSelected = () => cat.id === activeCategory();
						return (
							<button
								type="button"
								onClick={() => handleCategoryClick(cat.id)}
								class={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors shrink-0 border ${
									isSelected()
										? 'bg-[#232d3a] border-white/[0.14] text-white'
										: 'bg-[#141a22] border-white/[0.06] text-[#8c9ba5] hover:text-white'
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

			{/* Active category showcase */}
			<div class="frag-card p-4 flex flex-col gap-3">
				<FragSectionHeader
					title={layaT(currentCat().title)}
					subtitle={layaT(currentCat().resonance)}
					right={
						<span
							class="text-[11px] font-mono font-medium px-2 py-0.5 rounded-[6px] border"
							style={{
								'background-color': `${currentCat().color}15`,
								'border-color': `${currentCat().color}35`,
								color: currentCat().color,
							}}
						>
							{currentCat().badge}
						</span>
					}
				/>

				<div class="frag-inset px-3 py-2 flex items-center justify-between gap-2 text-[12px]">
					<span class="text-[#8c9ba5] shrink-0">{layaT(USERNAME_I18N.targetBuyerPersona)}</span>
					<span class="text-[#ffb340] font-medium truncate text-end">
						{layaT(currentCat().targetPersona)}
					</span>
				</div>

				{/* Curated handles order-book list */}
				<div class="frag-table-container">
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
								class="frag-table-row w-full flex items-center justify-between gap-3 px-3 py-2.5 text-start"
							>
								<div class="flex items-center gap-2.5 min-w-0">
									<FragNftTile
										handle={item.name}
										class="w-9 h-9 shrink-0"
										rounded="rounded-[7px]"
									/>
									<div class="flex flex-col min-w-0 gap-0.5">
										<FragHandle handle={item.name} size="sm" />
										<span class="text-[11px] text-[#60707c] truncate">{item.tag}</span>
									</div>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<TonAmount size="sm" value={`~${item.estTon}`} tone="positive" />
									<span class="material-symbols-outlined text-[16px] text-[#60707c] rtl:rotate-180">
										chevron_right
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
