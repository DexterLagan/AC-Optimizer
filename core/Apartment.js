export class Apartment {
    constructor(width = 9.0, height = 6.0) {
        this.width = width;   // 9 meters
        this.height = height; // 6 meters
        this.floorHeight = 3.0; // Each floor is 3m high
        
        // Zone definitions (in meters)
        this.zones = {
            upperMezzanine: {
                id: 'upperMezzanine',
                x: 0, y: 3, width: 6, height: 3,
                connections: ['upperBedroom', 'stairShaft'],
                temperature: 22,
                airParticles: []
            },
            upperBedroom: {
                id: 'upperBedroom', 
                x: 6, y: 3, width: 3, height: 3,
                connections: ['upperMezzanine'],
                temperature: 22,
                airParticles: []
            },
            lowerFloor: {
                id: 'lowerFloor',
                x: 0, y: 0, width: 9, height: 3,
                connections: [],
                temperature: 22,
                airParticles: []
            }
        };
        
        // Openings
        this.openings = {
            bedroomDoor: {
                fromZone: 'upperMezzanine',
                toZone: 'upperBedroom',
                x: 6, y: 3, width: 0.8, height: 2.1,
                isOpen: true
            },
            leftWindow: {
                fromZone: 'lowerFloor',
                toZone: 'outside',
                x: 0, y: 0.5, width: 0.1, height: 1.5,
                isOpen: false
            },
            rightWindow: {
                fromZone: 'lowerFloor', 
                toZone: 'outside',
                x: 8.9, y: 0.5, width: 0.1, height: 1.5,
                isOpen: false
            }
        };
        
        // Stair opening (just coordinates for collision detection)
        this.stairOpening = {
            x: 4.9, y: 2.9, width: 1.2, height: 0.2
        };
        
        // AC Unit with extended tube
        this.acUnit = {
            zone: 'upperMezzanine',
            x: 0.2, y: 4, width: 0.6, height: 0.3, // 1m above floor (y=4)
            temperature: 16,
            flowStrength: 0.5,
            isActive: true,
            direction: { x: 1, y: 0 }, // Blow horizontally to the right
            // Extended tube for particle guidance
            tube: {
                x: 0.8, y: 4.05, width: 0.4, height: 0.2 // Shorter tube extension
            }
        };
        
        // Fans
        this.fans = {
            stairFan: {
                id: 'stairFan',
                zone: 'upperMezzanine',
                x: 5.3, y: 5.5, width: 0.4, height: 0.4, // Directly above stair opening center
                direction: { x: 0, y: -1 }, // Pointing straight down
                flowStrength: 0.5,
                isActive: false,
                temperature: 22, // Ambient temperature (just moves air)
                duct: {
                    x: 5.35, y: 5.1, width: 0.3, height: 0.4 // Downward duct
                }
            },
            bedroomFan: {
                id: 'bedroomFan',
                zone: 'upperBedroom',
                x: 8.5, y: 4.5, width: 0.3, height: 0.3, // Back wall of bedroom
                direction: { x: -1, y: 0 }, // Pointing toward bedroom door (left)
                flowStrength: 0.5,
                isActive: false,
                temperature: 22, // Ambient temperature
                duct: {
                    x: 8.0, y: 4.55, width: 0.5, height: 0.2 // Leftward duct
                }
            }
        };
    }
    
    getZoneAtPoint(x, y) {
        // Special handling for floor boundary - particles can only cross floors through stair opening
        if (y > 2.95 && y < 3.05) {
            // At floor level - only valid in stair opening
            if (x >= this.stairOpening.x && x <= this.stairOpening.x + this.stairOpening.width) {
                // In stair opening - allow movement between floors
                return y < 3 ? this.zones.lowerFloor : this.zones.upperMezzanine;
            }
            return null; // Invalid position at floor level outside opening
        }
        
        for (const zone of Object.values(this.zones)) {
            if (x >= zone.x && x <= zone.x + zone.width &&
                y >= zone.y && y <= zone.y + zone.height) {
                return zone;
            }
        }
        return null;
    }
    
    getConnectedZones(zoneId) {
        const zone = this.zones[zoneId];
        if (!zone) return [];
        
        return zone.connections.map(id => this.zones[id]).filter(Boolean);
    }
    
    isValidPosition(x, y) {
        // Check if point is inside apartment bounds
        if (x < 0 || x > this.width || y < 0 || y > this.height) {
            return false;
        }
        
        // Check if point is inside a valid zone
        return this.getZoneAtPoint(x, y) !== null;
    }
    
    getOpeningsBetweenZones(zoneA, zoneB) {
        return Object.values(this.openings).filter(opening =>
            (opening.fromZone === zoneA && opening.toZone === zoneB) ||
            (opening.fromZone === zoneB && opening.toZone === zoneA)
        );
    }
    
    updateOpeningState(openingName, isOpen) {
        if (this.openings[openingName]) {
            this.openings[openingName].isOpen = isOpen;
        }
    }
    
    updateACSettings(temperature, flowStrength) {
        this.acUnit.temperature = temperature;
        this.acUnit.flowStrength = flowStrength;
    }
    
    getAverageTemperatureInZone(zoneId) {
        const zone = this.zones[zoneId];
        if (!zone || zone.airParticles.length === 0) {
            return zone.temperature;
        }
        
        const sum = zone.airParticles.reduce((acc, particle) => acc + particle.temperature, 0);
        return sum / zone.airParticles.length;
    }
}