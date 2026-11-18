(function () {
  if (window.__SILVANIA_WIDGET_LOADED__) return;
  window.__SILVANIA_WIDGET_LOADED__ = true;

  var currentScript = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  var scriptSrc = (currentScript && currentScript.src) || "";
  var baseUrl = "";
  try {
    if (scriptSrc) {
      var u = new URL(scriptSrc);
      baseUrl = u.origin;
    }
  } catch (e) {
    baseUrl = "";
  }
  if (!baseUrl) baseUrl = window.location.origin;

  var agentId = (currentScript && currentScript.getAttribute("data-agent-id")) || "silvania";
  var defaultVoice = (currentScript && currentScript.getAttribute("data-voice")) || "Lucia";
  var widgetTitle = (currentScript && currentScript.getAttribute("data-title")) || "Habla con Silvania";

  var state = {
    isOpen: false,
    voiceEnabled: true,
    isListening: false,
    isLoading: false,
    history: [],
    audioEl: new Audio(),
    selectedSlot: null,
  };

  // Inject Scoped Styles
  var style = document.createElement("style");
  style.id = "silvania-widget-styles";
  style.textContent = [
    "#silvania-widget-root { position: fixed; bottom: 24px; right: 24px; z-index: 2147483000; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f3f4f6; }",
    "#silvania-launcher { display: flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #06b6d4 0%, #2563eb 100%); color: #fff; border: 1px solid rgba(255,255,255,0.22); border-radius: 999px; padding: 12px 20px; font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 10px 28px rgba(6, 182, 212, 0.35), 0 4px 12px rgba(0,0,0,0.3); transition: transform 0.2s ease, box-shadow 0.2s ease; }",
    "#silvania-launcher:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 14px 34px rgba(6, 182, 212, 0.48); }",
    "#silvania-launcher .sv-pulse { width: 10px; height: 10px; border-radius: 50%; background: #34d399; box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); animation: sv-pulse-anim 2s infinite; }",
    "@keyframes sv-pulse-anim { 0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); } 70% { box-shadow: 0 0 0 8px rgba(52, 211, 153, 0); } 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); } }",
    "#silvania-panel { display: none; flex-direction: column; width: 380px; max-width: calc(100vw - 32px); height: 540px; max-height: calc(100vh - 48px); background: rgba(13, 18, 30, 0.96); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.14); border-radius: 20px; box-shadow: 0 24px 60px rgba(0,0,0,0.6); overflow: hidden; }",
    "#silvania-panel.sv-open { display: flex; animation: sv-slide-up 0.22s ease-out; }",
    "@keyframes sv-slide-up { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }",
    ".sv-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: linear-gradient(135deg, rgba(6,182,212,0.18), rgba(37,99,235,0.18)); border-bottom: 1px solid rgba(255,255,255,0.1); }",
    ".sv-header-info { display: flex; align-items: center; gap: 10px; }",
    ".sv-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #06b6d4, #3b82f6); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #fff; box-shadow: 0 0 12px rgba(6,182,212,0.45); }",
    ".sv-title { font-size: 15px; font-weight: 700; color: #ffffff; margin: 0; line-height: 1.2; }",
    ".sv-subtitle { font-size: 11px; color: #93c5fd; margin: 2px 0 0 0; }",
    ".sv-header-actions { display: flex; align-items: center; gap: 6px; }",
    ".sv-icon-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #e5e7eb; border-radius: 8px; padding: 6px 8px; font-size: 13px; cursor: pointer; transition: background 0.15s; }",
    ".sv-icon-btn:hover { background: rgba(255,255,255,0.18); }",
    ".sv-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth; }",
    ".sv-messages::-webkit-scrollbar { width: 6px; }",
    ".sv-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 3px; }",
    ".sv-msg { max-width: 86%; padding: 10px 13px; border-radius: 14px; font-size: 13.5px; line-height: 1.45; word-wrap: break-word; position: relative; }",
    ".sv-msg-bot { align-self: flex-start; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #f3f4f6; border-bottom-left-radius: 4px; }",
    ".sv-msg-user { align-self: flex-end; background: linear-gradient(135deg, #06b6d4 0%, #2563eb 100%); color: #ffffff; border-bottom-right-radius: 4px; }",
    ".sv-play-mini { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; background: rgba(6,182,212,0.18); border: 1px solid rgba(6,182,212,0.35); color: #67e8f9; border-radius: 999px; padding: 3px 9px; font-size: 11px; cursor: pointer; }",
    ".sv-play-mini:hover { background: rgba(6,182,212,0.32); }",
    ".sv-slots-box { align-self: flex-start; width: 92%; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }",
    ".sv-slots-title { font-size: 12px; font-weight: 600; color: #6ee7b7; margin: 0; }",
    ".sv-slot-btn { background: rgba(255,255,255,0.07); border: 1px solid rgba(16,185,129,0.45); color: #ecfdf5; border-radius: 10px; padding: 8px 10px; font-size: 12.5px; font-weight: 600; text-align: left; cursor: pointer; transition: all 0.15s; }",
    ".sv-slot-btn:hover { background: rgba(16,185,129,0.25); transform: translateX(2px); }",
    ".sv-book-form { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }",
    ".sv-book-input { width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 8px 10px; color: #fff; font-size: 12.5px; outline: none; }",
    ".sv-book-input:focus { border-color: #34d399; }",
    ".sv-book-submit { background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; border-radius: 8px; padding: 9px; font-size: 13px; font-weight: 700; cursor: pointer; }",
    ".sv-book-submit:hover { opacity: 0.92; }",
    ".sv-typing { font-size: 12px; color: #9ca3af; font-style: italic; align-self: flex-start; padding: 4px 8px; }",
    ".sv-input-bar { display: flex; align-items: center; gap: 8px; padding: 12px; background: rgba(255,255,255,0.03); border-top: 1px solid rgba(255,255,255,0.1); }",
    "#sv-input { flex: 1; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.14); border-radius: 12px; padding: 10px 12px; color: #fff; font-size: 13.5px; outline: none; }",
    "#sv-input::placeholder { color: #9ca3af; }",
    "#sv-input:focus { border-color: #06b6d4; }",
    ".sv-mic-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #e5e7eb; border-radius: 12px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: all 0.2s; }",
    ".sv-mic-btn.sv-recording { background: #ef4444; border-color: #f87171; color: #fff; animation: sv-pulse-anim 1.2s infinite; }",
    ".sv-send-btn { background: linear-gradient(135deg, #06b6d4, #2563eb); border: none; color: #fff; border-radius: 12px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; font-weight: 700; }",
    ".sv-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }",
    ".sv-powered { text-align: center; font-size: 10px; color: #6b7280; padding: 4px 0 6px 0; background: rgba(13,18,30,0.98); }",
    ".sv-powered a { color: #38bdf8; text-decoration: none; }",
  ].join("\n");
  document.head.appendChild(style);

  // Build Root DOM
  var root = document.createElement("div");
  root.id = "silvania-widget-root";
  root.innerHTML = [
    '<button id="silvania-launcher" aria-label="Abrir chat con Silvania">',
    '  <span class="sv-pulse"></span>',
    '  <span>🎙️ ' + escapeHtml(widgetTitle) + '</span>',
    '</button>',
    '<div id="silvania-panel" role="dialog" aria-label="' + escapeHtml(widgetTitle) + '">',
    '  <div class="sv-header">',
    '    <div class="sv-header-info">',
    '      <div class="sv-avatar">S</div>',
    '      <div>',
    '        <div class="sv-title">Silvania AI</div>',
    '        <div class="sv-subtitle">👩 Voz: Lucía · En línea</div>',
    '      </div>',
    '    </div>',
    '    <div class="sv-header-actions">',
    '      <button id="sv-voice-toggle" class="sv-icon-btn" title="Activar o silenciar voz">🔊</button>',
    '      <button id="sv-close-btn" class="sv-icon-btn" title="Cerrar">✕</button>',
    '    </div>',
    '  </div>',
    '  <div id="sv-messages" class="sv-messages"></div>',
    '  <div class="sv-input-bar">',
    '    <input id="sv-input" type="text" placeholder="Escribe o habla con Silvania..." autocomplete="off" />',
    '    <button id="sv-mic-btn" class="sv-mic-btn" title="Hablar por micrófono">🎙️</button>',
    '    <button id="sv-send-btn" class="sv-send-btn" title="Enviar">➤</button>',
    '  </div>',
    '  <div class="sv-powered">Impulsado por <a href="https://silvania.ai" target="_blank" rel="noopener">Silvania AI</a></div>',
    '</div>',
  ].join("");
  document.body.appendChild(root);

  var launcher = document.getElementById("silvania-launcher");
  var panel = document.getElementById("silvania-panel");
  var closeBtn = document.getElementById("sv-close-btn");
  var voiceToggleBtn = document.getElementById("sv-voice-toggle");
  var messagesEl = document.getElementById("sv-messages");
  var inputEl = document.getElementById("sv-input");
  var micBtn = document.getElementById("sv-mic-btn");
  var sendBtn = document.getElementById("sv-send-btn");

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function playAudioUrls(urls) {
    if (!state.voiceEnabled) return;
    var list = Array.isArray(urls) ? urls.filter(Boolean) : (urls ? [urls] : []);
    if (!list.length) return;
    var idx = 0;

    function playNext() {
      if (idx >= list.length || !state.voiceEnabled) return;
      var url = list[idx++];
      var fullUrl = url.indexOf("http") === 0 ? url : baseUrl + url;
      state.audioEl.onended = playNext;
      state.audioEl.src = fullUrl;
      state.audioEl.play().catch(function () {});
    }

    try {
      state.audioEl.pause();
      state.audioEl.onended = null;
      playNext();
    } catch (e) {}
  }

  function formatBubbleText(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function addMessageBubble(role, text, audioUrls) {
    var list = Array.isArray(audioUrls) ? audioUrls.filter(Boolean) : (audioUrls ? [audioUrls] : []);
    var div = document.createElement("div");
    div.className = "sv-msg " + (role === "user" ? "sv-msg-user" : "sv-msg-bot");
    div.innerHTML = "<div>" + formatBubbleText(text) + "</div>";

    if (role === "assistant" && list.length > 0) {
      var playBtn = document.createElement("button");
      playBtn.className = "sv-play-mini";
      playBtn.innerHTML = "▶ Escuchar a Lucía";
      playBtn.onclick = function () {
        state.voiceEnabled = true;
        voiceToggleBtn.textContent = "🔊";
        playAudioUrls(list);
      };
      div.appendChild(playBtn);
    }

    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderBookingSlots(slots, autoOpenSlot) {
    if (!slots || !slots.length) return;
    var existing = document.getElementById("sv-active-slots");
    if (existing) existing.remove();

    var box = document.createElement("div");
    box.id = "sv-active-slots";
    box.className = "sv-slots-box";

    if (autoOpenSlot) {
      messagesEl.appendChild(box);
      showBookingForm(box, autoOpenSlot);
      return;
    }

    var title = document.createElement("p");
    title.className = "sv-slots-title";
    title.textContent = "📅 Huecos disponibles en Google Calendar (clic para agendar):";
    box.appendChild(title);

    slots.forEach(function (slot) {
      var btn = document.createElement("button");
      btn.className = "sv-slot-btn";
      btn.textContent = "🕒 " + slot.label;
      btn.onclick = function () {
        showBookingForm(box, slot);
      };
      box.appendChild(btn);
    });

    messagesEl.appendChild(box);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showBookingForm(container, slot) {
    container.innerHTML = "";
    var title = document.createElement("p");
    title.className = "sv-slots-title";
    title.textContent = "✅ Confirmar cita: " + slot.label;
    container.appendChild(title);

    var form = document.createElement("div");
    form.className = "sv-book-form";

    var nameInput = document.createElement("input");
    nameInput.className = "sv-book-input";
    nameInput.placeholder = "Tu nombre completo";
    nameInput.required = true;

    var emailInput = document.createElement("input");
    emailInput.className = "sv-book-input";
    emailInput.type = "email";
    emailInput.placeholder = "Tu email (para enviar Google Meet)";
    emailInput.required = true;

    var submitBtn = document.createElement("button");
    submitBtn.className = "sv-book-submit";
    submitBtn.textContent = "📅 Confirmar y Agendar Ahora";

    submitBtn.onclick = function () {
      var name = nameInput.value.trim();
      var email = emailInput.value.trim();
      if (!name || !email || email.indexOf("@") === -1) {
        alert("Por favor, introduce tu nombre y un email válido.");
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "Agendando en Calendar...";

      fetch(baseUrl + "/api/widget/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          email: email,
          slotStart: slot.start,
          slotLabel: slot.label,
          agentId: agentId,
          voice: defaultVoice,
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          container.remove();
          if (data && data.success) {
            var bookUrls = data.audioUrls || (data.audioUrl ? [data.audioUrl] : []);
            addMessageBubble("assistant", data.replyText, bookUrls);
            playAudioUrls(bookUrls);
          } else {
            addMessageBubble("assistant", "Hubo un problema al confirmar la cita. Inténtalo de nuevo o escribe tu email en el chat.");
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = "📅 Confirmar y Agendar Ahora";
        });
    };

    form.appendChild(nameInput);
    form.appendChild(emailInput);
    form.appendChild(submitBtn);
    container.appendChild(form);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    setTimeout(function () { nameInput.focus(); }, 100);
  }

  function showTyping() {
    var t = document.createElement("div");
    t.id = "sv-typing-indicator";
    t.className = "sv-typing";
    t.textContent = "Silvania está escribiendo y preparando audio...";
    messagesEl.appendChild(t);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    var t = document.getElementById("sv-typing-indicator");
    if (t) t.remove();
  }

  function sendMessage(text) {
    var trimmed = String(text || "").trim();
    if (!trimmed || state.isLoading) return;

    inputEl.value = "";
    addMessageBubble("user", trimmed);
    state.history.push({ role: "user", content: trimmed });

    state.isLoading = true;
    sendBtn.disabled = true;
    showTyping();

    fetch(baseUrl + "/api/widget/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: trimmed,
        history: state.history.slice(-8),
        agentId: agentId,
        voice: defaultVoice,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        hideTyping();
        state.isLoading = false;
        sendBtn.disabled = false;

        if (data && data.replyText) {
          var chatUrls = data.audioUrls || (data.audioUrl ? [data.audioUrl] : []);
          state.history.push({ role: "assistant", content: data.replyText });
          addMessageBubble("assistant", data.replyText, chatUrls);
          playAudioUrls(chatUrls);
          if (data.showBookingSlots && data.slots && data.slots.length) {
            renderBookingSlots(data.slots, data.autoOpenSlot);
          }
        } else {
          addMessageBubble("assistant", "Disculpa, tuve un microcorte de conexión. ¿Puedes repetirlo?");
        }
      })
      .catch(function () {
        hideTyping();
        state.isLoading = false;
        sendBtn.disabled = false;
        addMessageBubble("assistant", "No pude conectar con el servidor en este momento. Inténtalo de nuevo.");
      });
  }

  // Welcome message on first open
  var welcomed = false;
  function openWidget() {
    state.isOpen = true;
    panel.classList.add("sv-open");
    launcher.style.display = "none";
    if (!welcomed) {
      welcomed = true;
      addMessageBubble(
        "assistant",
        "¡Hola! Soy Silvania. ¿Con quién tengo el gusto?"
      );
    }
    setTimeout(function () { inputEl.focus(); }, 150);
  }

  function closeWidget() {
    state.isOpen = false;
    panel.classList.remove("sv-open");
    launcher.style.display = "flex";
    state.audioEl.pause();
  }

  launcher.onclick = openWidget;
  closeBtn.onclick = closeWidget;

  voiceToggleBtn.onclick = function () {
    state.voiceEnabled = !state.voiceEnabled;
    voiceToggleBtn.textContent = state.voiceEnabled ? "🔊" : "🔇";
    if (!state.voiceEnabled) state.audioEl.pause();
  };

  sendBtn.onclick = function () { sendMessage(inputEl.value); };
  inputEl.onkeydown = function (e) {
    if (e.key === "Enter") sendMessage(inputEl.value);
  };

  // Speech Recognition (Browser Mic)
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    var recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = function (event) {
      var transcript = event.results[0][0].transcript;
      if (transcript) sendMessage(transcript);
    };
    recognition.onend = function () {
      state.isListening = false;
      micBtn.classList.remove("sv-recording");
    };
    recognition.onerror = function () {
      state.isListening = false;
      micBtn.classList.remove("sv-recording");
    };

    micBtn.onclick = function () {
      if (state.isListening) {
        recognition.stop();
      } else {
        state.audioEl.pause();
        state.audioEl.onended = null;
        state.isListening = true;
        micBtn.classList.add("sv-recording");
        recognition.start();
      }
    };
  } else {
    micBtn.style.display = "none";
  }
})();

