import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ====================================================================
   SOLAR SYSTEM EXPLORER
   Hybrid Loading: Tries HD textures first -> Falls back to Procedural
   ==================================================================== */

// ── Globals ──────────────────────────────────────────────────────────
let scene, camera, renderer, controls;
let raycaster, mouse;
let planetMeshes = [];
let orbitLines = [];
let selectedPlanet = null;
let hoveredPlanet = null;
let isAnimating = false;
let showOrbits = true;
let soundOn = false;
const clock = new THREE.Clock();
const textureLoader = new THREE.TextureLoader();

// ── Planet Data ──────────────────────────────────────────────────────
const PLANET_DATA = [
  {
    name: 'Sun', radius: 8, distance: 0,
    colors: ['#fff7a0','#ffcc33','#ff8800','#cc4400'],
    textureUrl: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/sun.jpg',
    rotationSpeed: 0.001, isSun: true,
    desc: 'The star at the center of our solar system, a nearly perfect sphere of hot plasma.'
  },
  {
    name: 'Mercury', radius: 0.8, distance: 18,
    colors: ['#b5a89a','#8c7e6d','#6b5e50','#4a3f35'],
    textureUrl: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/mercury.jpg',
    rotationSpeed: 0.004,
    desc: 'The smallest planet and closest to the Sun. Heavily cratered with no atmosphere.'
  },
  {
    name: 'Venus', radius: 1.5, distance: 26,
    colors: ['#f5deb3','#e8cda0','#d4a960','#c09040'],
    textureUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Venus-real_color.jpg',
    rotationSpeed: 0.002,
    desc: 'The hottest planet with a thick toxic atmosphere. Often called Earth\'s twin.'
  },
  {
    name: 'Earth', radius: 1.6, distance: 36,
    colors: ['#4a90d9','#2b82c9','#1a6b3a','#3d8b37'],
    textureUrl: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    rotationSpeed: 0.003,
    desc: 'Our home planet — the only known world to harbor life. Covered in 71% water.'
  },
  {
    name: 'Mars', radius: 1.1, distance: 46,
    colors: ['#e07040','#c1440e','#a03020','#802010'],
    textureUrl: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/mars.jpg',
    rotationSpeed: 0.003,
    desc: 'The Red Planet, home to the tallest volcano and deepest canyon in the solar system.'
  },
  {
    name: 'Jupiter', radius: 4.5, distance: 62,
    colors: ['#e8d0a0','#c9a45c','#b08030','#8a6020'],
    textureUrl: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/jupiter.jpg',
    rotationSpeed: 0.005,
    desc: 'The largest planet, a gas giant with a Great Red Spot storm lasting hundreds of years.'
  },
  {
    name: 'Saturn', radius: 3.8, distance: 82,
    colors: ['#f0e0c0','#e8d5a3','#c0a060','#a08040'],
    textureUrl: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/saturn.jpg',
    ringUrl: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/saturn_ring.png',
    rotationSpeed: 0.004,
    hasRing: true, ringInner: 5.0, ringOuter: 8.5,
    desc: 'Known for its stunning ring system made of ice and rock. A gas giant with low density.'
  },
  {
    name: 'Uranus', radius: 2.5, distance: 100,
    colors: ['#a0e8e8','#73c2d0','#5aa0b0','#408090'],
    textureUrl: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/uranus.jpg',
    rotationSpeed: 0.003,
    desc: 'An ice giant that rotates on its side. Blue-green color from methane in its atmosphere.'
  },
  {
    name: 'Neptune', radius: 2.4, distance: 118,
    colors: ['#7080e0','#3f54ba','#2840a0','#1a2880'],
    textureUrl: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/neptune.jpg',
    rotationSpeed: 0.002,
    desc: 'The windiest planet in the solar system. A deep blue ice giant far from the Sun.'
  }
];

// ── Procedural Texture Generator (Fallback) ──────────────────────────
function generatePlanetTexture(data, size) {
  size = size || 512;
  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // Base gradient
  const baseGrad = ctx.createLinearGradient(0, 0, w, h);
  baseGrad.addColorStop(0, data.colors[0]);
  baseGrad.addColorStop(0.35, data.colors[1]);
  baseGrad.addColorStop(0.65, data.colors[2]);
  baseGrad.addColorStop(1, data.colors[3]);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  // Simple noise
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const v = Math.random() * 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.06})`;
    ctx.fillRect(x, y, 2, 2);
  }
  
  // Detail
   if (data.hasRing) { 
       for(let y=0; y<h; y+=4) {
           ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.1})`;
           ctx.fillRect(0, y, w, 2);
       }
   }
   if (data.name === 'Jupiter') { 
       for(let y=0; y<h; y++) {
           const b = Math.sin(y/h*30)*0.2;
           ctx.fillStyle = `rgba(0,0,0,${Math.abs(b)})`;
           ctx.fillRect(0, y, w, 1);
       }
   }

  return canvas;
}

function generateRingTexture() {
    const c = document.createElement('canvas'); c.width=512; c.height=64;
    const ctx = c.getContext('2d');
    for (let x = 0; x < 512; x++) {
        const t = x / 512;
        const alpha = (Math.sin(t * 80) * 0.5 + 0.5) * 0.8;
        ctx.fillStyle = `rgba(200, 180, 150, ${alpha})`;
        ctx.fillRect(x, 0, 1, 64);
    }
    return c;
}

// ── Hybrid Texture Loader ────────────────────────────────────────────
function loadTexture(data) {
  return new Promise((resolve) => {
    textureLoader.load(
      data.textureUrl,
      (tex) => { 
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex); 
      },
      undefined,
      (err) => {
        console.warn(`Fallback texture for ${data.name}`);
        const canvas = generatePlanetTexture(data, 512);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      }
    );
  });
}

// ── Stars ────────────────────────────────────────────────────────────
function createStars() {
  const count = 5000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 400 + Math.random() * 600;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i*3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i*3+2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ size: 0.7, color: 0xffffff, transparent: true, opacity: 0.8 });
  scene.add(new THREE.Points(geo, mat));
}

// ── Main Init ────────────────────────────────────────────────────────
init();
animate();

async function init() {
  // Setup Scene
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(30, 40, 90);
  
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.id = 'main-canvas';
  document.body.prepend(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 5;
  controls.maxDistance = 400;

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  scene.add(new THREE.AmbientLight(0x222244, 0.5));
  const sunLight = new THREE.PointLight(0xffddaa, 2.5, 600);
  scene.add(sunLight);

  createStars();

  let loadedCount = 0;
  const total = PLANET_DATA.length;
  
  const updateLoader = () => {
      loadedCount++;
      const fill = document.getElementById('loader-fill');
      if (fill) fill.style.width = (loadedCount / total) * 100 + '%';
      if (loadedCount >= total) {
          setTimeout(() => document.getElementById('loader').classList.add('hidden'), 500);
      }
  };

  for (let i = 0; i < PLANET_DATA.length; i++) {
    const data = PLANET_DATA[i];
    const group = new THREE.Group();
    group.position.set(data.distance, 0, 0);

    const geo = new THREE.SphereGeometry(data.radius, data.isSun ? 64 : 48, 48);
    
    let mat;
    if (data.isSun) mat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    else mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8, metalness: 0.1 });

    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    mesh.userData = { planetIndex: i, name: data.name };
    
    loadTexture(data).then(tex => {
      mat.map = tex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
      updateLoader();
    });

    if (data.isSun) {
         const canvas = document.createElement('canvas'); canvas.width=64; canvas.height=64;
         const ctx = canvas.getContext('2d');
         const g = ctx.createRadialGradient(32,32,0,32,32,32);
         g.addColorStop(0, 'rgba(255, 200, 50, 0.8)');
         g.addColorStop(1, 'rgba(0,0,0,0)');
         ctx.fillStyle = g; ctx.fillRect(0,0,64,64);
         
         const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ 
             map: new THREE.CanvasTexture(canvas), color: 0xffaa00, blending: THREE.AdditiveBlending 
         }));
         sprite.scale.set(35, 35, 1);
         group.add(sprite);
    }

    if (data.hasRing) {
        const ringGeo = new THREE.RingGeometry(data.ringInner, data.ringOuter, 64);
        const pos = ringGeo.attributes.position;
        const uv = ringGeo.attributes.uv;
        for (let k = 0; k < pos.count; k++) {
            const x = pos.getX(k), y = pos.getY(k);
            const d = Math.sqrt(x*x + y*y);
            uv.setXY(k, (d - data.ringInner)/(data.ringOuter - data.ringInner), 0.5);
        }
        
        const ringMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2.2;
        group.add(ring);

        if (data.ringUrl) {
            textureLoader.load(data.ringUrl, (t) => {
                ringMat.map = t; ringMat.needsUpdate = true;
            }, undefined, () => {
                ringMat.map = new THREE.CanvasTexture(generateRingTexture());
                ringMat.needsUpdate = true;
            });
        } else {
             ringMat.map = new THREE.CanvasTexture(generateRingTexture());
        }
    }

    if (data.distance > 0) {
        const pts = [];
        for (let j=0; j<=128; j++) {
            const a = (j/128) * Math.PI * 2;
            pts.push(Math.cos(a)*data.distance, 0, Math.sin(a)*data.distance);
        }
        const oGeo = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p,0,0)));
        
        const oLine = new THREE.Line(oGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 }));
        scene.add(oLine);
        orbitLines.push(oLine);
    }

    scene.add(group);
    planetMeshes.push({ mesh, data, group });
  }

  createNavUI();

  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('touchend', onTouchEnd);
  document.getElementById('back-btn').addEventListener('click', resetCamera);
  document.getElementById('btn-orbits').addEventListener('click', toggleOrbits);
  document.getElementById('btn-sound').addEventListener('click', toggleSound);
}

// ── Nav UI ───────────────────────────────────────────────────────────
function createNavUI() {
  const scroll = document.getElementById('nav-scroll');
  PLANET_DATA.forEach((data, idx) => {
    const card = document.createElement('div');
    card.className = 'planet-card';
    const c = document.createElement('canvas'); c.width=64;c.height=64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32,32,4,32,32,30);
    g.addColorStop(0, data.colors[0]); g.addColorStop(1, data.colors[3]);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(32,32,28,0,Math.PI*2); ctx.fill();
    
    card.innerHTML = `<div class="thumb"></div><span class="name">${data.name}</span>`;
    card.querySelector('.thumb').appendChild(c);
    card.onclick = () => flyToPlanet(idx);
    scroll.appendChild(card);
  });
}

// ── Interaction Logic ────────────────────────────────────────────────
function flyToPlanet(index) {
    if (isAnimating) return;
    isAnimating = true;
    const p = planetMeshes[index];
    const target = p.group.position.clone();
    const dist = p.data.radius * 4 + 4;
    const camPos = new THREE.Vector3(target.x + dist*0.5, target.y + dist*0.4, target.z + dist*0.7);

    gsap.to(camera.position, { duration: 1.5, x: camPos.x, y: camPos.y, z: camPos.z, ease: 'power2.inOut', onUpdate: () => controls.update() });
    gsap.to(controls.target, { duration: 1.5, x: target.x, y: target.y, z: target.z, ease: 'power2.inOut', onComplete: () => {
         isAnimating = false; selectedPlanet = index; 
         updateActiveCard(index);
         document.getElementById('planet-info').classList.add('visible');
         document.getElementById('info-name').textContent = p.data.name;
         document.getElementById('info-desc').textContent = p.data.desc;
         document.getElementById('back-btn').classList.add('visible');
    }});
}

function resetCamera() {
    if (isAnimating) return;
    isAnimating = true;
    gsap.to(camera.position, { duration: 1.5, x: 30, y: 40, z: 90, ease: 'power2.inOut', onUpdate: () => controls.update() });
    gsap.to(controls.target, { duration: 1.5, x: 0, y: 0, z: 0, ease: 'power2.inOut', onComplete: () => {
        isAnimating = false; selectedPlanet = null; updateActiveCard(-1);
        document.getElementById('planet-info').classList.remove('visible');
        document.getElementById('back-btn').classList.remove('visible');
    }});
}

function updateActiveCard(index) {
    document.querySelectorAll('.planet-card').forEach((c, i) => {
        c.classList.toggle('active', i === index);
        if (i === index) c.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    });
}

function toggleOrbits() {
    showOrbits = !showOrbits;
    orbitLines.forEach(l => l.visible = showOrbits);
    document.getElementById('btn-orbits').classList.toggle('active', showOrbits);
}

function toggleSound() {
    const a = document.getElementById('ambient-audio');
    soundOn = !soundOn;
    if (soundOn) { a.volume = 0.2; a.play().catch(()=>{}); } else a.pause();
    document.getElementById('btn-sound').classList.toggle('active', soundOn);
}

function onResize() {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onClick(e) {
    mouse.x = (e.clientX/window.innerWidth)*2-1;
    mouse.y = -(e.clientY/window.innerHeight)*2+1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(planetMeshes.map(x=>x.mesh));
    if (intersects.length) flyToPlanet(intersects[0].object.userData.planetIndex);
}

function onMouseMove(e) {
    const tooltip = document.getElementById('tooltip');
    mouse.x = (e.clientX/window.innerWidth)*2-1;
    mouse.y = -(e.clientY/window.innerHeight)*2+1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(planetMeshes.map(x=>x.mesh));
    
    if (intersects.length) {
        const idx = intersects[0].object.userData.planetIndex;
        document.body.style.cursor = 'pointer';
        tooltip.style.left = e.clientX + 15 + 'px';
        tooltip.style.top = e.clientY + 'px';
        tooltip.textContent = PLANET_DATA[idx].name;
        tooltip.classList.add('visible');
        
        if (hoveredPlanet !== idx) {
            if (hoveredPlanet !== null) gsap.to(planetMeshes[hoveredPlanet].mesh.scale, {x:1,y:1,z:1,duration:0.2});
            hoveredPlanet = idx;
            gsap.to(intersects[0].object.scale, {x:1.15,y:1.15,z:1.15,duration:0.2});
        }
    } else {
        document.body.style.cursor = 'grab';
        tooltip.classList.remove('visible');
        if (hoveredPlanet !== null) {
            gsap.to(planetMeshes[hoveredPlanet].mesh.scale, {x:1,y:1,z:1,duration:0.2});
            hoveredPlanet = null;
        }
    }
}

function onTouchEnd(e) { 
    if(e.changedTouches.length) {
        const t=e.changedTouches[0]; 
        mouse.x=(t.clientX/window.innerWidth)*2-1; 
        mouse.y=-(t.clientY/window.innerHeight)*2+1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(planetMeshes.map(x=>x.mesh));
        if (intersects.length) flyToPlanet(intersects[0].object.userData.planetIndex);
    }
}

function animate() {
    requestAnimationFrame(animate);
    planetMeshes.forEach(p => p.mesh.rotation.y += p.data.rotationSpeed);
    controls.update();
    renderer.render(scene, camera);
}
