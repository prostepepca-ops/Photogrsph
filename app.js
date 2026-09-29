document.addEventListener('DOMContentLoaded', () => {
    
    const videoElement = document.getElementById('camera-stream');
    const gpsStatusElement = document.getElementById('gps-status');
    const smokeToggle = document.getElementById('smoke-toggle');
    const noFlashToggle = document.getElementById('no-flash-toggle');
    const manualEvSelect = document.getElementById('manual-ev-select');
    
    const UI = {
        ev: document.getElementById('target-ev'),
        shutter: document.getElementById('btn-shutter'),
        aperture: document.getElementById('btn-aperture'),
        iso: document.getElementById('btn-iso'),
        flash: document.getElementById('btn-flash'),
        exteriorBtn: document.getElementById('btn-exterior'),
        interiorBtn: document.getElementById('btn-interior'),
        cameraSelect: document.getElementById('camera-brand')
    };

    const FLASH_POWERS = ["1/128", "1/64", "1/32", "1/16", "1/8", "1/4", "1/2", "1/1 (FULL)"];
    const SHUTTERS = [
        { v: 1/8000, l: "1/8000" }, { v: 1/4000, l: "1/4000" }, { v: 1/2000, l: "1/2000" },
        { v: 1/1000, l: "1/1000" }, { v: 1/500, l: "1/500" }, { v: 1/250, l: "1/250" },
        { v: 1/125, l: "1/125" }, { v: 1/60, l: "1/60" }, { v: 1/30, l: "1/30" },
        { v: 1/15, l: "1/15" }, { v: 1/8, l: "1/8" }, { v: 1/4, l: "1/4" },
        { v: 1/2, l: "1/2" }, { v: 1, l: "1\"" }, { v: 2, l: "2\"" }, { v: 5, l: "5\"" },
        { v: 10, l: "10\"" }, { v: 15, l: "15\"" }, { v: 30, l: "30\"" }
    ];

    let state = {
        ev: 14.0,
        mode: 'exterior', 
        aperture: 8.0,
        iso: 100,
        shutterValue: 1/125,
        shutterLabel: "1/125",
        flashPower: "1/16",
        cameraBrand: parseFloat(UI.cameraSelect.value),
        hasSmoke: false,
        noFlash: false,
        manualEvMode: false
    };

    function getClosest(arr, val) {
        let closest = arr[0];
        let minDiff = Math.abs(val - closest.v);
        for (const item of arr) {
            const diff = Math.abs(val - item.v);
            if (diff < minDiff) {
                minDiff = diff;
                closest = item;
            }
        }
        return closest;
    }

    function applyModeSettings(mode) {
        state.mode = mode;
        if (state.mode === 'exterior') {
            state.aperture = 8.0; 
            state.iso = 100;
            UI.exteriorBtn.classList.add('active');
            UI.interiorBtn.classList.remove('active');
        } 
        else if (state.mode === 'interior') {
            state.aperture = 4.0; 
            state.iso = 400;      
            UI.interiorBtn.classList.add('active');
            UI.exteriorBtn.classList.remove('active');
        }
        recomputeExposure();
    }

    function recomputeExposure() {
        if (isNaN(state.ev) || state.ev < 0) state.ev = 0;
        if (state.ev > 18) state.ev = 18;

        if (state.noFlash) {
            const brandMultiplier = state.cameraBrand === 1.6 ? 1.05 : 1.0; 
            const exactTime = (Math.pow(state.aperture, 2) * brandMultiplier) / (Math.pow(2, state.ev) * (state.iso / 100));
            const closestShutter = getClosest(SHUTTERS, exactTime);
            state.shutterValue = closestShutter.v;
            state.shutterLabel = closestShutter.l;

            UI.shutter.classList.remove('locked');
            UI.flash.textContent = "OFF";
            UI.flash.classList.remove('flash-badge');
            UI.flash.classList.add('disabled');
        } else {
            state.shutterLabel = "1/125";
            UI.shutter.classList.add('locked');
            UI.flash.classList.remove('disabled');
            UI.flash.classList.add('flash-badge');

            let flashIndex = Math.floor(Math.log2(state.aperture / 2.8) * 2 - (Math.log2(state.iso / 100)));

            if (state.ev < 12) flashIndex += 1;
            if (state.ev < 8) flashIndex += 1;
            if (state.ev < 4) flashIndex += 2;

            if (state.hasSmoke) {
                flashIndex -= 2; 
            }

            flashIndex = Math.max(0, Math.min(FLASH_POWERS.length - 1, flashIndex));
            state.flashPower = FLASH_POWERS[flashIndex];
            UI.flash.textContent = state.flashPower;
        }

        UI.ev.textContent = state.ev.toFixed(1) + ' EV';
        UI.aperture.textContent = 'f/' + state.aperture;
        UI.iso.textContent = state.iso;
        UI.shutter.textContent = state.shutterLabel;
    }

    // --- EVENT LISTENERY ---

    UI.exteriorBtn.addEventListener('click', () => applyModeSettings('exterior'));
    UI.interiorBtn.addEventListener('click', () => applyModeSettings('interior'));

    UI.ev.addEventListener('click', () => {
        const input = prompt("Zadejte vlastní hodnotu EV (např. 14 pro slunce, 7 pro interiér):", state.ev.toFixed(1));
        if (input !== null && !isNaN(input)) {
            state.ev = parseFloat(input);
            state.manualEvMode = true;
            manualEvSelect.value = "auto"; 
            recomputeExposure();
        }
    });

    manualEvSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'auto') {
            state.manualEvMode = false;
        } else {
            state.manualEvMode = true;
            state.ev = parseFloat(val);
            recomputeExposure();
        }
    });

    noFlashToggle.addEventListener('change', (e) => {
        state.noFlash = e.target.checked;
        recomputeExposure();
    });

    smokeToggle.addEventListener('change', (e) => {
        state.hasSmoke = e.target.checked;
        recomputeExposure();
    });

    UI.cameraSelect.addEventListener('change', (e) => {
        state.cameraBrand = parseFloat(e.target.value);
        recomputeExposure();
    });

    function startAutoExposure() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = 64; 
        canvas.height = 64;

        setInterval(() => {
            if (state.manualEvMode) return;

            if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
                try {
                    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                    
                    let totalLuminance = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        totalLuminance += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                    }
                    
                    const avgBrightness = totalLuminance / (canvas.width * canvas.height);
                    if (avgBrightness > 0) {
                        let rawEV = Math.log2(avgBrightness) * 1.5 + 2;
                        rawEV = Math.max(0, Math.min(18, rawEV));
                        
                        state.ev = (state.ev * 0.85) + (rawEV * 0.15);
                        recomputeExposure();
                    }
                } catch (err) {
                    console.warn("Chyba analýzy plátna kamery:", err);
                }
            }
        }, 250);
    }

    async function initCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Kamera není v tomto prohlížeči podporována.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 640 } }, audio: false
            });
            videoElement.srcObject = stream;
            await videoElement.play();
            startAutoExposure();
        } catch (error) {
            console.error('Chyba kamery:', error);
            alert(`Nelze spustit kameru: ${error.message}. Zkontrolujte oprávnění v Safari.`);
        }
    }

    function initGPS() {
        if (!navigator.geolocation) return;
        navigator.geolocation.watchPosition(
            (pos) => gpsStatusElement.textContent = `GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
            () => gpsStatusElement.textContent = 'GPS: Odepřeno',
            { enableHighAccuracy: true, maximumAge: 0 }
        );
    }

    applyModeSettings('exterior');
    initCamera();
    initGPS();
});
