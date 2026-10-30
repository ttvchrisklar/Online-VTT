/**
 * Main Application Controller — Connects UI Controls to VTTMapModule
 */
document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const viewport = document.getElementById("vtt-viewport");
  const stage = document.getElementById("vtt-stage");
  const mapLayer = document.getElementById("map-layer");
  const gridCanvas = document.getElementById("grid-canvas");
  const emptyState = document.getElementById("empty-state");
  const dropOverlay = document.getElementById("drop-overlay");
  const sidebar = document.getElementById("vtt-sidebar");

  // Header Controls
  const btnUploadMap = document.getElementById("btn-upload-map");
  const btnEmptyUpload = document.getElementById("btn-empty-upload");
  const btnEmptySample = document.getElementById("btn-empty-sample");
  const mapFileInput = document.getElementById("map-file-input");
  const btnUrlMap = document.getElementById("btn-url-map");
  const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");

  // Zoom Controls
  const btnZoomIn = document.getElementById("btn-zoom-in");
  const btnZoomOut = document.getElementById("btn-zoom-out");
  const zoomReadout = document.getElementById("zoom-readout");
  const btnFitMap = document.getElementById("btn-fit-map");

  // Video Controls
  const videoControls = document.getElementById("video-controls");
  const btnVideoPlay = document.getElementById("btn-video-play");
  const btnVideoMute = document.getElementById("btn-video-mute");
  const videoSpeedSelect = document.getElementById("video-speed-select");

  // Status Bar
  const mapInfoText = document.getElementById("map-info-text");
  const coordsText = document.getElementById("coords-text");
  const measureStatusText = document.getElementById("measure-status-text");

  // Tool Switcher
  const toolPan = document.getElementById("tool-pan");
  const toolMeasure = document.getElementById("tool-measure");

  // Measurement Settings Controls
  const measureRuleSelect = document.getElementById("measure-rule");
  const speedBaseInput = document.getElementById("speed-base");
  const speedDashInput = document.getElementById("speed-dash");
  const btnClearRuler = document.getElementById("btn-clear-ruler");

  // Main App & Role Switcher
  const vttApp = document.getElementById("vtt-app");
  const btnRoleDm = document.getElementById("btn-role-dm");
  const btnRolePlayer = document.getElementById("btn-role-player");

  // Multiplayer Connection Elements
  const btnShareRoom = document.getElementById("btn-share-room");
  const btnShareText = document.getElementById("btn-share-text");
  const netStatusDot = document.getElementById("net-status-dot");
  const shareModal = document.getElementById("share-modal");
  const shareLinkInput = document.getElementById("share-link-input");
  const btnCopyShareLink = document.getElementById("btn-copy-share-link");
  const roomCodeDisplay = document.getElementById("room-code-display");
  const netStatusPill = document.getElementById("net-status-pill");
  const netRoleBadge = document.getElementById("net-role-badge");
  const connectedCount = document.getElementById("connected-count");
  const connectedPlayersList = document.getElementById("connected-players-list");
  const btnCloseShareModal = document.getElementById("btn-close-share-modal");

  const playerNameModal = document.getElementById("player-name-modal");
  const playerNameInput = document.getElementById("player-name-input");
  const btnConfirmPlayerName = document.getElementById("btn-confirm-player-name");

  // Token UI Elements
  const tokensLayer = document.getElementById("tokens-layer");
  const btnSpawnPlayer = document.getElementById("btn-spawn-player");
  const btnSpawnMonster = document.getElementById("btn-spawn-monster");
  const btnSideSpawnPlayer = document.getElementById("btn-side-spawn-player");
  const btnSideSpawnMonster = document.getElementById("btn-side-spawn-monster");
  const tokenListEl = document.getElementById("token-list");
  const tokenCountBadge = document.getElementById("token-count-badge");

  // Token Inspector Elements
  const tokenInspector = document.getElementById("token-inspector");
  const inspTokenTypePill = document.getElementById("insp-token-type-pill");
  const inspTokenName = document.getElementById("insp-token-name");
  const inspTokenType = document.getElementById("insp-token-type");
  const inspTokenSize = document.getElementById("insp-token-size");
  const inspHpReadout = document.getElementById("insp-hp-readout");
  const inspTokenHp = document.getElementById("insp-token-hp");
  const inspTokenMaxHp = document.getElementById("insp-token-maxhp");
  const inspHpSection = document.getElementById("insp-hp-section");
  const inspPlayerNotice = document.getElementById("insp-player-notice");
  const btnHpMinus = document.getElementById("btn-hp-minus");
  const btnHpPlus = document.getElementById("btn-hp-plus");
  const btnDeleteToken = document.getElementById("btn-delete-token");

  // Sidebar Map List
  const mapListEl = document.getElementById("map-list");
  const mapCountBadge = document.getElementById("map-count-badge");

  // Grid Controls
  const gridEnabledInput = document.getElementById("grid-enabled");
  const gridTypeSelect = document.getElementById("grid-type");
  const gridSizeSlider = document.getElementById("grid-size");
  const gridSizeNum = document.getElementById("grid-size-num");
  const gridOffsetX = document.getElementById("grid-offset-x");
  const gridOffsetY = document.getElementById("grid-offset-y");
  const gridColorInput = document.getElementById("grid-color");
  const gridOpacitySlider = document.getElementById("grid-opacity");
  const gridOpacityVal = document.getElementById("grid-opacity-val");
  const btnOpenGridWizard = document.getElementById("btn-open-grid-wizard");

  // Visual Grid Alignment Wizard Elements (D&D Beyond Style)
  const gridWizardBar = document.getElementById("grid-wizard-bar");
  const calDimButtons = document.querySelectorAll("#cal-dim-buttons .btn-dim");
  const calCellSize = document.getElementById("cal-cell-size");
  const btnCalSizeDec = document.getElementById("btn-cal-size-dec");
  const btnCalSizeInc = document.getElementById("btn-cal-size-inc");
  const btnNudgeLeft = document.getElementById("btn-nudge-left");
  const btnNudgeUp = document.getElementById("btn-nudge-up");
  const btnNudgeDown = document.getElementById("btn-nudge-down");
  const btnNudgeRight = document.getElementById("btn-nudge-right");
  const calGridColor = document.getElementById("cal-grid-color");
  const calGridOpacity = document.getElementById("cal-grid-opacity");
  const calGridType = document.getElementById("cal-grid-type");
  const btnCalSave = document.getElementById("btn-cal-save");
  const btnCalNoGrid = document.getElementById("btn-cal-nogrid");
  const btnCalCancel = document.getElementById("btn-cal-cancel");

  // Map Scale Controls
  const mapScaleSlider = document.getElementById("map-scale");
  const mapScaleNum = document.getElementById("map-scale-num");
  const btnResetMapAdjust = document.getElementById("btn-reset-map-adjust");

  // URL Modal Elements
  const urlModal = document.getElementById("url-modal");
  const mapUrlInput = document.getElementById("map-url-input");
  const mapUrlName = document.getElementById("map-url-name");
  const mapUrlType = document.getElementById("map-url-type");
  const btnUrlCancel = document.getElementById("btn-url-cancel");
  const btnUrlConfirm = document.getElementById("btn-url-confirm");

  // Initialize VTT Map Module
  const mapModule = new VTTMapModule({
    viewport,
    stage,
    mapLayer,
    gridCanvas,

    onMapListChange(maps, activeId) {
      mapCountBadge.textContent = maps.length;
      mapListEl.innerHTML = "";

      if (maps.length === 0) {
        const emptyLi = document.createElement("li");
        emptyLi.className = "map-list-empty";
        emptyLi.textContent = "No maps uploaded yet.";
        mapListEl.appendChild(emptyLi);
        return;
      }

      maps.forEach((m) => {
        const li = document.createElement("li");
        li.className = `map-item ${m.id === activeId ? "active" : ""}`;

        const infoDiv = document.createElement("div");
        infoDiv.className = "map-item-info";

        const titleSpan = document.createElement("span");
        titleSpan.className = "map-item-title";
        titleSpan.textContent = m.name;

        const metaSpan = document.createElement("span");
        metaSpan.className = "map-item-meta";

        const pill = document.createElement("span");
        pill.className = `type-pill ${m.mediaType}`;
        pill.textContent = m.mediaType.toUpperCase();

        const dimText = document.createElement("span");
        dimText.textContent = `${m.naturalWidth}×${m.naturalHeight}`;

        metaSpan.appendChild(pill);
        metaSpan.appendChild(dimText);

        infoDiv.appendChild(titleSpan);
        infoDiv.appendChild(metaSpan);

        const delBtn = document.createElement("button");
        delBtn.className = "btn-delete-map";
        delBtn.title = "Remove Map";
        delBtn.textContent = "✕";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          mapModule.removeMap(m.id);
        });

        li.appendChild(infoDiv);
        li.appendChild(delBtn);
        li.addEventListener("click", () => mapModule.setActiveMap(m.id));
        mapListEl.appendChild(li);
      });
    },

    onActiveMapChange(map, mediaEl) {
      if (!map) {
        emptyState.classList.remove("hidden");
        videoControls.classList.add("hidden");
        mapInfoText.textContent = "No active map";
        return;
      }

      emptyState.classList.add("hidden");

      const scaledW = Math.round(map.naturalWidth * map.scale);
      const scaledH = Math.round(map.naturalHeight * map.scale);
      mapInfoText.textContent = `${map.name} (${scaledW}×${scaledH}px • ${map.mediaType.toUpperCase()})`;

      // Sync Sidebar Controls with this map's settings
      gridEnabledInput.checked = map.grid.enabled;
      gridTypeSelect.value = map.grid.type;
      gridSizeSlider.value = map.grid.size;
      gridSizeNum.value = map.grid.size;
      gridOffsetX.value = map.grid.offsetX;
      gridOffsetY.value = map.grid.offsetY;
      gridColorInput.value = map.grid.color;
      const opPct = Math.round(map.grid.opacity * 100);
      gridOpacitySlider.value = opPct;
      gridOpacityVal.textContent = `${opPct}%`;

      const scalePct = Math.round(map.scale * 100);
      mapScaleSlider.value = scalePct;
      mapScaleNum.value = scalePct;

      if (window.tokenModule) {
        window.tokenModule.syncTokenPositions();
      }

      // Show/Hide Video Playback Controls
      if (map.mediaType === "video" && mediaEl) {
        videoControls.classList.remove("hidden");
        btnVideoPlay.textContent = mediaEl.paused ? "▶️" : "⏸️";
        btnVideoMute.textContent = mediaEl.muted ? "🔇" : "🔊";
        videoSpeedSelect.value = String(mediaEl.playbackRate || 1);
      } else {
        videoControls.classList.add("hidden");
      }
    },

    onTransformChange(camera) {
      zoomReadout.textContent = `${Math.round(camera.zoom * 100)}%`;
    },

    onCursorMove({ worldX, worldY, cellX, cellY }) {
      coordsText.textContent = `X: ${worldX}, Y: ${worldY} (Cell: ${cellX}, ${cellY})`;
    },

    onGridCalibrateChange(gridSettings, calBox) {
      if (!gridSettings || !calBox) {
        gridWizardBar.classList.add("hidden");
        if (gridSettings) {
          gridEnabledInput.checked = gridSettings.enabled;
          gridSizeSlider.value = gridSettings.size;
          gridSizeNum.value = gridSettings.size;
          gridOffsetX.value = gridSettings.offsetX;
          gridOffsetY.value = gridSettings.offsetY;
          gridColorInput.value = gridSettings.color;
          const opPct = Math.round(gridSettings.opacity * 100);
          gridOpacitySlider.value = opPct;
          gridOpacityVal.textContent = `${opPct}%`;
          if (gridTypeSelect) gridTypeSelect.value = gridSettings.type;
        }
        return;
      }

      gridWizardBar.classList.remove("hidden");
      calCellSize.value = gridSettings.size;
      calGridColor.value = gridSettings.color;
      calGridOpacity.value = Math.round(gridSettings.opacity * 100);
      if (calGridType) calGridType.value = gridSettings.type;

      calDimButtons.forEach((btn) => {
        btn.classList.toggle("active", Number(btn.dataset.dim) === calBox.dim);
      });

      // Synchronize sidebar controls simultaneously
      gridEnabledInput.checked = gridSettings.enabled;
      gridSizeSlider.value = gridSettings.size;
      gridSizeNum.value = gridSettings.size;
      gridOffsetX.value = gridSettings.offsetX;
      gridOffsetY.value = gridSettings.offsetY;
      gridColorInput.value = gridSettings.color;
      const opPct = Math.round(gridSettings.opacity * 100);
      gridOpacitySlider.value = opPct;
      gridOpacityVal.textContent = `${opPct}%`;
      if (gridTypeSelect) gridTypeSelect.value = gridSettings.type;
    },

    onToolChange(tool) {
      if (toolPan && toolMeasure) {
        toolPan.classList.toggle("active", tool === "pan");
        toolMeasure.classList.toggle("active", tool === "measure");
      }
      if (measureStatusText) {
        measureStatusText.textContent = tool === "measure"
          ? "📏 Ruler: Active (Click square center to measure)"
          : "📏 Ruler: Idle (Press M)";
      }
    },

    onMeasurementChange(data) {
      if (!measureStatusText) return;
      if (data) {
        measureStatusText.textContent = `📏 ${data.totalFeet} ft • ${data.statusLabel} (${data.isGrid ? "Center-snapped" : "Point-to-point"})`;
      } else {
        measureStatusText.textContent = mapModule.currentTool === "measure"
          ? "📏 Ruler: Click square center to measure"
          : "📏 Ruler: Idle (Press M)";
      }
    },
  });

  // Initialize Character & Monster Token System
  const tokenModule = new VTTTokenModule(mapModule, {
    tokensLayer,
    onTokensChange(tokens) {
      if (tokenCountBadge) tokenCountBadge.textContent = tokens.length;
      if (!tokenListEl) return;
      tokenListEl.innerHTML = "";

      if (tokens.length === 0) {
        const li = document.createElement("li");
        li.className = "token-list-empty";
        li.textContent = "No tokens placed yet.";
        tokenListEl.appendChild(li);
        return;
      }

      tokens.forEach((t) => {
        const isEnemyHidden = tokenModule.currentRole === "player" && t.type === "monster";
        const hpDisplay = isEnemyHidden ? "HP Hidden" : `${t.hp}/${t.maxHp} HP`;

        const li = document.createElement("li");
        li.className = `token-list-item ${t.id === tokenModule.selectedTokenId ? "selected" : ""}`;
        li.innerHTML = `
          <div class="token-item-left">
            <span class="dot ${t.type === "player" ? "dot-green" : "dot-red"}"></span>
            <span class="token-item-name">${t.name}</span>
          </div>
          <span class="token-item-hp">${hpDisplay}</span>
        `;
        li.addEventListener("click", () => tokenModule.selectToken(t.id));
        tokenListEl.appendChild(li);
      });
    },

    onTokenSelected(token) {
      if (!tokenInspector) return;
      if (!token) {
        tokenInspector.classList.add("hidden");
        return;
      }

      tokenInspector.classList.remove("hidden");
      if (inspTokenTypePill) {
        inspTokenTypePill.textContent = token.type.toUpperCase();
        inspTokenTypePill.className = `type-pill ${token.type === "player" ? "gif" : "video"}`;
      }
      if (inspTokenName) inspTokenName.value = token.name;
      if (inspTokenType) inspTokenType.value = token.type;
      if (inspTokenSize) inspTokenSize.value = String(token.size);
      if (inspTokenHp) inspTokenHp.value = token.hp;
      if (inspTokenMaxHp) inspTokenMaxHp.value = token.maxHp;
      if (inspHpReadout) inspHpReadout.textContent = `${token.hp} / ${token.maxHp}`;

      // In Player View, hide enemy HP section and show hidden notice
      const isEnemyHidden = tokenModule.currentRole === "player" && token.type === "monster";
      if (inspPlayerNotice) {
        inspPlayerNotice.classList.toggle("hidden", !isEnemyHidden);
      }
      if (inspHpSection) {
        inspHpSection.classList.toggle("hidden", isEnemyHidden);
      }
      if (btnDeleteToken) {
        btnDeleteToken.classList.toggle("hidden", isEnemyHidden);
      }

      // Highlight selected item in list
      const items = tokenListEl.querySelectorAll(".token-list-item");
      tokenModule.tokens.forEach((t, idx) => {
        if (items[idx]) {
          items[idx].classList.toggle("selected", t.id === token.id);
        }
      });
    },
  });
  window.tokenModule = tokenModule;

  // --- Token UI & Inspector Listeners ---
  if (btnSpawnPlayer) btnSpawnPlayer.addEventListener("click", () => tokenModule.spawnToken("player"));
  if (btnSpawnMonster) btnSpawnMonster.addEventListener("click", () => tokenModule.spawnToken("monster"));
  if (btnSideSpawnPlayer) btnSideSpawnPlayer.addEventListener("click", () => tokenModule.spawnToken("player"));
  if (btnSideSpawnMonster) btnSideSpawnMonster.addEventListener("click", () => tokenModule.spawnToken("monster"));

  if (inspTokenName) {
    inspTokenName.addEventListener("input", () => {
      if (tokenModule.selectedTokenId) {
        tokenModule.updateToken(tokenModule.selectedTokenId, { name: inspTokenName.value.trim() || "Token" });
      }
    });
  }

  if (inspTokenType) {
    inspTokenType.addEventListener("change", () => {
      if (tokenModule.selectedTokenId) {
        tokenModule.updateToken(tokenModule.selectedTokenId, { type: inspTokenType.value });
      }
    });
  }

  if (inspTokenSize) {
    inspTokenSize.addEventListener("change", () => {
      if (tokenModule.selectedTokenId) {
        tokenModule.updateToken(tokenModule.selectedTokenId, { size: Number(inspTokenSize.value) || 1 });
      }
    });
  }

  if (inspTokenHp) {
    inspTokenHp.addEventListener("input", () => {
      if (tokenModule.selectedTokenId) {
        const hp = Math.max(0, Number(inspTokenHp.value) || 0);
        tokenModule.updateToken(tokenModule.selectedTokenId, { hp });
        if (inspHpReadout) {
          const tok = tokenModule.tokens.find((t) => t.id === tokenModule.selectedTokenId);
          if (tok) inspHpReadout.textContent = `${hp} / ${tok.maxHp}`;
        }
      }
    });
  }

  if (inspTokenMaxHp) {
    inspTokenMaxHp.addEventListener("input", () => {
      if (tokenModule.selectedTokenId) {
        const maxHp = Math.max(1, Number(inspTokenMaxHp.value) || 1);
        tokenModule.updateToken(tokenModule.selectedTokenId, { maxHp });
        if (inspHpReadout) {
          const tok = tokenModule.tokens.find((t) => t.id === tokenModule.selectedTokenId);
          if (tok) inspHpReadout.textContent = `${tok.hp} / ${maxHp}`;
        }
      }
    });
  }

  if (btnHpMinus) {
    btnHpMinus.addEventListener("click", () => {
      if (!tokenModule.selectedTokenId) return;
      const tok = tokenModule.tokens.find((t) => t.id === tokenModule.selectedTokenId);
      if (!tok) return;
      const newHp = Math.max(0, tok.hp - 5);
      tokenModule.updateToken(tok.id, { hp: newHp });
      inspTokenHp.value = newHp;
      if (inspHpReadout) inspHpReadout.textContent = `${newHp} / ${tok.maxHp}`;
    });
  }

  if (btnHpPlus) {
    btnHpPlus.addEventListener("click", () => {
      if (!tokenModule.selectedTokenId) return;
      const tok = tokenModule.tokens.find((t) => t.id === tokenModule.selectedTokenId);
      if (!tok) return;
      const newHp = Math.min(tok.maxHp, tok.hp + 5);
      tokenModule.updateToken(tok.id, { hp: newHp });
      inspTokenHp.value = newHp;
      if (inspHpReadout) inspHpReadout.textContent = `${newHp} / ${tok.maxHp}`;
    });
  }

  if (btnDeleteToken) {
    btnDeleteToken.addEventListener("click", () => {
      if (tokenModule.selectedTokenId) {
        tokenModule.removeToken(tokenModule.selectedTokenId);
      }
    });
  }

  // --- Initialize Realtime Multiplayer Network Module (PeerJS WebRTC) ---
  const networkModule = new VTTNetworkModule(mapModule, tokenModule, {
    onStatusChange(info) {
      if (netStatusDot) {
        netStatusDot.className = `net-status-dot ${info.status === "connected" ? "online" : info.status === "connecting" ? "connecting" : "offline"}`;
      }
      if (netStatusPill) {
        netStatusPill.textContent = info.text || info.status;
      }
      if (shareLinkInput && info.inviteUrl) {
        shareLinkInput.value = info.inviteUrl;
      }
      if (roomCodeDisplay && info.roomId) {
        roomCodeDisplay.value = info.roomId;
      }
      if (netRoleBadge) {
        netRoleBadge.textContent = networkModule.isHost ? "DM Host" : "Player Client";
      }
      if (btnShareText) {
        btnShareText.textContent = networkModule.isHost ? "🔗 Invite Link" : "🔗 Connected";
      }
    },

    onPeersChange(players) {
      if (connectedCount) connectedCount.textContent = players.length;
      if (!connectedPlayersList) return;
      connectedPlayersList.innerHTML = "";

      if (players.length === 0) {
        const li = document.createElement("li");
        li.className = "player-list-empty";
        li.textContent = "Waiting for players to join...";
        connectedPlayersList.appendChild(li);
        return;
      }

      players.forEach((p) => {
        const li = document.createElement("li");
        li.className = "player-tag";
        li.innerHTML = `<span class="dot dot-green"></span> <span>${p.name || "Player"}</span>`;
        connectedPlayersList.appendChild(li);
      });
    },

    onPlayerJoined(name) {
      console.log(`Player connected: ${name}`);
    },
  });
  window.networkModule = networkModule;

  // Multiplayer Share Modal Listeners
  if (btnShareRoom) {
    btnShareRoom.addEventListener("click", () => {
      if (shareLinkInput) {
        shareLinkInput.value = networkModule.getInviteUrl();
      }
      if (roomCodeDisplay) {
        roomCodeDisplay.value = networkModule.roomId || "";
      }
      const fileWarnEl = document.getElementById("file-protocol-warning");
      if (fileWarnEl) {
        fileWarnEl.classList.toggle("hidden", window.location.protocol !== "file:");
      }
      if (shareModal) shareModal.classList.remove("hidden");
    });
  }

  if (btnCloseShareModal) {
    btnCloseShareModal.addEventListener("click", () => {
      if (shareModal) shareModal.classList.add("hidden");
    });
  }

  if (shareModal) {
    shareModal.addEventListener("click", (e) => {
      if (e.target === shareModal) shareModal.classList.add("hidden");
    });
  }

  if (btnCopyShareLink) {
    btnCopyShareLink.addEventListener("click", () => {
      const link = shareLinkInput && shareLinkInput.value ? shareLinkInput.value : networkModule.getInviteUrl();
      if (link) {
        navigator.clipboard.writeText(link).then(() => {
          const original = btnCopyShareLink.textContent;
          btnCopyShareLink.textContent = "✓ Copied!";
          setTimeout(() => {
            btnCopyShareLink.textContent = original;
          }, 2000);
        });
      }
    });
  }

  // Handle Player Join Flow vs DM Host Flow
  if (!networkModule.isHost) {
    // Automatically enforce Player View
    setGameRole("player");

    // Prompt for player or character name
    if (playerNameModal) {
      playerNameModal.classList.remove("hidden");
      if (playerNameInput) {
        playerNameInput.value = networkModule.playerName || "Player";
        setTimeout(() => playerNameInput.focus(), 100);
      }
    }

    const confirmJoin = () => {
      const name = playerNameInput ? playerNameInput.value.trim() || "Player" : "Player";
      networkModule.setPlayerName(name);
      if (playerNameModal) playerNameModal.classList.add("hidden");
      networkModule.init();
    };

    if (btnConfirmPlayerName) {
      btnConfirmPlayerName.addEventListener("click", confirmJoin);
    }
    if (playerNameInput) {
      playerNameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") confirmJoin();
      });
    }
  } else {
    // DM Host: Initialize peer room immediately
    networkModule.init();
  }

  // --- File Upload Triggers ---
  const triggerFilePicker = () => mapFileInput.click();
  btnUploadMap.addEventListener("click", triggerFilePicker);
  btnEmptyUpload.addEventListener("click", triggerFilePicker);

  mapFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      mapModule.loadFiles(e.target.files);
      mapFileInput.value = "";
    }
  });

  btnEmptySample.addEventListener("click", () => {
    mapModule.loadDemoDungeon();
  });

  // --- Drag & Drop Support across Viewport ---
  let dragDepth = 0;

  window.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragDepth++;
    dropOverlay.classList.remove("hidden");
  });

  window.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  window.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      dropOverlay.classList.add("hidden");
    }
  });

  window.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    dropOverlay.classList.add("hidden");

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      mapModule.loadFiles(e.dataTransfer.files);
    }
  });

  // --- URL Modal ---
  const openUrlModal = () => {
    mapUrlInput.value = "";
    mapUrlName.value = "";
    mapUrlType.value = "auto";
    urlModal.classList.remove("hidden");
    mapUrlInput.focus();
  };

  const closeUrlModal = () => {
    urlModal.classList.add("hidden");
  };

  btnUrlMap.addEventListener("click", openUrlModal);
  btnUrlCancel.addEventListener("click", closeUrlModal);
  urlModal.addEventListener("click", (e) => {
    if (e.target === urlModal) closeUrlModal();
  });

  btnUrlConfirm.addEventListener("click", () => {
    const url = mapUrlInput.value.trim();
    if (!url) return;
    mapModule.loadUrl(url, mapUrlName.value, mapUrlType.value);
    closeUrlModal();
  });

  mapUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnUrlConfirm.click();
    if (e.key === "Escape") closeUrlModal();
  });

  // --- Zoom & Viewport Controls ---
  btnZoomIn.addEventListener("click", () => mapModule.zoomAt(1.2));
  btnZoomOut.addEventListener("click", () => mapModule.zoomAt(1 / 1.2));
  zoomReadout.addEventListener("click", () => mapModule.setZoom(1));
  btnFitMap.addEventListener("click", () => mapModule.fitMapToViewport());

  btnToggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });

  // --- Video Controls ---
  btnVideoPlay.addEventListener("click", () => {
    const media = mapModule.activeMediaElement;
    if (!media || media.tagName !== "VIDEO") return;
    if (media.paused) {
      media.play();
      btnVideoPlay.textContent = "⏸️";
    } else {
      media.pause();
      btnVideoPlay.textContent = "▶️";
    }
  });

  btnVideoMute.addEventListener("click", () => {
    const media = mapModule.activeMediaElement;
    if (!media || media.tagName !== "VIDEO") return;
    media.muted = !media.muted;
    btnVideoMute.textContent = media.muted ? "🔇" : "🔊";
  });

  videoSpeedSelect.addEventListener("change", () => {
    const media = mapModule.activeMediaElement;
    if (!media || media.tagName !== "VIDEO") return;
    media.playbackRate = parseFloat(videoSpeedSelect.value) || 1;
  });

  // --- Grid Controls ---
  const syncGridFromUI = () => {
    const size = Math.min(300, Math.max(16, Number(gridSizeNum.value) || 64));
    const opacity = Number(gridOpacitySlider.value) / 100;
    gridOpacityVal.textContent = `${Math.round(opacity * 100)}%`;

    mapModule.updateActiveMapSettings({
      grid: {
        enabled: gridEnabledInput.checked,
        type: gridTypeSelect.value,
        size,
        offsetX: Number(gridOffsetX.value) || 0,
        offsetY: Number(gridOffsetY.value) || 0,
        color: gridColorInput.value,
        opacity,
      },
    });

    if (window.tokenModule) {
      window.tokenModule.syncTokenPositions();
    }
  };

  gridEnabledInput.addEventListener("change", syncGridFromUI);
  gridTypeSelect.addEventListener("change", syncGridFromUI);

  gridSizeSlider.addEventListener("input", () => {
    gridSizeNum.value = gridSizeSlider.value;
    syncGridFromUI();
  });

  gridSizeNum.addEventListener("input", () => {
    gridSizeSlider.value = gridSizeNum.value;
    syncGridFromUI();
  });

  gridOffsetX.addEventListener("input", syncGridFromUI);
  gridOffsetY.addEventListener("input", syncGridFromUI);
  gridColorInput.addEventListener("input", syncGridFromUI);
  gridOpacitySlider.addEventListener("input", syncGridFromUI);

  // --- Map Scale Controls ---
  const applyMapScale = (pct) => {
    const clamped = Math.min(500, Math.max(10, Number(pct) || 100));
    mapScaleSlider.value = clamped;
    mapScaleNum.value = clamped;
    mapModule.updateActiveMapSettings({ scale: clamped / 100 });

    const active = mapModule.getActiveMap();
    if (active) {
      const scaledW = Math.round(active.naturalWidth * active.scale);
      const scaledH = Math.round(active.naturalHeight * active.scale);
      mapInfoText.textContent = `${active.name} (${scaledW}×${scaledH}px • ${active.mediaType.toUpperCase()})`;
    }
  };

  mapScaleSlider.addEventListener("input", () => applyMapScale(mapScaleSlider.value));
  mapScaleNum.addEventListener("change", () => applyMapScale(mapScaleNum.value));

  btnResetMapAdjust.addEventListener("click", () => {
    gridOffsetX.value = 0;
    gridOffsetY.value = 0;
    gridSizeSlider.value = 64;
    gridSizeNum.value = 64;
    applyMapScale(100);
    syncGridFromUI();
    mapModule.fitMapToViewport();
  });

  // --- Visual Grid Alignment Wizard Listeners (D&D Beyond Style) ---
  btnOpenGridWizard.addEventListener("click", () => {
    if (!mapModule.getActiveMap()) {
      alert("Please upload or select a map first to align the grid.");
      return;
    }
    mapModule.startGridCalibration();
  });

  calDimButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const dim = Number(btn.dataset.dim) || 3;
      mapModule.setCalibratorDimension(dim);
    });
  });

  btnCalSizeDec.addEventListener("click", () => {
    const cur = Number(calCellSize.value) || 64;
    mapModule.setCalibratorCellSize(cur - 1);
  });

  btnCalSizeInc.addEventListener("click", () => {
    const cur = Number(calCellSize.value) || 64;
    mapModule.setCalibratorCellSize(cur + 1);
  });

  calCellSize.addEventListener("change", () => {
    mapModule.setCalibratorCellSize(Number(calCellSize.value) || 64);
  });

  btnNudgeLeft.addEventListener("click", (e) => mapModule.nudgeCalibrator(e.shiftKey ? -5 : -1, 0));
  btnNudgeRight.addEventListener("click", (e) => mapModule.nudgeCalibrator(e.shiftKey ? 5 : 1, 0));
  btnNudgeUp.addEventListener("click", (e) => mapModule.nudgeCalibrator(0, e.shiftKey ? -5 : -1));
  btnNudgeDown.addEventListener("click", (e) => mapModule.nudgeCalibrator(0, e.shiftKey ? 5 : 1));

  calGridColor.addEventListener("input", () => {
    mapModule.setCalibratorColor(calGridColor.value);
  });

  calGridOpacity.addEventListener("input", () => {
    mapModule.setCalibratorOpacity(Number(calGridOpacity.value) / 100);
  });

  if (calGridType) {
    calGridType.addEventListener("change", () => {
      mapModule.setCalibratorGridType(calGridType.value);
    });
  }

  btnCalSave.addEventListener("click", () => {
    mapModule.stopGridCalibration(true);
    if (window.tokenModule) window.tokenModule.syncTokenPositions();
  });

  btnCalNoGrid.addEventListener("click", () => {
    mapModule.disableCalibratorGrid();
  });

  btnCalCancel.addEventListener("click", () => {
    mapModule.stopGridCalibration(false);
  });

  // --- Tool Switcher & Movement Ruler Listeners ---
  if (toolPan) {
    toolPan.addEventListener("click", () => mapModule.setTool("pan"));
  }
  if (toolMeasure) {
    toolMeasure.addEventListener("click", () => mapModule.setTool("measure"));
  }

  if (measureRuleSelect) {
    measureRuleSelect.addEventListener("change", () => {
      mapModule.setMeasureRule(measureRuleSelect.value);
    });
  }

  const syncSpeeds = () => {
    const base = Number(speedBaseInput?.value) || 30;
    const dash = Number(speedDashInput?.value) || 60;
    mapModule.setMovementSpeeds(base, dash);
  };

  if (speedBaseInput) speedBaseInput.addEventListener("input", syncSpeeds);
  if (speedDashInput) speedDashInput.addEventListener("input", syncSpeeds);

  if (btnClearRuler) {
    btnClearRuler.addEventListener("click", () => {
      mapModule.clearMeasurement();
    });
  }

  // --- Collapsible Sidebar Accordion Tabs ---
  const collapsibleTriggers = document.querySelectorAll(".collapsible-trigger");
  collapsibleTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const section = trigger.closest(".panel-section");
      if (section) {
        section.classList.toggle("collapsed");
      }
    });
  });

  // --- DM View vs Player View Role Switcher ---
  function setGameRole(role) {
    const isPlayer = role === "player";

    if (vttApp) {
      vttApp.classList.toggle("role-player", isPlayer);
      vttApp.classList.toggle("role-dm", !isPlayer);
    }

    if (btnRoleDm && btnRolePlayer) {
      btnRoleDm.classList.toggle("active", !isPlayer);
      btnRolePlayer.classList.toggle("active", isPlayer);
    }

    if (window.tokenModule) {
      window.tokenModule.setRole(isPlayer ? "player" : "dm");
    }

    // In player view, close grid calibrator if open
    if (isPlayer && mapModule && mapModule.isCalibrating) {
      mapModule.stopGridCalibration(false);
    }

    // Update status bar text
    if (coordsText) {
      const roleText = isPlayer ? "👤 Player View (Enemy HP & DM Tools Locked)" : "👑 DM View (Full Controls)";
      coordsText.setAttribute("data-role-label", roleText);
    }
  }

  if (btnRoleDm) {
    btnRoleDm.addEventListener("click", () => setGameRole("dm"));
  }
  if (btnRolePlayer) {
    btnRolePlayer.addEventListener("click", () => setGameRole("player"));
  }

  // Default to DM View
  setGameRole("dm");
});

