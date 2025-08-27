export class FlowSolver {
    constructor(apartment, AirParticle) {
        this.apartment = apartment;
        this.ambientTemperature = 22;
        this.AirParticle = AirParticle;
    }
    
    update(particles, dt) {
        // Clear zone particle arrays
        Object.values(this.apartment.zones).forEach(zone => {
            zone.airParticles = [];
        });
        
        // Assign particles to zones
        particles.forEach(particle => {
            const zone = this.apartment.getZoneAtPoint(particle.x, particle.y);
            if (zone) {
                zone.airParticles.push(particle);
                particle.zone = zone.id;
            }
        });
        
        // Update zone temperatures based on particles
        this.updateZoneTemperatures();
        
        // Calculate inter-zone flows
        this.calculateInterZoneFlows(dt);
        
        // Apply AC unit effects
        this.applyACEffects(particles, dt);
        
        // Handle particle interactions
        this.handleParticleInteractions(particles, dt);
    }
    
    updateZoneTemperatures() {
        Object.values(this.apartment.zones).forEach(zone => {
            if (zone.airParticles.length > 0) {
                const avgTemp = zone.airParticles.reduce((sum, p) => sum + p.temperature, 0) / zone.airParticles.length;
                // Smooth temperature change
                zone.temperature = zone.temperature * 0.95 + avgTemp * 0.05;
            } else {
                // Gradually return to ambient if no particles
                zone.temperature = zone.temperature * 0.999 + this.ambientTemperature * 0.001;
            }
        });
    }
    
    calculateInterZoneFlows(dt) {
        Object.values(this.apartment.zones).forEach(zone => {
            zone.connections.forEach(connectedZoneId => {
                const connectedZone = this.apartment.zones[connectedZoneId];
                if (!connectedZone) return;
                
                // Check if there's an opening between zones
                const openings = this.apartment.getOpeningsBetweenZones(zone.id, connectedZoneId);
                let totalFlowArea = 0;
                
                openings.forEach(opening => {
                    if (opening.isOpen) {
                        totalFlowArea += opening.width * opening.height;
                    }
                });
                
                // For stair shaft, always allow some flow
                if ((zone.id === 'stairShaft' || connectedZoneId === 'stairShaft') && totalFlowArea === 0) {
                    totalFlowArea = 1.0; // Default stair opening
                }
                
                if (totalFlowArea > 0) {
                    this.createInterZoneFlow(zone, connectedZone, totalFlowArea, dt);
                }
            });
        });
    }
    
    createInterZoneFlow(zoneA, zoneB, flowArea, dt) {
        // Calculate pressure difference based on temperature difference
        const tempDiff = zoneA.temperature - zoneB.temperature;
        const pressureDiff = tempDiff * 0.1; // Simplified pressure calculation
        
        // Cold air flows toward warm air (density-driven flow)
        const flowDirection = tempDiff > 0 ? 1 : -1;
        const flowStrength = Math.abs(pressureDiff) * flowArea * dt * 0.1;
        
        // Move some particles between zones if pressure difference exists
        if (Math.abs(tempDiff) > 0.5 && flowStrength > 0.01) {
            this.moveParticlesBetweenZones(zoneA, zoneB, flowDirection, flowStrength);
        }
    }
    
    moveParticlesBetweenZones(zoneA, zoneB, flowDirection, flowStrength) {
        const sourceZone = flowDirection > 0 ? zoneA : zoneB;
        const targetZone = flowDirection > 0 ? zoneB : zoneA;
        
        if (sourceZone.airParticles.length === 0) return;
        
        // Calculate how many particles to move
        const particlesToMove = Math.min(
            Math.floor(sourceZone.airParticles.length * flowStrength * 0.1),
            Math.max(1, Math.floor(sourceZone.airParticles.length * 0.05))
        );
        
        for (let i = 0; i < particlesToMove; i++) {
            const particle = sourceZone.airParticles[Math.floor(Math.random() * sourceZone.airParticles.length)];
            if (particle) {
                // Move particle toward target zone
                const targetCenter = {
                    x: targetZone.x + targetZone.width / 2,
                    y: targetZone.y + targetZone.height / 2
                };
                
                const dx = targetCenter.x - particle.x;
                const dy = targetCenter.y - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    const force = flowStrength * 0.5;
                    particle.addForce(
                        (dx / distance) * force,
                        (dy / distance) * force
                    );
                }
            }
        }
    }
    
    applyACEffects(particles, dt) {
        if (!this.apartment.acUnit.isActive) return;
        
        const ac = this.apartment.acUnit;
        const acZone = this.apartment.zones[ac.zone];
        if (!acZone) return;
        
        // Create new cold air particles near AC unit
        const particlesPerFrame = Math.floor(ac.flowStrength * 2);
        
        for (let i = 0; i < particlesPerFrame; i++) {
            if (particles.length < 1000) { // Limit total particles
                const newParticle = this.createACParticle(ac, this.AirParticle);
                particles.push(newParticle);
            }
        }
        
        // Apply cooling effect to particles in the AC airflow path (including extended tube)
        acZone.airParticles.forEach(particle => {
            const tube = ac.tube;
            // Check if particle is in the AC's extended airflow path
            const isInAirflowPath = (
                particle.x >= ac.x && // To the right of AC start
                particle.x <= tube.x + tube.width + 1.0 && // Including extended tube + 1m beyond
                particle.y >= tube.y - 0.1 && // Within narrow vertical band of tube
                particle.y <= tube.y + tube.height + 0.1
            );
            
            if (isInAirflowPath) {
                // Distance from AC outlet center
                const dx = particle.x - (ac.x + ac.width);
                const dy = particle.y - (ac.y + ac.height / 2);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 2.0) { // Within AC influence range
                    const coolingEffect = Math.max(0, (2.0 - distance) / 2.0) * ac.flowStrength * dt * 0.8;
                    const targetTemp = ac.temperature;
                    particle.temperature = particle.temperature * (1 - coolingEffect) + targetTemp * coolingEffect;
                    
                    // Add strong horizontal push to the right (no vertical component)
                    const pushForce = ac.flowStrength * 0.3 * (2.0 - distance) / 2.0;
                    particle.addForce(pushForce, 0); // Pure horizontal force only
                }
            }
        });
    }
    
    createACParticle(ac, AirParticle) {
        // Create particles at the right edge of AC unit for laser-straight beam
        const x = ac.x + ac.width; // Start at right edge of AC
        const y = ac.y + ac.height/2; // Always at exact center
        
        // Create ultra-narrow beam (±1 degree maximum)
        const maxAngleDegrees = 1; // Ultra-narrow beam
        const angleRadians = (Math.random() - 0.5) * 2 * (maxAngleDegrees * Math.PI / 180);
        
        const speed = ac.flowStrength * 1.5;
        const particle = new AirParticle(
            x, y, ac.temperature, 
            { 
                x: speed * Math.cos(angleRadians), // 99.9% horizontal
                y: speed * Math.sin(angleRadians)  // Tiny vertical component (±1°)
            }
        );
        
        return particle;
    }
    
    handleParticleInteractions(particles, dt) {
        // Simple particle-to-particle temperature mixing
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const particleA = particles[i];
                const particleB = particles[j];
                
                const distance = particleA.distanceTo(particleB);
                
                if (distance < 0.3) { // Close enough to interact
                    // Temperature mixing
                    const tempDiff = particleA.temperature - particleB.temperature;
                    const mixingRate = 0.1 * dt;
                    
                    particleA.temperature -= tempDiff * mixingRate;
                    particleB.temperature += tempDiff * mixingRate;
                    
                    // Simple collision response
                    const repulsion = 0.05;
                    const dx = (particleA.x - particleB.x) / distance;
                    const dy = (particleA.y - particleB.y) / distance;
                    
                    particleA.addForce(dx * repulsion, dy * repulsion);
                    particleB.addForce(-dx * repulsion, -dy * repulsion);
                }
            }
        }
    }
    
    setAmbientTemperature(temp) {
        this.ambientTemperature = temp;
    }
}