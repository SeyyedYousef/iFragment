// High-performance, zero-dependency canvas confetti burst
export function triggerConfetti(options?: {
	particleCount?: number;
	spread?: number;
	origin?: { y?: number };
}) {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;

	const count = options?.particleCount || 60;
	const originY = options?.origin?.y !== undefined ? options.origin.y : 0.6;
	const colors = ['#0098EA', '#FBBF24', '#34D399', '#38BDF8', '#F472B6', '#FFFFFF'];

	const canvas = document.createElement('canvas');
	canvas.style.position = 'fixed';
	canvas.style.top = '0';
	canvas.style.left = '0';
	canvas.style.width = '100vw';
	canvas.style.height = '100vh';
	canvas.style.pointerEvents = 'none';
	canvas.style.zIndex = '99999';
	document.body.appendChild(canvas);

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		canvas.remove();
		return;
	}

	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	const particles: Array<{
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
		color: string;
		alpha: number;
		rotation: number;
		rotationSpeed: number;
	}> = [];

	for (let i = 0; i < count; i++) {
		const angle = Math.PI * (Math.random() * 1.2 + 0.9); // upwards spray
		const speed = Math.random() * 12 + 8;
		particles.push({
			x: canvas.width / 2 + (Math.random() - 0.5) * 80,
			y: canvas.height * originY,
			vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 6,
			vy: Math.sin(angle) * speed,
			size: Math.random() * 6 + 4,
			color: colors[Math.floor(Math.random() * colors.length)],
			alpha: 1,
			rotation: Math.random() * 360,
			rotationSpeed: (Math.random() - 0.5) * 10,
		});
	}

	let animationId: number;
	const startTime = performance.now();

	const render = (time: number) => {
		const elapsed = time - startTime;
		if (elapsed > 2500 || particles.length === 0) {
			cancelAnimationFrame(animationId);
			canvas.remove();
			return;
		}

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i];
			p.x += p.vx;
			p.y += p.vy;
			p.vy += 0.35; // gravity
			p.vx *= 0.98; // drag
			p.alpha = Math.max(0, 1 - elapsed / 2200);
			p.rotation += p.rotationSpeed;

			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate((p.rotation * Math.PI) / 180);
			ctx.globalAlpha = p.alpha;
			ctx.fillStyle = p.color;
			ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
			ctx.restore();

			if (p.y > canvas.height + 20 || p.alpha <= 0) {
				particles.splice(i, 1);
			}
		}

		animationId = requestAnimationFrame(render);
	};

	animationId = requestAnimationFrame(render);
}
