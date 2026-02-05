const main = {
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    cacheKey: 'upcoming_launches',
    cacheTime: (10 * 1000 * 60),

    init() {
        const CONTAINER = document.querySelector('#main');
        const SCROLL= {
            targetScroll: 0,
            currentScroll: 0,
            max: CONTAINER.scrollWidth - window.innerWidth
        }

        main.setHorizontalScroll(CONTAINER, SCROLL);
        main.createPlanetAnimation(CONTAINER, SCROLL);

        if (main.isTouchDevice) return;

        main.updateClock();
        setInterval(main.updateClock, 1000);

        main.getUpcomingLaunches();
    },

    // =================================== INTERFACE EVENTS

    setHorizontalScroll(CONTAINER, SCROLL) {
        SCROLL.max = CONTAINER.scrollWidth - window.innerWidth;
        CONTAINER.addEventListener('wheel', (e) => {
            e.preventDefault();
            SCROLL.targetScroll += e.deltaY;

            SCROLL.targetScroll = THREE.MathUtils.clamp(SCROLL.targetScroll, 0, SCROLL.max);
        }, { passive: false });
        
        window.addEventListener('scroll', () => {
            const PROGRESS = window.scrollY / (document.body.scrollHeight - innerHeight);
            const x = PROGRESS * (window.innerWidth * 2);

            CONTAINER.style.transform = `translateX(${-x}px)`;
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
        const NOW = new Date();

        const HOURS = String(NOW.getHours()).padStart(2, '0');
        const MINUTES = String(NOW.getMinutes()).padStart(2, '0');
        const SECONDS = String(NOW.getSeconds()).padStart(2, '0');

        document.getElementById('clock').textContent = `${HOURS}:${MINUTES}:${SECONDS}`;
    },

    // =================================== CONSUME SERVICES

    getLastLaunches(limit=10) {
        const URL = `https://ll.thespacedevs.com/2.3.0/launches/?ordering=-net&limit=${limit}`;
        fetch(URL, {
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(res => res.json())
        .then(json => {
            main.printLaunches(json);
        })
        .catch(error => console.log(error));
    },
    getUpcomingLaunches(limit=10) {
        const cacheData = main.getDataFromCache(main.cacheKey);

        if (cacheData)
        {
            main.printLaunches(cacheData);
            return;
        }

        const URL = `https://ll.thespacedevs.com/2.3.0/launches/upcoming/?ordering=net&limit=${limit}`;

        fetch(URL, {
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(res => res.json())
        .then(json => { 
            main.saveDataToCache(main.cacheKey, json); 
            main.printLaunches(json) ;
        })
        .catch(error => console.log(error));
    },

    // =================================== CACHE STORAGE

    getDataFromCache(cacheKey) {
        const CACHED = localStorage.getItem(cacheKey);
        let data = null;

        if (CACHED) {
            const { data: DATA, timestamp: TIMESTAMP } = JSON.parse(CACHED);

            if (Date.now() - TIMESTAMP < main.cacheTime) {
                console.log('getting from cache');
                data = DATA;
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
        console.log('cache saved');
    },

    // =================================== INTERFACE BUILDING

    printLaunches(data) {
        const RESULTS = data.results ?? [];
        
        if (RESULTS.length < 1)
            return

        const resultsElement = document.querySelector('#results');
        let htmlTemplate = ``;

        const createBtnWatchLive = (link, title) => {
            return `<a href="${link}" title="${title}" type="button" target="_blank" class="py-2 px-4 bg-white font-bold text-xl rounded-2xl text-slate-600">Watch live</a>`;
        }

        RESULTS.forEach(result => {
            htmlTemplate += `
                <div class="launch_card rounded-xl grid grid-cols-6">
                    <div class="col-span-2">
                        <img class="w-full h-full object-cover" src="${ result?.image?.image_url ?? ''}" loading="lazy" alt="${result?.image?.name ?? 'image' }">
                    </div>
                    <div class="p-4 col-span-4 grid grid-rows-5 overflow-hidden text-center text-wrap">
                        
                            <div class="text-left row-span-2">
                                <small class="text-slate-300 truncate">${ result?.launch_service_provider?.name ?? 'Unknown' }</small>
                                <h1 class="text-2xl">${ result?.name ?? 'Unknown' }</h1>
                            </div>
                            <div>
                                <div class="flex gap-2 items-center items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-geo-alt-fill" viewBox="0 0 16 16">
                                        <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6"/>
                                    </svg>
                                    <h1 class="text-md truncate">
                                        ${ result?.pad?.location?.name ?? 'Unknown' }
                                    </h1>
                                </div>
                                <div>
                                    <h1 class="text-xl">
                                        Schedule: ${ result?.net ?? '0000-00-00T00:00:00Z' }
                                    </h1>
                                </div>
                            </div>
                            <div>
                                <p>Status: ${ result?.status?.name ?? 'Unknown' }</p>
                                <p class="text-slate-300">${ result?.status?.description ?? '---' }</p>
                            </div> 
                            <div class="flex items-center justify-center gap-2">
                                ${( (result?.mission?.vid_urls ?? []).length > 1 
                                ? (result?.mission?.vid_urls.forEach(vid => createBtnWatchLive((vid?.url??'#'), (vid?.title??''))))
                                : '')}
                            </div>
                    </div>
                </div>
            `;
        });

        resultsElement.innerHTML = htmlTemplate;
    }
}
document.addEventListener('DOMContentLoaded', () => {
    main.init();
});