export class FluidRenderer {
    constructor(canvasId, apartment) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.apartment = apartment;
        
        // Fluid field for rendering
        this.fluidField = this.createFluidField();
        this.velocityField = this.createVelocityField();
        this.temperatureTrails = [];
        
        // Scale factors
        this.scaleX = this.canvas.width / apartment.width;
        this.scaleY = this.canvas.height / apartment.height;
        
        // Rendering options
        this.showVectors = false;
        this.fluidDensity = 0.8;
        this.turbulenceStrength = 0.3;
        
        this.setupInteraction();
        this.initializeNoiseField();
    }
    
    createFluidField() {
        const cols = Math.floor(this.canvas.width / 8);
        const rows = Math.floor(this.canvas.height / 8);
        const field = [];
        
        for (let i = 0; i < cols; i++) {
            field[i] = [];
            for (let j = 0; j < rows; j++) {
                field[i][j] = {
                    temperature: 22,
                    density: 0,
                    age: 0,
                    turbulence: 0
                };
            }
        }
        
        this.fieldCols = cols;
        this.fieldRows = rows;
        return field;
    }
    
    createVelocityField() {
        const field = [];
        for (let i = 0; i < this.fieldCols; i++) {
            field[i] = [];
            for (let j = 0; j < this.fieldRows; j++) {
                field[i][j] = { x: 0, y: 0, magnitude: 0 };
            }
        }
        return field;
    }
    
    initializeNoiseField() {
        this.noiseField = [];
        for (let i = 0; i < this.fieldCols; i++) {
            this.noiseField[i] = [];
            for (let j = 0; j < this.fieldRows; j++) {
                this.noiseField[i][j] = Math.random() * 2 - 1;
            }
        }
    }
    
    setupInteraction() {
        let isDrawing = false;
        
        this.canvas.addEventListener('mousedown', (e) => {
            isDrawing = true;
            this.handleCanvasInteraction(e);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (isDrawing) {
                this.handleCanvasInteraction(e);
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            isDrawing = false;
        });
    }
    
    handleCanvasInteraction(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.scaleX;
        const y = (this.canvas.height - (e.clientY - rect.top)) / this.scaleY;
        
        const detail = {
            x: x,
            y: y,
            temperature: e.shiftKey ? 16 : 28,
            velocity: e.altKey ? {
                x: (Math.random() - 0.5) * 2,
                y: (Math.random() - 0.5) * 2
            } : { x: 0, y: 0 }
        };
        
        this.canvas.dispatchEvent(new CustomEvent('injectAir', { detail }));
    }
    
    updateFluidField(particles) {
        // Clear field
        for (let i = 0; i < this.fieldCols; i++) {
            for (let j = 0; j < this.fieldRows; j++) {
                const cell = this.fluidField[i][j];
                cell.density *= 0.95; // Decay
                cell.age *= 0.98;
                cell.turbulence *= 0.9;
                this.velocityField[i][j].x *= 0.9;
                this.velocityField[i][j].y *= 0.9;
            }
        }
        
        // Add particle influence
        particles.forEach(particle => {
            const fieldX = Math.floor((particle.x / this.apartment.width) * this.fieldCols);
            const fieldY = Math.floor((particle.y / this.apartment.height) * this.fieldRows);
            
            if (fieldX >= 0 && fieldX < this.fieldCols && fieldY >= 0 && fieldY < this.fieldRows) {
                const cell = this.fluidField[fieldX][fieldY];
                const velCell = this.velocityField[fieldX][fieldY];
                
                // Add temperature and density
                const tempDiff = Math.abs(particle.temperature - 22);
                cell.temperature = particle.temperature;
                cell.density = Math.min(1, cell.density + 0.1 + tempDiff * 0.02);
                cell.age = Math.min(1, cell.age + 0.1);
                
                // Add velocity influence
                velCell.x += particle.velocity.x * 0.3;
                velCell.y += particle.velocity.y * 0.3;
                velCell.magnitude = Math.sqrt(velCell.x * velCell.x + velCell.y * velCell.y);
                
                // Add turbulence based on velocity
                cell.turbulence = Math.min(1, cell.turbulence + velCell.magnitude * 0.5);
                
                // Spread influence to neighboring cells
                this.spreadInfluence(fieldX, fieldY, particle);
            }
        });
        
        // Apply fluid dynamics
        this.applyFluidDynamics();
    }
    
    spreadInfluence(centerX, centerY, particle) {
        const radius = 2;
        for (let i = -radius; i <= radius; i++) {
            for (let j = -radius; j <= radius; j++) {
                const x = centerX + i;
                const y = centerY + j;
                
                if (x >= 0 && x < this.fieldCols && y >= 0 && y < this.fieldRows) {
                    const distance = Math.sqrt(i * i + j * j);
                    if (distance <= radius && distance > 0) {
                        const influence = Math.max(0, (radius - distance) / radius) * 0.3;
                        const cell = this.fluidField[x][y];
                        
                        cell.temperature = cell.temperature * (1 - influence) + particle.temperature * influence;
                        cell.density = Math.min(1, cell.density + influence * 0.2);
                        
                        // Add some turbulence
                        const noise = this.noiseField[x][y] * this.turbulenceStrength;
                        cell.turbulence = Math.min(1, cell.turbulence + Math.abs(noise) * influence);
                    }
                }
            }
        }
    }
    
    applyFluidDynamics() {
        // Simple fluid simulation - pressure and diffusion
        const newField = JSON.parse(JSON.stringify(this.fluidField));
        
        for (let i = 1; i < this.fieldCols - 1; i++) {
            for (let j = 1; j < this.fieldRows - 1; j++) {
                const current = this.fluidField[i][j];
                const newCell = newField[i][j];
                
                // Diffusion
                const neighbors = [
                    this.fluidField[i-1][j], this.fluidField[i+1][j],
                    this.fluidField[i][j-1], this.fluidField[i][j+1]
                ];
                
                let avgTemp = neighbors.reduce((sum, n) => sum + n.temperature, current.temperature) / 5;
                let avgDensity = neighbors.reduce((sum, n) => sum + n.density, current.density) / 5;
                
                newCell.temperature = current.temperature * 0.8 + avgTemp * 0.2;
                newCell.density = current.density * 0.9 + avgDensity * 0.1;
                
                // Add some swirling motion
                const velCell = this.velocityField[i][j];
                const swirl = Math.sin(i * 0.1 + j * 0.1 + Date.now() * 0.001) * 0.1;
                velCell.x += swirl;
                velCell.y += Math.cos(i * 0.1 + j * 0.1 + Date.now() * 0.001) * 0.1;
            }
        }
        
        this.fluidField = newField;
    }
    
    render(particles) {
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update fluid field
        this.updateFluidField(particles);
        
        // Draw apartment structure
        this.drawApartmentStructure();
        
        // Draw fluid field as flowing plasma
        this.drawFluidField();
        
        // Draw particle trails
        this.drawParticleTrails(particles);
        
        // Draw individual particles with glow effects
        this.drawGlowingParticles(particles);
        
        // Draw velocity vectors if enabled
        if (this.showVectors) {
            this.drawFluidVectors();
        }
        
        // Draw UI overlays
        this.drawUIOverlays();
    }
    
    drawFluidField() {
        const cellWidth = this.canvas.width / this.fieldCols;
        const cellHeight = this.canvas.height / this.fieldRows;
        
        // Create flowing patterns
        for (let i = 0; i < this.fieldCols; i++) {
            for (let j = 0; j < this.fieldRows; j++) {
                const cell = this.fluidField[i][j];
                
                if (cell.density > 0.05) {
                    const x = i * cellWidth;
                    const y = this.canvas.height - (j + 1) * cellHeight;
                    
                    // Create plasma-like colors
                    const tempColor = this.getPlasmaColor(cell.temperature, cell.density, cell.turbulence);
                    
                    // Draw flowing shapes instead of rectangles
                    this.drawFluidShape(x, y, cellWidth, cellHeight, tempColor, cell);
                }
            }
        }
    }
    
    drawFluidShape(x, y, width, height, color, cell) {
        this.ctx.save();
        
        // Create gradient for plasma effect
        const gradient = this.ctx.createRadialGradient(
            x + width/2, y + height/2, 0,
            x + width/2, y + height/2, Math.max(width, height)
        );
        
        const alpha = cell.density * this.fluidDensity;
        gradient.addColorStop(0, color.replace('rgb', 'rgba').replace(')', `, ${alpha})`));
        gradient.addColorStop(1, color.replace('rgb', 'rgba').replace(')', ', 0)'));
        
        this.ctx.fillStyle = gradient;
        
        // Draw flowing shape with turbulence distortion
        this.ctx.beginPath();
        const turbulence = cell.turbulence * 10;
        const time = Date.now() * 0.002;
        
        for (let angle = 0; angle <= Math.PI * 2; angle += 0.2) {
            const radius = Math.min(width, height) / 2;
            const distortion = Math.sin(angle * 3 + time + turbulence) * turbulence;
            const px = x + width/2 + Math.cos(angle) * (radius + distortion);
            const py = y + height/2 + Math.sin(angle) * (radius + distortion);
            
            if (angle === 0) {
                this.ctx.moveTo(px, py);
            } else {
                this.ctx.lineTo(px, py);
            }
        }
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawParticleTrails(particles) {
        // Add current particles to trail history
        particles.forEach(particle => {
            this.temperatureTrails.push({
                x: particle.x * this.scaleX,
                y: this.canvas.height - particle.y * this.scaleY,
                temperature: particle.temperature,
                age: 0
            });
        });
        
        // Age and remove old trails
        this.temperatureTrails = this.temperatureTrails.filter(trail => {
            trail.age += 1;
            return trail.age < 30;
        });
        
        // Draw trails
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        
        for (let i = 1; i < this.temperatureTrails.length; i++) {
            const current = this.temperatureTrails[i];
            const previous = this.temperatureTrails[i-1];
            
            if (current.age < 2) { // Only draw recent connections
                const alpha = (30 - current.age) / 30 * 0.3;
                const color = this.getPlasmaColor(current.temperature, 0.5, 0.2);
                
                this.ctx.strokeStyle = color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(previous.x, previous.y);
                this.ctx.lineTo(current.x, current.y);
                this.ctx.stroke();
            }
        }
        
        this.ctx.restore();
    }
    
    drawGlowingParticles(particles) {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        
        particles.forEach(particle => {
            const x = particle.x * this.scaleX;
            const y = this.canvas.height - particle.y * this.scaleY;
            
            const tempDiff = Math.abs(particle.temperature - 22);
            const glowSize = 3 + tempDiff * 0.5;
            const speed = Math.sqrt(particle.velocity.x ** 2 + particle.velocity.y ** 2);
            
            // Create glow effect
            const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, glowSize * 3);
            const baseColor = this.getPlasmaColor(particle.temperature, 1, speed);
            
            gradient.addColorStop(0, baseColor);
            gradient.addColorStop(0.3, baseColor.replace('rgb', 'rgba').replace(')', ', 0.8)'));
            gradient.addColorStop(1, baseColor.replace('rgb', 'rgba').replace(')', ', 0)'));
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(x, y, glowSize * 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Core particle
            this.ctx.fillStyle = baseColor;
            this.ctx.beginPath();
            this.ctx.arc(x, y, glowSize, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.ctx.restore();
    }
    
    getPlasmaColor(temperature, intensity, turbulence) {
        const minTemp = 10;
        const maxTemp = 40;
        const normalizedTemp = Math.max(0, Math.min(1, (temperature - minTemp) / (maxTemp - minTemp)));
        
        // Create plasma-like colors with more vibrant hues
        let r, g, b;
        
        if (normalizedTemp < 0.33) {
            // Cold: electric blue to cyan
            const t = normalizedTemp / 0.33;
            r = Math.floor(0 + t * 100);
            g = Math.floor(150 + t * 105);
            b = 255;
        } else if (normalizedTemp < 0.66) {
            // Medium: cyan to yellow
            const t = (normalizedTemp - 0.33) / 0.33;
            r = Math.floor(100 + t * 155);
            g = 255;
            b = Math.floor(255 - t * 255);
        } else {
            // Hot: yellow to magenta
            const t = (normalizedTemp - 0.66) / 0.34;
            r = 255;
            g = Math.floor(255 - t * 100);
            b = Math.floor(t * 150);
        }
        
        // Add turbulence effect
        const turbulenceEffect = turbulence * 50;
        r = Math.min(255, Math.max(0, r + turbulenceEffect));
        g = Math.min(255, Math.max(0, g + turbulenceEffect));
        b = Math.min(255, Math.max(0, b + turbulenceEffect));
        
        // Adjust intensity
        r = Math.floor(r * intensity);
        g = Math.floor(g * intensity);
        b = Math.floor(b * intensity);
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    drawFluidVectors() {
        const cellWidth = this.canvas.width / this.fieldCols;
        const cellHeight = this.canvas.height / this.fieldRows;
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.lineWidth = 1;
        
        for (let i = 0; i < this.fieldCols; i += 3) {
            for (let j = 0; j < this.fieldRows; j += 3) {
                const velCell = this.velocityField[i][j];
                
                if (velCell.magnitude > 0.1) {
                    const x = i * cellWidth + cellWidth/2;
                    const y = this.canvas.height - j * cellHeight - cellHeight/2;
                    
                    const scale = 20;
                    const endX = x + velCell.x * scale;
                    const endY = y - velCell.y * scale;
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, y);
                    this.ctx.lineTo(endX, endY);
                    this.ctx.stroke();
                    
                    // Arrow head
                    const angle = Math.atan2(endY - y, endX - x);
                    const arrowLength = 4;
                    this.ctx.beginPath();
                    this.ctx.moveTo(endX, endY);
                    this.ctx.lineTo(
                        endX - arrowLength * Math.cos(angle - Math.PI/6),
                        endY - arrowLength * Math.sin(angle - Math.PI/6)
                    );
                    this.ctx.moveTo(endX, endY);
                    this.ctx.lineTo(
                        endX - arrowLength * Math.cos(angle + Math.PI/6),
                        endY - arrowLength * Math.sin(angle + Math.PI/6)
                    );
                    this.ctx.stroke();
                }
            }
        }
    }
    
    drawApartmentStructure() {
        this.ctx.strokeStyle = '#666666';
        this.ctx.fillStyle = '#333333';
        this.ctx.lineWidth = 2;
        
        // Draw zone boundaries
        Object.values(this.apartment.zones).forEach(zone => {
            if (zone.id === 'stairOpening') return; // Don't draw the stair opening as solid geometry
            
            const x = zone.x * this.scaleX;
            const y = this.canvas.height - (zone.y + zone.height) * this.scaleY;
            const width = zone.width * this.scaleX;
            const height = zone.height * this.scaleY;
            
            this.ctx.strokeRect(x, y, width, height);
        });
        
        // Draw floor with stair opening
        this.ctx.fillStyle = '#444444';
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = '#888888';
        
        // Left part of floor
        this.ctx.fillRect(0, this.canvas.height - 3 * this.scaleY - 5, 4.9 * this.scaleX, 10);
        
        // Right part of floor
        this.ctx.fillRect(6.1 * this.scaleX, this.canvas.height - 3 * this.scaleY - 5, (this.apartment.width - 6.1) * this.scaleX, 10);
        
        // Bedroom wall
        this.ctx.fillRect(6 * this.scaleX, this.canvas.height - 6 * this.scaleY, 0.1 * this.scaleX, (6 - 5.1) * this.scaleY);
        
        // AC Unit
        this.drawACUnit();
        
        // Windows
        this.drawWindows();
        
        // Labels
        this.drawLabels();
    }
    
    drawACUnit() {
        const ac = this.apartment.acUnit;
        const x = ac.x * this.scaleX;
        const y = this.canvas.height - (ac.y + ac.height) * this.scaleY;
        const width = ac.width * this.scaleX;
        const height = ac.height * this.scaleY;
        
        this.ctx.fillStyle = ac.isActive ? '#0066ff' : '#666666';
        this.ctx.fillRect(x, y, width, height);
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, width, height);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px Arial';
        this.ctx.fillText('AC', x + width/4, y + height/2 + 3);
    }
    
    drawWindows() {
        Object.entries(this.apartment.openings).forEach(([name, opening]) => {
            if (opening.toZone === 'outside' && opening.isOpen) {
                const x = opening.x * this.scaleX;
                const y = this.canvas.height - (opening.y + opening.height) * this.scaleY;
                const width = opening.width * this.scaleX;
                const height = opening.height * this.scaleY;
                
                this.ctx.strokeStyle = '#00ff00';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(x, y, width, height);
            }
        });
    }
    
    drawLabels() {
        this.ctx.fillStyle = '#cccccc';
        this.ctx.font = '12px Arial';
        
        this.ctx.fillText('Mezzanine', 10, 30);
        this.ctx.fillText('Bedroom', 6.2 * this.scaleX, 30);
        this.ctx.fillText('Lower Floor', 10, this.canvas.height - 10);
        this.ctx.fillText('Stair Opening', 4.5 * this.scaleX, this.canvas.height / 2);
    }
    
    drawUIOverlays() {
        this.drawTemperatureLegend();
    }
    
    drawTemperatureLegend() {
        const legendX = this.canvas.width - 120;
        const legendY = 20;
        const legendWidth = 100;
        const legendHeight = 15;
        
        const gradient = this.ctx.createLinearGradient(legendX, 0, legendX + legendWidth, 0);
        gradient.addColorStop(0, this.getPlasmaColor(10, 1, 0));
        gradient.addColorStop(0.5, this.getPlasmaColor(25, 1, 0));
        gradient.addColorStop(1, this.getPlasmaColor(40, 1, 0));
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px Arial';
        this.ctx.fillText('10°C', legendX, legendY + legendHeight + 12);
        this.ctx.fillText('40°C', legendX + legendWidth - 25, legendY + legendHeight + 12);
    }
    
    toggleVectors() {
        this.showVectors = !this.showVectors;
        return this.showVectors;
    }
    
    setFluidDensity(density) {
        this.fluidDensity = density;
    }
    
    setTurbulenceStrength(strength) {
        this.turbulenceStrength = strength;
    }
}