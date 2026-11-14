import { Motion } from '@motionone/solid';
import { type Component, createSignal, For, onCleanup, onMount } from 'solid-js';

interface ToastProps {
	message: string;
	type: 'success' | 'error' | 'info';
	duration: number;
	onClose: () => void;
}

export const Toast: Component<ToastProps> = (props) => {
	let timer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		timer = setTimeout(props.onClose, props.duration);
		onCleanup(() => {
			if (timer) clearTimeout(timer);
		});
	});

	const accent = () => {
		switch (props.type) {
			case 'success':
				return {
					ring: 'border-[#4cd964]/35',
					iconBg: 'bg-[#4cd964]/15',
					text: 'text-[#4cd964]',
					icon: 'check_circle',
				};
			case 'error':
				return {
					ring: 'border-[#ff5c6c]/35',
					iconBg: 'bg-[#ff5c6c]/15',
					text: 'text-[#ff5c6c]',
					icon: 'error',
				};
			default:
				return {
					ring: 'border-[#2990FF]/35',
					iconBg: 'bg-[#2990FF]/15',
					text: 'text-[#2990FF]',
					icon: 'info',
				};
		}
	};

	let startX = 0;
	const [offset, setOffset] = createSignal(0);

	const handleTouchStart = (e: TouchEvent) => {
		startX = e.touches[0].clientX;
	};
	const handleTouchMove = (e: TouchEvent) => {
		setOffset(e.touches[0].clientX - startX);
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
			initial={{ opacity: 0, y: 36, scale: 0.96 }}
			animate={{ opacity: 1, y: 0, scale: 1, x: offset() }}
			exit={{ opacity: 0, scale: 0.96 }}
			transition={{ duration: 0.18, easing: [0.16, 1, 0.3, 1] }}
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			class={`frag-toast pointer-events-auto px-3.5 py-2.5 rounded-[14px] flex items-center gap-2.5 max-w-[360px] font-frag-sans ${accent().ring}`}
		>
			<div
				class={`w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 ${accent().iconBg}`}
			>
				<span class={`material-symbols-outlined text-[17px] ${accent().text}`}>
					{accent().icon}
				</span>
			</div>
			<span class="text-white text-[13px] font-medium leading-snug">{props.message}</span>
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

export const showToast = (
	message: string,
	type: 'success' | 'error' | 'info' = 'info',
	options?: { duration?: number },
) => {
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
		<div class="fixed inset-0 pointer-events-none z-[200] flex flex-col items-center justify-end pb-24 px-4 gap-2">
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
