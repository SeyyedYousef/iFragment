import { Component, For, Show, createSignal, createMemo } from 'solid-js';
import { ClanRow } from './ClanRow.js';
import { useGlobalClans } from '@/shared/store/clans.js';

export const ClanLeaderboard: Component = () => {
	const clansQuery = useGlobalClans();
	const [currentPage, setCurrentPage] = createSignal(1);
	const itemsPerPage = 20;

	const paginatedClans = createMemo(() => {
		const clans = clansQuery.data || [];
		const startIndex = (currentPage() - 1) * itemsPerPage;
		return clans.slice(startIndex, startIndex + itemsPerPage);
	});

	const totalPages = createMemo(() => {
		const clans = clansQuery.data || [];
		return Math.ceil(clans.length / itemsPerPage);
	});

	return (
		<div class="relative w-full max-w-2xl mx-auto px-4 pb-24 z-20">
			<Show 
				when={!clansQuery.isLoading} 
				fallback={
					<div class="w-full flex justify-center py-12">
						<div class="w-8 h-8 border-4 border-[#0088cc] border-t-transparent rounded-full animate-spin"></div>
					</div>
				}
			>
				<div class="flex flex-col animate-fade-in">
					<For each={paginatedClans()}>
						{(clan, index) => (
							<ClanRow 
								clan={clan} 
								rank={(currentPage() - 1) * itemsPerPage + index() + 1} 
							/>
						)}
					</For>

					{/* Pagination Controls */}
					<Show when={totalPages() > 1}>
						<div class="flex items-center justify-center gap-4 mt-8">
							<button 
								disabled={currentPage() === 1}
								onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
								class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-all active:scale-95"
							>
								<span class="material-symbols-outlined">chevron_left</span>
							</button>
							
							<div class="text-white font-bold tabular-nums">
								{currentPage()} <span class="text-[#8e8e93] font-normal mx-1">/</span> {totalPages()}
							</div>

							<button 
								disabled={currentPage() === totalPages()}
								onClick={() => setCurrentPage(p => Math.min(totalPages(), p + 1))}
								class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-all active:scale-95"
							>
								<span class="material-symbols-outlined">chevron_right</span>
							</button>
						</div>
					</Show>

					<Show when={clansQuery.data?.length === 0}>
						<div class="text-center py-12 text-[#8e8e93]">
							No clans found. Be the first to start one!
						</div>
					</Show>
				</div>
			</Show>
		</div>
	);
};
