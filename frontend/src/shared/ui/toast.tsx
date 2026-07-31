import { Motion } from '@motionone/solid';
import { Component, createSignal, For, onCleanup, onMount } from 'solid-js';

interface ToastProps {
	message: string;
	type: 'success' | 'error' | 'info';
	duration: number;
	onClose: () => void;
}

export const Toast: Component<ToastProps> = (props) => {
	let timer: any;
	
	onMount(() => {
		timer = setTimeout(props.onClose, props.duration);
		onCleanup(() => clearTimeout(timer));
	});

	const bgClass = () => {
		switch (props.type) {
			case 'success':
				return 'bg-[#34c759]';
			case 'error':
				return 'bg-[#ff3b30]';
			case 'info':
				return 'bg-[#3390ec]';
			default:
				return 'bg-[#3390ec]';
		}
	};

	const icon = () => {
		switch (props.type) {
			case 'success':
				return 'check_circle';
			case 'error':
				return 'error';
			case 'info':
				return 'info';
			default:
				return 'info';
		}
	};

	let startX = 0;
	const [offset, setOffset] = createSignal(0);

	const handleTouchStart = (e: TouchEvent) => {
		startX = e.touches[0].clientX;
	};
	const handleTouchMove = (e: TouchEvent) => {
		const currentX = e.touches[0].clientX;
		const diff = currentX - startX;
		setOffset(diff);
	};
	const handleTouchEnd = () => {
		if (Math.abs(offset()) > 100) {
			props.onClose();
		} else {
			setOffset(0);
		}
	};

	return (
		<Motion.div
			initial={{ opacity: 0, y: 50, scale: 0.9 }}
			animate={{ opacity: 1, y: 0, scale: 1, x: offset() }}
			exit={{ opacity: 0, scale: 0.9 }}
			transition={{ duration: 0.2 }}
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			class={`pointer-events-auto px-6 py-3.5 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.4)] flex items-center gap-3 border border-white/10 ${bgClass()}`}
		>
			<span class="material-symbols-outlined text-white text-[20px]">{icon()}</span>
			<span class="text-white text-[14px] font-bold">{props.message}</span>
		</Motion.div>
	);
};

interface ToastItem {
	id: number;
	message: string;
	type: 'success' | 'error' | 'info';
	duration: number;
}

const [toasts, setToasts] = createSignal<ToastItem[]>([]);

export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', options?: { duration?: number }) => {
	const id = Date.now();
	let duration = options?.duration;
	if (!duration) {
		duration = type === 'success' ? 3000 : type === 'error' ? 6000 : 4000;
	}
	
	setToasts((prev) => {
		const newToasts = [...prev, { id, message, type, duration }];
		if (newToasts.length > 3) {
			return newToasts.slice(newToasts.length - 3);
		}
		return newToasts;
	});
};

export const ToastContainer: Component = () => {
	return (
		<div class="fixed inset-0 pointer-events-none z-[200] flex flex-col items-center justify-end pb-28 gap-3">
			<For each={toasts()}>
				{(toast: ToastItem) => (
					<Toast
						message={toast.message}
						type={toast.type}
						duration={toast.duration}
						onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
					/>
				)}
			</For>
		</div>
	);
};
