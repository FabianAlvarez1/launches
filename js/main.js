const main = {
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    isMobile: window.innerWidth <= 768,
    cacheKey: 'upcoming_launches',
    cacheTime: (10 * 1000 * 60),

    state: {
        limit: 10,
        nextUrl: null,
        prevUrl: null,
        count: 0,
        currentTab: 'upcoming',
        clockTz: 'LOCAL',
        nextLaunchInterval: null,
        lastSearchQuery: ''
    },

    init() {
        const CONTAINER = document.querySelector('#main');
        const SCROLL= {
            targetScroll: 0,
            currentScroll: 0,
            max: CONTAINER.scrollWidth - window.innerWidth
        }

        // Only apply horizontal scroll on desktop
        if (!main.isMobile) {
            main.setHorizontalScroll(CONTAINER, SCROLL);
        } else {
            // Mobile: smooth vertical scroll for anchor links
            document.querySelectorAll('a[href^="#"]').forEach(link => {
                link.addEventListener('click', (e) => {
                    let targetId = link.getAttribute('href');
                    if (targetId === '#results') targetId = '#results_section';
                    const target = document.querySelector(targetId);
                    if (target) {
                        e.preventDefault();
                        target.scrollIntoView({ behavior: 'smooth' });
                        history.replaceState(null, null, ' ');
                    }
                });
            });
        }

        main.createPlanetAnimation(CONTAINER, SCROLL);
        main.initSidebarEvents();
        main.initMobileNav();

        document.querySelector('#btn-clock-tz')?.addEventListener('click', (e) => {
            main.state.clockTz = main.state.clockTz === 'LOCAL' ? 'UTC' : 'LOCAL';
            e.target.innerText = main.state.clockTz;
        });

        // Topbar collapse toggle
        document.querySelector('#topbar-toggle')?.addEventListener('click', () => {
            const data = document.getElementById('topbar-data');
            const btn = document.getElementById('topbar-toggle');
            if (data && btn) {
                data.classList.toggle('collapsed');
                btn.classList.toggle('rotated');
            }
        });

        // Always init clock and data (mobile included)
        if (!main.isMobile) {
            main.updateClock();
        }

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

        // Mobile: planet is still visible as background, no blocker

        window.addEventListener('resize', () => {
            CAMERA.aspect = window.innerWidth / window.innerHeight;
            CAMERA.updateProjectionMatrix();
            RENDERER.setSize(window.innerWidth, window.innerHeight);
        });

        // Scroll animation
        const getPlanetProgress = () => {
            if (main.isMobile) {
                const MAX = window.innerHeight;
                return THREE.MathUtils.clamp(CONTAINER.scrollTop / MAX, 0, 1);
            }
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

            if (!main.isMobile) {
                SCROLL.currentScroll += (SCROLL.targetScroll - SCROLL.currentScroll) * 0.08;
                SCROLL.currentScroll = THREE.MathUtils.clamp( SCROLL.currentScroll, 0, SCROLL.max);
                CONTAINER.scrollLeft = SCROLL.currentScroll;
            }
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
    // =================================== MOBILE NAV

    initMobileNav() {
        const mobUpcoming = document.getElementById('mob-nav-upcoming');
        const mobPrevious = document.getElementById('mob-nav-previous');
        const mobSearch = document.getElementById('mob-nav-search');
        const btnNextMob = document.getElementById('btn-next-mobile');
        const btnPrevMob = document.getElementById('btn-prev-mobile');

        const setActive = (btn) => {
            document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };

        const scrollToResults = () => {
            const resultsSection = document.getElementById('results_section');
            if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };

        mobUpcoming?.addEventListener('click', () => {
            setActive(mobUpcoming);
            main.state.currentTab = 'upcoming';
            main.fetchLaunches(`https://ll.thespacedevs.com/2.3.0/launches/upcoming/?ordering=net&limit=${main.state.limit}`, 'Latest and Upcoming', 'upcoming_launches');
            scrollToResults();
        });

        mobPrevious?.addEventListener('click', () => {
            setActive(mobPrevious);
            main.state.currentTab = 'previous';
            main.fetchLaunches(`https://ll.thespacedevs.com/2.3.0/launches/previous/?ordering=-net&limit=${main.state.limit}`, 'Previous Launches', 'previous_launches');
            scrollToResults();
        });

        mobSearch?.addEventListener('click', () => {
            setActive(mobSearch);
            main.state.currentTab = 'search';
            main.showSearchUI();
            scrollToResults();
        });

        btnNextMob?.addEventListener('click', () => {
            if (main.state.nextUrl) main.fetchLaunches(main.state.nextUrl, document.querySelector('#results_title').innerText, main.state.currentTab + '_page_next');
        });

        btnPrevMob?.addEventListener('click', () => {
            if (main.state.prevUrl) main.fetchLaunches(main.state.prevUrl, document.querySelector('#results_title').innerText, main.state.currentTab + '_page_prev');
        });
    },

    // =================================== CONSUME SERVICES & SIDEBAR

    initSidebarEvents() {
        const upcomingBtn = document.getElementById('nav-upcoming');
        const previousBtn = document.getElementById('nav-previous');
        const searchBtn = document.getElementById('nav-search');

        const btnNext = document.getElementById('btn-next');
        const btnPrev = document.getElementById('btn-prev');

        const navLinks = [upcomingBtn, previousBtn, searchBtn];

        const setActiveNav = (activeBtn) => {
            navLinks.forEach(btn => {
                if (!btn) return;
                btn.classList.remove('text-slate-200');
                btn.classList.add('text-slate-500');
            });
            if (activeBtn) {
                activeBtn.classList.remove('text-slate-500');
                activeBtn.classList.add('text-slate-200');
            }
        };

        upcomingBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            main.state.currentTab = 'upcoming';
            setActiveNav(upcomingBtn);
            main.fetchLaunches(`https://ll.thespacedevs.com/2.3.0/launches/upcoming/?ordering=net&limit=${main.state.limit}`, 'Latest and Upcoming', 'upcoming_launches');
        });

        previousBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            main.state.currentTab = 'previous';
            setActiveNav(previousBtn);
            main.fetchLaunches(`https://ll.thespacedevs.com/2.3.0/launches/previous/?ordering=-net&limit=${main.state.limit}`, 'Previous Launches', 'previous_launches');
        });

        searchBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            main.state.currentTab = 'search';
            setActiveNav(searchBtn);
            main.showSearchUI();
        });

        btnNext?.addEventListener('click', () => {
            if (main.state.nextUrl) main.fetchLaunches(main.state.nextUrl, document.querySelector('#results_title').innerText, main.state.currentTab + '_page_next');
        });

        btnPrev?.addEventListener('click', () => {
            if (main.state.prevUrl) main.fetchLaunches(main.state.prevUrl, document.querySelector('#results_title').innerText, main.state.currentTab + '_page_prev');
        });
    },

    // =================================== SEARCH

    showSearchUI() {
        // Auto-collapse topbar data when search is activated
        const data = document.getElementById('topbar-data');
        const btnToggle = document.getElementById('topbar-toggle');
        if (data && btnToggle && !data.classList.contains('collapsed')) {
            data.classList.add('collapsed');
            btnToggle.classList.add('rotated');
        }

        const titleEl = document.querySelector('#results_title');
        const titleMob = document.querySelector('#results_title_mobile');

        const searchHTML = `
            <div class="search-bar">
                <span class="search-bar-label hidden md:inline" style="display: ${main.isMobile ? 'none' : 'inline'}">Search</span>
                <input type="text" class="search-input" placeholder="e.g. Starlink, Falcon..." value="${main.state.lastSearchQuery}" autocomplete="off" />
                <button class="search-go-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </button>
            </div>
        `;

        if (titleEl) titleEl.innerHTML = searchHTML;
        if (titleMob) titleMob.innerHTML = searchHTML;

        document.querySelectorAll('.search-input').forEach(input => {
            const btn = input.nextElementSibling;
            
            btn.addEventListener('click', () => {
                const q = input.value.trim();
                if (q) main.executeSearch(q);
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const q = input.value.trim();
                    if (q) main.executeSearch(q);
                }
            });
        });

        // Focus the visible input
        setTimeout(() => {
            const visibleInput = Array.from(document.querySelectorAll('.search-input')).find(i => i.offsetParent !== null);
            if (visibleInput) visibleInput.focus();
        }, 100);

        // If there's a previous search, reload those results
        if (main.state.lastSearchQuery) {
            main.executeSearch(main.state.lastSearchQuery);
        } else {
            // Clear results and paginator
            document.querySelector('#results').innerHTML = `<div class="search-empty-state"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><p>Search for launches by name, provider, rocket, pad, or mission</p></div>`;
            main.state.nextUrl = null;
            main.state.prevUrl = null;
            main.state.count = 0;
            main.updatePaginator();
        }
    },

    executeSearch(query) {
        main.state.lastSearchQuery = query;
        const url = `https://ll.thespacedevs.com/2.3.0/launches/?search=${encodeURIComponent(query)}&ordering=-last_updated&limit=15`;
        main.fetchLaunches(url, `__SEARCH__`, `search_${query}`);
    },


    fetchLaunches(url, title, cacheKey) {
        document.querySelector('#results').innerHTML = '<div class="p-8 text-slate-300">Cargando lanzamientos...</div>';
        // Don't overwrite the search bar when in search mode
        if (title !== '__SEARCH__') {
            if(document.querySelector('#results_title')) {
                document.querySelector('#results_title').innerText = title;
            }
            const titleMob = document.querySelector('#results_title_mobile');
            if (titleMob) titleMob.innerText = title;
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

        // Desktop paginator
        if (btnNext) btnNext.disabled = !main.state.nextUrl;
        if (btnPrev) btnPrev.disabled = !main.state.prevUrl;
        if (indicator) indicator.innerText = `Total: ${main.state.count}`;

        // Mobile paginator
        const btnNextMob = document.getElementById('btn-next-mobile');
        const btnPrevMob = document.getElementById('btn-prev-mobile');
        const indicatorMob = document.getElementById('page-indicator-mobile');

        if (btnNextMob) btnNextMob.disabled = !main.state.nextUrl;
        if (btnPrevMob) btnPrevMob.disabled = !main.state.prevUrl;
        if (indicatorMob) indicatorMob.innerText = `Total: ${main.state.count}`;
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
            const timerEle = document.querySelector('#next-launch-timer-top');
            const statusEle = document.querySelector('#next-launch-status-top');

            const startNextLaunchTimer = () => {
                const now = new Date().getTime();
                let nextLaunch = null;
                
                // Buscar el primer lanzamiento que esté estrictamente en el futuro
                for (let i = 0; i < RESULTS.length; i++) {
                    if (new Date(RESULTS[i].net).getTime() > now) {
                        nextLaunch = RESULTS[i];
                        break;
                    }
                }

                if (main.state.nextLaunchInterval) clearInterval(main.state.nextLaunchInterval);

                if (!nextLaunch) {
                    if (timerEle) timerEle.innerText = "00d 00h 00m 00s";
                    if (statusEle) statusEle.innerText = "NO DATA";
                    return;
                }

                const netDate = new Date(nextLaunch.net).getTime();
                
                if (statusEle) {
                    statusEle.innerText = nextLaunch?.status?.name ?? 'UNKNOWN';
                }
                
                if (timerEle && netDate) {
                    main.state.nextLaunchInterval = setInterval(() => {
                        const currentNow = new Date().getTime();
                        const distance = netDate - currentNow;

                        if (distance <= 0) {
                            timerEle.innerText = "00d 00h 00m 00s";
                            clearInterval(main.state.nextLaunchInterval);
                            startNextLaunchTimer(); // Mover al siguiente cuando llega a cero
                            return;
                        }

                        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                        timerEle.innerText = `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
                    }, 1000);
                }
            };

            startNextLaunchTimer();
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
                        <div class="lc-actions" style="flex-direction:column">
                            <button class="lc-btn-details" onclick="main.showLaunchModal(${RESULTS.indexOf(result)})">Details</button>
                            ${watchBtn}
                        </div>

                    </div>
                </div>
            `;
        };

        resultsElement.innerHTML = RESULTS.map(r => createLaunchCard(r)).join('');
        main._currentResults = RESULTS;

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
    },

    // =================================== LAUNCH DETAIL MODAL

    showLaunchModal(index) {
        const r = main._currentResults?.[index];
        if (!r) return;

        // Remove existing modal if any
        document.querySelector('.modal-overlay')?.remove();

        const esc = (s) => (s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const linkIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>`;

        // Data extraction
        const imageUrl = r?.image?.image_url ?? '';
        const provider = r?.launch_service_provider;
        const mission = r?.mission;
        const pad = r?.pad;
        const loc = pad?.location;
        const rocket = r?.rocket?.configuration;
        const status = r?.status;
        const programs = r?.program ?? [];
        const netDate = r?.net ? new Date(r.net) : null;
        const windowStart = r?.window_start ? new Date(r.window_start) : null;
        const windowEnd = r?.window_end ? new Date(r.window_end) : null;

        const fmtDt = (d) => d ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
        const fmtDtUTC = (d) => d ? d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : '—';

        // Collect all external links
        const links = [];
        //if (r?.url) links.push({ label: 'API Source', url: r.url });
        if (pad?.wiki_url) links.push({ label: 'Pad Wiki', url: pad.wiki_url });
        if (pad?.map_url) links.push({ label: 'Google Maps', url: pad.map_url });
        //if (loc?.url) links.push({ label: 'Location API', url: loc.url });

        // Provider links
        const providerFull = mission?.agencies?.[0] ?? null;
        if (providerFull?.info_url) links.push({ label: `${providerFull.abbrev ?? 'Provider'} Website`, url: providerFull.info_url });
        if (providerFull?.wiki_url) links.push({ label: `${providerFull.abbrev ?? 'Provider'} Wiki`, url: providerFull.wiki_url });

        // Social media links
        const socialLinks = providerFull?.social_media_links ?? [];
        socialLinks.forEach(sl => {
            if (sl?.url) links.push({ label: sl.social_media?.name ?? 'Link', url: sl.url });
        });

        // Mission info/vid urls
        (mission?.info_urls ?? []).forEach(u => links.push({ label: 'Mission Info', url: u.url ?? u }));
        (mission?.vid_urls ?? []).forEach(u => links.push({ label: u.title ?? 'Video', url: u.url ?? u }));

        // Program links
        programs.forEach(p => {
            if (p?.info_url) links.push({ label: `${p.name} Website`, url: p.info_url });
            if (p?.wiki_url) links.push({ label: `${p.name} Wiki`, url: p.wiki_url });
        });

        // Build links HTML
        const linksHtml = links.length > 0
            ? `<div class="modal-section">
                <div class="modal-section-title">External Links</div>
                <div class="modal-links">
                    ${links.map(l => `<a href="${l.url}" target="_blank" rel="noopener" class="modal-link-pill">${linkIcon} ${esc(l.label)}</a>`).join('')}
                </div>
               </div>`
            : '';

        // Provider stats
        const pStats = providerFull;
        const statsHtml = pStats && pStats.total_launch_count != null
            ? `<div class="modal-section">
                <div class="modal-section-title">Provider Statistics — ${esc(pStats.name)}</div>
                <div class="modal-stat-row">
                    <div class="modal-stat"><span class="modal-stat-num">${pStats.total_launch_count}</span><span class="modal-stat-label">Total Launches</span></div>
                    <div class="modal-stat"><span class="modal-stat-num">${pStats.successful_launches}</span><span class="modal-stat-label">Successful</span></div>
                    <div class="modal-stat"><span class="modal-stat-num">${pStats.failed_launches}</span><span class="modal-stat-label">Failed</span></div>
                    <div class="modal-stat"><span class="modal-stat-num">${pStats.pending_launches}</span><span class="modal-stat-label">Pending</span></div>
                    <div class="modal-stat"><span class="modal-stat-num">${pStats.consecutive_successful_launches}</span><span class="modal-stat-label">Streak</span></div>
                    ${pStats.attempted_landings > 0 ? `<div class="modal-stat"><span class="modal-stat-num">${pStats.successful_landings}/${pStats.attempted_landings}</span><span class="modal-stat-label">Landings</span></div>` : ''}
                </div>
               </div>`
            : '';

        // Programs section
        const programsHtml = programs.length > 0
            ? `<div class="modal-section">
                <div class="modal-section-title">Associated Programs</div>
                ${programs.map(p => `
                    <div class="modal-grid">
                        <div class="modal-field"><span class="modal-field-label">Program</span><span class="modal-field-value">${esc(p.name)}</span></div>
                        <div class="modal-field"><span class="modal-field-label">Type</span><span class="modal-field-value">${esc(p.type?.name ?? '—')}</span></div>
                    </div>
                    ${p.description ? `<p class="modal-description">${esc(p.description)}</p>` : ''}
                `).join('')}
               </div>`
            : '';

        // Build modal HTML
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-container">
                <div class="modal-hero">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${esc(r.name)}">` : '<div style="background:#111827;width:100%;height:100%"></div>'}
                    <div class="modal-hero-overlay"></div>
                    <div class="modal-hero-title">
                        <span>${esc(provider?.name)}</span>
                        <h2>${esc(r.name)}</h2>
                    </div>
                    <button class="modal-close" id="modal-close-btn">&times;</button>
                </div>
                <div class="modal-scroll">

                    <!-- Status & Schedule -->
                    <div class="modal-section">
                        <div class="modal-section-title">Launch Status & Schedule</div>
                        <div class="modal-grid">
                            <div class="modal-field">
                                <span class="modal-field-label">Status</span>
                                <span class="modal-field-value">${esc(status?.name)} — ${esc(status?.description)}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Precision</span>
                                <span class="modal-field-value">${esc(r?.net_precision?.name ?? '—')}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">NET (Local)</span>
                                <span class="modal-field-value">${fmtDt(netDate)}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">NET (UTC)</span>
                                <span class="modal-field-value">${fmtDtUTC(netDate)}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Window Start</span>
                                <span class="modal-field-value">${fmtDtUTC(windowStart)}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Window End</span>
                                <span class="modal-field-value">${fmtDtUTC(windowEnd)}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Weather Probability</span>
                                <span class="modal-field-value">${r.probability != null ? r.probability + '%' : '—'}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Weather Concerns</span>
                                <span class="modal-field-value">${esc(r.weather_concerns) || '—'}</span>
                            </div>
                        </div>
                    </div>

                    <hr class="modal-divider">

                    <!-- Mission -->
                    ${mission ? `
                    <div class="modal-section">
                        <div class="modal-section-title">Mission Details</div>
                        <div class="modal-grid">
                            <div class="modal-field">
                                <span class="modal-field-label">Mission Name</span>
                                <span class="modal-field-value">${esc(mission.name)}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Mission Type</span>
                                <span class="modal-field-value">${esc(mission.type)}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Orbit</span>
                                <span class="modal-field-value">${esc(mission.orbit?.name ?? '—')} (${esc(mission.orbit?.abbrev ?? '')})</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Celestial Body</span>
                                <span class="modal-field-value">${esc(mission.orbit?.celestial_body?.name ?? '—')}</span>
                            </div>
                        </div>
                        ${mission.description ? `<p class="modal-description">${esc(mission.description)}</p>` : ''}
                    </div>
                    <hr class="modal-divider">
                    ` : ''}

                    <!-- Rocket -->
                    ${rocket ? `
                    <div class="modal-section">
                        <div class="modal-section-title">Launch Vehicle</div>
                        <div class="modal-grid">
                            <div class="modal-field">
                                <span class="modal-field-label">Rocket</span>
                                <span class="modal-field-value">${esc(rocket.full_name ?? rocket.name)}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Variant</span>
                                <span class="modal-field-value">${esc(rocket.variant) || '—'}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Family</span>
                                <span class="modal-field-value">${(rocket.families ?? []).map(f => esc(f.name)).join(', ') || '—'}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Provider</span>
                                <span class="modal-field-value">${esc(provider?.name)} (${esc(provider?.type?.name ?? '')})</span>
                            </div>
                        </div>
                    </div>
                    <hr class="modal-divider">
                    ` : ''}

                    <!-- Pad & Location -->
                    ${pad ? `
                    <div class="modal-section">
                        <div class="modal-section-title">Launch Site</div>
                        <div class="modal-grid">
                            <div class="modal-field">
                                <span class="modal-field-label">Pad</span>
                                <span class="modal-field-value">${esc(pad.name)}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Location</span>
                                <span class="modal-field-value">${esc(loc?.name ?? '—')}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Country</span>
                                <span class="modal-field-value">${esc(pad.country?.name ?? '—')}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Coordinates</span>
                                <span class="modal-field-value">
                                    ${pad.latitude != null ? `<a href="${pad.map_url ?? `https://www.google.com/maps?q=${pad.latitude},${pad.longitude}`}" target="_blank">${pad.latitude}°, ${pad.longitude}°</a>` : '—'}
                                </span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Pad Launches</span>
                                <span class="modal-field-value">${pad.total_launch_count ?? '—'}</span>
                            </div>
                            <div class="modal-field">
                                <span class="modal-field-label">Location Launches</span>
                                <span class="modal-field-value">${loc?.total_launch_count ?? '—'}</span>
                            </div>
                        </div>
                        ${pad.description ? `<p class="modal-description">${esc(pad.description)}</p>` : ''}
                        ${loc?.description ? `<p class="modal-description">${esc(loc.description)}</p>` : ''}
                    </div>
                    <hr class="modal-divider">
                    ` : ''}

                    <!-- Provider Stats -->
                    ${statsHtml}
                    ${statsHtml ? '<hr class="modal-divider">' : ''}

                    <!-- Programs -->
                    ${programsHtml}
                    ${programsHtml ? '<hr class="modal-divider">' : ''}

                    <!-- Global Stats -->
                    <div class="modal-section">
                        <div class="modal-section-title">Global Launch Statistics</div>
                        <div class="modal-stat-row">
                            <div class="modal-stat"><span class="modal-stat-num">${r.orbital_launch_attempt_count ?? '—'}</span><span class="modal-stat-label">Orbital Attempts (All-time)</span></div>
                            <div class="modal-stat"><span class="modal-stat-num">${r.orbital_launch_attempt_count_year ?? '—'}</span><span class="modal-stat-label">This Year</span></div>
                            <div class="modal-stat"><span class="modal-stat-num">${r.agency_launch_attempt_count ?? '—'}</span><span class="modal-stat-label">Agency Total</span></div>
                            <div class="modal-stat"><span class="modal-stat-num">${r.agency_launch_attempt_count_year ?? '—'}</span><span class="modal-stat-label">Agency This Year</span></div>
                        </div>
                    </div>

                    <hr class="modal-divider">

                    <!-- Links -->
                    ${linksHtml}

                    <div style="font-size:0.6rem;color:#475569;text-align:center;padding-top:0.5rem">Last updated: ${r.last_updated ? new Date(r.last_updated).toLocaleString() : '—'}</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Animate in
        requestAnimationFrame(() => modal.classList.add('active'));

        // Close handlers
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        modal.querySelector('#modal-close-btn').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        document.addEventListener('keydown', function handler(e) {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handler);
            }
        });
    }
}
document.addEventListener('DOMContentLoaded', () => {
    main.init();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});
