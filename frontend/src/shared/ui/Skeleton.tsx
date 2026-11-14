import type { Component } from 'solid-js';

interface SkeletonProps {
	class?: string;
}

export const SkeletonBlock: Component<SkeletonProps> = (props) => {
	return (
		<div
			class={`bg-gradient-to-r from-[#1b232d] via-[#24303e] to-[#1b232d] bg-[length:200%_100%] animate-pulse ${props.class || ''}`}
			style={{
				animation: 'pulse 1.8s ease-in-out infinite',
			}}
		/>
	);
};

export const SkeletonTask: Component = () => {
	return (
		<div class="flex items-center justify-between frag-card p-4 animate-pulse">
			<div class="flex flex-col gap-2 w-[65%]">
				<SkeletonBlock class="h-4 w-3/4 rounded-[6px]" />
				<div class="flex items-center gap-2 mt-1">
					<SkeletonBlock class="h-4 w-16 rounded-[6px]" />
					<SkeletonBlock class="h-4 w-12 rounded-[6px]" />
				</div>
			</div>
			<SkeletonBlock class="w-16 h-8 rounded-[8px]" />
		</div>
	);
};

export const SkeletonLeader: Component = () => {
	return (
		<div class="flex items-center justify-between frag-card p-3.5 animate-pulse">
			<div class="flex items-center gap-3 w-1/2">
				<SkeletonBlock class="w-9 h-9 rounded-[10px]" />
				<div class="flex flex-col gap-2 w-2/3">
					<SkeletonBlock class="h-3.5 w-full rounded" />
					<SkeletonBlock class="h-3 w-1/2 rounded" />
				</div>
			</div>
			<div class="flex flex-col items-end gap-1.5 w-16">
				<SkeletonBlock class="h-3.5 w-full rounded" />
				<SkeletonBlock class="h-2.5 w-1/2 rounded" />
			</div>
		</div>
	);
};

export const SkeletonProfile: Component = () => {
	return (
		<div class="flex flex-col gap-4 animate-pulse">
			<div class="flex items-center gap-4 frag-card p-4">
				<SkeletonBlock class="w-16 h-16 rounded-full" />
				<div class="flex flex-col gap-2 w-1/2">
					<SkeletonBlock class="h-5 w-3/4 rounded" />
					<SkeletonBlock class="h-3 w-1/2 rounded" />
				</div>
			</div>
			<div class="grid grid-cols-2 gap-2.5">
				<SkeletonBlock class="h-24 rounded-[14px]" />
				<SkeletonBlock class="h-24 rounded-[14px]" />
				<SkeletonBlock class="h-24 rounded-[14px]" />
				<SkeletonBlock class="h-24 rounded-[14px]" />
			</div>
		</div>
	);
};

export const SkeletonCard: Component = () => {
	return (
		<div class="flex flex-col gap-3 p-4 frag-card h-[120px] animate-pulse w-full">
			<SkeletonBlock class="h-5 w-1/2 rounded-[6px]" />
			<SkeletonBlock class="h-3 w-full rounded mt-1" />
			<SkeletonBlock class="h-3 w-3/4 rounded" />
		</div>
	);
};

export const SkeletonTableRow: Component = () => {
	return (
		<div class="flex items-center justify-between py-3 border-b border-white/[0.06] w-full animate-pulse">
			<SkeletonBlock class="h-4 w-[30%] rounded" />
			<SkeletonBlock class="h-4 w-[20%] rounded" />
			<SkeletonBlock class="h-4 w-[15%] rounded" />
			<SkeletonBlock class="h-4 w-[10%] rounded" />
		</div>
	);
};

export const SkeletonChart: Component = () => {
	return (
		<div class="frag-card h-[200px] p-4 flex items-end justify-between gap-2 animate-pulse w-full">
			<SkeletonBlock class="w-1/6 h-[40%] rounded-t-[6px]" />
			<SkeletonBlock class="w-1/6 h-[70%] rounded-t-[6px]" />
			<SkeletonBlock class="w-1/6 h-[50%] rounded-t-[6px]" />
			<SkeletonBlock class="w-1/6 h-[90%] rounded-t-[6px]" />
			<SkeletonBlock class="w-1/6 h-[30%] rounded-t-[6px]" />
		</div>
	);
};
