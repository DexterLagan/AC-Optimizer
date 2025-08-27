# AC-Optimizer: Comprehensive Development Documentation

## Project Overview

AC-Optimizer is an advanced 2D fluid simulation application designed to visualize and optimize air conditioning performance in residential spaces. The project simulates cold air distribution patterns, thermal mixing, and airflow dynamics in a two-story apartment cross-section.

## Architecture Evolution & Lessons Learned

### Initial Challenges

The project began as an attempt to recreate a failed ChatGPT implementation that used Jos Stam's Stable Fluids method with a monolithic 270×180 grid approach. This approach suffered from:

- **Performance Issues**: 48,600 cell updates per frame
- **Complexity Overload**: Full CFD implementation for visualization purposes
- **Maintenance Difficulties**: Single-file HTML/JS approach
- **Boundary Condition Complexity**: Multiple irregular geometries in unified grid

### Architectural Breakthrough: Zone-Based Approach

The solution was to replace the uniform grid with a **logical zone system**:

```
Zone Structure:
├── upperMezzanine (6m×3m)
├── upperBedroom (3m×3m) 
├── stairOpening (1.2m×0.2m)
└── lowerFloor (9m×3m continuous)
```

**Key Benefits:**
- 5 zones vs 48,600 cells = 99.99% computational reduction
- Natural air movement patterns
- Easier boundary condition handling
- Scalable particle density

### Particle System Design

**Core Principle**: Use weighted air particles with temperature and velocity tracking instead of solving Navier-Stokes equations.

```javascript
class AirParticle {
    constructor(x, y, temperature, velocity) {
        this.x = x;
        this.y = y;
        this.temperature = temperature;  // Celsius
        this.velocity = velocity;        // {x, y} m/s
        this.age = 0;
        this.maxAge = 1200;             // 20 seconds at 60fps
        this.mass = calculateMass(temperature); // Density-based
    }
}
```

**Physics Implementation:**
- **Momentum Conservation**: Fast particles resist buoyancy/gravity
- **Temperature Mixing**: Gradual equilibration with environment
- **Collision Response**: Boundary-aware wall bouncing
- **Buoyancy Effects**: Cold air sinks, warm air rises

### Critical Engineering Solutions

#### 1. AC Unit Directional Control

**Problem**: Initial AC implementations produced omnidirectional particle scatter.

**Solution**: Extended tube system with collision physics:
```javascript
// AC Unit with Extended Duct
acUnit: {
    main: { x: 0.2, y: 4, width: 0.6, height: 0.3 },
    tube: { x: 0.8, y: 4.05, width: 0.4, height: 0.2 }
}
```

**Key Innovation**: Particles spawn inside the AC unit and are physically constrained by tube walls, creating realistic narrow beam output (±1° variance).

#### 2. Fan System Architecture

**Problem**: Fans initially exhibited the same scatter issues as early AC implementations.

**Solution**: Dedicated duct systems for each fan:
```javascript
fans: {
    stairFan: {
        position: "above stair opening",
        direction: { x: 0, y: -1 },  // Straight down
        duct: { focused downward channel }
    },
    bedroomFan: {
        position: "bedroom back wall", 
        direction: { x: -1, y: 0 },  // Toward door
        duct: { horizontal focusing channel }
    }
}
```

**Engineering Detail**: Each fan includes wall collision detection, centering forces, and directional acceleration to maintain beam integrity.

#### 3. Particle Priority System

**Problem**: AC units would stop emitting particles after ~10 seconds due to particle limit competition.

**Solution**: Hierarchical particle allocation:
```javascript
// Priority Order:
1. AC Unit: 95% of particle limit, every 2 frames
2. Fans: 90% of particle limit, every 3 frames  
3. User interaction: Remaining capacity
```

#### 4. Floor Boundary Physics

**Problem**: Particles were passing through solid floors outside stair opening.

**Solution**: Precise collision detection with stair-only passage:
```javascript
const inStairOpening = (x >= 4.9 && x <= 6.1); // 1.2m opening
if (!inStairOpening) {
    // Solid floor physics - bounce particles back
    handleFloorCollision(particle);
}
```

## Technical Specifications

### Performance Characteristics
- **Target**: 60fps visualization, 30fps physics
- **Particle Count**: 50-8000 (user configurable)
- **Memory Usage**: ~5MB for 1000 particles
- **Browser Compatibility**: Modern browsers with Canvas2D support

### Coordinate System
```
Origin: Bottom-left corner
X-axis: 0-9 meters (left to right)
Y-axis: 0-6 meters (bottom to top)
Floors: Lower (0-3m), Upper (3-6m)
```

### File Structure
```
FluidSim/
├── index.html              # Main UI and controls
├── main.js                 # Application orchestration
├── core/
│   ├── Apartment.js        # Zone definitions & geometry
│   ├── AirParticle.js      # Particle physics & behavior
│   └── FlowSolver.js       # Inter-zone flow dynamics
├── ui/
│   └── Canvas.js           # Visualization & rendering
└── docs/
    ├── CLAUDE.md          # This documentation
    └── README.md          # User-facing documentation
```

## Physics Model Details

### Buoyancy Implementation
```javascript
// Temperature-based density effects
const buoyancyForce = (ambientTemp - particle.temperature) * 0.02 * momentumFactor;
particle.velocity.y += buoyancyForce * dt;

// Momentum preservation for fast particles
const momentumFactor = Math.max(0.1, 1 - speed * 0.5);
```

### Inter-Zone Flow Calculation
```javascript
// Pressure-driven flow based on temperature differential
const tempDiff = zoneA.temperature - zoneB.temperature;
const pressureDiff = tempDiff * 0.1;
const flowStrength = Math.abs(pressureDiff) * flowArea * dt * 0.1;
```

### Wall Collision Response
```javascript
// Bedroom door physics example
if (particle.x > 5.9 && particle.x < 6.1 && particle.y >= 3 && particle.y <= 6) {
    const doorOpen = apartment.openings.bedroomDoor.isOpen;
    const inDoorArea = (particle.y >= 3 && particle.y <= 5.1);
    
    if (!doorOpen || !inDoorArea) {
        // Bounce with energy loss
        particle.velocity.x *= -0.3;
    }
}
```

## User Interface Design Philosophy

### Control Grouping
1. **Temperature Controls**: Ambient and AC temperature settings
2. **AC & Openings**: Flow strength, door/window states
3. **Fan Controls**: Individual fan toggles and shared speed control
4. **Simulation Parameters**: Particle density, flow speed multiplier
5. **Actions**: Reset, pause, vector visualization toggle

### Real-Time Feedback
- **Temperature Probes**: Live readouts for upper floor, lower floor, and stair area
- **Visual Indicators**: Color-coded particles (blue=cold, orange=warm)
- **Interactive Elements**: Click/drag to inject air manually
- **Equipment Status**: Visual feedback for AC/fan operation states

## Optimization Strategies

### Performance Optimizations
1. **Adaptive Physics**: High-velocity particles resist environmental forces
2. **Particle Culling**: Remove aged particles automatically
3. **Batched Operations**: Process similar particles together
4. **Spatial Partitioning**: Zone-based particle organization

### Memory Management
1. **Object Pooling**: Reuse particle objects when possible
2. **Efficient Data Structures**: Minimize per-particle memory footprint
3. **Garbage Collection Friendly**: Avoid frequent object creation/destruction

## Deployment & Configuration

### Local Development
```bash
# Start local server
python -m http.server 8000

# Access application
http://localhost:8000
```

### Configuration Options
- **Particle Density**: 50-1000 particles
- **Flow Speed**: 0.1x-3.0x multiplier
- **Temperature Range**: Ambient (15-40°C), AC (10-25°C)
- **Visual Options**: Velocity vectors, temperature field overlay

## Future Enhancement Opportunities

### Simulation Enhancements
1. **3D Visualization**: Extend to full volumetric representation
2. **Humidity Modeling**: Add moisture content tracking
3. **Turbulence Effects**: Implement Reynolds number calculations
4. **Seasonal Variations**: Solar gain and external temperature effects

### User Experience Improvements
1. **Preset Scenarios**: Common apartment configurations
2. **Energy Efficiency Metrics**: Power consumption estimates
3. **Optimization Suggestions**: AI-driven AC placement recommendations
4. **Export Capabilities**: Save configuration and results

### Technical Expansions
1. **Multi-Room Support**: Arbitrary floor plan import
2. **Equipment Library**: Different AC types, fan models
3. **Real-Time Data Integration**: IoT sensor input
4. **Performance Benchmarking**: Comparative analysis tools

## Known Limitations & Workarounds

### Current Constraints
1. **2D Simplification**: Real airflow is 3-dimensional
2. **Simplified Physics**: No turbulence or detailed fluid dynamics
3. **Fixed Geometry**: Hardcoded apartment layout
4. **Temperature-Only**: No humidity, pressure, or air quality metrics

### Recommended Usage Patterns
1. **Proof of Concept**: Visualize general airflow patterns
2. **Comparative Analysis**: Test different AC/fan configurations
3. **Educational Tool**: Understand basic thermodynamics principles
4. **Design Validation**: Verify airflow assumptions before construction

## Development Insights

### What Worked Well
1. **Zone-Based Architecture**: Massive performance improvement over grid methods
2. **Particle Physics**: Intuitive and visually appealing
3. **Modular Design**: Easy to extend and maintain
4. **User-Centric Controls**: Immediate visual feedback

### Lessons for Future Projects
1. **Start Simple**: Basic working version before advanced features
2. **Performance First**: Architecture decisions have lasting impact
3. **Visual Feedback**: Users understand physics through visualization
4. **Iterative Refinement**: Small improvements compound significantly

### Critical Success Factors
1. **Directional Control**: Precise particle emission was key to realism
2. **Collision Physics**: Proper boundary conditions enable complex geometry
3. **Priority Systems**: Resource management prevents feature interference
4. **User Agency**: Interactive controls increase engagement dramatically

## Command Reference for Claude Code

### Development Commands
```bash
# Start development server
python -m http.server 8000

# Create new feature branch  
git checkout -b feature/new-enhancement

# Run local tests
# (Manual testing via browser recommended)

# Commit changes with proper attribution
git commit -m "Add feature X

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

### File Management
- **Core Logic**: Modify files in `core/` directory
- **UI Changes**: Update `ui/Canvas.js` for visualization
- **Configuration**: Adjust parameters in `core/Apartment.js`
- **Main Application**: Orchestra changes through `main.js`

This documentation serves as both a technical specification and a development guide for future enhancements to the AC-Optimizer system.