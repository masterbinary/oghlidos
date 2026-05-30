import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ============================================
// راه‌اندازی صحنه سه بعدی
// ============================================
const canvas = document.getElementById('bgCanvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b18);
scene.fog = new THREE.FogExp2(0x070b18, 0.004);

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(10, 7, 14);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.left = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
labelRenderer.domElement.style.zIndex = '10';
document.body.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enableZoom = true;
controls.zoomSpeed = 1.2;
controls.target.set(0, 0.2, 0);

// ============================================
// نورپردازی سینمایی با جلوه بیشتر
// ============================================
const ambient = new THREE.AmbientLight(0x3a4a7a, 0.55);
scene.add(ambient);

const mainLight = new THREE.DirectionalLight(0xfff2e0, 1.2);
mainLight.position.set(6, 10, 5);
mainLight.castShadow = true;
mainLight.receiveShadow = true;
scene.add(mainLight);

const fillLight = new THREE.PointLight(0xffaa66, 0.6);
fillLight.position.set(-3, 4, 4);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0xffaa88, 0.5);
rimLight.position.set(0, 3, -7);
scene.add(rimLight);

const backLight = new THREE.PointLight(0x4488ff, 0.4);
backLight.position.set(0, 3, 8);
scene.add(backLight);

const movingLight = new THREE.PointLight(0xffaa55, 0.5);
movingLight.position.set(2, 5, 2);
scene.add(movingLight);

// ============================================
// المان‌های تزئینی صحنه
// ============================================
const gridHelper = new THREE.GridHelper(24, 28, 0x88aaff, 0x4466aa);
gridHelper.position.y = -0.9;
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.4;
scene.add(gridHelper);

const groundDisc = new THREE.Mesh(
    new THREE.CircleGeometry(11, 32),
    new THREE.MeshStandardMaterial({ color: 0x112244, roughness: 0.5, metalness: 0.2, transparent: true, opacity: 0.25 })
);
groundDisc.rotation.x = -Math.PI / 2;
groundDisc.position.y = -0.95;
scene.add(groundDisc);

const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 2000; i++) {
    starPos.push((Math.random() - 0.5) * 200);
    starPos.push((Math.random() - 0.5) * 100);
    starPos.push((Math.random() - 0.5) * 80 - 40);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starPos), 3));
const starsMat = new THREE.PointsMaterial({ color: 0xccd6ff, size: 0.07, transparent: true, opacity: 0.7 });
const starsField = new THREE.Points(starGeo, starsMat);
scene.add(starsField);

// ============================================
// داده‌های اصلی
// ============================================
let points = [];
let currentPath3D = [];
let learningSteps = [];
let currentStep = 0;
let isLearning = false;

const pointGroup = new THREE.Group();
const lineGroup = new THREE.Group();
const labelGroup = new THREE.Group();
scene.add(pointGroup);
scene.add(lineGroup);
scene.add(labelGroup);

// ============================================
// توابع محاسباتی TSP
// ============================================
function dist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.z - p2.z);
}

function totalDistance(pathArr) {
    if (!pathArr || pathArr.length < 2) return 0;
    let d = 0;
    for (let i = 0; i < pathArr.length - 1; i++) {
        d += dist(pathArr[i], pathArr[i + 1]);
    }
    d += dist(pathArr[pathArr.length - 1], pathArr[0]);
    return d;
}

function nearestNeighborPath() {
    if (points.length < 2) return [...points];
    let unvisited = points.map((_, i) => i);
    let pathIdx = [0];
    unvisited.splice(unvisited.indexOf(0), 1);
    while (unvisited.length) {
        let last = pathIdx[pathIdx.length - 1];
        let nearest = unvisited.reduce((a, b) => 
            dist(points[last], points[a]) < dist(points[last], points[b]) ? a : b
        );
        pathIdx.push(nearest);
        unvisited.splice(unvisited.indexOf(nearest), 1);
    }
    return pathIdx.map(i => points[i]);
}

function twoOptImprove(pathArr) {
    if (!pathArr || pathArr.length < 3) return [...pathArr];
    let best = [...pathArr];
    let improved = true;
    let iterations = 0;
    while (improved && iterations < 1000) {
        improved = false;
        iterations++;
        for (let i = 0; i < best.length - 2; i++) {
            for (let j = i + 2; j < best.length - 1; j++) {
                let newPath = best.slice(0, i + 1);
                let rev = best.slice(i + 1, j + 1).reverse();
                newPath.push(...rev, ...best.slice(j + 1));
                if (totalDistance(newPath) < totalDistance(best) - 0.0001) {
                    best = newPath;
                    improved = true;
                }
            }
        }
    }
    return best;
}

function geneticAlgorithm() {
    if (points.length < 2) return [...points];
    let popSize = Math.min(70, Math.max(20, points.length * 3));
    let generations = Math.min(150, points.length * 15);
    let population = [];
    
    for (let i = 0; i < popSize; i++) {
        let perm = [...Array(points.length).keys()];
        for (let j = perm.length - 1; j > 0; j--) {
            let r = Math.floor(Math.random() * (j + 1));
            [perm[j], perm[r]] = [perm[r], perm[j]];
        }
        population.push(perm);
    }
    
    const fitness = (perm) => 1 / (totalDistance(perm.map(i => points[i])) + 1e-8);
    
    for (let gen = 0; gen < generations; gen++) {
        let fits = population.map(fitness);
        let newPop = [];
        let bestIdx = fits.reduce((imax, x, i, arr) => x > arr[imax] ? i : imax, 0);
        newPop.push([...population[bestIdx]]);
        
        for (let i = 0; i < popSize - 1; i++) {
            let p1 = tournamentSelection(population, fits);
            let p2 = tournamentSelection(population, fits);
            let child = orderCrossover(p1, p2);
            if (Math.random() < 0.08) child = mutateSwap(child);
            newPop.push(child);
        }
        population = newPop;
    }
    
    let finalFits = population.map(fitness);
    let bestIndex = finalFits.reduce((imax, x, i, arr) => x > arr[imax] ? i : imax, 0);
    return population[bestIndex].map(i => points[i]);
}

function tournamentSelection(pop, fits, k = 3) {
    let best = null;
    let bestFit = -1;
    for (let i = 0; i < k; i++) {
        let idx = Math.floor(Math.random() * pop.length);
        if (fits[idx] > bestFit) {
            bestFit = fits[idx];
            best = pop[idx];
        }
    }
    return best || pop[0];
}

function orderCrossover(p1, p2) {
    let size = p1.length;
    let start = Math.floor(Math.random() * size);
    let end = Math.floor(Math.random() * size);
    if (start > end) [start, end] = [end, start];
    
    let child = new Array(size).fill(null);
    for (let i = start; i <= end; i++) child[i] = p1[i];
    
    let current = 0;
    for (let i = 0; i < size; i++) {
        let idx = (end + 1 + i) % size;
        let val = p2[idx];
        if (!child.includes(val)) {
            while (child[current] !== null) current++;
            child[current] = val;
        }
    }
    return child;
}

function mutateSwap(perm) {
    let newPerm = [...perm];
    let i = Math.floor(Math.random() * newPerm.length);
    let j = Math.floor(Math.random() * newPerm.length);
    [newPerm[i], newPerm[j]] = [newPerm[j], newPerm[i]];
    return newPerm;
}

function hybridPath() {
    return twoOptImprove(nearestNeighborPath());
}

// ============================================
// رندر نقاط و مسیر (با هاله نورانی)
// ============================================
function renderPointsAndPath() {
    while (pointGroup.children.length) pointGroup.remove(pointGroup.children[0]);
    while (labelGroup.children.length) labelGroup.remove(labelGroup.children[0]);
    while (lineGroup.children.length) lineGroup.remove(lineGroup.children[0]);

    points.forEach((p, idx) => {
        const sphereGeo = new THREE.SphereGeometry(0.38, 64, 64);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xffaa55, 
            emissive: 0x442200, 
            roughness: 0.2, 
            metalness: 0.8 
        });
        const sphere = new THREE.Mesh(sphereGeo, material);
        sphere.position.set(p.x, 0.15, p.z);
        sphere.castShadow = true;
        pointGroup.add(sphere);
        
        const halo = new THREE.Mesh(
            new THREE.SphereGeometry(0.62, 32, 32),
            new THREE.MeshStandardMaterial({ 
                color: 0xffaa66, 
                emissive: 0xff5500,
                transparent: true, 
                opacity: 0.35,
                roughness: 0.3
            })
        );
        sphere.add(halo);
        
        const outerGlow = new THREE.Mesh(
            new THREE.SphereGeometry(0.75, 24, 24),
            new THREE.MeshBasicMaterial({ 
                color: 0xffaa44, 
                transparent: true, 
                opacity: 0.15 
            })
        );
        sphere.add(outerGlow);
        
        const div = document.createElement('div');
        div.textContent = `${idx + 1}`;
        div.style.backgroundColor = '#1a1a2e';
        div.style.color = '#facc55';
        div.style.fontSize = '20px';
        div.style.fontWeight = 'bold';
        div.style.padding = '5px 12px';
        div.style.borderRadius = '40px';
        div.style.border = '2px solid #facc55';
        div.style.fontFamily = 'monospace';
        div.style.boxShadow = '0 0 15px rgba(250, 204, 85, 0.5)';
        div.style.backdropFilter = 'blur(4px)';
        
        const label = new CSS2DObject(div);
        label.position.set(p.x, 0.85, p.z);
        labelGroup.add(label);
    });

    if (currentPath3D && currentPath3D.length >= 2) {
        const vertices = [];
        for (let i = 0; i < currentPath3D.length; i++) {
            vertices.push(new THREE.Vector3(currentPath3D[i].x, 0.2, currentPath3D[i].z));
        }
        vertices.push(new THREE.Vector3(currentPath3D[0].x, 0.2, currentPath3D[0].z));
        
        const lineGeo = new THREE.BufferGeometry().setFromPoints(vertices);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x6ca0ff });
        const lineObj = new THREE.Line(lineGeo, lineMat);
        lineGroup.add(lineObj);
        
        const midMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, emissive: 0x2266aa });
        vertices.forEach(v => {
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), midMat);
            dot.position.copy(v);
            lineGroup.add(dot);
        });
    }
}

// ============================================
// مقایسه الگوریتم‌ها
// ============================================
function updateComparison() {
    const compareList = document.getElementById('compareList');
    const bestDistanceVal = document.getElementById('bestDistanceVal');
    
    if (points.length === 0) {
        if (compareList) {
            compareList.innerHTML = `<div style="text-align:center; padding:30px;">✨ روی صحنه کلیک کنید</div>`;
        }
        if (bestDistanceVal) bestDistanceVal.innerHTML = '0';
        return;
    }
    
    let nn = nearestNeighborPath();
    let two = twoOptImprove(nn);
    let gen = geneticAlgorithm();
    let hybrid = hybridPath();
    
    let results = [
        { name: 'نزدیکترین همسایه', icon: '🌱', dist: totalDistance(nn), path: nn },
        { name: 'بهینه‌سازی 2-OPT', icon: '⚙️', dist: totalDistance(two), path: two },
        { name: 'الگوریتم ژنتیک', icon: '🧬', dist: totalDistance(gen), path: gen },
        { name: 'هیبرید', icon: '🔥', dist: totalDistance(hybrid), path: hybrid }
    ];
    
    results.sort((a, b) => a.dist - b.dist);
    let bestVal = results[0].dist;
    if (bestDistanceVal) bestDistanceVal.innerHTML = bestVal.toFixed(2);
    
    let medals = ['🥇', '🥈', '🥉', '📌'];
    let rankTexts = ['بهترین مسیر', 'نفر دوم', 'نفر سوم', 'سایر'];
    
    let html = '';
    for (let idx = 0; idx < results.length; idx++) {
        let r = results[idx];
        let percent = (bestVal / r.dist) * 100;
        let improvement = (100 - percent).toFixed(1);
        
        html += `
            <div class="algo-compare-item rank-${idx + 1}" data-path='${JSON.stringify(r.path)}'>
                <div class="algo-item-header">
                    <div class="algo-title">
                        <span class="algo-icon">${r.icon}</span>
                        <span class="algo-name-text">${r.name}</span>
                        <span class="algo-rank">${rankTexts[idx]}</span>
                    </div>
                    <div class="algo-distance-box">${r.dist.toFixed(2)}</div>
                </div>
                <div class="algo-item-body">
                    <div class="progress-label">
                        <span>📊 بهبود نسبت به بهترین</span>
                        <span>${improvement}%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${percent}%;"></div>
                    </div>
                    <div class="algo-footer">
                        <span>👈 کلیک کنید</span>
                        <span>${medals[idx]} ${percent.toFixed(0)}%</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    if (compareList) compareList.innerHTML = html;
    
    document.querySelectorAll('.algo-compare-item').forEach(item => {
        item.addEventListener('click', () => {
            const pathData = JSON.parse(item.getAttribute('data-path'));
            currentPath3D = pathData;
            renderPointsAndPath();
        });
    });
    
    currentPath3D = results[0].path;
    renderPointsAndPath();
}

// ============================================
// مراحل آموزشی
// ============================================
function generateLearningSteps(algoType) {
    if (points.length < 2) return [];
    let steps = [];
    
    if (algoType === 'nearest') {
        let unvisited = points.map((_, i) => i);
        let pathIdx = [0];
        unvisited.splice(unvisited.indexOf(0), 1);
        steps.push({ desc: `📍 شروع از نقطه 1`, path: [points[0]] });
        while (unvisited.length) {
            let last = pathIdx[pathIdx.length - 1];
            let nearest = unvisited.reduce((a, b) => 
                dist(points[last], points[a]) < dist(points[last], points[b]) ? a : b
            );
            let d = dist(points[last], points[nearest]);
            pathIdx.push(nearest);
            unvisited.splice(unvisited.indexOf(nearest), 1);
            steps.push({ desc: `➕ افزودن نقطه ${nearest + 1} (فاصله ${d.toFixed(2)})`, path: pathIdx.map(i => points[i]) });
        }
        steps.push({ desc: `🔁 مسیر نهایی`, path: pathIdx.map(i => points[i]) });
    } else if (algoType === 'genetic') {
        steps.push({ desc: `🧬 الگوریتم ژنتیک - تکامل طی ۱۵۰ نسل`, path: geneticAlgorithm() });
    } else if (algoType === 'twoopt') {
        let init = nearestNeighborPath();
        steps.push({ desc: `📌 مسیر اولیه: ${totalDistance(init).toFixed(2)}`, path: init });
        let improved = twoOptImprove(init);
        steps.push({ desc: `🔄 پس از 2-OPT: ${totalDistance(improved).toFixed(2)}`, path: improved });
    } else if (algoType === 'hybrid') {
        let nn = nearestNeighborPath();
        steps.push({ desc: `🔹 مسیر اولیه: ${totalDistance(nn).toFixed(2)}`, path: nn });
        let hybridRes = twoOptImprove(nn);
        steps.push({ desc: `⚡ پس از بهینه‌سازی: ${totalDistance(hybridRes).toFixed(2)}`, path: hybridRes });
    }
    return steps;
}

async function startLearning() {
    const algo = document.getElementById('algoSelectLearn').value;
    const names = { nearest: 'نزدیکترین همسایه', genetic: 'الگوریتم ژنتیک', twoopt: '2-OPT', hybrid: 'هیبرید' };
    document.getElementById('currentAlgoName').innerHTML = names[algo];
    
    learningSteps = generateLearningSteps(algo);
    if (learningSteps.length === 0) {
        document.getElementById('stepExplanation').innerHTML = '⚠️ حداقل ۲ نقطه نیاز است';
        return;
    }
    
    currentStep = 0;
    isLearning = true;
    document.getElementById('nextStepBtn').disabled = false;
    showStep(0);
    
    let dotsHtml = '';
    learningSteps.forEach((_, idx) => {
        dotsHtml += `<div class="step-dot" data-step="${idx}">${idx + 1}</div>`;
    });
    document.getElementById('stepDots').innerHTML = dotsHtml;
    
    document.querySelectorAll('.step-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const step = parseInt(dot.getAttribute('data-step'));
            if (learningSteps[step]) {
                showStep(step);
                currentStep = step;
            }
        });
    });
}

function showStep(step) {
    if (!learningSteps[step]) return;
    currentPath3D = learningSteps[step].path;
    renderPointsAndPath();
    document.getElementById('stepExplanation').innerHTML = `
        ✨ ${learningSteps[step].desc}<br>
        <span style="font-size:0.7rem;">📏 طول: ${totalDistance(learningSteps[step].path).toFixed(2)}</span>
    `;
    document.querySelectorAll('.step-dot').forEach((el, i) => {
        if (i === step) el.classList.add('active');
        else el.classList.remove('active');
    });
}

// ============================================
// انیمیشن نور متحرک
// ============================================
function animateLights() {
    const time = Date.now() * 0.002;
    movingLight.position.x = 3 + Math.sin(time) * 2;
    movingLight.position.z = 2 + Math.cos(time * 0.7) * 2;
    requestAnimationFrame(animateLights);
}
animateLights();

// ============================================
// رویدادهای کلیک
// ============================================
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

renderer.domElement.addEventListener('click', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObjects(pointGroup.children);
    if (intersects.length === 0) {
        const interPoint = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
        if (interPoint) {
            let newX = Math.min(7.8, Math.max(-7.8, interPoint.x));
            let newZ = Math.min(6.5, Math.max(-6.5, interPoint.z));
            points.push({ x: newX, z: newZ });
            updatePointCount();
            updateComparison();
            renderPointsAndPath();
        }
    }
});

renderer.domElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (points.length > 0) {
        points.pop();
        updatePointCount();
        updateComparison();
        renderPointsAndPath();
    }
});

function updatePointCount() {
    document.getElementById('pointCount').innerText = points.length;
}

// دکمه‌ها
document.getElementById('addPointBtn').onclick = () => alert('روی صحنه کلیک کنید');
document.getElementById('randomPointsBtn').onclick = () => {
    points = [];
    for (let i = 0; i < 10; i++) {
        points.push({ x: (Math.random() - 0.5) * 14, z: (Math.random() - 0.5) * 10 });
    }
    updatePointCount();
    updateComparison();
};
document.getElementById('clearAllBtn').onclick = () => {
    points = [];
    currentPath3D = [];
    updatePointCount();
    updateComparison();
    renderPointsAndPath();
    isLearning = false;
};
document.getElementById('runLearningBtn').onclick = startLearning;
document.getElementById('nextStepBtn').onclick = () => {
    if (!isLearning) return;
    if (currentStep + 1 < learningSteps.length) {
        currentStep++;
        showStep(currentStep);
    } else {
        document.getElementById('stepExplanation').innerHTML += '<br>✅ آموزش کامل شد';
        document.getElementById('nextStepBtn').disabled = true;
        isLearning = false;
    }
};
document.getElementById('aboutBtn').onclick = () => location.href = 'about.html';

// ============================================
// منوی همبرگری
// ============================================
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const menuOverlay = document.getElementById('menuOverlay');
const closeMenuBtn = document.getElementById('closeMenuBtn');

hamburgerBtn?.addEventListener('click', () => {
    mobileMenu.classList.add('open');
    menuOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
});
closeMenuBtn?.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    menuOverlay.classList.remove('active');
    document.body.style.overflow = '';
});
menuOverlay?.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    menuOverlay.classList.remove('active');
    document.body.style.overflow = '';
});

// دکمه‌های موبایل
document.getElementById('mobileAddPointBtn')?.addEventListener('click', () => alert('روی صحنه کلیک کنید'));
document.getElementById('mobileRandomPointsBtn')?.addEventListener('click', () => {
    points = [];
    for (let i = 0; i < 10; i++) points.push({ x: (Math.random() - 0.5) * 14, z: (Math.random() - 0.5) * 10 });
    updatePointCount();
    updateComparison();
});
document.getElementById('mobileClearAllBtn')?.addEventListener('click', () => {
    points = [];
    currentPath3D = [];
    updatePointCount();
    updateComparison();
    renderPointsAndPath();
});
document.getElementById('mobileRunLearningBtn')?.addEventListener('click', startLearning);
document.getElementById('mobileAboutBtn')?.addEventListener('click', () => location.href = 'about.html');

// ============================================
// Dropdown سفارشی
// ============================================
const dropdownContainer = document.getElementById('algoDropdown');
const dropdownBtn = document.getElementById('algoDropdownBtn');
const dropdownBtnText = document.querySelector('.dropdown-btn-text');
const dropdownBtnIcon = document.querySelector('.dropdown-btn-icon');
const algoSelect = document.getElementById('algoSelectLearn');

dropdownBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownContainer.classList.toggle('active');
});
document.addEventListener('click', () => dropdownContainer?.classList.remove('active'));

document.querySelectorAll('.dropdown-menu-item').forEach(item => {
    item.addEventListener('click', () => {
        const algo = item.getAttribute('data-algo');
        const icon = item.getAttribute('data-icon');
        const name = item.getAttribute('data-name');
        if (dropdownBtnIcon) dropdownBtnIcon.textContent = icon;
        if (dropdownBtnText) dropdownBtnText.textContent = name;
        if (algoSelect) algoSelect.value = algo;
        document.querySelectorAll('.dropdown-menu-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        dropdownContainer.classList.remove('active');
    });
});

// ============================================
// انتخابگر موبایل
// ============================================
document.querySelectorAll('.mobile-selector-item').forEach(item => {
    item.addEventListener('click', () => {
        const algo = item.getAttribute('data-algo');
        if (algoSelect) algoSelect.value = algo;
        document.querySelectorAll('.mobile-selector-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const desktopItem = document.querySelector(`.dropdown-menu-item[data-algo="${algo}"]`);
        if (desktopItem) {
            const icon = desktopItem.getAttribute('data-icon');
            const name = desktopItem.getAttribute('data-name');
            if (dropdownBtnIcon) dropdownBtnIcon.textContent = icon;
            if (dropdownBtnText) dropdownBtnText.textContent = name;
            document.querySelectorAll('.dropdown-menu-item').forEach(i => i.classList.remove('active'));
            desktopItem.classList.add('active');
        }
    });
});

// ============================================
// پنل کناری
// ============================================
const sidebarPanel = document.getElementById('sidebarPanel');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const sidebarOpenBtn = document.getElementById('sidebarOpenBtn');

if (window.innerWidth <= 900) {
    sidebarPanel?.classList.add('collapsed');
}
sidebarCloseBtn?.addEventListener('click', () => sidebarPanel?.classList.add('collapsed'));
sidebarOpenBtn?.addEventListener('click', () => sidebarPanel?.classList.remove('collapsed'));

// ============================================
// انیمیشن حلقه اصلی
// ============================================
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    starsField.rotation.y += 0.0005;
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}
animate();

// ============================================
// ریسپانسیو و مقداردهی اولیه
// ============================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

updatePointCount();
setTimeout(() => {
    if (points.length === 0) {
        for (let i = 0; i < 6; i++) {
            points.push({ x: (Math.random() - 0.5) * 11, z: (Math.random() - 0.5) * 8 });
        }
        updatePointCount();
        updateComparison();
        renderPointsAndPath();
    }
}, 500);