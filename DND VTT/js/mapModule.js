/**
 * Custom Map Module for D&D VTT
 * Supports static images (PNG, JPG, WebP, SVG, BMP, AVIF), animated GIFs,
 * and video maps (MP4, WebM, OGG, MOV) in any modern browser.
 */
class VTTMapModule {
  constructor(options) {
    this.viewport = options.viewport;
    this.stage = options.stage;
    this.mapLayer = options.mapLayer;
    this.gridCanvas = options.gridCanvas;
    this.gridCtx = this.gridCanvas.getContext("2d");
    this.calibratorEl = options.calibratorEl || document.getElementById("grid-calibrator");
    this.subgridEl = options.subgridEl || document.getElementById("calibrator-subgrid");
    this.calSizeText = options.calSizeText || document.getElementById("calibrator-size-text");
    this.calDimLabel = options.calDimLabel || document.getElementById("calibrator-dim-label");
    this.measureCanvas = options.measureCanvas || document.getElementById("measure-canvas");
    this.measureCtx = this.measureCanvas ? this.measureCanvas.getContext("2d") : null;

    // Callbacks for UI updates
    this.onMapListChange = options.onMapListChange || (() => {});
    this.onActiveMapChange = options.onActiveMapChange || (() => {});
    this.onTransformChange = options.onTransformChange || (() => {});
    this.onCursorMove = options.onCursorMove || (() => {});
    this.onGridCalibrateChange = options.onGridCalibrateChange || (() => {});
    this.onMeasurementChange = options.onMeasurementChange || (() => {});
    this.onToolChange = options.onToolChange || (() => {});

    // Active tool ('pan' | 'measure')
    this.currentTool = "pan";

    // Measurement & Movement Rule Settings
    this.measureRule = "5-5-5"; // "5-5-5" | "5-10-5" | "euclidean"
    this.speedBase = 30; // ft (Standard normal move)
    this.speedDash = 60; // ft (Standard Dash action)
    this.measurement = {
      active: false,
      points: [], // Array of { x, y, cellX, cellY, isGrid }
      current: null,
    };

    // Map collection & active state
    this.maps = [];
    this.activeMapId = null;
    this.activeMediaElement = null;

    // Visual Grid Calibrator State (D&D Beyond style)
    this.isCalibrating = false;
    this.calBox = {
      x: 100,
      y: 100,
      width: 192,
      height: 192,
      dim: 3, // 3x3 squares
    };
    this.savedGridBackup = null;
    this.activeDragHandle = null;
    this.isDraggingCalBox = false;
    this.dragStart = null;

    // Camera / Viewport transform state
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1,
      minZoom: 0.1,
      maxZoom: 5.0,
    };

    // Panning interaction state
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.cameraStart = { x: 0, y: 0 };

    // Default Grid settings (saved per-map when a map is active)
    this.defaultGrid = {
      enabled: true,
      type: "square", // 'square' | 'hex-flat' | 'hex-pointy'
      size: 64,
      offsetX: 0,
      offsetY: 0,
      color: "#ffffff",
      opacity: 0.25,
    };

    this._bindEvents();
  }

  /**
   * Detect media category ('video' | 'gif' | 'image') from File or URL
   */
  detectMediaType(fileOrUrl, forcedType = "auto") {
    if (forcedType && forcedType !== "auto") {
      return forcedType;
    }

    if (fileOrUrl instanceof File) {
      const mime = (fileOrUrl.type || "").toLowerCase();
      const name = (fileOrUrl.name || "").toLowerCase();

      if (mime.startsWith("video/") || /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(name)) {
        return "video";
      }
      if (mime === "image/gif" || name.endsWith(".gif")) {
        return "gif";
      }
      return "image";
    }

    if (typeof fileOrUrl === "string") {
      const cleanUrl = fileOrUrl.split("?")[0].split("#")[0].toLowerCase();
      if (/\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(cleanUrl)) {
        return "video";
      }
      if (cleanUrl.endsWith(".gif")) {
        return "gif";
      }
    }

    return "image";
  }

  /**
   * Load one or more File objects uploaded or dropped by the user
   */
  async loadFiles(fileList) {
    const files = Array.from(fileList);
    let lastAdded = null;

    for (const file of files) {
      const mediaType = this.detectMediaType(file);
      const objectUrl = URL.createObjectURL(file);
      const mapEntry = await this._createMapEntry({
        name: file.name.replace(/\.[^/.]+$/, ""),
        src: objectUrl,
        mediaType,
        isObjectUrl: true,
      });
      if (mapEntry) {
        this.maps.push(mapEntry);
        lastAdded = mapEntry;
      }
    }

    this.onMapListChange(this.maps, this.activeMapId);

    if (lastAdded) {
      this.setActiveMap(lastAdded.id, true);
    }
  }

  /**
   * Load a map from a direct URL
   */
  async loadUrl(url, customName = "", forcedType = "auto") {
    const trimmed = url.trim();
    if (!trimmed) return;

    let mediaType = this.detectMediaType(trimmed, forcedType);
    const derivedName =
      customName.trim() ||
      trimmed.split("/").pop().split("?")[0].replace(/\.[^/.]+$/, "") ||
      "Custom URL Map";

    const mapEntry = await this._createMapEntry({
      name: derivedName,
      src: trimmed,
      mediaType,
      isObjectUrl: false,
      allowFallbackProbe: forcedType === "auto",
    });

    if (mapEntry) {
      this.maps.push(mapEntry);
      this.onMapListChange(this.maps, this.activeMapId);
      this.setActiveMap(mapEntry.id, true);
    }
  }

  /**
   * Probe media dimensions and create a structured map object
   */
  _createMapEntry({ name, src, mediaType, isObjectUrl, allowFallbackProbe = false }) {
    return new Promise((resolve) => {
      const id = "map_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

      const finalize = (width, height, resolvedType) => {
        resolve({
          id,
          name,
          src,
          mediaType: resolvedType,
          isObjectUrl,
          naturalWidth: width || 1920,
          naturalHeight: height || 1080,
          scale: 1, // 1 = 100%
          grid: { ...this.defaultGrid },
        });
      };

      if (mediaType === "video") {
        const vid = document.createElement("video");
        vid.preload = "metadata";
        vid.muted = true;
        vid.onloadedmetadata = () => {
          finalize(vid.videoWidth, vid.videoHeight, "video");
        };
        vid.onerror = () => {
          alert(`Failed to load video map: ${name}`);
          resolve(null);
        };
        vid.src = src;
      } else {
        const img = new Image();
        img.onload = () => {
          finalize(img.naturalWidth, img.naturalHeight, mediaType);
        };
        img.onerror = () => {
          // If auto-detect tried image first on an extensionless video URL, try video fallback
          if (allowFallbackProbe) {
            const vid = document.createElement("video");
            vid.preload = "metadata";
            vid.muted = true;
            vid.onloadedmetadata = () => {
              finalize(vid.videoWidth, vid.videoHeight, "video");
            };
            vid.onerror = () => {
              alert(`Could not load media from "${name}". Make sure the file or URL is a valid image, GIF, or video.`);
              resolve(null);
            };
            vid.src = src;
          } else {
            alert(`Failed to load image map: ${name}`);
            resolve(null);
          }
        };
        img.src = src;
      }
    });
  }

  /**
   * Get the currently active map object
   */
  getActiveMap() {
    return this.maps.find((m) => m.id === this.activeMapId) || null;
  }

  /**
   * Switch the active map rendered on the stage
   */
  setActiveMap(mapId, promptCalibration = false) {
    if (this.isCalibrating) {
      this.stopGridCalibration(false);
    }
    this.clearMeasurement();

    // Pause previous video if any
    if (this.activeMediaElement && this.activeMediaElement.tagName === "VIDEO") {
      this.activeMediaElement.pause();
    }

    this.activeMapId = mapId;
    const map = this.getActiveMap();

    this.mapLayer.innerHTML = "";
    this.activeMediaElement = null;

    if (!map) {
      this.gridCanvas.width = 0;
      this.gridCanvas.height = 0;
      this.onMapListChange(this.maps, this.activeMapId);
      this.onActiveMapChange(null, null);
      return;
    }

    if (map.mediaType === "video") {
      const video = document.createElement("video");
      video.src = map.src;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.play().catch(() => {
        // Autoplay fallback if browser blocks un-interacted play
      });
      this.mapLayer.appendChild(video);
      this.activeMediaElement = video;
    } else {
      const img = document.createElement("img");
      img.src = map.src;
      img.alt = map.name;
      this.mapLayer.appendChild(img);
      this.activeMediaElement = img;
    }

    this._syncMapDimensions();
    this.fitMapToViewport();

    this.onMapListChange(this.maps, this.activeMapId);
    this.onActiveMapChange(map, this.activeMediaElement);

    if (promptCalibration) {
      setTimeout(() => this.startGridCalibration(), 80);
    }
  }

  /**
   * Delete a map from the loaded library
   */
  removeMap(mapId) {
    const idx = this.maps.findIndex((m) => m.id === mapId);
    if (idx === -1) return;

    const [removed] = this.maps.splice(idx, 1);
    if (removed.isObjectUrl) {
      URL.revokeObjectURL(removed.src);
    }

    if (this.activeMapId === mapId) {
      const nextMap = this.maps[idx] || this.maps[idx - 1] || null;
      this.setActiveMap(nextMap ? nextMap.id : null);
    } else {
      this.onMapListChange(this.maps, this.activeMapId);
    }
  }

  /**
   * Update active map's scale or grid settings and redraw
   */
  updateActiveMapSettings({ scale, grid }) {
    const map = this.getActiveMap();
    if (!map) return;

    if (typeof scale === "number") {
      map.scale = Math.min(5, Math.max(0.1, scale));
    }
    if (grid) {
      map.grid = { ...map.grid, ...grid };
    }

    this._syncMapDimensions();
  }

  /**
   * Synchronize media element and grid canvas dimensions with map natural size * scale
   */
  _syncMapDimensions() {
    const map = this.getActiveMap();
    if (!map || !this.activeMediaElement) return;

    const width = Math.round(map.naturalWidth * map.scale);
    const height = Math.round(map.naturalHeight * map.scale);

    this.activeMediaElement.style.width = `${width}px`;
    this.activeMediaElement.style.height = `${height}px`;

    this.stage.style.width = `${width}px`;
    this.stage.style.height = `${height}px`;

    this.gridCanvas.width = width;
    this.gridCanvas.height = height;

    if (this.measureCanvas) {
      this.measureCanvas.width = width;
      this.measureCanvas.height = height;
      this.renderMeasurement();
    }

    this.renderGrid();
  }

  /**
   * Draw Square or Hexagonal tabletop grid onto the overlay canvas
   */
  renderGrid() {
    const map = this.getActiveMap();
    const ctx = this.gridCtx;
    const width = this.gridCanvas.width;
    const height = this.gridCanvas.height;

    ctx.clearRect(0, 0, width, height);
    if (!map || !map.grid.enabled || map.grid.opacity <= 0) return;

    const { type, size, offsetX, offsetY, color, opacity } = map.grid;
    const cellSize = Math.max(16, Number(size) || 64);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = 1.25;

    if (type === "square") {
      this._drawSquareGrid(ctx, width, height, cellSize, offsetX, offsetY);
    } else if (type === "hex-flat") {
      this._drawFlatHexGrid(ctx, width, height, cellSize, offsetX, offsetY);
    } else if (type === "hex-pointy") {
      this._drawPointyHexGrid(ctx, width, height, cellSize, offsetX, offsetY);
    }

    ctx.restore();
  }

  _drawSquareGrid(ctx, width, height, size, offsetX, offsetY) {
    const startX = ((offsetX % size) + size) % size;
    const startY = ((offsetY % size) + size) % size;

    ctx.beginPath();
    for (let x = startX; x <= width; x += size) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, height);
    }
    for (let y = startY; y <= height; y += size) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
    }
    ctx.stroke();
  }

  _drawFlatHexGrid(ctx, width, height, size, offsetX, offsetY) {
    // size = distance across flats (height of hex)
    const r = size / Math.sqrt(3);
    const hexWidth = 2 * r;
    const horizStep = 1.5 * r;
    const vertStep = size;

    const startX = (offsetX % (horizStep * 2)) - horizStep * 2;
    const startY = (offsetY % vertStep) - vertStep;

    ctx.beginPath();
    let col = 0;
    for (let cx = startX; cx < width + hexWidth; cx += horizStep, col++) {
      const colOffsetY = (col % 2 !== 0) ? vertStep / 2 : 0;
      for (let cy = startY + colOffsetY; cy < height + vertStep; cy += vertStep) {
        this._traceHex(ctx, cx, cy, r, 0);
      }
    }
    ctx.stroke();
  }

  _drawPointyHexGrid(ctx, width, height, size, offsetX, offsetY) {
    // size = distance across flats (width of hex)
    const r = size / Math.sqrt(3);
    const hexHeight = 2 * r;
    const horizStep = size;
    const vertStep = 1.5 * r;

    const startX = (offsetX % horizStep) - horizStep;
    const startY = (offsetY % (vertStep * 2)) - vertStep * 2;

    ctx.beginPath();
    let row = 0;
    for (let cy = startY; cy < height + hexHeight; cy += vertStep, row++) {
      const rowOffsetX = (row % 2 !== 0) ? horizStep / 2 : 0;
      for (let cx = startX + rowOffsetX; cx < width + horizStep; cx += horizStep) {
        this._traceHex(ctx, cx, cy, r, Math.PI / 6);
      }
    }
    ctx.stroke();
  }

  _traceHex(ctx, cx, cy, radius, angleOffset) {
    for (let i = 0; i < 6; i++) {
      const angle = angleOffset + (Math.PI / 3) * i;
      const vx = cx + radius * Math.cos(angle);
      const vy = cy + radius * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(vx, vy);
      } else {
        ctx.lineTo(vx, vy);
      }
    }
    ctx.closePath();
  }

  /**
   * Apply camera pan/zoom to the stage DOM element
   */
  applyTransform() {
    const { x, y, zoom } = this.camera;
    this.stage.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    this.onTransformChange(this.camera);
  }

  /**
   * Center and fit the active map inside the viewport
   */
  fitMapToViewport() {
    const map = this.getActiveMap();
    if (!map) return;

    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;
    const mw = map.naturalWidth * map.scale;
    const mh = map.naturalHeight * map.scale;

    const padding = 48;
    const scaleX = (vw - padding * 2) / mw;
    const scaleY = (vh - padding * 2) / mh;
    const zoom = Math.min(Math.max(Math.min(scaleX, scaleY), this.camera.minZoom), 1.5);

    this.camera.zoom = zoom;
    this.camera.x = Math.round((vw - mw * zoom) / 2);
    this.camera.y = Math.round((vh - mh * zoom) / 2);
    this.applyTransform();
  }

  /**
   * Zoom around a specific viewport point (defaults to viewport center)
   */
  zoomAt(factor, clientX = null, clientY = null) {
    const rect = this.viewport.getBoundingClientRect();
    const px = clientX !== null ? clientX - rect.left : rect.width / 2;
    const py = clientY !== null ? clientY - rect.top : rect.height / 2;

    const prevZoom = this.camera.zoom;
    const nextZoom = Math.min(this.camera.maxZoom, Math.max(this.camera.minZoom, prevZoom * factor));

    if (nextZoom === prevZoom) return;

    // Keep the world coordinate under (px, py) stationary
    const worldX = (px - this.camera.x) / prevZoom;
    const worldY = (py - this.camera.y) / prevZoom;

    this.camera.zoom = nextZoom;
    this.camera.x = px - worldX * nextZoom;
    this.camera.y = py - worldY * nextZoom;
    this.applyTransform();
  }

  setZoom(targetZoom) {
    const factor = targetZoom / this.camera.zoom;
    this.zoomAt(factor);
  }

  /**
   * Convert client mouse coordinates to Map World coordinates & Grid Cell
   */
  screenToWorld(clientX, clientY) {
    const rect = this.viewport.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;

    const worldX = Math.round((vx - this.camera.x) / this.camera.zoom);
    const worldY = Math.round((vy - this.camera.y) / this.camera.zoom);

    const map = this.getActiveMap();
    const size = map ? map.grid.size : 64;
    const offsetX = map ? map.grid.offsetX : 0;
    const offsetY = map ? map.grid.offsetY : 0;

    const cellX = Math.floor((worldX - offsetX) / size);
    const cellY = Math.floor((worldY - offsetY) / size);

    return { worldX, worldY, cellX, cellY };
  }

  /**
   * Generate a built-in animated SVG Demo Dungeon map so users can test immediately
   */
  loadDemoDungeon() {
    const svgDemo = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="896" viewBox="0 0 1280 896">
      <defs>
        <radialGradient id="torchGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ff9d3b" stop-opacity="0.55">
            <animate attributeName="stop-opacity" values="0.45;0.65;0.5;0.62;0.45" dur="2.4s" repeatCount="indefinite"/>
          </stop>
          <stop offset="60%" stop-color="#d9531e" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <pattern id="stoneTile" width="64" height="64" patternUnits="userSpaceOnUse">
          <rect width="64" height="64" fill="#1e222d" stroke="#141720" stroke-width="2"/>
          <path d="M 8 16 L 24 12 M 42 48 L 56 44" stroke="#282e3d" stroke-width="1.5" stroke-linecap="round"/>
        </pattern>
      </defs>

      <!-- Cavern Background -->
      <rect width="1280" height="896" fill="#0d0f14"/>

      <!-- Main Chamber Floor -->
      <rect x="192" y="128" width="896" height="640" fill="url(#stoneTile)" stroke="#3b4254" stroke-width="8" rx="8"/>

      <!-- Entrance Corridor -->
      <rect x="576" y="760" width="128" height="136" fill="url(#stoneTile)" stroke="#3b4254" stroke-width="6"/>

      <!-- Inner Sanctum Dais -->
      <rect x="448" y="256" width="384" height="256" fill="#252b3b" stroke="#525b73" stroke-width="4" rx="4"/>
      <circle cx="640" cy="384" r="76" fill="#191d28" stroke="#7c5cff" stroke-width="3" stroke-dasharray="10 6">
        <animateTransform attributeName="transform" type="rotate" from="0 640 384" to="360 640 384" dur="24s" repeatCount="indefinite"/>
      </circle>
      <circle cx="640" cy="384" r="42" fill="#7c5cff" fill-opacity="0.22" stroke="#a68eff" stroke-width="2">
        <animate attributeName="r" values="38;45;38" dur="3s" repeatCount="indefinite"/>
      </circle>

      <!-- Pillars -->
      <g fill="#363d4f" stroke="#11131a" stroke-width="4">
        <rect x="296" y="232" width="48" height="48" rx="6"/>
        <rect x="296" y="616" width="48" height="48" rx="6"/>
        <rect x="936" y="232" width="48" height="48" rx="6"/>
        <rect x="936" y="616" width="48" height="48" rx="6"/>
      </g>

      <!-- Animated Torch Lights -->
      <circle cx="320" cy="256" r="180" fill="url(#torchGlow)"/>
      <circle cx="320" cy="640" r="180" fill="url(#torchGlow)"/>
      <circle cx="960" cy="256" r="180" fill="url(#torchGlow)"/>
      <circle cx="960" cy="640" r="180" fill="url(#torchGlow)"/>

      <!-- Torch Braziers -->
      <g fill="#ffae42" stroke="#7a2e0e" stroke-width="2">
        <circle cx="320" cy="256" r="7"/>
        <circle cx="320" cy="640" r="7"/>
        <circle cx="960" cy="256" r="7"/>
        <circle cx="960" cy="640" r="7"/>
      </g>
    </svg>`;

    const blob = new Blob([svgDemo], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    this._createMapEntry({
      name: "Arcane Sanctum (Animated Demo)",
      src: url,
      mediaType: "image",
      isObjectUrl: true,
    }).then((entry) => {
      if (entry) {
        this.maps.push(entry);
        this.onMapListChange(this.maps, this.activeMapId);
        this.setActiveMap(entry.id, true);
      }
    });
  }

  // =========================================================================
  // Visual Grid Calibration Methods (D&D Beyond Style)
  // =========================================================================

  startGridCalibration() {
    const map = this.getActiveMap();
    if (!map) return;

    this.isCalibrating = true;
    this.savedGridBackup = JSON.parse(JSON.stringify(map.grid));

    // Ensure grid is visible and active while calibrating
    map.grid.enabled = true;

    const cellSize = map.grid.size || 64;
    this.calBox.dim = this.calBox.dim || 3;
    this.calBox.width = cellSize * this.calBox.dim;
    this.calBox.height = cellSize * this.calBox.dim;

    // Center calibrator in current viewport
    const rect = this.viewport.getBoundingClientRect();
    const center = this.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    this.calBox.x = Math.round(center.worldX - this.calBox.width / 2);
    this.calBox.y = Math.round(center.worldY - this.calBox.height / 2);

    map.grid.offsetX = Math.round(((this.calBox.x % cellSize) + cellSize) % cellSize);
    map.grid.offsetY = Math.round(((this.calBox.y % cellSize) + cellSize) % cellSize);

    this._renderSubgrid();
    this._updateCalibratorDOM();
    if (this.calibratorEl) this.calibratorEl.classList.remove("hidden");
    this.renderGrid();

    this.onGridCalibrateChange(map.grid, this.calBox);
  }

  stopGridCalibration(apply = true) {
    const map = this.getActiveMap();
    if (map && !apply && this.savedGridBackup) {
      map.grid = JSON.parse(JSON.stringify(this.savedGridBackup));
      this.renderGrid();
    }
    this.isCalibrating = false;
    this.savedGridBackup = null;
    this.activeDragHandle = null;
    this.isDraggingCalBox = false;

    if (this.calibratorEl) this.calibratorEl.classList.add("hidden");
    this.onGridCalibrateChange(map ? map.grid : null, null);
  }

  disableCalibratorGrid() {
    const map = this.getActiveMap();
    if (map) {
      map.grid.enabled = false;
      this.renderGrid();
    }
    this.stopGridCalibration(true);
  }

  setCalibratorDimension(dim) {
    const clampedDim = Math.max(1, Math.min(5, Number(dim) || 3));
    this.calBox.dim = clampedDim;
    const map = this.getActiveMap();
    const cellSize = map ? map.grid.size : 64;
    this.calBox.width = cellSize * clampedDim;
    this.calBox.height = cellSize * clampedDim;
    this._renderSubgrid();
    this._updateCalibratorDOM();
    this.onGridCalibrateChange(map ? map.grid : null, this.calBox);
  }

  setCalibratorCellSize(newSize) {
    const map = this.getActiveMap();
    if (!map) return;
    const size = Math.max(16, Math.min(300, Math.round(newSize)));
    map.grid.size = size;
    this.calBox.width = size * this.calBox.dim;
    this.calBox.height = size * this.calBox.dim;
    map.grid.offsetX = Math.round(((this.calBox.x % size) + size) % size);
    map.grid.offsetY = Math.round(((this.calBox.y % size) + size) % size);
    this._updateCalibratorDOM();
    this.renderGrid();
    this.onGridCalibrateChange(map.grid, this.calBox);
  }

  nudgeCalibrator(dx, dy) {
    const map = this.getActiveMap();
    if (!map) return;
    this.calBox.x += dx;
    this.calBox.y += dy;
    const size = map.grid.size;
    map.grid.offsetX = Math.round(((this.calBox.x % size) + size) % size);
    map.grid.offsetY = Math.round(((this.calBox.y % size) + size) % size);
    this._updateCalibratorDOM();
    this.renderGrid();
    this.onGridCalibrateChange(map.grid, this.calBox);
  }

  setCalibratorGridType(type) {
    const map = this.getActiveMap();
    if (!map) return;
    map.grid.type = type;
    this.renderGrid();
    this.onGridCalibrateChange(map.grid, this.calBox);
  }

  setCalibratorColor(color) {
    const map = this.getActiveMap();
    if (!map) return;
    map.grid.color = color;
    this.renderGrid();
    this.onGridCalibrateChange(map.grid, this.calBox);
  }

  setCalibratorOpacity(opacity) {
    const map = this.getActiveMap();
    if (!map) return;
    map.grid.opacity = Math.max(0, Math.min(1, opacity));
    this.renderGrid();
    this.onGridCalibrateChange(map.grid, this.calBox);
  }

  _renderSubgrid() {
    if (!this.subgridEl) return;
    this.subgridEl.style.setProperty("--cal-dim", this.calBox.dim);
    this.subgridEl.innerHTML = "";
    const total = this.calBox.dim * this.calBox.dim;
    for (let i = 0; i < total; i++) {
      const cell = document.createElement("div");
      cell.className = "subgrid-cell";
      this.subgridEl.appendChild(cell);
    }
  }

  _updateCalibratorDOM() {
    if (!this.calibratorEl) return;
    this.calibratorEl.style.left = `${this.calBox.x}px`;
    this.calibratorEl.style.top = `${this.calBox.y}px`;
    this.calibratorEl.style.width = `${this.calBox.width}px`;
    this.calibratorEl.style.height = `${this.calBox.height}px`;

    const map = this.getActiveMap();
    const cellSize = map ? map.grid.size : Math.round(this.calBox.width / this.calBox.dim);
    if (this.calSizeText) {
      this.calSizeText.textContent = `${cellSize}px`;
    }
    if (this.calDimLabel) {
      this.calDimLabel.textContent = `${this.calBox.dim}×${this.calBox.dim} Grid`;
    }
  }

  // =========================================================================
  // Movement & Measurement Methods (5ft increments, center snap, waypoints)
  // =========================================================================

  setTool(tool) {
    this.currentTool = tool === "measure" ? "measure" : "pan";
    if (this.currentTool === "measure") {
      this.viewport.classList.add("mode-measure");
    } else {
      this.viewport.classList.remove("mode-measure");
    }
    this.onToolChange(this.currentTool);
  }

  setMeasureRule(rule) {
    this.measureRule = rule || "5-5-5";
    this.renderMeasurement();
  }

  setMovementSpeeds(base, dash) {
    this.speedBase = Number(base) || 30;
    this.speedDash = Number(dash) || 60;
    this.renderMeasurement();
  }

  clearMeasurement() {
    this.measurement.active = false;
    this.measurement.points = [];
    this.measurement.current = null;
    if (this.measureCtx && this.measureCanvas) {
      this.measureCtx.clearRect(0, 0, this.measureCanvas.width, this.measureCanvas.height);
    }
    this.onMeasurementChange(null);
  }

  addMeasurementWaypoint() {
    if (!this.measurement.active || !this.measurement.current) return;
    const last = this.measurement.points[this.measurement.points.length - 1];
    const cur = this.measurement.current;
    if (last && last.x === cur.x && last.y === cur.y) return;
    this.measurement.points.push({ ...cur });
    this.renderMeasurement();
  }

  getSnappedPoint(worldX, worldY) {
    const map = this.getActiveMap();
    if (map && map.grid.enabled) {
      const size = Math.max(16, Number(map.grid.size) || 64);
      const cellX = Math.floor((worldX - map.grid.offsetX) / size);
      const cellY = Math.floor((worldY - map.grid.offsetY) / size);
      // Snapped to the exact center of the square:
      const centerX = Math.round(map.grid.offsetX + (cellX + 0.5) * size);
      const centerY = Math.round(map.grid.offsetY + (cellY + 0.5) * size);
      return { x: centerX, y: centerY, cellX, cellY, isGrid: true };
    } else {
      // No grid: measures directly from selected point!
      return { x: Math.round(worldX), y: Math.round(worldY), cellX: null, cellY: null, isGrid: false };
    }
  }

  calculateSegmentDistance(p1, p2) {
    const map = this.getActiveMap();
    const cellSize = map ? Math.max(16, Number(map.grid.size) || 64) : 64;

    if (p1.isGrid && p2.isGrid) {
      const dx = Math.abs(p2.cellX - p1.cellX);
      const dy = Math.abs(p2.cellY - p1.cellY);

      if (this.measureRule === "5-5-5") {
        const sq = Math.max(dx, dy);
        return { feet: sq * 5, squares: sq };
      } else if (this.measureRule === "5-10-5") {
        const diags = Math.min(dx, dy);
        const straights = Math.max(dx, dy) - diags;
        const feet = straights * 5 + diags * 5 + Math.floor(diags / 2) * 5;
        return { feet, squares: Math.max(dx, dy) };
      } else {
        const distSq = Math.hypot(dx, dy);
        const rawFeet = distSq * 5;
        const feet = Math.round(rawFeet / 5) * 5;
        return { feet, squares: Math.round(distSq * 10) / 10 };
      }
    } else {
      // No Grid: from selected point in 5ft increments
      const distPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const rawFeet = (distPx / cellSize) * 5;
      const feet = Math.max(0, Math.round(rawFeet / 5) * 5);
      const exactFeet = Math.round(rawFeet * 10) / 10;
      return { feet, exactFeet, squares: Math.round((feet / 5) * 10) / 10 };
    }
  }

  calculateTotalMeasurement() {
    if (!this.measurement.points.length) return null;
    const pts = [...this.measurement.points];
    if (this.measurement.current) {
      const last = pts[pts.length - 1];
      if (last.x !== this.measurement.current.x || last.y !== this.measurement.current.y) {
        pts.push(this.measurement.current);
      }
    }

    let totalFeet = 0;
    let totalSquares = 0;
    const segments = [];

    for (let i = 0; i < pts.length - 1; i++) {
      const seg = this.calculateSegmentDistance(pts[i], pts[i + 1]);
      totalFeet += seg.feet;
      totalSquares += seg.squares;
      segments.push({ from: pts[i], to: pts[i + 1], ...seg });
    }

    return {
      points: pts,
      segments,
      totalFeet,
      totalSquares: Math.round(totalSquares * 10) / 10,
      isGrid: pts[0]?.isGrid || false,
    };
  }

  renderMeasurement() {
    if (!this.measureCtx || !this.measureCanvas) return;
    const ctx = this.measureCtx;
    const width = this.measureCanvas.width;
    const height = this.measureCanvas.height;

    ctx.clearRect(0, 0, width, height);

    const data = this.calculateTotalMeasurement();
    if (!data || data.points.length < 1) {
      this.onMeasurementChange(null);
      return;
    }

    const map = this.getActiveMap();
    const cellSize = map ? Math.max(16, Number(map.grid.size) || 64) : 64;
    const isGrid = data.isGrid;

    // Movement speed color coding for easy calculation
    let themeColor = "#10b981"; // Normal move (<= 30ft)
    let statusLabel = "Normal Move";
    if (data.totalFeet > this.speedDash) {
      themeColor = "#ef4444"; // Extended move (> 60ft)
      statusLabel = "Exceeds Dash";
    } else if (data.totalFeet > this.speedBase) {
      themeColor = "#f59e0b"; // Dash move (<= 60ft)
      statusLabel = "Dash Action";
    }

    // 1. Highlight traversed grid squares
    if (isGrid && data.segments.length > 0) {
      ctx.save();
      ctx.fillStyle = themeColor;
      ctx.globalAlpha = 0.22;

      const visited = new Set();
      data.segments.forEach((seg) => {
        const cells = this._getCellsAlongPath(seg.from.cellX, seg.from.cellY, seg.to.cellX, seg.to.cellY);
        cells.forEach(({ cx, cy }) => {
          const key = `${cx},${cy}`;
          if (!visited.has(key)) {
            visited.add(key);
            const x = map.grid.offsetX + cx * cellSize;
            const y = map.grid.offsetY + cy * cellSize;
            ctx.fillRect(x, y, cellSize, cellSize);
          }
        });
      });
      ctx.restore();
    }

    // 2. Glowing movement ruler path
    if (data.points.length > 1) {
      ctx.save();
      // Outer colored glow
      ctx.strokeStyle = themeColor;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(data.points[0].x, data.points[0].y);
      for (let i = 1; i < data.points.length; i++) {
        ctx.lineTo(data.points[i].x, data.points[i].y);
      }
      ctx.stroke();

      // Sharp core line
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.restore();
    }

    // 3. Waypoint nodes
    data.points.forEach((pt, idx) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, idx === data.points.length - 1 ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = idx === 0 ? "#38bdf8" : themeColor;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.restore();
    });

    // 4. Segment distance labels for waypoints
    if (data.segments.length > 1) {
      data.segments.forEach((seg) => {
        const midX = (seg.from.x + seg.to.x) / 2;
        const midY = (seg.from.y + seg.to.y) / 2;
        this._drawRulerBadge(ctx, midX, midY, `${seg.feet} ft`, "#1e2433", "#94a3b8", 11);
      });
    }

    // 5. Total Movement Badge at destination
    const endPt = data.points[data.points.length - 1];
    let badgeText = `${data.totalFeet} ft`;
    if (isGrid) {
      badgeText += ` (${Math.round(data.totalFeet / 5)} sq)`;
    } else if (data.segments.length > 0 && data.segments[0].exactFeet) {
      badgeText += ` (~${data.segments.reduce((acc, s) => acc + s.exactFeet, 0).toFixed(1)}ft)`;
    }
    badgeText += ` • ${statusLabel}`;

    this._drawRulerBadge(ctx, endPt.x, endPt.y - 22, badgeText, themeColor, "#ffffff", 13, true);

    this.onMeasurementChange({
      totalFeet: data.totalFeet,
      statusLabel,
      themeColor,
      isGrid,
    });
  }

  _drawRulerBadge(ctx, x, y, text, bgColor, textColor, fontSize = 12, isTotal = false) {
    ctx.save();
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const textWidth = ctx.measureText(text).width;
    const paddingX = 9;
    const paddingY = 4;
    const boxW = textWidth + paddingX * 2;
    const boxH = fontSize + paddingY * 2;
    const boxX = Math.round(x - boxW / 2);
    const boxY = Math.round(y - boxH / 2);

    ctx.fillStyle = isTotal ? bgColor : "rgba(17, 21, 31, 0.94)";
    ctx.strokeStyle = isTotal ? "#ffffff" : bgColor;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isTotal ? "#ffffff" : textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }

  _getCellsAlongPath(x0, y0, x1, y1) {
    const cells = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    while (true) {
      cells.push({ cx, cy });
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
    return cells;
  }

  /**
   * Bind viewport mouse, wheel, and keyboard events
   */
  _bindEvents() {
    // Prevent default context menu on viewport so right-drag panning feels native
    this.viewport.addEventListener("contextmenu", (e) => e.preventDefault());

    // Calibrator interactions (handles resize + box move)
    if (this.calibratorEl) {
      this.calibratorEl.addEventListener("mousedown", (e) => {
        if (!this.isCalibrating) return;
        const handle = e.target.closest(".cal-handle");
        if (handle) {
          e.stopPropagation();
          e.preventDefault();
          this.activeDragHandle = handle.dataset.handle;
          this.dragStart = { clientX: e.clientX, clientY: e.clientY, ...this.calBox };
        } else {
          e.stopPropagation();
          e.preventDefault();
          this.isDraggingCalBox = true;
          this.dragStart = { clientX: e.clientX, clientY: e.clientY, ...this.calBox };
        }
      });
    }

    // Viewport mouse interaction (Measuring or Panning)
    this.viewport.addEventListener("mousedown", (e) => {
      if (this.isCalibrating) return;

      const isMeasureMode = this.currentTool === "measure" || e.shiftKey;

      if (isMeasureMode && e.button === 0) {
        const coords = this.screenToWorld(e.clientX, e.clientY);
        const snapped = this.getSnappedPoint(coords.worldX, coords.worldY);

        if (!this.measurement.active) {
          // Start measurement at snapped center (or free point if no grid)
          this.measurement.active = true;
          this.measurement.points = [snapped];
          this.measurement.current = snapped;
          this.renderMeasurement();
        } else {
          // Click adds a waypoint around obstacles
          this.addMeasurementWaypoint();
        }
        return;
      }

      // Right-click or middle-click while measuring clears ruler
      if (this.measurement.active && (e.button === 2 || e.button === 1)) {
        this.clearMeasurement();
        return;
      }

      // Normal map panning
      if (e.button === 0 || e.button === 1 || e.button === 2) {
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY };
        this.cameraStart = { x: this.camera.x, y: this.camera.y };
        this.viewport.classList.add("panning");
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (this.activeDragHandle && this.dragStart) {
        const dx = (e.clientX - this.dragStart.clientX) / this.camera.zoom;
        const dy = (e.clientY - this.dragStart.clientY) / this.camera.zoom;
        const orig = this.dragStart;
        const h = this.activeDragHandle;
        const minPixels = 16 * this.calBox.dim;

        let newWidth = orig.width;
        let newHeight = orig.height;
        let newX = orig.x;
        let newY = orig.y;

        if (h === "se") {
          const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
          newWidth = Math.max(minPixels, orig.width + delta);
          newHeight = newWidth;
        } else if (h === "e") {
          newWidth = Math.max(minPixels, orig.width + dx);
          newHeight = newWidth;
        } else if (h === "s") {
          newHeight = Math.max(minPixels, orig.height + dy);
          newWidth = newHeight;
        } else if (h === "nw") {
          const delta = Math.abs(dx) > Math.abs(dy) ? -dx : -dy;
          newWidth = Math.max(minPixels, orig.width + delta);
          newHeight = newWidth;
          newX = orig.x + (orig.width - newWidth);
          newY = orig.y + (orig.height - newHeight);
        } else if (h === "ne") {
          const delta = Math.abs(dx) > Math.abs(dy) ? dx : -dy;
          newWidth = Math.max(minPixels, orig.width + delta);
          newHeight = newWidth;
          newY = orig.y + (orig.height - newHeight);
        } else if (h === "sw") {
          const delta = Math.abs(dx) > Math.abs(dy) ? -dx : dy;
          newWidth = Math.max(minPixels, orig.width + delta);
          newHeight = newWidth;
          newX = orig.x + (orig.width - newWidth);
        } else if (h === "n") {
          newHeight = Math.max(minPixels, orig.height - dy);
          newWidth = newHeight;
          newY = orig.y + (orig.height - newHeight);
        } else if (h === "w") {
          newWidth = Math.max(minPixels, orig.width - dx);
          newHeight = newWidth;
          newX = orig.x + (orig.width - newWidth);
        }

        this.calBox.width = Math.round(newWidth);
        this.calBox.height = Math.round(newHeight);
        this.calBox.x = Math.round(newX);
        this.calBox.y = Math.round(newY);

        const newCellSize = Math.max(16, Math.min(300, Math.round(this.calBox.width / this.calBox.dim)));
        const map = this.getActiveMap();
        if (map) {
          map.grid.size = newCellSize;
          map.grid.offsetX = Math.round(((this.calBox.x % newCellSize) + newCellSize) % newCellSize);
          map.grid.offsetY = Math.round(((this.calBox.y % newCellSize) + newCellSize) % newCellSize);
          this.renderGrid();
          this._updateCalibratorDOM();
          this.onGridCalibrateChange(map.grid, this.calBox);
        }
      } else if (this.isDraggingCalBox && this.dragStart) {
        const dx = (e.clientX - this.dragStart.clientX) / this.camera.zoom;
        const dy = (e.clientY - this.dragStart.clientY) / this.camera.zoom;
        this.calBox.x = Math.round(this.dragStart.x + dx);
        this.calBox.y = Math.round(this.dragStart.y + dy);

        const map = this.getActiveMap();
        if (map) {
          const cellSize = map.grid.size;
          map.grid.offsetX = Math.round(((this.calBox.x % cellSize) + cellSize) % cellSize);
          map.grid.offsetY = Math.round(((this.calBox.y % cellSize) + cellSize) % cellSize);
          this.renderGrid();
          this._updateCalibratorDOM();
          this.onGridCalibrateChange(map.grid, this.calBox);
        }
      } else if (this.isPanning) {
        const dx = e.clientX - this.panStart.x;
        const dy = e.clientY - this.panStart.y;
        this.camera.x = this.cameraStart.x + dx;
        this.camera.y = this.cameraStart.y + dy;
        this.applyTransform();
      }

      const coords = this.screenToWorld(e.clientX, e.clientY);

      // Track active measurement
      if (this.measurement.active) {
        const snapped = this.getSnappedPoint(coords.worldX, coords.worldY);
        this.measurement.current = snapped;
        this.renderMeasurement();
      }

      if (this.getActiveMap()) {
        this.onCursorMove(coords);
      }
    });

    window.addEventListener("mouseup", () => {
      this.activeDragHandle = null;
      this.isDraggingCalBox = false;
      if (this.isPanning) {
        this.isPanning = false;
        this.viewport.classList.remove("panning");
      }
    });

    // Smooth wheel zoom centered at cursor
    this.viewport.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        this.zoomAt(zoomFactor, e.clientX, e.clientY);
      },
      { passive: false }
    );

    // Keyboard shortcuts (F to fit, +/- to zoom, Arrows to nudge, Space/Esc for ruler, M/P for tools)
    window.addEventListener("keydown", (e) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        return;
      }

      // Space adds waypoint while measuring
      if (e.code === "Space" && this.measurement.active) {
        e.preventDefault();
        this.addMeasurementWaypoint();
        return;
      }

      // Escape clears active measurement
      if (e.key === "Escape" && this.measurement.active) {
        e.preventDefault();
        this.clearMeasurement();
        return;
      }

      // 'M' toggles Measurement Ruler
      if (e.key.toLowerCase() === "m" && !this.isCalibrating) {
        e.preventDefault();
        this.setTool(this.currentTool === "measure" ? "pan" : "measure");
        return;
      }

      // 'P' or 'V' switches to Pan tool
      if ((e.key.toLowerCase() === "p" || e.key.toLowerCase() === "v") && !this.isCalibrating) {
        e.preventDefault();
        this.setTool("pan");
        return;
      }

      if (this.isCalibrating) {
        const step = e.shiftKey ? 5 : 1;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          this.nudgeCalibrator(-step, 0);
          return;
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          this.nudgeCalibrator(step, 0);
          return;
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          this.nudgeCalibrator(0, -step);
          return;
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          this.nudgeCalibrator(0, step);
          return;
        } else if (e.key === "Enter") {
          e.preventDefault();
          this.stopGridCalibration(true);
          return;
        } else if (e.key === "Escape") {
          e.preventDefault();
          this.stopGridCalibration(false);
          return;
        }
      }

      if (e.key.toLowerCase() === "f") {
        this.fitMapToViewport();
      } else if (e.key === "=" || e.key === "+") {
        this.zoomAt(1.15);
      } else if (e.key === "-") {
        this.zoomAt(1 / 1.15);
      } else if (e.key === "0") {
        this.setZoom(1);
      }
    });
  }
}

window.VTTMapModule = VTTMapModule;

