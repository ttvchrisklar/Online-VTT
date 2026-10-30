/**
 * Multiplayer Network Module for D&D VTT
 * Peer-to-Peer WebRTC connection (via PeerJS).
 * Zero external login, zero accounts, zero configuration.
 * The DM gets an invite link, players click it and connect instantly.
 */
class VTTNetworkModule {
  constructor(mapModule, tokenModule, options = {}) {
    this.mapModule = mapModule;
    this.tokenModule = tokenModule;
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onPeersChange = options.onPeersChange || (() => {});
    this.onPlayerJoined = options.onPlayerJoined || (() => {});

    this.isHost = true;
    this.roomId = null;
    this.peer = null;
    this.hostConnection = null; // For clients: connection to DM
    this.connectedPeers = new Map(); // For host: connectionId -> { conn, name }
    this.isConnecting = false;
    this.isConnected = false;
    this.playerName = localStorage.getItem("vtt_player_name") || "Player";

    this._checkUrlParameters();
  }

  /**
   * Check if user opened the page with a ?join=<roomId> link
   */
  _checkUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const joinRoom = params.get("join") || params.get("room");

    if (joinRoom) {
      this.isHost = false;
      this.roomId = joinRoom.trim();
    } else {
      this.isHost = true;
      this.roomId = "vtt-" + Math.random().toString(36).slice(2, 8);
    }
  }

  /**
   * Initialize PeerJS connection
   */
  init() {
    if (typeof Peer === "undefined") {
      this.onStatusChange({
        status: "error",
        text: "PeerJS library not loaded. Check internet connection.",
      });
      return;
    }

    if (this.isHost) {
      this._initHost();
    } else {
      this._initClient();
    }
  }

  /**
   * Host (DM) Setup
   */
  _initHost() {
    this.isConnecting = true;
    this.onStatusChange({
      status: "connecting",
      text: "Creating game room on peer network...",
    });

    try {
      this.peer = new Peer(this.roomId, {
        debug: 1,
      });

      this.peer.on("open", (id) => {
        this.roomId = id;
        this.isConnected = true;
        this.isConnecting = false;
        this.onStatusChange({
          status: "connected",
          text: `🟢 Room Active: ${this.roomId}`,
          isHost: true,
          roomId: this.roomId,
          inviteUrl: this.getInviteUrl(),
        });
      });

      this.peer.on("connection", (conn) => {
        this._handleIncomingConnection(conn);
      });

      this.peer.on("error", (err) => {
        // If room ID collision occurred, retry with random ID
        if (err.type === "unavailable-id") {
          this.roomId = "vtt-" + Math.random().toString(36).slice(2, 8);
          this._initHost();
          return;
        }
        this.onStatusChange({
          status: "error",
          text: `Connection notice: ${err.type || err.message}`,
        });
      });
    } catch (e) {
      this.onStatusChange({ status: "error", text: "Failed to initialize host peer." });
    }
  }

  _handleIncomingConnection(conn) {
    conn.on("open", () => {
      this.connectedPeers.set(conn.peer, { conn, name: "Player" });
      this.onPeersChange(this.getConnectedPlayerList());

      // Send the current game state (map, grid, tokens) to the new player
      this._sendInitialStateTo(conn);
    });

    conn.on("data", (data) => {
      this._handleIncomingData(data, conn);
    });

    conn.on("close", () => {
      this.connectedPeers.delete(conn.peer);
      this.onPeersChange(this.getConnectedPlayerList());
    });

    conn.on("error", () => {
      this.connectedPeers.delete(conn.peer);
      this.onPeersChange(this.getConnectedPlayerList());
    });
  }

  /**
   * Client (Player) Setup
   */
  _initClient() {
    this.isConnecting = true;
    this.onStatusChange({
      status: "connecting",
      text: `Connecting to DM's room (${this.roomId})...`,
    });

    try {
      this.peer = new Peer({
        debug: 1,
      });

      this.peer.on("open", () => {
        this._connectToHost();
      });

      this.peer.on("error", (err) => {
        this.onStatusChange({
          status: "error",
          text: `Connection error: ${err.type || err.message}`,
        });
      });
    } catch (e) {
      this.onStatusChange({ status: "error", text: "Failed to initialize player client." });
    }
  }

  _connectToHost() {
    this.hostConnection = this.peer.connect(this.roomId, {
      reliable: true,
      metadata: { playerName: this.playerName },
    });

    this.hostConnection.on("open", () => {
      this.isConnected = true;
      this.isConnecting = false;
      this.onStatusChange({
        status: "connected",
        text: `🟢 Connected to DM (Room: ${this.roomId})`,
        isHost: false,
        roomId: this.roomId,
      });

      // Send join announcement
      this.hostConnection.send({
        type: "PLAYER_JOIN",
        name: this.playerName,
      });
    });

    this.hostConnection.on("data", (data) => {
      this._handleIncomingData(data, this.hostConnection);
    });

    this.hostConnection.on("close", () => {
      this.isConnected = false;
      this.onStatusChange({
        status: "disconnected",
        text: "Disconnected from DM. Attempting reconnect...",
      });
      setTimeout(() => this._connectToHost(), 3000);
    });

    this.hostConnection.on("error", (err) => {
      this.onStatusChange({
        status: "error",
        text: `Network error: ${err.message || "Failed to reach DM"}`,
      });
    });
  }

  /**
   * Handle incoming network messages
   */
  _handleIncomingData(msg, senderConn) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "PLAYER_JOIN":
        if (this.isHost) {
          const peerInfo = this.connectedPeers.get(senderConn.peer);
          if (peerInfo) {
            peerInfo.name = msg.name || "Player";
          }
          this.onPeersChange(this.getConnectedPlayerList());
          this.onPlayerJoined(msg.name || "A player");
          // Re-broadcast player join to all
          this.broadcast(
            { type: "PEERS_UPDATE", peers: this.getConnectedPlayerList() },
            senderConn.peer
          );
        }
        break;

      case "PEERS_UPDATE":
        if (!this.isHost) {
          this.onPeersChange(msg.peers || []);
        }
        break;

      case "INIT_STATE":
        this._applyFullState(msg.state);
        break;

      case "MAP_SYNC":
        this._applyMapSync(msg.mapData);
        if (this.isHost) {
          this.broadcast(msg, senderConn.peer);
        }
        break;

      case "TOKEN_MOVE":
        this._applyTokenMove(msg.tokenId, msg.x, msg.y, msg.cellX, msg.cellY);
        if (this.isHost) {
          this.broadcast(msg, senderConn.peer);
        }
        break;

      case "TOKEN_ADD":
        this._applyTokenAdd(msg.token);
        if (this.isHost) {
          this.broadcast(msg, senderConn.peer);
        }
        break;

      case "TOKEN_UPDATE":
        this._applyTokenUpdate(msg.tokenId, msg.patch);
        if (this.isHost) {
          this.broadcast(msg, senderConn.peer);
        }
        break;

      case "TOKEN_REMOVE":
        this._applyTokenRemove(msg.tokenId);
        if (this.isHost) {
          this.broadcast(msg, senderConn.peer);
        }
        break;
    }
  }

  /**
   * Send the full game state to a newly connected client
   */
  async _sendInitialStateTo(conn) {
    const activeMap = this.mapModule.getActiveMap();
    let mapData = null;

    if (activeMap) {
      let resolvedSrc = activeMap.src;
      // If local blob/upload, convert to dataURL for peer transfer
      if (activeMap.isObjectUrl && activeMap.mediaType === "image") {
        resolvedSrc = await this._getImageDataUrl(activeMap.src);
      }

      mapData = {
        name: activeMap.name,
        src: resolvedSrc,
        mediaType: activeMap.mediaType,
        naturalWidth: activeMap.naturalWidth,
        naturalHeight: activeMap.naturalHeight,
        scale: activeMap.scale,
        grid: { ...activeMap.grid },
      };
    }

    const state = {
      mapData,
      tokens: this.tokenModule.tokens.map((t) => ({ ...t })),
      rule: this.mapModule.measureRule,
      speedBase: this.mapModule.speedBase,
      speedDash: this.mapModule.speedDash,
    };

    conn.send({
      type: "INIT_STATE",
      state,
    });
  }

  /**
   * Apply received full game state (on player connect)
   */
  _applyFullState(state) {
    if (!state) return;

    if (state.rule) this.mapModule.setMeasureRule(state.rule);
    if (state.speedBase) this.mapModule.setMovementSpeeds(state.speedBase, state.speedDash);

    if (state.mapData) {
      this._applyMapSync(state.mapData);
    }

    if (Array.isArray(state.tokens)) {
      this.tokenModule.tokens = state.tokens.map((t) => ({ ...t }));
      this.tokenModule.renderTokens();
      this.tokenModule.onTokensChange(this.tokenModule.tokens);
    }
  }

  /**
   * Apply synchronized map
   */
  _applyMapSync(mapData) {
    if (!mapData) return;

    const existing = this.mapModule.maps.find((m) => m.name === mapData.name);
    if (existing) {
      existing.src = mapData.src;
      existing.scale = mapData.scale;
      existing.grid = { ...mapData.grid };
      this.mapModule.setActiveMap(existing.id, false);
    } else {
      const newEntry = {
        id: "net_map_" + Date.now(),
        name: mapData.name,
        src: mapData.src,
        mediaType: mapData.mediaType || "image",
        isObjectUrl: false,
        naturalWidth: mapData.naturalWidth || 1920,
        naturalHeight: mapData.naturalHeight || 1080,
        scale: mapData.scale || 1,
        grid: mapData.grid || { ...this.mapModule.defaultGrid },
      };
      this.mapModule.maps.push(newEntry);
      this.mapModule.onMapListChange(this.mapModule.maps, newEntry.id);
      this.mapModule.setActiveMap(newEntry.id, false);
    }

    if (this.tokenModule) {
      this.tokenModule.syncTokenPositions();
    }
  }

  _applyTokenMove(tokenId, x, y, cellX, cellY) {
    const token = this.tokenModule.tokens.find((t) => t.id === tokenId);
    if (!token) return;
    token.x = x;
    token.y = y;
    token.cellX = cellX;
    token.cellY = cellY;
    this.tokenModule.renderTokens();
  }

  _applyTokenAdd(token) {
    if (!token) return;
    const exists = this.tokenModule.tokens.some((t) => t.id === token.id);
    if (!exists) {
      this.tokenModule.tokens.push(token);
      this.tokenModule.renderTokens();
      this.tokenModule.onTokensChange(this.tokenModule.tokens);
    }
  }

  _applyTokenUpdate(tokenId, patch) {
    const token = this.tokenModule.tokens.find((t) => t.id === tokenId);
    if (!token) return;
    Object.assign(token, patch);
    this.tokenModule.renderTokens();
    this.tokenModule.onTokensChange(this.tokenModule.tokens);
    if (this.tokenModule.selectedTokenId === tokenId) {
      this.tokenModule.onTokenSelected(token);
    }
  }

  _applyTokenRemove(tokenId) {
    this.tokenModule.removeToken(tokenId);
  }

  /**
   * Broadcast message to peers
   */
  broadcast(msg, excludePeerId = null) {
    if (this.isHost) {
      this.connectedPeers.forEach((info, peerId) => {
        if (peerId !== excludePeerId && info.conn && info.conn.open) {
          info.conn.send(msg);
        }
      });
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(msg);
    }
  }

  /**
   * Outgoing event dispatchers called by UI/Modules
   */
  syncMapUpdate() {
    const active = this.mapModule.getActiveMap();
    if (!active) return;
    this.broadcast({
      type: "MAP_SYNC",
      mapData: {
        name: active.name,
        src: active.src,
        mediaType: active.mediaType,
        naturalWidth: active.naturalWidth,
        naturalHeight: active.naturalHeight,
        scale: active.scale,
        grid: { ...active.grid },
      },
    });
  }

  syncTokenMove(tokenId, x, y, cellX, cellY) {
    this.broadcast({
      type: "TOKEN_MOVE",
      tokenId,
      x,
      y,
      cellX,
      cellY,
    });
  }

  syncTokenAdd(token) {
    this.broadcast({
      type: "TOKEN_ADD",
      token,
    });
  }

  syncTokenUpdate(tokenId, patch) {
    this.broadcast({
      type: "TOKEN_UPDATE",
      tokenId,
      patch,
    });
  }

  syncTokenRemove(tokenId) {
    this.broadcast({
      type: "TOKEN_REMOVE",
      tokenId,
    });
  }

  /**
   * Helpers
   */
  getInviteUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("join", this.roomId);
    return url.toString();
  }

  getConnectedPlayerList() {
    const list = [];
    this.connectedPeers.forEach((val, key) => {
      list.push({ peerId: key, name: val.name || "Player" });
    });
    return list;
  }

  setPlayerName(name) {
    this.playerName = name.trim() || "Player";
    localStorage.setItem("vtt_player_name", this.playerName);
    if (!this.isHost && this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({
        type: "PLAYER_JOIN",
        name: this.playerName,
      });
    }
  }

  _getImageDataUrl(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 2048;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }
}

window.VTTNetworkModule = VTTNetworkModule;

