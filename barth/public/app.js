(function () {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const fileNameEl = document.getElementById("file-name");
  const clientListEl = document.getElementById("client-list");
  const briefEl = document.getElementById("brief");
  const launchBtn = document.getElementById("launch-btn");
  const statusLog = document.getElementById("status-log");

  let selectedFile = null;

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

  function renderClients(clients) {
    clientListEl.innerHTML = "";
    if (!clients.length) {
      clientListEl.innerHTML = "<p class=\"loading\">No Meta clients in config.</p>";
      return;
    }
    clients.forEach(function (c) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "client";
      checkbox.value = c.id;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(c.clientName));
      clientListEl.appendChild(label);
    });
  }

  function updateLaunchButton() {
    const hasFile = !!selectedFile;
    const hasClient = clientListEl.querySelector('input[name="client"]:checked');
    launchBtn.disabled = !hasFile || !hasClient;
  }

  function loadClients() {
    setClientsLoading(true);
    fetch("/api/clients")
      .then(function (res) {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(function (data) {
        renderClients(data.clients || []);
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

  launchBtn.addEventListener("click", function () {
    if (!selectedFile) return;
    const checked = clientListEl.querySelectorAll('input[name="client"]:checked');
    if (!checked.length) return;

    const clientIds = Array.from(checked).map(function (c) { return c.value; });
    const brief = (briefEl && briefEl.value) ? briefEl.value.trim() : "";

    const form = new FormData();
    form.append("video", selectedFile);
    form.append("clientIds", JSON.stringify(clientIds));
    if (brief) form.append("brief", brief);

    launchBtn.disabled = true;
    log("Barth: Starting launch…");

    fetch("/api/launch", {
      method: "POST",
      body: form
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.error || res.statusText); });
        return res.json();
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
        log("Barth: Launch failed — " + err.message, true);
        launchBtn.disabled = false;
      });
  });

  loadClients();
})();
