(function () {
  const platformMetaEl = document.getElementById("platform-meta");
  const platformTikTokEl = document.getElementById("platform-tiktok");
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const fileNameEl = document.getElementById("file-name");
  const clientListEl = document.getElementById("client-list");
  const briefEl = document.getElementById("brief");
  const launchBtn = document.getElementById("launch-btn");
  const statusLog = document.getElementById("status-log");

  let selectedFile = null;
  let allClients = [];

  function log(message, isError) {
    const line = document.createElement("div");
    line.className = "line" + (isError ? " error" : "");
    line.textContent = message;
    statusLog.appendChild(line);
    statusLog.scrollTop = statusLog.scrollHeight;
  }

  function setClientsLoading(loading) {
    if (loading) {
      clientListEl.innerHTML = "<p class=\"loading\">Loading clients…</p>";
      return;
    }
  }

  function getSelectedPlatforms() {
    const platforms = [];
    if (platformMetaEl && platformMetaEl.checked) platforms.push("meta");
    if (platformTikTokEl && platformTikTokEl.checked) platforms.push("tiktok");
    return platforms;
  }

  function isClientReadyForPlatforms(client, platforms) {
    if (!platforms.length) return false;
    return platforms.every(function (platform) {
      return platform === "meta" ? !!client.metaReady : !!client.tiktokReady;
    });
  }

  function getClientNote(client, platforms) {
    const readyNotes = [];
    if (client.metaReady) readyNotes.push("Meta ready");
    if (client.tiktokReady) readyNotes.push("TikTok ready");

    if (isClientReadyForPlatforms(client, platforms)) {
      return readyNotes.join(" • ");
    }

    const missing = [];
    if (platforms.indexOf("meta") !== -1 && !client.metaReady) {
      missing.push(client.metaIssue || "Meta setup incomplete");
    }
    if (platforms.indexOf("tiktok") !== -1 && !client.tiktokReady) {
      missing.push(client.tiktokIssue || "TikTok setup incomplete");
    }
    return missing.join(" • ") || readyNotes.join(" • ");
  }

  function renderClients(clients) {
    clientListEl.innerHTML = "";
    const platforms = getSelectedPlatforms();

    if (!platforms.length) {
      clientListEl.innerHTML = "<p class=\"loading\">Select at least one platform.</p>";
      return;
    }
    if (!clients.length) {
      clientListEl.innerHTML = "<p class=\"loading\">No clients in config.</p>";
      return;
    }

    const readyCount = clients.filter(function (client) {
      return isClientReadyForPlatforms(client, platforms);
    }).length;
    if (!readyCount) {
      clientListEl.innerHTML = "<p class=\"loading\">No clients are ready for the selected platform(s).</p>";
      return;
    }

    clients.forEach(function (c) {
      const label = document.createElement("label");
      label.className = "client-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "client";
      checkbox.value = c.id;
      checkbox.disabled = !isClientReadyForPlatforms(c, platforms);

      const textWrap = document.createElement("span");
      textWrap.className = "client-text";

      const name = document.createElement("span");
      name.className = "client-name";
      name.textContent = c.clientName;

      const note = document.createElement("span");
      note.className = "client-note";
      note.textContent = getClientNote(c, platforms);

      textWrap.appendChild(name);
      textWrap.appendChild(note);
      label.appendChild(checkbox);
      label.appendChild(textWrap);
      clientListEl.appendChild(label);
    });
  }

  function updateLaunchButton() {
    const hasFile = !!selectedFile;
    const hasPlatform = getSelectedPlatforms().length > 0;
    const hasClient = clientListEl.querySelector('input[name="client"]:checked:not(:disabled)');
    launchBtn.disabled = !hasFile || !hasPlatform || !hasClient;
  }

  function loadClients() {
    setClientsLoading(true);
    fetch("/api/clients")
      .then(function (res) {
        return res.text().then(function (text) {
          if (!res.ok) throw new Error(text || res.statusText);
          try {
            return JSON.parse(text);
          } catch (_) {
            throw new Error("Invalid response from server");
          }
        });
      })
      .then(function (data) {
        allClients = data.clients || [];
        renderClients(allClients);
        updateLaunchButton();
      })
      .catch(function (err) {
        clientListEl.innerHTML = "<p class=\"loading\" style=\"color:#c00;\">Failed to load clients.</p>";
        log("Barth: Failed to load clients — " + err.message, true);
      });
  }

  dropZone.addEventListener("click", function () {
    fileInput.click();
  });

  dropZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", function () {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      selectedFile = file;
      fileNameEl.textContent = file.name;
      updateLaunchButton();
    }
  });

  fileInput.addEventListener("change", function () {
    const file = fileInput.files[0];
    if (file) {
      selectedFile = file;
      fileNameEl.textContent = file.name;
    } else {
      selectedFile = null;
      fileNameEl.textContent = "";
    }
    updateLaunchButton();
  });

  clientListEl.addEventListener("change", updateLaunchButton);
  if (platformMetaEl) {
    platformMetaEl.addEventListener("change", function () {
      renderClients(allClients);
      updateLaunchButton();
    });
  }
  if (platformTikTokEl) {
    platformTikTokEl.addEventListener("change", function () {
      renderClients(allClients);
      updateLaunchButton();
    });
  }

  launchBtn.addEventListener("click", function () {
    if (!selectedFile) return;
    const selectedPlatforms = getSelectedPlatforms();
    if (!selectedPlatforms.length) return;
    const checked = clientListEl.querySelectorAll('input[name="client"]:checked:not(:disabled)');
    if (!checked.length) return;

    const clientIds = Array.from(checked).map(function (c) { return c.value; });
    const brief = (briefEl && briefEl.value) ? briefEl.value.trim() : "";

    const form = new FormData();
    form.append("video", selectedFile);
    form.append("clientIds", JSON.stringify(clientIds));
    form.append("platforms", JSON.stringify(selectedPlatforms));
    if (brief) form.append("brief", brief);

    launchBtn.disabled = true;
    log("Barth: Starting " + selectedPlatforms.join(" + ") + " launch…");

    fetch("/api/launch", {
      method: "POST",
      body: form
    })
      .then(function (res) {
        return res.text().then(function (text) {
          if (!res.ok) {
            var msg = res.status === 413
              ? "Video too large for server (try a smaller file or run Barth locally)."
              : (res.statusText || "Request failed");
            try {
              var d = JSON.parse(text);
              if (d && typeof d.error === "string") msg = d.error;
            } catch (_) {
              if (text && text.length < 200) msg = text.trim() || msg;
            }
            throw new Error(msg);
          }
          try {
            return JSON.parse(text);
          } catch (_) {
            var snippet = text.length > 120 ? text.slice(0, 120) + "…" : text;
            throw new Error("Server returned non-JSON (request may be too large or gateway error): " + snippet);
          }
        });
      })
      .then(function (data) {
        var runId = data.runId;
        if (!runId) { throw new Error("No runId"); }
        var url = "/api/launch/stream?runId=" + encodeURIComponent(runId);
        var es = new EventSource(url);
        es.onmessage = function (e) {
          if (e.data === "[DONE]") {
            es.close();
            launchBtn.disabled = false;
            return;
          }
          var payload;
          try { payload = JSON.parse(e.data); } catch (_) { return; }
          if (payload.message) log(payload.message);
          if (payload.error) log(payload.error, true);
        };
        es.onerror = function () {
          es.close();
          launchBtn.disabled = false;
        };
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : String(err);
        if (/Unexpected token|is not valid JSON/i.test(msg)) {
          msg = "Server returned a non-JSON response (request may be too large or a gateway error).";
        }
        log("Barth: Launch failed — " + msg, true);
        launchBtn.disabled = false;
      });
  });

  loadClients();
})();
