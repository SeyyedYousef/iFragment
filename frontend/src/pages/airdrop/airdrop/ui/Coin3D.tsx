import { createSignal, onCleanup, onMount } from 'solid-js';
import * as THREE from 'three';

interface Coin3DProps {
	onTap: (e: PointerEvent) => void;
	isPressed: boolean;
	isTurboActive: boolean;
	textureUrl?: string;
}

export function Coin3D(props: Coin3DProps) {
	let containerRef!: HTMLDivElement;
	let renderer: THREE.WebGLRenderer;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let coinMesh: THREE.Mesh;
	let animationFrameId: number;
	let material: THREE.MeshPhysicalMaterial;
	let resizeObserver: ResizeObserver;

	const [tiltX, setTiltX] = createSignal(0);
	const [tiltY, setTiltY] = createSignal(0);

	onMount(() => {
		// 1. Setup Scene
		scene = new THREE.Scene();

		// 2. Setup Camera
		camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
		camera.position.z = 5.5; // Slightly pulled back to let the glow breathe

		// 3. Premium Renderer Setup
		renderer = new THREE.WebGLRenderer({ 
			alpha: true, 
			antialias: true,
			powerPreference: "high-performance" 
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Balanced for performance and sharpness
		containerRef.appendChild(renderer.domElement);

		// 4. Responsive Resizing (Crucial for UI Layouts)
		resizeObserver = new ResizeObserver(() => {
			if (!containerRef) return;
			const width = containerRef.clientWidth;
			const height = containerRef.clientHeight;
			if (width === 0 || height === 0) return;
			
			renderer.setSize(width, height);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
		});
		resizeObserver.observe(containerRef);

		// 5. Create Premium Coin Geometry (Ultra-smooth edges)
		const geometry = new THREE.CylinderGeometry(1.6, 1.6, 0.15, 128);

		// 6. Premium Physical Material (Glass/Metal hybrid)
		material = new THREE.MeshPhysicalMaterial({
			color: 0xffd700,
			metalness: 1.0,
			roughness: 0.15,
			clearcoat: 1.0,
			clearcoatRoughness: 0.05,
			emissive: 0x000000,
			emissiveIntensity: 0
		});

		if (props.textureUrl) {
			const textureLoader = new THREE.TextureLoader();
			textureLoader.load(props.textureUrl, (tex) => {
				tex.colorSpace = THREE.SRGBColorSpace;
				tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); // Extra crisp textures
				material.map = tex;
				material.needsUpdate = true;
			});
		}

		coinMesh = new THREE.Mesh(geometry, material);
		coinMesh.rotation.x = Math.PI / 2;
		scene.add(coinMesh);

		// 7. Studio 3-Point Lighting Setup
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
		scene.add(ambientLight);

		// Key Light (Main bright reflection)
		const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
		keyLight.position.set(5, 5, 5);
		scene.add(keyLight);

		// Fill Light (Cool Blue reflection for contrast)
		const fillLight = new THREE.DirectionalLight(0x3390ec, 2.0);
		fillLight.position.set(-5, 0, -5);
		scene.add(fillLight);

		// Rim Light (Amber/Gold highlight on edges)
		const rimLight = new THREE.DirectionalLight(0xf59e0b, 2.5);
		rimLight.position.set(0, -5, 2);
		scene.add(rimLight);

		// 8. Raycaster Interaction
		const raycaster = new THREE.Raycaster();
		const mouse = new THREE.Vector2();

		const handlePointerDown = (event: PointerEvent) => {
			if (event.cancelable) event.preventDefault();
			const rect = renderer.domElement.getBoundingClientRect();
			mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

			raycaster.setFromCamera(mouse, camera);
			const intersects = raycaster.intersectObject(coinMesh);

			if (intersects.length > 0) {
				props.onTap(event);
			}
		};

		renderer.domElement.addEventListener('pointerdown', handlePointerDown);

		// 9. Gyroscope tracking for parallax
		const handleOrientation = (event: DeviceOrientationEvent) => {
			if (event.gamma !== null && event.beta !== null) {
				const clampedGamma = Math.max(-30, Math.min(30, event.gamma));
				const clampedBeta = Math.max(-30, Math.min(30, event.beta - 45)); 
				setTiltX(clampedBeta * (Math.PI / 180));
				setTiltY(clampedGamma * (Math.PI / 180));
			}
		};

		if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
			window.addEventListener('deviceorientation', handleOrientation);
		}

		// 10. Animation Loop Constants
		const clock = new THREE.Clock();
		const turboEmissive = new THREE.Color(0xff1111);
		const defaultEmissive = new THREE.Color(0x000000);
		const turboColor = new THREE.Color(0xff6666);
		const defaultColor = new THREE.Color(0xffd700);

		const animate = () => {
			animationFrameId = requestAnimationFrame(animate);
			const elapsedTime = clock.getElapsedTime();

			// Idle floating & breathing motion
			const idleFloatY = Math.sin(elapsedTime * 2.0) * 0.08;
			const idleRotZ = Math.sin(elapsedTime * 0.8) * 0.05;

			// Target rotations with Gyro + Idle
			const targetRotationX = Math.PI / 2 + tiltX() + (props.isPressed ? 0.15 : 0);
			const targetRotationY = tiltY() + idleRotZ;
			
			// Smooth Lerping for movement
			coinMesh.rotation.x += (targetRotationX - coinMesh.rotation.x) * 0.15;
			coinMesh.rotation.y += (targetRotationY - coinMesh.rotation.y) * 0.15;
			coinMesh.position.y += (idleFloatY - coinMesh.position.y) * 0.1;

			// Scale effect on press (Springy feeling)
			const targetScale = props.isPressed ? 0.92 : 1.0;
			coinMesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2);

			// Premium Turbo Effect (Glowing Core Lerp)
			const targetEmissive = props.isTurboActive ? turboEmissive : defaultEmissive;
			const targetIntensity = props.isTurboActive ? 1.5 : 0;
			const targetBaseColor = props.isTurboActive ? turboColor : defaultColor;
			
			material.emissive.lerp(targetEmissive, 0.1);
			material.emissiveIntensity += (targetIntensity - material.emissiveIntensity) * 0.1;
			material.color.lerp(targetBaseColor, 0.1);

			renderer.render(scene, camera);
		};

		animate();

		// 11. Cleanup
		onCleanup(() => {
			cancelAnimationFrame(animationFrameId);
			if (resizeObserver) resizeObserver.disconnect();
			if (typeof window !== 'undefined') {
				window.removeEventListener('deviceorientation', handleOrientation);
			}
			if (renderer.domElement) {
				renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
			}
			
			renderer.dispose();
			geometry.dispose();
			material.dispose();
			
			if (containerRef && renderer.domElement) {
				containerRef.removeChild(renderer.domElement);
			}
		});
	});

	return (
		<div
			ref={containerRef}
			class="w-full h-full absolute inset-0 z-20 flex items-center justify-center touch-none select-none"
		/>
	);
}
