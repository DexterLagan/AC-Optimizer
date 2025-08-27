Here’s a full **specification document in Markdown** for the airflow simulation prototype you now have running:

---

# Apartment Airflow Simulation — Prototype Specifications

## 1. Overview

This prototype implements a **2D airflow and temperature simulation** of a two-floor apartment cross-section using Jos Stam’s *Stable Fluids* method.
The purpose is to visualize the behavior of **cold air from an AC unit** on the upper floor, its mixing with ambient warm air, and its exchange with the lower floor through a **spiral stair opening** and **windows**.

The implementation is delivered as a single HTML/JS page, designed to run inside ChatGPT (or any browser).

---

## 2. Geometry Model

### Apartment Layout

* Modeled as a **longitudinal cross-section** (length × height = `9.0 m × 6.0 m`).
* Each floor: **3.0 m high** (two stacked rectangular prisms).
* Upper floor:

  * **Mezzanine**: first 6.0 m.
  * **Bedroom**: last 3.0 m, partitioned with a wall and door.
* **Spiral staircase shaft**:

  * Width ≈ `1.2 m`, centered at \~`5.5 m` along the length.
  * Breaks the mid-slab to connect upper and lower floors.
* **Partition wall**:

  * Located at 6.0 m.
  * Door opening: **floor-to-head height = 2.1 m**, above which wall continues.

### AC Unit

* Located at **upper-left wall** of the mezzanine (x=0, upper floor).
* Simulated as a **rectangular vent** injecting cold air:

  * Outlet temperature configurable.
  * Flow velocity configurable.

### Windows

* Placed on the **lower floor side walls** (left and right).
* Each can be toggled open/closed.
* Opening height adjustable (number of cells, mapped to meters).

---

## 3. Simulation Model

### Numerical Grid

* Resolution: **270 × 180 cells** (30 cells per meter).
* Fixed logical resolution (no adaptive scaling).
* Simulation step size `dt` adjustable via UI.

### Fluid Variables

* Velocity field: `u` (horizontal), `v` (vertical).
* Temperature field: absolute values in **°C**.
* Pressure and divergence arrays for incompressibility correction.

### Methods

* Diffusion and viscosity modeled with iterative Gauss–Seidel solvers.
* Semi-Lagrangian advection.
* Buoyancy term:

  * Vertical velocity adjusted based on temperature difference from ambient.
  * Cooler-than-ambient air sinks.

### Boundaries

* **Solid obstacles**: slab, partition wall, stair opening.
* **Openings**:

  * Stair shaft modeled as an aperture in the slab.
  * Door modeled as a vertical opening from floor to 2.1 m (toggleable).
  * Windows modeled as boundary conditions open to ambient.

---

## 4. User Interface

### Left Panel Controls

* **Temperatures**

  * Ambient temperature (°C).
  * AC outlet temperature (°C).
* **AC & Openings**

  * AC flow strength (slider).
  * Bedroom door open/closed (checkbox).
  * Lower left/right windows open (checkboxes).
  * Window opening height (slider).
* **Fluid Parameters**

  * Viscosity.
  * Diffusion.
  * Buoyancy.
  * Δt (time step).
* **Actions**

  * Reset (clear velocities and reset temperature to ambient).
  * Pause/Play.
  * Show/Hide velocity vectors.

### Canvas Interaction

* **Drag on canvas**: inject warm air.
* **Shift + drag**: inject cold air.
* **Alt/Option + drag**: directional puff (momentum).

---

## 5. Rendering

* **Color field**: encodes temperature (blue for cool, orange for warm).
* **Overlays**:

  * Slab with stair opening.
  * Partition wall above door head.
  * Stair shaft (rectangle).
  * AC vent (rectangle).
  * Window spans (green markers).
* **Optional velocity vectors** (thin white arrows, toggleable).

---

## 6. Performance and Constraints

* Grid size fixed (`270 × 180`).
* Designed for browsers with **no external dependencies** (pure JS + Canvas).
* Stable inside ChatGPT webview (no dynamic resizing logic).
* Expected refresh rate: \~30–60 FPS in modern browsers.

---

## 7. Known Limitations

* Simplified 2D section (no full 3D dynamics).
* No modeling of humidity, turbulence, or detailed door/wall leakage.
* AC modeled as a **constant jet** with fixed rectangular footprint.
* Window exchange modeled as a **temperature reset** toward ambient, not true external airflow pressure.

---

## 8. Possible Extensions

* Add **temperature probes** at selected points (e.g., upstairs center, downstairs center) with graphs of cooling curves.
* Support **multiple AC units** or heaters.
* Model **solar gain** through windows.
* Allow user to **draw arbitrary partitions** in the cross-section.
* Add **time controls** (fast-forward, step-by-step).

---

✅ This specification fully describes the **“Airflow Sim — ChatGPT-Safe Minimal (Section, °C, Windows)”** prototype.

---

Would you like me to also write a **formal README.md** version (with installation/usage instructions and screenshots placeholders) so you can drop it straight into a GitHub repo?
