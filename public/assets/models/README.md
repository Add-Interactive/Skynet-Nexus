# 3D models for Space Center

This directory holds the `.glb` 3D models used by the Space Center LOD system
(`public/assets/js/space-center-models.js`): dots at distance, real models when
you click / fly to a satellite and zoom in close.

## Files (pushed via local git — too big for the web connector)

| File | Size | Source / license |
|---|---|---|
| `hubble.glb` | 2.37 MB | NASA 3D Resources — public domain |
| `iss.glb` | 0.31 MB | NASA 3D Resources — public domain |
| `chandra.glb` | 2.03 MB | NASA 3D Resources — public domain |
| `fermi.glb` | 2.78 MB | NASA 3D Resources — public domain |
| `jwst.glb` | 1.19 MB | NASA 3D Resources — public domain |
| `terra.glb` | 2.05 MB | NASA 3D Resources — public domain |
| `aqua.glb` | 1.90 MB | NASA 3D Resources — public domain |

All models: NASA 3D Resources (https://science.nasa.gov/3d-resources/),
US government work = public domain. Draco compression decoded at build time so
they load with stock three.js GLTFLoader (no decoder download, no CSP change).

## Behavior when files are missing

The loader degrades cleanly: if a `.glb` 404s, the satellite keeps its dot and
the user sees a one-time "3D model not on server yet" toast. Procedural
stand-ins (Starlink / Tiangong / CubeSat) are built in code and always work.
| `space-bay.glb` | 2.29 MB | Original — Stella's Space Bay set, modeled + textured in Blender (2026-10-30) |
