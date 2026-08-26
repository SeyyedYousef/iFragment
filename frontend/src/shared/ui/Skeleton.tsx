import type { Component } from 'solid-js';

interface SkeletonProps {
	class?: string;
}

export const SkeletonBlock: Component<SkeletonProps> = (props) => {
	return (
		<div
			class={`bg-gradient-to-r from-[#1c1d24] via-[#242630] to-[#1c1d24] bg-[length:200%_100%] animate-pulse ${props.class || ''}`}
			style={{
				animation: 'pulse 1.8s ease-in-out infinite',
			}}
		/>
	);
};

export const SkeletonTask: Component = () => {
	return (
		<div class="flex items-center justify-between border rounded-3xl p-5 bg-[#15161d]/60 border-[#222]/80 animate-pulse">
			<div class="flex flex-col gap-2 w-[65%]">
				<SkeletonBlock class="h-4 w-3/4 rounded-lg" />
				<div class="flex items-center gap-2 mt-1">
					<SkeletonBlock class="h-4.5 w-16 rounded-lg" />
					<SkeletonBlock class="h-4.5 w-12 rounded-lg" />
				</div>
			</div>
			<SkeletonBlock class="w-16 h-8 rounded-xl" />
		</div>
	);
};

export const SkeletonLeader: Component = () => {
	return (
		<div class="flex items-center justify-between bg-[#15161d]/60 border border-[#222]/80 rounded-2xl p-4 animate-pulse">
			<div class="flex items-center gap-3 w-1/2">
				<SkeletonBlock class="w-9 h-9 rounded-xl" />
				<div class="flex flex-col gap-2 w-2/3">
					<SkeletonBlock class="h-3.5 w-full rounded" />
					<SkeletonBlock class="h-3 w-1/2 rounded" />
				</div>
			</div>
			<div class="flex flex-col items-end gap-1.5 w-16">
				<SkeletonBlock class="h-3.5 w-full rounded" />
				<SkeletonBlock class="h-2 w-1/2 rounded" />
			</div>
		</div>
	);
};

export const SkeletonProfile: Component = () => {
	return (
		<div class="flex flex-col gap-6 animate-pulse">
			<div class="flex items-center gap-4 bg-[#15161d]/60 border border-[#222]/80 rounded-3xl p-5">
				<SkeletonBlock class="w-16 h-16 rounded-full" />
				<div class="flex flex-col gap-2 w-1/2">
					<SkeletonBlock class="h-5 w-3/4 rounded" />
					<SkeletonBlock class="h-3 w-1/2 rounded" />
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<SkeletonBlock class="h-24 rounded-3xl" />
				<SkeletonBlock class="h-24 rounded-3xl" />
				<SkeletonBlock class="h-24 rounded-3xl" />
				<SkeletonBlock class="h-24 rounded-3xl" />
			</div>
		</div>
	);
};

export const SkeletonCard: Component = () => {
	return (
		<div class="flex flex-col gap-3 p-5 bg-[#15161d]/60 border border-[#222]/80 rounded-3xl h-[120px] animate-pulse w-full">
			<SkeletonBlock class="h-5 w-1/2 rounded-lg" />
			<SkeletonBlock class="h-3 w-full rounded mt-2" />
			<SkeletonBlock class="h-3 w-3/4 rounded" />
		</div>
	);
};

export const SkeletonTableRow: Component = () => {
	return (
		<div class="flex items-center justify-between py-3 border-b border-[#222]/50 w-full animate-pulse">
			<SkeletonBlock class="h-4 w-[30%] rounded" />
			<SkeletonBlock class="h-4 w-[20%] rounded" />
			<SkeletonBlock class="h-4 w-[15%] rounded" />
			<SkeletonBlock class="h-4 w-[10%] rounded" />
		</div>
	);
};

export const SkeletonChart: Component = () => {
	return (
		<div class="bg-[#15161d]/60 border border-[#222]/80 rounded-3xl h-[200px] p-5 flex items-end justify-between gap-2 animate-pulse w-full">
			<SkeletonBlock class="w-1/6 h-[40%] rounded-t-lg" />
			<SkeletonBlock class="w-1/6 h-[70%] rounded-t-lg" />
			<SkeletonBlock class="w-1/6 h-[50%] rounded-t-lg" />
			<SkeletonBlock class="w-1/6 h-[90%] rounded-t-lg" />
			<SkeletonBlock class="w-1/6 h-[30%] rounded-t-lg" />
		</div>
	);
};
