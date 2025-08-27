import { Apartment } from './core/Apartment.js';
import { AirParticle } from './core/AirParticle.js';
import { FlowSolver } from './core/FlowSolver.js';
import { CanvasRenderer } from './ui/Canvas.js';

class FluidSimulation {
    constructor() {
        this.apartment = new Apartment();
        this.particles = [];
        this.flowSolver = new FlowSolver(this.apartment, AirParticle);
        this.renderer = new CanvasRenderer('canvas', this.apartment);
        
        this.isRunning = true;
        this.lastTime = 0;
        this.frameCount = 0;
        
        this.settings = {
            ambientTemp: 22,
            acTemp: 16,
            acFlow: 50,
            particleDensity: 100,
            flowSpeed: 1.0
        };
        
        this.setupControls();
        this.setupCanvasInteraction();
        this.initializeParticles();
        this.animate();
    }
    
    setupControls() {
        // Temperature controls
        const ambientTempSlider = document.getElementById('ambientTemp');
        const acTempSlider = document.getElementById('acTemp');
        const ambientTempValue = document.getElementById('ambientTempValue');
        const acTempValue = document.getElementById('acTempValue');
        
        ambientTempSlider.addEventListener('input', (e) => {
            this.settings.ambientTemp = parseFloat(e.target.value);
            ambientTempValue.textContent = `${this.settings.ambientTemp}°C`;
            this.flowSolver.setAmbientTemperature(this.settings.ambientTemp);
        });
        
        acTempSlider.addEventListener('input', (e) => {
            this.settings.acTemp = parseFloat(e.target.value);
            acTempValue.textContent = `${this.settings.acTemp}°C`;
            this.apartment.updateACSettings(this.settings.acTemp, this.settings.acFlow / 100);
        });
        
        // AC and openings controls
        const acFlowSlider = document.getElementById('acFlow');
        const acFlowValue = document.getElementById('acFlowValue');
        
        acFlowSlider.addEventListener('input', (e) => {
            this.settings.acFlow = parseInt(e.target.value);
            acFlowValue.textContent = `${this.settings.acFlow}%`;
            this.apartment.updateACSettings(this.settings.acTemp, this.settings.acFlow / 100);
        });
        
        // Opening controls
        document.getElementById('bedroomDoor').addEventListener('change', (e) => {
            this.apartment.updateOpeningState('bedroomDoor', e.target.checked);
        });
        
        document.getElementById('leftWindow').addEventListener('change', (e) => {
            this.apartment.updateOpeningState('leftWindow', e.target.checked);
        });
        
        document.getElementById('rightWindow').addEventListener('change', (e) => {
            this.apartment.updateOpeningState('rightWindow', e.target.checked);
        });
        
        const windowHeightSlider = document.getElementById('windowHeight');
        const windowHeightValue = document.getElementById('windowHeightValue');
        
        windowHeightSlider.addEventListener('input', (e) => {
            const height = parseInt(e.target.value);
            windowHeightValue.textContent = `${height}%`;
            
            // Update window heights
            const newHeight = (height / 100) * 2.0; // Max 2m window height
            this.apartment.openings.leftWindow.height = newHeight;
            this.apartment.openings.rightWindow.height = newHeight;
        });
        
        // Fan controls
        document.getElementById('stairFan').addEventListener('change', (e) => {
            this.apartment.fans.stairFan.isActive = e.target.checked;
        });
        
        document.getElementById('bedroomFan').addEventListener('change', (e) => {
            this.apartment.fans.bedroomFan.isActive = e.target.checked;
        });
        
        const fanSpeedSlider = document.getElementById('fanSpeed');
        const fanSpeedValue = document.getElementById('fanSpeedValue');
        
        fanSpeedSlider.addEventListener('input', (e) => {
            const speed = parseInt(e.target.value);
            fanSpeedValue.textContent = `${speed}%`;
            const flowStrength = speed / 100;
            
            // Update both fans
            this.apartment.fans.stairFan.flowStrength = flowStrength;
            this.apartment.fans.bedroomFan.flowStrength = flowStrength;
        });
        
        // Simulation controls
        const particleDensitySlider = document.getElementById('particleDensity');
        const particleDensityValue = document.getElementById('particleDensityValue');
        
        particleDensitySlider.addEventListener('input', (e) => {
            this.settings.particleDensity = parseInt(e.target.value);
            particleDensityValue.textContent = this.settings.particleDensity;
        });
        
        const flowSpeedSlider = document.getElementById('flowSpeed');
        const flowSpeedValue = document.getElementById('flowSpeedValue');
        
        flowSpeedSlider.addEventListener('input', (e) => {
            this.settings.flowSpeed = parseFloat(e.target.value);
            flowSpeedValue.textContent = `${this.settings.flowSpeed}x`;
        });
        
        
        // Action buttons
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.reset();
        });
        
        document.getElementById('pauseBtn').addEventListener('click', (e) => {
            this.isRunning = !this.isRunning;
            e.target.textContent = this.isRunning ? 'Pause' : 'Play';
        });
        
        document.getElementById('showVectorsBtn').addEventListener('click', (e) => {
            const showing = this.renderer.toggleVectors();
            e.target.textContent = showing ? 'Hide Vectors' : 'Show Vectors';
        });
    }
    
    setupCanvasInteraction() {
        this.renderer.canvas.addEventListener('injectAir', (e) => {
            const { x, y, temperature, velocity } = e.detail;
            
            if (this.apartment.isValidPosition(x, y)) {
                for (let i = 0; i < 5; i++) { // Inject multiple particles
                    const particle = new AirParticle(
                        x + (Math.random() - 0.5) * 0.3,
                        y + (Math.random() - 0.5) * 0.3,
                        temperature,
                        {
                            x: velocity.x + (Math.random() - 0.5) * 0.5,
                            y: velocity.y + (Math.random() - 0.5) * 0.5
                        }
                    );
                    this.particles.push(particle);
                }
            }
        });
    }
    
    initializeParticles() {
        // Add some initial ambient air particles
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * this.apartment.width;
            const y = Math.random() * this.apartment.height;
            
            if (this.apartment.isValidPosition(x, y)) {
                const particle = new AirParticle(x, y, this.settings.ambientTemp);
                this.particles.push(particle);
            }
        }
    }
    
    animate(currentTime = 0) {
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;
        
        if (this.isRunning && deltaTime > 0) {
            this.update(deltaTime * this.settings.flowSpeed);
        }
        
        this.render();
        this.updateUI();
        
        requestAnimationFrame((time) => this.animate(time));
    }
    
    update(dt) {
        // Limit particle count - but be more generous for higher density settings
        const maxParticles = Math.max(500, this.settings.particleDensity * 8);
        while (this.particles.length > maxParticles) {
            this.particles.shift();
        }
        
        // Update flow solver
        this.flowSolver.update(this.particles, dt);
        
        // Update particles
        this.particles = this.particles.filter(particle => 
            particle.update(dt, this.apartment, this.settings.ambientTemp)
        );
        
        // Add AC particles if AC is active - check for particle limits
        if (this.apartment.acUnit.isActive && this.frameCount % 2 === 0) { // More frequent spawning
            const beforeCount = this.particles.length;
            this.addACParticles();
            const afterCount = this.particles.length;
            
            // Debug: Log if AC stopped producing particles
            if (this.frameCount % 120 === 0 && beforeCount === afterCount && this.apartment.acUnit.isActive) {
                console.log(`AC not producing particles. Count: ${this.particles.length}, Max: ${Math.max(500, this.settings.particleDensity * 8)}`);
            }
        }
        
        // Add fan particles if fans are active (less frequently than AC)
        if (this.frameCount % 3 === 0) { // Every 3 frames - give AC priority
            this.addFanParticles();
        }
        
        this.frameCount++;
    }
    
    addACParticles() {
        const particlesPerFrame = Math.floor(this.settings.acFlow / 12); // Slightly more particles
        const ac = this.apartment.acUnit;
        const maxParticles = Math.max(500, this.settings.particleDensity * 8);
        
        for (let i = 0; i < particlesPerFrame; i++) {
            if (this.particles.length < maxParticles * 0.95) { // Higher threshold for AC
                // Simulate AC vent pipe - particles start at center back of tube
                const pipeLength = 0.2; // 20cm pipe simulation
                const x = ac.x + 0.05; // Start near back of AC unit
                const y = ac.y + ac.height/2; // Exact center vertically
                
                // Particles inside AC tube start with pure horizontal velocity
                const minSpeed = 1.2; // Minimum speed to maintain narrow beam
                const speed = Math.max(minSpeed, ac.flowStrength * 1.5);
                
                const particle = new AirParticle(
                    x, y, 
                    this.settings.acTemp,
                    {
                        x: speed, // Pure horizontal velocity inside tube
                        y: 0      // No vertical component initially
                    }
                );
                
                this.particles.push(particle);
            }
        }
    }
    
    addFanParticles() {
        const maxParticles = Math.max(500, this.settings.particleDensity * 8);
        
        Object.values(this.apartment.fans).forEach(fan => {
            if (!fan.isActive) return;
            
            const particlesPerFrame = Math.floor(fan.flowStrength * 2); // Fewer particles to not compete with AC
            
            for (let i = 0; i < particlesPerFrame; i++) {
                if (this.particles.length < maxParticles * 0.9) {
                    // Fan particles spawn inside the fan unit center
                    const x = fan.x + fan.width/2;
                    const y = fan.y + fan.height/2;
                    
                    // Create narrow directional beam like AC unit (±2 degrees)
                    const maxAngleDegrees = 2; // Narrow fan beam
                    const angleRadians = (Math.random() - 0.5) * 2 * (maxAngleDegrees * Math.PI / 180);
                    
                    // Calculate base direction
                    const baseAngle = Math.atan2(fan.direction.y, fan.direction.x);
                    const finalAngle = baseAngle + angleRadians;
                    
                    const speed = fan.flowStrength * 2.0; // Strong directional flow
                    const particle = new AirParticle(
                        x, y,
                        this.settings.ambientTemp, // Fans move ambient air
                        {
                            x: speed * Math.cos(finalAngle),
                            y: speed * Math.sin(finalAngle)
                        }
                    );
                    
                    this.particles.push(particle);
                }
            }
        });
    }
    
    render() {
        this.renderer.render(this.particles);
    }
    
    updateUI() {
        // Update temperature probes
        const upperTemp = this.apartment.getAverageTemperatureInZone('upperMezzanine');
        const lowerTemp = this.apartment.getAverageTemperatureInZone('lowerFloor');
        const stairTemp = (this.apartment.getAverageTemperatureInZone('upperMezzanine') + 
                          this.apartment.getAverageTemperatureInZone('lowerFloor')) / 2;
        
        document.getElementById('upperTemp').textContent = `${upperTemp.toFixed(1)}°C`;
        document.getElementById('lowerTemp').textContent = `${lowerTemp.toFixed(1)}°C`;
        document.getElementById('stairTemp').textContent = `${stairTemp.toFixed(1)}°C`;
    }
    
    reset() {
        this.particles = [];
        
        // Reset zone temperatures
        Object.values(this.apartment.zones).forEach(zone => {
            zone.temperature = this.settings.ambientTemp;
            zone.airParticles = [];
        });
        
        // Re-initialize with ambient particles
        this.initializeParticles();
    }
}

// Start the simulation when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FluidSimulation();
});