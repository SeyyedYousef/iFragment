import { Motion } from '@motionone/solid';
import { Component, createMemo, For, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { ACHIEVEMENT_DEFS, type Achievement } from '@/shared/store/profile.js';

interface Props {
	achievements: Achievement[];
}

export const AchievementPreview: Component<Props> = (props) => {
	const merged = createMemo(() => {
		return ACHIEVEMENT_DEFS.map((def) => {
			const data = props.achievements.find((a) => a.id === def.id);
			return {
				...def,
				target: data?.target ?? 1,
				unlocked: data?.unlocked ?? false,
				progress: data?.progress ?? 0,
				unlockedAt: data?.unlockedAt,
			};
		});
	});

	const unlockedCount = createMemo(() => merged().filter((a) => a.unlocked).length);

	return (
		<Motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.2 }}
			class="mx-6 mt-4 bg-[#1c1c1c] rounded-3xl p-5 border border-[#2a2a2a]"
		>
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-xl bg-[#0f1014] flex items-center justify-center border border-[#2a2a2a]">
						<span
							class="material-symbols-outlined text-[18px] text-[#ffd700]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							military_tech
						</span>
					</div>
					<span class="text-white font-black text-sm">
						{t('profile.achievements') || 'Achievements'}
					</span>
				</div>
				<span class="text-[#a0a4ad] text-xs font-bold">
					{unlockedCount()}/{merged().length}
				</span>
			</div>

			{/* Horizontal scrollable carousel */}
			<div class="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style={{ 'scrollbar-width': 'none' }}>
				<For each={merged()}>
					{(ach) => (
						<div
							class={`flex-shrink-0 w-20 flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${
								ach.unlocked
									? 'bg-white/5 border-[#ffd700]/30'
									: 'bg-[#0f1014] border-[#2a2a2a] opacity-50'
							}`}
						>
							<div class="relative">
								<span class="text-2xl">{ach.icon}</span>
								<Show when={!ach.unlocked}>
									<div class="absolute -bottom-1 -right-1">
										<span class="material-symbols-outlined text-[12px] text-[#a0a4ad]">lock</span>
									</div>
								</Show>
							</div>
							<Show when={!ach.unlocked && ach.target > 1}>
								<div class="w-full h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
									<div
										class="h-full rounded-full bg-[#3390ec]"
										style={{ width: `${Math.min(100, (ach.progress / ach.target) * 100)}%` }}
									/>
								</div>
							</Show>
							<Show when={ach.unlocked}>
								<span
									class="material-symbols-outlined text-[14px] text-[#34c759]"
									style={{ 'font-variation-settings': '"FILL" 1' }}
								>
									check_circle
								</span>
							</Show>
						</div>
					)}
				</For>
			</div>
		</Motion.div>
	);
};
