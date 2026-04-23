const main = {
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    cacheKey: 'upcoming_launches',
    cacheTime: (30 * 1000 * 60),

    state: {
        limit: 10,
        nextUrl: null,
        prevUrl: null,
        count: 0,
        currentTab: 'upcoming',
        clockTz: 'LOCAL',
        nextLaunchInterval: null
    },

    init() {
        const CONTAINER = document.querySelector('#main');
        const SCROLL= {
            targetScroll: 0,
            currentScroll: 0,
            max: CONTAINER.scrollWidth - window.innerWidth
        }

        main.setHorizontalScroll(CONTAINER, SCROLL);
        main.createPlanetAnimation(CONTAINER, SCROLL);
        main.initSidebarEvents();

        document.querySelector('#btn-clock-tz')?.addEventListener('click', (e) => {
            main.state.clockTz = main.state.clockTz === 'LOCAL' ? 'UTC' : 'LOCAL';
            e.target.innerText = main.state.clockTz;
        });

        if (main.isTouchDevice) return;

        main.updateClock();

        main.fetchLaunches(`https://ll.thespacedevs.com/2.3.0/launches/upcoming/?ordering=net&limit=${main.state.limit}`, 'Latest and Upcoming', 'upcoming_launches');
    },

    // =================================== INTERFACE EVENTS

    setHorizontalScroll(CONTAINER, SCROLL) {
        SCROLL.max = CONTAINER.scrollWidth - window.innerWidth;
        CONTAINER.addEventListener('wheel', (e) => {
            e.preventDefault();
            SCROLL.targetScroll += e.deltaY;

            SCROLL.targetScroll = THREE.MathUtils.clamp(SCROLL.targetScroll, 0, SCROLL.max);
        }, { passive: false });
        window.addEventListener('hashchange', () => { 
            if (!location.hash) return;
            let targetId = location.hash;
            if (targetId === '#results') targetId = '#results_section';
            const target = document.querySelector(targetId);
            if (target) {
                gsap.to(SCROLL, { 
                    targetScroll: target.offsetLeft, 
                    duration: 2, 
                    ease: "power2.out"
                });
            }
            history.replaceState(null, null, ' ');
        });
    },
    createPlanetAnimation(CONTAINER, SCROLL) {
        const SCENE = new THREE.Scene();

        // Perspective
        const CAMERA = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        CAMERA.position.z = 4;
        CAMERA.position.y = .5;

        // Renderer
        const RENDERER = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        RENDERER.setSize(window.innerWidth, window.innerHeight);
        RENDERER.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(RENDERER.domElement);

        // Light source (sun)
        const LIGHT = new THREE.DirectionalLight(0xffffEE, 1.5);
        SCENE.add(LIGHT);

        // Shadow
        const AMBIENT = new THREE.AmbientLight(0x101010);
        SCENE.add(AMBIENT);

        // Surface of the planet texture
        const createPlanetTexture = () => {
            const SIZE = 1024;
            const CANVAS = document.createElement('canvas');
            CANVAS.width = CANVAS.height = SIZE;
            const CTX = CANVAS.getContext('2d');

            CTX.fillStyle = '#FFF';
            CTX.fillRect(0, 0, SIZE, SIZE);

            const LAYERS = [
                { count: 30000, radius: 12, color: [220, 220, 230], arc: Math.PI * 1.2 },
                { count: 3000, radius: 8,  color: [190, 190, 200], arc: Math.PI *  1.4},
                { count: 300, radius: 2,  color: [140, 140, 150], arc: Math.PI *  1.6},
                { count: 300, radius: 4,  color: [80, 80, 80], arc: Math.PI *  1.4},
                { count: 300, radius: 2,  color: [200, 200, 250], arc: Math.PI *  1.6},
                { count: 300, radius: 8,  color: [250, 200, 200], arc: Math.PI *  1.4},
                { count: 300, radius: 12,  color: [200, 150, 150], arc: Math.PI *  1.2},
                { count: 300, radius: 8,  color: [160, 175, 200], arc: Math.PI *  1.2},
                { count: 3000, radius: 20,  color: [230, 210, 185], arc: Math.PI *  .7},
                { count: 3000, radius: 20,  color: [185, 210, 230], arc: Math.PI *  .7}
            ];

            LAYERS.forEach(layer => {
                for (let i = 0; i < layer.count; i++) {
                    CTX.fillStyle = `rgba(${layer.color.join(',')}, ${Math.random()})`;
                    CTX.beginPath();
                    CTX.arc(
                        Math.random() * SIZE,
                        Math.random() * SIZE,
                        Math.random() * layer.radius,
                        0,
                        layer.arc
                    );
                    CTX.fill();
                }
            });

            return new THREE.CanvasTexture(CANVAS);
        }

        const GEOMETRY = new THREE.SphereGeometry(1.2, 64, 64);

        // Material
        const MATERIAL = new THREE.MeshStandardMaterial({
            map: createPlanetTexture(),
            roughness: .5,
            metalness: 0.0
        });

        const PLANET = new THREE.Mesh(GEOMETRY, MATERIAL);

        // Atmosphere
        const ATMOSPHEREGEOMETRY = new THREE.SphereGeometry(1.3, 64, 64);
        const ATMOSPHEREMATERIAL = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.5 - dot(0.1 + vNormal, vec3(0, 0, 1.0)), 4.0);
                    gl_FragColor = vec4(0.7, 0.9, 1.0, intensity);
                }
            `,
            uniforms: {
                cameraPosition: { value: new THREE.Vector3() }
            },
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true
        });
        const ATMOSPHERE = new THREE.Mesh(ATMOSPHEREGEOMETRY, ATMOSPHEREMATERIAL);

        const PLANETGROUP = new THREE.Group();
        PLANETGROUP.add(PLANET);
        PLANETGROUP.add(ATMOSPHERE);
        SCENE.add(PLANETGROUP);

        if (main.isTouchDevice) {
            document.querySelector('#main').innerHTML = `
                <div style="width:100vw;height:100vh;display:flex;flex-direction: column;align-items: center;justify-content: center;">
                    <h1>Disponible solo en PC</h1>
                    <p class="text-center text-wrap">Este sitio no está optimizado para dispositivos móviles.</p>
                </div>
            `;
        }

        window.addEventListener('resize', () => {
            CAMERA.aspect = window.innerWidth / window.innerHeight;
            CAMERA.updateProjectionMatrix();
            RENDERER.setSize(window.innerWidth, window.innerHeight);
        });

        // Scroll animation
        const getPlanetProgress = () => {
            const MAX = window.innerWidth;
            return THREE.MathUtils.clamp(CONTAINER.scrollLeft / MAX, 0, 1);
        }

        const animate = () => {
            requestAnimationFrame(animate);

            SCROLL.max = CONTAINER.scrollWidth - window.innerWidth;
            const PROGRESS = getPlanetProgress();

            let t = PROGRESS;
            const PARABOLA = 4 * t * (1 - t);
            
            // Planet movements
            PLANETGROUP.position.x = THREE.MathUtils.lerp(-1.2, 1.5, PROGRESS);
            PLANETGROUP.position.y = THREE.MathUtils.lerp(.8, PARABOLA * -1, PROGRESS);
            PLANETGROUP.position.z = THREE.MathUtils.lerp(1.2, 0, PROGRESS);


            // Planet rotation
            PLANETGROUP.rotation.y = PROGRESS * Math.PI * 0.4;

            // Change of light source
            LIGHT.position.set(Math.cos(PROGRESS * Math.PI) * 10, 0, Math.sin(PROGRESS * Math.PI) * 10);

            // Planet transitions
            PLANET.rotation.y += 0.001;
            ATMOSPHERE.rotation.y += 0.001;

            LIGHT.target.position.copy(PLANETGROUP.position);
            LIGHT.target.updateMatrixWorld();
            ATMOSPHEREMATERIAL.uniforms.cameraPosition.value.copy(CAMERA.position);

            RENDERER.render(SCENE, CAMERA);

            SCROLL.currentScroll += (SCROLL.targetScroll - SCROLL.currentScroll) * 0.08;

            SCROLL.currentScroll = THREE.MathUtils.clamp( SCROLL.currentScroll, 0, SCROLL.max);

            CONTAINER.scrollLeft = SCROLL.currentScroll;
        }

        animate();
    },
    updateClock() {
        const root = document.querySelector('#clock_container');
        let size = parseFloat(getComputedStyle(root).fontSize);
        let columns = Array.from(document.querySelectorAll('.clock_column'));
        let d, c;
        let classList = [ 'visible', 'close'];

        const padClock = (p, n) => {
            return p + ('0' + n).slice(-2);
        }

        const getClock = () => {
            d = new Date();
            const isUTC = main.state.clockTz === 'UTC';
            return [
                    isUTC ? d.getUTCHours() : d.getHours(),
                    isUTC ? d.getUTCMinutes() : d.getMinutes(),
                    isUTC ? d.getUTCSeconds() : d.getSeconds()
                ]
                .reduce(padClock, '');
        }

        const getClass = (n, i2, K) => {
            let digitAtIdx = (K - 1) - i2;
            return classList.find((class_, classIndex) => Math.abs(n - digitAtIdx) === classIndex) || '';
        }

        let loop = setInterval(() => {
            c = getClock();

            columns.forEach((ele, i) => {
                let n = +c[i];
                let K = ele.children.length;
                let targetIndex = (K - 1) - n;
                let offset = -targetIndex * size;
                ele.style.transform = `translateY(${offset}px)`;
                Array.from(ele.children).forEach((ele2, i2) => {
                    ele2.className = 'clock_num ' + getClass(n, i2, K);
                });
            });
        }, 1000);
    },
    // =================================== CONSUME SERVICES & SIDEBAR

    initSidebarEvents() {
        const upcomingBtn = document.getElementById('nav-upcoming');
        const previousBtn = document.getElementById('nav-previous');
        const searchBtn = document.getElementById('nav-search');

        const btnNext = document.getElementById('btn-next');
        const btnPrev = document.getElementById('btn-prev');

        upcomingBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            main.state.currentTab = 'upcoming';
            main.fetchLaunches(`https://ll.thespacedevs.com/2.3.0/launches/upcoming/?ordering=net&limit=${main.state.limit}`, 'Latest and Upcoming', 'upcoming_launches');
        });

        previousBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            main.state.currentTab = 'previous';
            main.fetchLaunches(`https://ll.thespacedevs.com/2.3.0/launches/previous/?ordering=-net&limit=${main.state.limit}`, 'Previous Launches', 'previous_launches');
        });

        searchBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            main.state.currentTab = 'search';
            // Placeholder para una futura pantalla de busqueda
            document.querySelector('#results_title').innerText = 'Search (Coming Soon)';
            document.querySelector('#results').innerHTML = '<p class="text-white p-8">Search functionality not yet implemented.</p>';
            main.state.nextUrl = null;
            main.state.prevUrl = null;
            main.state.count = 0;
            main.updatePaginator();
        });

        btnNext?.addEventListener('click', () => {
            if (main.state.nextUrl) main.fetchLaunches(main.state.nextUrl, document.querySelector('#results_title').innerText, main.state.currentTab + '_page_next');
        });

        btnPrev?.addEventListener('click', () => {
            if (main.state.prevUrl) main.fetchLaunches(main.state.prevUrl, document.querySelector('#results_title').innerText, main.state.currentTab + '_page_prev');
        });
    },

    fetchLaunches(url, title, cacheKey) {
        document.querySelector('#results').innerHTML = '<div class="p-8 text-slate-300">Cargando lanzamientos...</div>';
        if(document.querySelector('#results_title')) {
            document.querySelector('#results_title').innerText = title;
        }
        
        const cached = main.getDataFromCache(cacheKey);
        if (cached && cached.url === url) {
            main.handleApiResponse(cached.data);
            return;
        }

        fetch(url, {
            headers: { 'Accept': 'application/json' }
        })
        .then(res => res.json())
        .then(json => {
            if (json.results) {
                main.saveDataToCache(cacheKey, { url: url, data: json });
                main.handleApiResponse(json);
            } else if (json.detail) {
                // Posible error de API, como "Throttled"
                document.querySelector('#results').innerHTML = `<div class="p-8 text-red-400">Error: ${json.detail}</div>`;
            } else {
                document.querySelector('#results').innerHTML = '<div class="p-8 text-white">Error loading data</div>';
            }
        })
        .catch(err => {
            console.error(err);
            document.querySelector('#results').innerHTML = '<div class="p-8 text-red-400">Connection error</div>';
        });
    },

    handleApiResponse(json) {
        main.state.nextUrl = json.next;
        main.state.prevUrl = json.previous;
        main.state.count = json.count;
        main.updatePaginator();
        main.printLaunches(json);
    },

    updatePaginator() {
        const btnNext = document.getElementById('btn-next');
        const btnPrev = document.getElementById('btn-prev');
        const indicator = document.getElementById('page-indicator');

        if (btnNext) btnNext.disabled = !main.state.nextUrl;
        if (btnPrev) btnPrev.disabled = !main.state.prevUrl;
        
        if (indicator) {
            indicator.innerText = `Total: ${main.state.count}`;
        }
    },

    // =================================== CACHE STORAGE

    getDataFromCache(cacheKey) {
        const CACHED = localStorage.getItem(cacheKey);
        let data = null;

        if (CACHED) {
            try {
                const { data: DATA, timestamp: TIMESTAMP } = JSON.parse(CACHED);
                if (Date.now() - TIMESTAMP < main.cacheTime) {
                    data = DATA;
                }
            } catch(e) {
                console.error("Cache parsing error", e);
            }
        }
        return data;
    },
    
    saveDataToCache(cacheKey, data) {
        localStorage.setItem(
            cacheKey,
            JSON.stringify({
                data: data,
                timestamp: Date.now()
            })
        );
    },

    // =================================== INTERFACE BUILDING

    printLaunches(data) {
        const RESULTS = data.results ?? [];

        if (RESULTS.length < 1)
            return;

        if (main.state.currentTab === 'upcoming') {
            const nextLaunch = RESULTS[0];
            const netDate = new Date(nextLaunch.net).getTime();
            const timerEle = document.querySelector('#next-launch-timer-top');
            const statusEle = document.querySelector('#next-launch-status-top');
            
            if (statusEle) {
                statusEle.innerText = nextLaunch?.status?.name ?? 'UNKNOWN';
            }

            if (main.state.nextLaunchInterval) clearInterval(main.state.nextLaunchInterval);
            
            if (timerEle && netDate) {
                main.state.nextLaunchInterval = setInterval(() => {
                    const now = new Date().getTime();
                    const distance = netDate - now;

                    if (distance < 0) {
                        timerEle.innerText = "00d 00h 00m 00s";
                        clearInterval(main.state.nextLaunchInterval);
                        return;
                    }

                    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                    timerEle.innerText = `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
                }, 1000);
            }
        }

        const resultsElement = document.querySelector('#results');

        const getStatusClasses = (statusName) => {
            if (statusName?.includes('Go'))
                return 'lc-status--go';
            if (statusName?.includes('Success') || statusName?.includes('Deployed'))
                return 'lc-status--success';
            if (statusName?.includes('Fail'))
                return 'lc-status--fail';
            return 'lc-status--hold';
        };

        const formatDate = (isoString) => {
            const d = new Date(isoString);
            const optDate = { month: 'short', day: 'numeric', year: 'numeric' };
            const optTime = { hour: '2-digit', minute: '2-digit' };
            
            return {
                localDate: d.toLocaleDateString(undefined, optDate),
                localTime: d.toLocaleTimeString(undefined, optTime),
                utcTime: d.toLocaleTimeString('en-GB', { ...optTime, timeZone: 'UTC' })
            };
        };

        const createLaunchCard = (result) => {
            const imageUrl = result?.image?.image_url ?? '';
            const provider  = result?.launch_service_provider?.name ?? 'Unknown';
            const name      = result?.name ?? 'Unknown';
            const statusName = result?.status?.name ?? 'Unknown';
            const statusCls  = getStatusClasses(statusName);
            const padName   = result?.pad?.name ?? '—';
            const locName   = result?.pad?.location?.name ?? '—';
            const net       = result?.net ?? null;
            const prob      = result?.probability;
            const id        = result?.id ?? Math.random().toString(36).slice(2);
            const vidUrls   = (result?.mission?.vid_urls ?? []).length > 0 ? (result?.mission?.vid_urls ?? []) : [{ title: 'YouTube', url: `https://www.youtube.com/results?search_query=${name.replace(/\s/g, "+")}+live+stream`}];
            const netFmt    = net ? formatDate(net) : { localDate: '—', localTime: '—', utcTime: '—' };

            const watchBtn = vidUrls.length > 0
                ? `<a href="${vidUrls[0]?.url ?? '#'}" target="_blank" class="lc-btn-watch">Watch Mission</a>`
                : `<button class="lc-btn-watch lc-btn-watch--disabled" disabled>No Webcast</button>`;

            const probHtml = prob != null
                ? `<span class="lc-meta-value lc-meta-value--blue">${prob}%</span>
                   <span class="lc-meta-label">Chance of GO</span>`
                : `<span class="lc-meta-value">—</span>
                   <span class="lc-meta-label">No data</span>`;

            return `
                <div class="launch_card">
                    <!-- Background image -->
                    <div class="lc-bg">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${name}" loading="lazy" class="lc-bg-img">` : ''}
                        <div class="lc-bg-overlay"></div>
                    </div>

                    <!-- Content -->
                    <div class="lc-body">

                        <!-- Header: provider + status badge -->
                        <div class="lc-header">
                            <div>
                                <span class="lc-provider">${provider}</span>
                                <h2 class="lc-title">${name}</h2>
                            </div>
                            <div class="lc-status ${statusCls}">
                                <span class="lc-status-dot"></span>
                                ${statusName}
                            </div>
                        </div>

                        <!-- Countdown -->
                        <div class="lc-section">
                            <span class="lc-label">T-Minus to Liftoff</span>
                            <div class="lc-timer" id="timer-${id}">
                                <div class="lc-timer-unit">
                                    <span class="lc-timer-num days">00</span>
                                    <span class="lc-timer-label">Days</span>
                                </div>
                                <span class="lc-timer-sep">:</span>
                                <div class="lc-timer-unit">
                                    <span class="lc-timer-num hours">00</span>
                                    <span class="lc-timer-label">Hours</span>
                                </div>
                                <span class="lc-timer-sep">:</span>
                                <div class="lc-timer-unit">
                                    <span class="lc-timer-num minutes">00</span>
                                    <span class="lc-timer-label">Mins</span>
                                </div>
                                <span class="lc-timer-sep">:</span>
                                <div class="lc-timer-unit">
                                    <span class="lc-timer-num seconds lc-timer-num--blue">00</span>
                                    <span class="lc-timer-label">Secs</span>
                                </div>
                            </div>
                        </div>

                        <!-- Meta grid: schedule / probability / pad -->
                        <div class="lc-meta-grid">
                            <div class="lc-meta-cell">
                                <span class="lc-meta-label">Target Schedule</span>
                                <span class="lc-meta-value">${netFmt.localDate}</span>
                                <span class="lc-meta-sub">${netFmt.localTime} (Local)</span>
                                <span class="lc-meta-sub">${netFmt.utcTime} UTC</span>
                            </div>
                            <div class="lc-meta-cell lc-meta-cell--right">
                                <span class="lc-meta-label">Weather Prob.</span>
                                ${probHtml}
                            </div>
                            <div class="lc-meta-cell lc-meta-cell--full lc-meta-cell--pad">
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16" class="lc-pin-icon">
                                    <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6"/>
                                </svg>
                                <div>
                                    <span class="lc-meta-pad-name">${padName}</span>
                                    <span class="lc-meta-pad-loc">${locName}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="lc-actions">
                            ${watchBtn}
                        </div>

                    </div>
                </div>
            `;
        };

        resultsElement.innerHTML = RESULTS.map(r => createLaunchCard(r)).join('');

        // Start per-card countdown timers
        if (main._cardTimerInterval) clearInterval(main._cardTimerInterval);

        main._cardTimerInterval = setInterval(() => {
            RESULTS.forEach(result => {
                if (!result?.net || !result?.id) return;
                const el = document.getElementById(`timer-${result.id}`);
                if (!el) return;

                const diff = new Date(result.net).getTime() - Date.now();
                if (diff > 0) {
                    const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const secs  = Math.floor((diff % (1000 * 60)) / 1000);

                    el.querySelector('.days').innerText    = String(days).padStart(2, '0');
                    el.querySelector('.hours').innerText   = String(hours).padStart(2, '0');
                    el.querySelector('.minutes').innerText = String(mins).padStart(2, '0');
                    el.querySelector('.seconds').innerText = String(secs).padStart(2, '0');
                } else {
                    // Already launched
                    el.querySelector('.days').innerText    = '00';
                    el.querySelector('.hours').innerText   = '00';
                    el.querySelector('.minutes').innerText = '00';
                    el.querySelector('.seconds').innerText = '00';
                }
            });
        }, 1000);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    main.init();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});
