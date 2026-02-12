import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* ====================================================================
   CINEMATIC 3D SPACE EXPERIENCE
   Features: High-Density Starfield, Nebula, Bloom, GSAP Fly-To
   ==================================================================== */

// ── Global Variables ─────────────────────────────────────────────────
let scene, camera, renderer, composer, controls;
let starMesh, nebulaMesh;
let planets = [];
let astronaut;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

// ── Configuration ────────────────────────────────────────────────────
const CONFIG = {
    starCount: 15000,
    bloomStrength: 1.5,
    bloomRadius: 0.4,
    bloomThreshold: 0.1,
    cameraFov: 60
};

const PLANET_DATA = [
    { name: 'Mercury', color: 0xA5A5A5, size: 2, distance: 30, position: { x: 30, y: 0, z: 0 } },
    { name: 'Venus', color: 0xE3BB76, size: 3.5, distance: 45, position: { x: 50, y: 10, z: -20 } },
    { name: 'Earth', color: 0x22A6B3, size: 4, distance: 60, position: { x: 0, y: 0, z: 0 } }, // Center focus
    { name: 'Mars', color: 0xEB4D4B, size: 3, distance: 80, position: { x: -40, y: -10, z: 30 } },
    { name: 'Jupiter', color: 0xD980FA, size: 8, distance: 120, position: { x: -80, y: 20, z: -50 } }
];

// ── Initialization ───────────────────────────────────────────────────
init();
animate();

function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.001); // Depth fog

    // 2. Camera
    camera = new THREE.PerspectiveCamera(CONFIG.cameraFov, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 20, 100);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);

    // 4. Post-Processing (Bloom)
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        CONFIG.bloomStrength,
        CONFIG.bloomRadius,
        CONFIG.bloomThreshold
    );
    composer.addPass(bloomPass);

    // 5. Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 500;
    controls.enablePan = false;

    // 6. Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft fill
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xffffff, 3, 1000);
    sunLight.position.set(100, 100, 100);
    scene.add(sunLight);

    // 7. Environment
    createStarfield();
    createBackground(); // Nebula-like
    createPlanets();
    loadAstronaut();

    // 8. Interaction
    window.addEventListener('resize', onResize);
    setupHUD();
}

// ── Environment Functions ────────────────────────────────────────────

function createStarfield() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    const colorPalette = [
        new THREE.Color(0x9bb0ff), // Blue star
        new THREE.Color(0xffffff), // White star
        new THREE.Color(0xfff4e8)  // Yellowish
    ];

    for (let i = 0; i < CONFIG.starCount; i++) {
        const x = (Math.random() - 0.5) * 600;
        const y = (Math.random() - 0.5) * 600;
        const z = (Math.random() - 0.5) * 600;
        positions.push(x, y, z);

        // Color variation
        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });

    starMesh = new THREE.Points(geometry, material);
    scene.add(starMesh);
}

function createBackground() {
    // Cinematic Nebula procedural backup (if no HDRI)
    // Using a large sphere with Noise texture or gradient
    const geometry = new THREE.SphereGeometry(400, 32, 32);
    // Invert geometry to see from inside
    geometry.scale(-1, 1, 1);

    // Create a canvas texture for gradient nebula
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#020024'); // Deep Blue
    gradient.addColorStop(0.5, '#090979'); // Purple/Blue
    gradient.addColorStop(1, '#2c003e'); // Dark Purple
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Add some noise
    for (let i = 0; i < 1000; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.05})`;
        ctx.beginPath();
        ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture });

    const bgMesh = new THREE.Mesh(geometry, material);
    scene.add(bgMesh);
}

function createPlanets() {
    const geometry = new THREE.SphereGeometry(1, 32, 32);

    PLANET_DATA.forEach(data => {
        const material = new THREE.MeshStandardMaterial({
            color: data.color,
            roughness: 0.7,
            metalness: 0.2,
            emissive: data.color,
            emissiveIntensity: 0.2
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(data.position.x, data.position.y, data.position.z);
        mesh.scale.set(data.size, data.size, data.size);
        mesh.userData = { name: data.name };

        // Add a "Glow" Sprite
        const spriteMat = new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(generateGlowTexture(data.color)),
            color: data.color,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.7
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(data.size * 3, data.size * 3, 1);
        mesh.add(sprite);

        scene.add(mesh);
        planets.push(mesh);
    });
}

function loadAstronaut() {
    const loader = new GLTFLoader();
    // Using simple placeholder box if model fails, but trying standard URL
    loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/NeilArmstrong.glb',
        (gltf) => {
            astronaut = gltf.scene;
            astronaut.scale.set(1, 1, 1);
            astronaut.position.set(10, 5, 10);
            astronaut.rotation.y = Math.PI;
            scene.add(astronaut);
        },
        undefined,
        (error) => {
            console.warn('Astronaut model could not be loaded. Using placeholder.', error);
            // Placeholder
            const geo = new THREE.BoxGeometry(2, 4, 1);
            const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.2 });
            astronaut = new THREE.Mesh(geo, mat);
            astronaut.position.set(10, 5, 10);
            scene.add(astronaut);
        }
    );
}

// ── Interact & Animation ─────────────────────────────────────────────

function setupHUD() {
    const items = document.querySelectorAll('.hud-item');
    items.forEach(item => {
        item.addEventListener('click', () => {
            // UI Update
            items.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // 3D Update
            const targetName = item.getAttribute('data-target');
            flyToPlanet(targetName);
        });
    });
}

function flyToPlanet(name) {
    const target = planets.find(p => p.userData.name === name);
    if (!target) return;

    // Calculate ideal camera position (offset)
    // We want to be somewhat in front and above
    const offset = 20;
    const targetPos = target.position.clone();

    // We can just add offset to Z for simplicity, or maintain current relative angle
    // Let's do a fixed offset for cinematic stability
    const camEndPos = new THREE.Vector3(targetPos.x, targetPos.y + 5, targetPos.z + offset);

    // GSAP Sequence
    // 1. Move Camera
    gsap.to(camera.position, {
        duration: 2.5,
        x: camEndPos.x,
        y: camEndPos.y,
        z: camEndPos.z,
        ease: 'power3.inOut',
        onUpdate: () => controls.update() // Important for OrbitControls sync
    });

    // 2. Adjust LookAt (Controls Target)
    gsap.to(controls.target, {
        duration: 2.5,
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        ease: 'power3.inOut'
    });
}

function generateGlowTexture(colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    // Convert hex to rgb for alpha
    const c = new THREE.Color(colorHex);
    gradient.addColorStop(0, `rgba(${c.r * 255}, ${c.g * 255}, ${c.b * 255}, 1)`);
    gradient.addColorStop(0.5, `rgba(${c.r * 255}, ${c.g * 255}, ${c.b * 255}, 0.2)`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return canvas;
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.0005;

    // Subtle star rotation
    if (starMesh) starMesh.rotation.y = time * 0.05;

    // Astronaut float
    if (astronaut) {
        astronaut.position.y += Math.sin(time * 2) * 0.01;
        astronaut.rotation.z = Math.sin(time) * 0.05;
    }

    // Controls update
    controls.update();

    // Render with Bloom
    composer.render();
}
