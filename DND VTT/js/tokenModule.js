/**
 * Token Module for D&D VTT
 * Supports Player (Green) and Monster/Enemy (Red) tokens,
 * automatic square-center snapping on gridded maps, free movement on ungridded maps,
 * HP bars, name tags, and sizing.
 */
class VTTTokenModule {
  constructor(mapModule, options = {}) {
    this.mapModule = mapModule;
    this.layer = options.tokensLayer || document.getElementById("tokens-layer");
    this.onTokensChange = options.onTokensChange || (() => {});
    this.onTokenSelected = options.onTokenSelected || (() => {});

    this.tokens = [];
    this.selectedTokenId = null;
    this.currentRole = "dm"; // "dm" | "player"

    // Dragging state
    this.isDragging = false;
    this.dragToken = null;
    this.dragStart = null;
    this.dragGhost = null;

    // Movement distance tooltip during drag
    this.moveTooltip = null;
    this._createMoveTooltip();

    this._bindEvents();
  }

  _createMoveTooltip() {
    this.moveTooltip = document.createElement("div");
    this.moveTooltip.className = "token-move-tooltip hidden";
    document.body.appendChild(this.moveTooltip);
  }

  /**
   * Spawn a new Player or Monster Token
   */
  spawnToken(type = "player", custom = {}) {
    const map = this.mapModule.getActiveMap();
    const cellSize = map ? Math.max(16, Number(map.grid.size) || 64) : 64;
    const isGrid = !!(map && map.grid.enabled);

    const typeCount = this.tokens.filter((t) => t.type === type).length + 1;
    const defaultName = type === "player" ? `Hero ${typeCount}` : `Monster ${typeCount}`;

    // Center spawn point in the visible viewport
    const rect = this.mapModule.viewport.getBoundingClientRect();
    const centerWorld = this.mapModule.screenToWorld(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );

    let x, y, cellX, cellY;

    if (isGrid) {
      cellX = Math.floor((centerWorld.worldX - map.grid.offsetX) / cellSize);
      cellY = Math.floor((centerWorld.worldY - map.grid.offsetY) / cellSize);
      x = map.grid.offsetX + cellX * cellSize;
      y = map.grid.offsetY + cellY * cellSize;
    } else {
      cellX = null;
      cellY = null;
      x = Math.round(centerWorld.worldX - cellSize / 2);
      y = Math.round(centerWorld.worldY - cellSize / 2);
    }

    const token = {
      id: "token_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      type: type, // "player" | "monster"
      name: custom.name || defaultName,
      size: custom.size || 1, // 1 = 1x1 cell, 2 = 2x2, etc.
      x,
      y,
      cellX,
      cellY,
      hp: custom.hp || (type === "player" ? 25 : 15),
      maxHp: custom.maxHp || (type === "player" ? 25 : 15),
    };

    this.tokens.push(token);
    this.renderTokens();
    this.selectToken(token.id);
    this.onTokensChange(this.tokens);

    if (window.networkModule) {
      window.networkModule.syncTokenAdd(token);
    }
    return token;
  }

  /**
   * Remove a token by ID
   */
  removeToken(tokenId) {
    const idx = this.tokens.findIndex((t) => t.id === tokenId);
    if (idx === -1) return;
    this.tokens.splice(idx, 1);
    if (this.selectedTokenId === tokenId) {
      this.selectedTokenId = null;
      this.onTokenSelected(null);
    }
    this.renderTokens();
    this.onTokensChange(this.tokens);

    if (window.networkModule) {
      window.networkModule.syncTokenRemove(tokenId);
    }
  }

  /**
   * Clear all tokens
   */
  clearAllTokens() {
    this.tokens = [];
    this.selectedTokenId = null;
    this.renderTokens();
    this.onTokensChange(this.tokens);
    this.onTokenSelected(null);
  }

  /**
   * Select a token
   */
  selectToken(tokenId) {
    this.selectedTokenId = tokenId;
    const token = this.tokens.find((t) => t.id === tokenId) || null;
    this._updateSelectionClasses();
    this.onTokenSelected(token);
  }

  /**
   * Update token data (name, HP, type, size)
   */
  updateToken(tokenId, patch) {
    const token = this.tokens.find((t) => t.id === tokenId);
    if (!token) return;

    Object.assign(token, patch);
    if (patch.size !== undefined) {
      this.syncTokenPositions();
    } else {
      this.renderTokens();
    }
    this.onTokensChange(this.tokens);
    if (this.selectedTokenId === tokenId) {
      this.onTokenSelected(token);
    }

    if (window.networkModule) {
      window.networkModule.syncTokenUpdate(tokenId, patch);
    }
  }

  /**
   * Set user viewing role ('dm' or 'player')
   */
  setRole(role) {
    this.currentRole = role === "player" ? "player" : "dm";
    this.renderTokens();
    this.onTokensChange(this.tokens);
    const sel = this.tokens.find((t) => t.id === this.selectedTokenId) || null;
    this.onTokenSelected(sel);
  }

  /**
   * Synchronize all tokens to current grid size / offset
   */
  syncTokenPositions() {
    const map = this.mapModule.getActiveMap();
    if (!map) return;
    const cellSize = Math.max(16, Number(map.grid.size) || 64);
    const isGrid = map.grid.enabled;

    this.tokens.forEach((t) => {
      if (isGrid && t.cellX !== null && t.cellY !== null) {
        t.x = map.grid.offsetX + t.cellX * cellSize;
        t.y = map.grid.offsetY + t.cellY * cellSize;
      }
    });

    this.renderTokens();
  }

  /**
   * Render or update all token elements inside #tokens-layer
   */
  renderTokens() {
    if (!this.layer) return;
    const map = this.mapModule.getActiveMap();
    const cellSize = map ? Math.max(16, Number(map.grid.size) || 64) : 64;

    this.layer.innerHTML = "";

    this.tokens.forEach((t) => {
      const el = document.createElement("div");
      el.className = `vtt-token token-${t.type} ${t.id === this.selectedTokenId ? "selected" : ""}`;
      el.dataset.id = t.id;

      const tokenWidth = cellSize * t.size;
      const tokenHeight = cellSize * t.size;

      el.style.width = `${tokenWidth}px`;
      el.style.height = `${tokenHeight}px`;
      el.style.left = `${t.x}px`;
      el.style.top = `${t.y}px`;

      // Initials for token center
      const initials = t.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || (t.type === "player" ? "P" : "M");

      // HP Bar percentage (hidden for monsters in player view)
      const isHpVisible = this.currentRole === "dm" || t.type === "player";
      const hpPct = Math.max(0, Math.min(100, Math.round((t.hp / t.maxHp) * 100)));
      const hpColor = hpPct > 50 ? "#10b981" : hpPct > 20 ? "#f59e0b" : "#ef4444";

      const hpBarHtml = isHpVisible
        ? `<div class="token-hp-wrap">
             <div class="token-hp-fill" style="width: ${hpPct}%; background-color: ${hpColor};"></div>
           </div>`
        : "";

      el.innerHTML = `
        ${hpBarHtml}
        <div class="token-body">
          <span class="token-initials">${initials}</span>
        </div>
        <div class="token-name-badge">${t.name}</div>
      `;

      // Token mousedown (drag initiation)
      el.addEventListener("mousedown", (e) => this._onTokenMouseDown(e, t));

      this.layer.appendChild(el);
    });
  }

  _updateSelectionClasses() {
    if (!this.layer) return;
    const tokenEls = this.layer.querySelectorAll(".vtt-token");
    tokenEls.forEach((el) => {
      el.classList.toggle("selected", el.dataset.id === this.selectedTokenId);
    });
  }

  _onTokenMouseDown(e, token) {
    if (e.button !== 0) return; // Only left-click drag
    e.stopPropagation();
    e.preventDefault();

    this.selectToken(token.id);

    this.isDragging = true;
    this.dragToken = token;
    this.dragStart = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: token.x,
      origY: token.y,
      origCellX: token.cellX,
      origCellY: token.cellY,
    };

    const tokenEl = this.layer.querySelector(`[data-id="${token.id}"]`);
    if (tokenEl) tokenEl.classList.add("dragging");
  }

  _bindEvents() {
    // Window mousemove handles token dragging with live movement measurement
    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging || !this.dragToken) return;

      const map = this.mapModule.getActiveMap();
      const cellSize = map ? Math.max(16, Number(map.grid.size) || 64) : 64;
      const isGrid = !!(map && map.grid.enabled && !e.altKey);

      const dx = (e.clientX - this.dragStart.clientX) / this.mapModule.camera.zoom;
      const dy = (e.clientY - this.dragStart.clientY) / this.mapModule.camera.zoom;

      const curX = this.dragStart.origX + dx;
      const curY = this.dragStart.origY + dy;

      const tokenEl = this.layer.querySelector(`[data-id="${this.dragToken.id}"]`);
      if (tokenEl) {
        tokenEl.style.left = `${curX}px`;
        tokenEl.style.top = `${curY}px`;
      }

      // Movement Distance Calculation during drag
      let distText = "";
      if (isGrid && this.dragStart.origCellX !== null) {
        const hoverCellX = Math.floor((curX + cellSize / 2 - map.grid.offsetX) / cellSize);
        const hoverCellY = Math.floor((curY + cellSize / 2 - map.grid.offsetY) / cellSize);
        const sqDist = Math.max(
          Math.abs(hoverCellX - this.dragStart.origCellX),
          Math.abs(hoverCellY - this.dragStart.origCellY)
        );
        const feet = sqDist * 5;
        distText = `🏃 ${feet} ft (${sqDist} sq)`;
      } else {
        const distPx = Math.hypot(dx, dy);
        const feet = Math.max(0, Math.round(((distPx / cellSize) * 5) / 5) * 5);
        distText = `🏃 ${feet} ft (Free)`;
      }

      // Show live tooltip near mouse
      this.moveTooltip.textContent = distText;
      this.moveTooltip.style.left = `${e.clientX + 16}px`;
      this.moveTooltip.style.top = `${e.clientY + 16}px`;
      this.moveTooltip.classList.remove("hidden");
    });

    // Window mouseup handles drop / square snap
    window.addEventListener("mouseup", (e) => {
      if (!this.isDragging || !this.dragToken) return;

      const map = this.mapModule.getActiveMap();
      const cellSize = map ? Math.max(16, Number(map.grid.size) || 64) : 64;
      const isGrid = !!(map && map.grid.enabled && !e.altKey);

      const dx = (e.clientX - this.dragStart.clientX) / this.mapModule.camera.zoom;
      const dy = (e.clientY - this.dragStart.clientY) / this.mapModule.camera.zoom;

      const finalX = this.dragStart.origX + dx;
      const finalY = this.dragStart.origY + dy;

      if (isGrid) {
        // Snap directly to the nearest grid square
        const targetCellX = Math.floor((finalX + cellSize / 2 - map.grid.offsetX) / cellSize);
        const targetCellY = Math.floor((finalY + cellSize / 2 - map.grid.offsetY) / cellSize);
        this.dragToken.cellX = targetCellX;
        this.dragToken.cellY = targetCellY;
        this.dragToken.x = map.grid.offsetX + targetCellX * cellSize;
        this.dragToken.y = map.grid.offsetY + targetCellY * cellSize;
      } else {
        // Free movement: place exactly where dropped
        this.dragToken.x = Math.round(finalX);
        this.dragToken.y = Math.round(finalY);
        this.dragToken.cellX = null;
        this.dragToken.cellY = null;
      }

      const movedToken = this.dragToken;

      this.isDragging = false;
      this.dragToken = null;
      this.dragStart = null;
      this.moveTooltip.classList.add("hidden");

      this.renderTokens();
      this.onTokensChange(this.tokens);

      if (window.networkModule && movedToken) {
        window.networkModule.syncTokenMove(
          movedToken.id,
          movedToken.x,
          movedToken.y,
          movedToken.cellX,
          movedToken.cellY
        );
      }
    });

    // Deselect token when clicking on blank viewport background
    this.mapModule.viewport.addEventListener("mousedown", (e) => {
      if (!e.target.closest(".vtt-token") && !e.target.closest(".vtt-sidebar")) {
        if (this.selectedTokenId !== null) {
          this.selectToken(null);
        }
      }
    });

    // Keyboard delete selected token
    window.addEventListener("keydown", (e) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && this.selectedTokenId) {
        e.preventDefault();
        this.removeToken(this.selectedTokenId);
      }
    });
  }
}

window.VTTTokenModule = VTTTokenModule;

