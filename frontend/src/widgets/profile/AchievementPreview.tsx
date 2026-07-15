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
		<div class="col-span-2 bg-gradient-to-r from-[#1c1c1c] to-[#15161d] rounded-3xl p-5 border border-[#2a2a2a] flex flex-col justify-between">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-xl bg-[#0f1014] flex items-center justify-center border border-[#d4af37]/20">
						<span
							class="material-symbols-outlined text-[20px] text-[#d4af37]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							military_tech
						</span>
					</div>
					<div class="flex flex-col">
						<span class="text-white font-black text-sm">
							{t('profile.achievements') || 'Achievements'}
						</span>
						<span class="text-[#a0a4ad] text-[10px] font-medium">
							{unlockedCount()} of {merged().length} Unlocked
						</span>
					</div>
				</div>
				<span class="material-symbols-outlined text-[#a0a4ad] text-[18px]">chevron_right</span>
			</div>

			{/* Horizontal scrollable carousel */}
			<div class="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
				<For each={merged()}>
					{(ach) => (
						<div
							class={`flex-shrink-0 w-[72px] flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${
								ach.unlocked
									? 'bg-gradient-to-b from-[#2a2a2a] to-[#1c1c1c] border-[#d4af37]/40 shadow-[0_4px_12px_rgba(212,175,55,0.15)]'
									: 'bg-[#0f1014] border-[#2a2a2a] opacity-40'
							}`}
						>
							<div class="relative">
								<span class="text-xl">{ach.icon}</span>
								<Show when={!ach.unlocked}>
									<div class="absolute -bottom-1 -right-1 bg-[#0f1014] rounded-full p-0.5">
										<span class="material-symbols-outlined text-[10px] text-[#a0a4ad]">lock</span>
									</div>
								</Show>
							</div>
							<Show when={!ach.unlocked && ach.target > 1}>
								<div class="w-full h-1 bg-[#2a2a2a] rounded-full overflow-hidden mt-1">
									<div
										class="h-full rounded-full bg-[#a0a4ad]"
										style={{
											width: `${Math.max(20, Math.min(100, (ach.progress / ach.target) * 100))}%`,
										}}
									/>
								</div>
							</Show>
							<Show when={ach.unlocked}>
								<div class="mt-1">
									<span
										class="material-symbols-outlined text-[12px] text-[#d4af37]"
										style={{ 'font-variation-settings': '"FILL" 1' }}
									>
										check_circle
									</span>
								</div>
							</Show>
						</div>
					)}
				</For>
			</div>
		</div>
	);
};
