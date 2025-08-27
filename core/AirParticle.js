export class AirParticle {
    constructor(x, y, temperature = 22, velocity = { x: 0, y: 0 }) {
        this.x = x;
        this.y = y;
        this.temperature = temperature;
        this.velocity = velocity;
        this.age = 0;
        this.maxAge = 1200; // Particle lifetime in frames (20 seconds at 60fps)
        this.mass = this.calculateMass(temperature);
        this.id = Math.random().toString(36).substr(2, 9);
        this.zone = null; // Will be set by apartment
    }
    
    calculateMass(temperature) {
        // Cold air is denser, warm air is lighter
        // Base mass at 20°C, adjusted by temperature
        const baseMass = 1.0;
        const tempEffect = (20 - temperature) * 0.05; // 5% change per degree
        return Math.max(0.1, baseMass + tempEffect);
    }
    
    update(dt, apartment, ambientTemp = 22) {
        this.age += 1;
        
        // Update mass based on current temperature
        this.mass = this.calculateMass(this.temperature);
        
        // Apply buoyancy (cold air sinks, warm air rises) - but reduced for fast-moving particles
        const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
        const momentumFactor = Math.max(0.1, 1 - speed * 0.5); // Reduce physics effects for fast particles
        
        const buoyancyForce = (ambientTemp - this.temperature) * 0.02 * momentumFactor;
        this.velocity.y += buoyancyForce * dt;
        
        // Apply gravity effect for cold air - reduced for fast horizontal particles
        if (this.temperature < ambientTemp) {
            this.velocity.y -= 0.1 * dt * momentumFactor;
        }
        
        // Air resistance/friction
        this.velocity.x *= 0.99;
        this.velocity.y *= 0.99;
        
        // Update position
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;
        
        // Temperature mixing with environment (gradual)
        const tempMixingRate = 0.001;
        const tempDiff = ambientTemp - this.temperature;
        this.temperature += tempDiff * tempMixingRate;
        
        // Boundary checks
        this.handleBoundaries(apartment);
        
        return this.age < this.maxAge;
    }
    
    handleBoundaries(apartment) {
        // Check if particle is still in a valid zone
        const currentZone = apartment.getZoneAtPoint(this.x, this.y);
        
        if (!currentZone) {
            // Particle is outside valid zones, try to bounce back
            this.bounceFromWalls(apartment);
        } else {
            this.zone = currentZone.id;
        }
        
        // Handle window openings (particles can escape)
        this.handleWindowEscape(apartment);
    }
    
    bounceFromWalls(apartment) {
        // Simple wall collision - bounce off apartment boundaries
        if (this.x <= 0) {
            this.x = 0;
            this.velocity.x = Math.abs(this.velocity.x) * 0.3;
        }
        if (this.x >= apartment.width) {
            this.x = apartment.width;
            this.velocity.x = -Math.abs(this.velocity.x) * 0.3;
        }
        if (this.y <= 0) {
            this.y = 0;
            this.velocity.y = Math.abs(this.velocity.y) * 0.3;
        }
        if (this.y >= apartment.height) {
            this.y = apartment.height;
            this.velocity.y = -Math.abs(this.velocity.y) * 0.3;
        }
        
        // Handle floor separation (particles can't pass through solid floor)
        // Floor exists everywhere except in the stair opening
        const opening = apartment.stairOpening;
        const inStairOpening = (this.x >= opening.x && this.x <= opening.x + opening.width);
        
        if (!inStairOpening) {
            // Outside stair opening - solid floor at y=3
            if (this.y > 2.95 && this.y < 3.05) {
                // Particle is at floor level, bounce it to correct side
                if (this.velocity.y > 0) {
                    // Moving up from lower floor
                    this.y = 2.95;
                    this.velocity.y = -Math.abs(this.velocity.y) * 0.3;
                } else {
                    // Moving down from upper floor  
                    this.y = 3.05;
                    this.velocity.y = Math.abs(this.velocity.y) * 0.3;
                }
            } else if (this.y > 3 && this.y < 3.1) {
                // Particle leaked through to upper side, push it back up
                this.y = 3.05;
                this.velocity.y = Math.abs(this.velocity.y) * 0.5;
            } else if (this.y < 3 && this.y > 2.9) {
                // Particle leaked through to lower side, push it back down
                this.y = 2.95;
                this.velocity.y = -Math.abs(this.velocity.y) * 0.5;
            }
        }
    }
    
    handleWindowEscape(apartment) {
        // Check if particle is near open windows and should escape
        for (const [name, opening] of Object.entries(apartment.openings)) {
            if (opening.isOpen && opening.toZone === 'outside') {
                const inWindow = (
                    this.x >= opening.x - 0.1 && 
                    this.x <= opening.x + opening.width + 0.1 &&
                    this.y >= opening.y && 
                    this.y <= opening.y + opening.height
                );
                
                if (inWindow) {
                    // Mark particle for removal (escaped through window)
                    this.age = this.maxAge;
                    return;
                }
            }
        }
        
        // Handle bedroom wall (vertical wall at x=6, from y=3 to y=6)
        if (this.x > 5.9 && this.x < 6.1 && this.y >= 3 && this.y <= 6) {
            // Check if door is open and particle is in door area (y=3 to y=5.1)
            const doorOpen = apartment.openings.bedroomDoor.isOpen;
            const inDoorArea = (this.y >= 3 && this.y <= 5.1);
            
            if (!doorOpen || !inDoorArea) {
                // Solid wall - bounce particle back
                if (this.velocity.x > 0) {
                    // Moving right (mezzanine to bedroom), bounce back left
                    this.x = 5.9;
                    this.velocity.x = -Math.abs(this.velocity.x) * 0.3;
                } else {
                    // Moving left (bedroom to mezzanine), bounce back right
                    this.x = 6.1;
                    this.velocity.x = Math.abs(this.velocity.x) * 0.3;
                }
            }
        }
        
        // Handle AC unit tube walls - prevent particles from escaping through sides/back
        const ac = apartment.acUnit;
        const tube = ac.tube;
        
        // Check if particle is in main AC unit
        const inMainUnit = (this.x >= ac.x && this.x <= ac.x + ac.width &&
                           this.y >= ac.y && this.y <= ac.y + ac.height);
        
        // Check if particle is in extended tube
        const inExtendedTube = (this.x >= tube.x && this.x <= tube.x + tube.width &&
                               this.y >= tube.y && this.y <= tube.y + tube.height);
        
        if (inMainUnit || inExtendedTube) {
            // Determine which section we're in for appropriate centering
            let centerY, sectionTop, sectionBottom;
            
            if (inMainUnit) {
                centerY = ac.y + ac.height / 2;
                sectionTop = ac.y + ac.height;
                sectionBottom = ac.y;
            } else {
                centerY = tube.y + tube.height / 2;
                sectionTop = tube.y + tube.height;
                sectionBottom = tube.y;
            }
            
            // Strong force toward outlet
            const forceToOutlet = 2.5;
            this.velocity.x = Math.max(this.velocity.x, forceToOutlet);
            
            // Keep particle centered vertically within current section
            const allowedDeviation = inExtendedTube ? tube.height * 0.2 : ac.height * 0.3;
            if (Math.abs(this.y - centerY) > allowedDeviation) {
                const correctionForce = (centerY - this.y) * 0.8;
                this.velocity.y += correctionForce;
            }
            
            // Bounce off tube walls
            if (this.y <= sectionBottom) {
                this.y = sectionBottom + 0.01;
                this.velocity.y = Math.abs(this.velocity.y) * 0.1;
            } else if (this.y >= sectionTop) {
                this.y = sectionTop - 0.01;
                this.velocity.y = -Math.abs(this.velocity.y) * 0.1;
            }
            
            // Prevent backward movement
            if (inMainUnit && this.x <= ac.x) {
                this.x = ac.x + 0.01;
                this.velocity.x = Math.abs(this.velocity.x) * 1.5;
            } else if (inExtendedTube && this.x <= tube.x) {
                this.x = tube.x + 0.01;
                this.velocity.x = Math.abs(this.velocity.x) * 1.2;
            }
        }
        
        // Handle fan ducts - keep particles flowing in the right direction
        Object.values(apartment.fans).forEach(fan => {
            if (!fan.isActive || !fan.duct) return;
            
            const duct = fan.duct;
            const inDuct = (this.x >= duct.x && this.x <= duct.x + duct.width &&
                           this.y >= duct.y && this.y <= duct.y + duct.height);
            
            if (inDuct) {
                // Strong directional force based on fan direction
                const forceStrength = 3.0;
                this.velocity.x += fan.direction.x * forceStrength;
                this.velocity.y += fan.direction.y * forceStrength;
                
                // Bounce off duct walls
                if (this.x <= duct.x) {
                    this.x = duct.x + 0.01;
                    this.velocity.x = Math.abs(this.velocity.x);
                } else if (this.x >= duct.x + duct.width) {
                    this.x = duct.x + duct.width - 0.01;
                    this.velocity.x = -Math.abs(this.velocity.x);
                }
                
                if (this.y <= duct.y) {
                    this.y = duct.y + 0.01;
                    this.velocity.y = Math.abs(this.velocity.y);
                } else if (this.y >= duct.y + duct.height) {
                    this.y = duct.y + duct.height - 0.01;
                    this.velocity.y = -Math.abs(this.velocity.y);
                }
                
                // Keep particles centered in the duct
                const ductCenterX = duct.x + duct.width / 2;
                const ductCenterY = duct.y + duct.height / 2;
                
                if (Math.abs(this.x - ductCenterX) > duct.width * 0.3) {
                    const correctionX = (ductCenterX - this.x) * 0.5;
                    this.velocity.x += correctionX;
                }
                
                if (Math.abs(this.y - ductCenterY) > duct.height * 0.3) {
                    const correctionY = (ductCenterY - this.y) * 0.5;
                    this.velocity.y += correctionY;
                }
            }
        });
    }
    
    addForce(forceX, forceY) {
        this.velocity.x += forceX;
        this.velocity.y += forceY;
        
        // Limit velocity to prevent unrealistic speeds
        const maxVel = 5.0;
        const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
        if (speed > maxVel) {
            this.velocity.x = (this.velocity.x / speed) * maxVel;
            this.velocity.y = (this.velocity.y / speed) * maxVel;
        }
    }
    
    setTemperature(newTemp) {
        this.temperature = newTemp;
        this.mass = this.calculateMass(newTemp);
    }
    
    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // Get particle color based on temperature for visualization
    getColor() {
        // Map temperature to color (blue for cold, red/orange for warm)
        const minTemp = 10;
        const maxTemp = 30;
        const normalizedTemp = (this.temperature - minTemp) / (maxTemp - minTemp);
        
        if (normalizedTemp <= 0.5) {
            // Cold: blue to cyan
            const intensity = Math.floor((1 - normalizedTemp * 2) * 255);
            return `rgb(${intensity}, ${intensity}, 255)`;
        } else {
            // Warm: yellow to red
            const intensity = Math.floor((normalizedTemp - 0.5) * 2 * 255);
            return `rgb(255, ${255 - intensity}, 0)`;
        }
    }
}