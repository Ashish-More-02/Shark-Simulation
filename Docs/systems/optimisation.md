# Optimisation using web assembly/cpp/rust to improve performance.

## How to Make Your JS Game Stand the Strain
As your world grows, pure JavaScript will eventually hit a CPU bottleneck. Use these steps to optimize your current stack:
- Move Math to WebAssembly: Do not rewrite the whole game. Keep your Three.js rendering in JS, but rewrite the heavy math—like procedural terrain generation, pathfinding, or physics—in C++ or Rust and compile it to WebAssembly (Wasm).
- Offload to Web Workers: Keep your main JavaScript thread strictly for Three.js rendering and user input. Move world chunk loading, data decompression, and AI calculations into background Web Workers so they do not cause frame drops.
- Optimize Three.js Memory: Ensure you are using InstancedMesh for repetitive objects (like trees, rocks, or buildings). Manually call .dispose() on geometries and materials when a world chunk is unloaded, or Electron will eventually crash from memory leaks