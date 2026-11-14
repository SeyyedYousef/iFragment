import { type Component, createMemo, For, Show } from 'solid-js';
import { ACHIEVEMENT_DEFS, type Achievement } from '@/entities/user/index.js';
import { t } from '@/shared/i18n/index.js';

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
		<div class="col-span-2 frag-card-elevated rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
			<div class="flex items-center justify-between mb-3.5">
				<div class="flex items-center gap-3">
					<div class="w-9 h-9 rounded-xl bg-[#141a22] flex items-center justify-center border border-[#ffb340]/25">
						<span
							class="material-symbols-outlined text-[20px] text-[#ffb340]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							military_tech
						</span>
					</div>
					<div class="flex flex-col">
						<span class="text-white font-semibold text-sm">
							{t('profile.achievements') || 'Achievements'}
						</span>
						<span class="text-[#8ca0b5] text-[11px] font-medium tabular-nums">
							{unlockedCount()} of {merged().length} unlocked
						</span>
					</div>
				</div>
				<span class="material-symbols-outlined text-[#8ca0b5] text-[18px] rtl:-scale-x-100">
					chevron_right
				</span>
			</div>

			{/* Horizontal scrollable carousel */}
			<div class="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
				<For each={merged()}>
					{(ach) => (
						<div
							class={`flex-shrink-0 w-[72px] flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
								ach.unlocked
									? 'bg-[#232d3a] border-[#ffb340]/35 shadow-[0_6px_16px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]'
									: 'bg-[#141a22] border-white/[0.06] opacity-50'
							}`}
						>
							<div class="relative">
								<span class="text-xl">{ach.icon}</span>
								<Show when={!ach.unlocked}>
									<div class="absolute -bottom-1 -right-1 bg-[#141a22] border border-white/[0.08] rounded-full p-0.5">
										<span class="material-symbols-outlined text-[10px] text-[#8ca0b5]">lock</span>
									</div>
								</Show>
							</div>
							<Show when={!ach.unlocked && ach.target > 1}>
								<div class="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden mt-1">
									<div
										class="h-full rounded-full bg-[#5aaeff]"
										style={{
											width: `${Math.max(20, Math.min(100, (ach.progress / ach.target) * 100))}%`,
										}}
									/>
								</div>
							</Show>
							<Show when={ach.unlocked}>
								<div class="mt-1">
									<span
										class="material-symbols-outlined text-[13px] text-[#ffb340]"
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
