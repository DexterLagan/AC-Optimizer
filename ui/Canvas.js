export class CanvasRenderer {
    constructor(canvasId, apartment) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.apartment = apartment;
        
        // Scale factors for visualization
        this.scaleX = this.canvas.width / apartment.width;   // pixels per meter
        this.scaleY = this.canvas.height / apartment.height;
        
        this.showVectors = false;
        this.showTemperatureField = true;
        
        this.setupInteraction();
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
        
        this.canvas.addEventListener('mouseleave', () => {
            isDrawing = false;
        });
    }
    
    handleCanvasInteraction(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.scaleX;
        const y = (this.canvas.height - (e.clientY - rect.top)) / this.scaleY; // Flip Y
        
        // Emit custom event for particle injection
        const detail = {
            x: x,
            y: y,
            temperature: e.shiftKey ? 16 : 28, // Cold air with Shift, warm air otherwise
            velocity: e.altKey ? {
                x: (Math.random() - 0.5) * 2,
                y: (Math.random() - 0.5) * 2
            } : { x: 0, y: 0 }
        };
        
        this.canvas.dispatchEvent(new CustomEvent('injectAir', { detail }));
    }
    
    render(particles) {
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw temperature field background
        if (this.showTemperatureField) {
            this.drawTemperatureField();
        }
        
        // Draw apartment structure
        this.drawApartmentStructure();
        
        // Draw particles
        this.drawParticles(particles);
        
        // Draw velocity vectors if enabled
        if (this.showVectors) {
            this.drawVelocityVectors(particles);
        }
        
        // Draw UI overlays
        this.drawUIOverlays();
    }
    
    drawTemperatureField() {
        const gridSize = 20; // Temperature field resolution
        const cellWidth = this.canvas.width / gridSize;
        const cellHeight = this.canvas.height / gridSize;
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const x = (i / gridSize) * this.apartment.width;
                const y = (j / gridSize) * this.apartment.height;
                
                const zone = this.apartment.getZoneAtPoint(x, y);
                if (zone) {
                    const temp = zone.temperature;
                    const color = this.getTemperatureColor(temp);
                    
                    this.ctx.fillStyle = color;
                    this.ctx.globalAlpha = 0.3;
                    this.ctx.fillRect(
                        i * cellWidth,
                        this.canvas.height - (j + 1) * cellHeight,
                        cellWidth,
                        cellHeight
                    );
                }
            }
        }
        this.ctx.globalAlpha = 1.0;
    }
    
    drawApartmentStructure() {
        this.ctx.strokeStyle = '#666666';
        this.ctx.fillStyle = '#333333';
        this.ctx.lineWidth = 2;
        
        // Draw zone boundaries (for debugging)
        Object.values(this.apartment.zones).forEach(zone => {
            const x = zone.x * this.scaleX;
            const y = this.canvas.height - (zone.y + zone.height) * this.scaleY;
            const width = zone.width * this.scaleX;
            const height = zone.height * this.scaleY;
            
            this.ctx.strokeRect(x, y, width, height);
        });
        
        // Draw floor separation (solid floor with stair opening)
        this.ctx.fillStyle = '#444444';
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = '#888888';
        
        // Left part of floor
        this.ctx.fillRect(
            0, 
            this.canvas.height - 3 * this.scaleY - 5,
            4.9 * this.scaleX,
            10
        );
        
        // Right part of floor
        this.ctx.fillRect(
            6.1 * this.scaleX,
            this.canvas.height - 3 * this.scaleY - 5,
            (this.apartment.width - 6.1) * this.scaleX,
            10
        );
        
        // Partition wall above bedroom door
        this.ctx.fillRect(
            6 * this.scaleX,
            this.canvas.height - 6 * this.scaleY,
            0.1 * this.scaleX,
            (6 - 5.1) * this.scaleY // From door head to ceiling
        );
        
        // AC Unit
        this.drawACUnit();
        
        // Fans
        this.drawFans();
        
        // Windows (if open)
        this.drawWindows();
        
        // Labels
        this.drawLabels();
    }
    
    drawACUnit() {
        const ac = this.apartment.acUnit;
        const tube = ac.tube;
        
        // Main AC unit
        const x = ac.x * this.scaleX;
        const y = this.canvas.height - (ac.y + ac.height) * this.scaleY;
        const width = ac.width * this.scaleX;
        const height = ac.height * this.scaleY;
        
        // AC unit body
        this.ctx.fillStyle = ac.isActive ? '#0066ff' : '#666666';
        this.ctx.fillRect(x, y, width, height);
        
        // AC unit border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);
        
        // Extended tube
        const tubeX = tube.x * this.scaleX;
        const tubeY = this.canvas.height - (tube.y + tube.height) * this.scaleY;
        const tubeWidth = tube.width * this.scaleX;
        const tubeHeight = tube.height * this.scaleY;
        
        // Tube body (slightly darker)
        this.ctx.fillStyle = ac.isActive ? '#004499' : '#555555';
        this.ctx.fillRect(tubeX, tubeY, tubeWidth, tubeHeight);
        
        // Tube border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(tubeX, tubeY, tubeWidth, tubeHeight);
        
        // Draw connecting tube walls
        this.ctx.strokeStyle = '#cccccc';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        // Top wall connection
        this.ctx.moveTo(x + width, y);
        this.ctx.lineTo(tubeX, tubeY);
        // Bottom wall connection  
        this.ctx.moveTo(x + width, y + height);
        this.ctx.lineTo(tubeX, tubeY + tubeHeight);
        this.ctx.stroke();
        
        // AC label
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '8px Arial';
        this.ctx.fillText('AC', x + width/4, y + height/2 + 2);
        
        // Tube label
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '6px Arial';
        this.ctx.fillText('VENT', tubeX + tubeWidth/4, tubeY + tubeHeight/2 + 1);
    }
    
    drawFans() {
        Object.values(this.apartment.fans).forEach(fan => {
            const x = fan.x * this.scaleX;
            const y = this.canvas.height - (fan.y + fan.height) * this.scaleY;
            const width = fan.width * this.scaleX;
            const height = fan.height * this.scaleY;
            
            // Fan body
            this.ctx.fillStyle = fan.isActive ? '#ff6600' : '#888888';
            this.ctx.fillRect(x, y, width, height);
            
            // Fan border
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, width, height);
            
            // Fan blades (simple cross pattern)
            if (fan.isActive) {
                this.ctx.strokeStyle = '#ffaa66';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + width, y + height);
                this.ctx.moveTo(x + width, y);
                this.ctx.lineTo(x, y + height);
                this.ctx.stroke();
            }
            
            // Direction arrow
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            const centerX = x + width/2;
            const centerY = y + height/2;
            const arrowLength = Math.min(width, height) * 0.6;
            
            const endX = centerX + fan.direction.x * arrowLength;
            const endY = centerY - fan.direction.y * arrowLength; // Flip Y for canvas
            
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();
            
            // Arrow head
            const angle = Math.atan2(centerY - endY, endX - centerX);
            const arrowHeadLength = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(endX, endY);
            this.ctx.lineTo(
                endX - arrowHeadLength * Math.cos(angle - Math.PI/6),
                endY - arrowHeadLength * Math.sin(angle - Math.PI/6)
            );
            this.ctx.moveTo(endX, endY);
            this.ctx.lineTo(
                endX - arrowHeadLength * Math.cos(angle + Math.PI/6),
                endY - arrowHeadLength * Math.sin(angle + Math.PI/6)
            );
            this.ctx.stroke();
            
            // Fan label
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '6px Arial';
            const label = fan.id === 'stairFan' ? 'FAN↓' : 'FAN←';
            this.ctx.fillText(label, x + 2, y + height - 2);
            
            // Draw fan duct if it exists
            if (fan.duct) {
                const ductX = fan.duct.x * this.scaleX;
                const ductY = this.canvas.height - (fan.duct.y + fan.duct.height) * this.scaleY;
                const ductWidth = fan.duct.width * this.scaleX;
                const ductHeight = fan.duct.height * this.scaleY;
                
                // Duct walls (darker than fan)
                this.ctx.fillStyle = fan.isActive ? '#cc4400' : '#666666';
                this.ctx.fillRect(ductX, ductY, ductWidth, ductHeight);
                
                // Duct border
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(ductX, ductY, ductWidth, ductHeight);
            }
        });
    }
    
    drawWindows() {
        Object.entries(this.apartment.openings).forEach(([name, opening]) => {
            if (opening.toZone === 'outside' && opening.isOpen) {
                const x = opening.x * this.scaleX;
                const y = this.canvas.height - (opening.y + opening.height) * this.scaleY;
                const width = opening.width * this.scaleX;
                const height = opening.height * this.scaleY;
                
                // Window opening (green indicator)
                this.ctx.strokeStyle = '#00ff00';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(x, y, width, height);
                
                // Arrow indicating airflow direction
                this.ctx.fillStyle = '#00ff00';
                this.ctx.beginPath();
                this.ctx.moveTo(x + width/2, y + height/2);
                this.ctx.lineTo(x + width/2 + 10, y + height/2);
                this.ctx.lineTo(x + width/2 + 7, y + height/2 - 3);
                this.ctx.moveTo(x + width/2 + 10, y + height/2);
                this.ctx.lineTo(x + width/2 + 7, y + height/2 + 3);
                this.ctx.stroke();
            }
        });
    }
    
    drawLabels() {
        this.ctx.fillStyle = '#cccccc';
        this.ctx.font = '12px Arial';
        
        // Zone labels
        this.ctx.fillText('Mezzanine', 10, 30);
        this.ctx.fillText('Bedroom', 6.2 * this.scaleX, 30);
        this.ctx.fillText('Lower Floor (Continuous)', 10, this.canvas.height - 10);
        this.ctx.fillText('Stair', 4.7 * this.scaleX, this.canvas.height / 2);
    }
    
    drawParticles(particles) {
        particles.forEach(particle => {
            const x = particle.x * this.scaleX;
            const y = this.canvas.height - particle.y * this.scaleY;
            
            // Particle size based on temperature difference from ambient
            const tempDiff = Math.abs(particle.temperature - 22);
            const size = Math.max(2, Math.min(6, 2 + tempDiff * 0.3));
            
            // Particle color based on temperature
            this.ctx.fillStyle = particle.getColor();
            this.ctx.globalAlpha = 0.8;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.globalAlpha = 1.0;
        });
    }
    
    drawVelocityVectors(particles) {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        
        particles.forEach(particle => {
            if (Math.random() > 0.1) return; // Only show 10% of vectors for clarity
            
            const x = particle.x * this.scaleX;
            const y = this.canvas.height - particle.y * this.scaleY;
            
            const velScale = 20;
            const endX = x + particle.velocity.x * velScale;
            const endY = y - particle.velocity.y * velScale;
            
            // Only draw if velocity is significant
            const speed = Math.sqrt(particle.velocity.x ** 2 + particle.velocity.y ** 2);
            if (speed > 0.01) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(endX, endY);
                this.ctx.stroke();
                
                // Arrowhead
                const angle = Math.atan2(endY - y, endX - x);
                const arrowLength = 5;
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
        });
    }
    
    drawUIOverlays() {
        // Temperature scale legend
        this.drawTemperatureLegend();
    }
    
    drawTemperatureLegend() {
        const legendX = this.canvas.width - 120;
        const legendY = 20;
        const legendWidth = 100;
        const legendHeight = 15;
        
        // Temperature gradient
        const gradient = this.ctx.createLinearGradient(legendX, 0, legendX + legendWidth, 0);
        gradient.addColorStop(0, this.getTemperatureColor(10));
        gradient.addColorStop(0.5, this.getTemperatureColor(22));
        gradient.addColorStop(1, this.getTemperatureColor(30));
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);
        
        // Labels
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px Arial';
        this.ctx.fillText('10°C', legendX, legendY + legendHeight + 12);
        this.ctx.fillText('30°C', legendX + legendWidth - 25, legendY + legendHeight + 12);
    }
    
    getTemperatureColor(temperature) {
        // Map temperature to color (blue for cold, red for warm)
        const minTemp = 10;
        const maxTemp = 30;
        const normalizedTemp = Math.max(0, Math.min(1, (temperature - minTemp) / (maxTemp - minTemp)));
        
        if (normalizedTemp <= 0.5) {
            // Cold: blue to cyan
            const intensity = Math.floor((1 - normalizedTemp * 2) * 255);
            return `rgb(0, ${255 - intensity}, 255)`;
        } else {
            // Warm: yellow to red
            const intensity = Math.floor((normalizedTemp - 0.5) * 2 * 255);
            return `rgb(255, ${255 - intensity}, 0)`;
        }
    }
    
    toggleVectors() {
        this.showVectors = !this.showVectors;
        return this.showVectors;
    }
    
    toggleTemperatureField() {
        this.showTemperatureField = !this.showTemperatureField;
        return this.showTemperatureField;
    }
}