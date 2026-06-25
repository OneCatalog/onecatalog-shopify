// OneCatalog Picker (§2.4 v1.2) для embedded-приложения. Клиентский модуль (Vite .client).
// parentOrigin = window.location.origin; доверие по event.source; разбор JSON-строки;
// своя кнопка × + Esc. Импорт по productPublicIds.
export function openPicker(cfg, onSelected) {
  const base = String(cfg.pickerBase || "").replace(/\/+$/, "");
  if (!base) return;
  const url = base + "/picker.html?token=" + encodeURIComponent(cfg.token || "") +
    "&parentOrigin=" + encodeURIComponent(window.location.origin);

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100000;";
  const frame = document.createElement("iframe");
  frame.src = url;
  frame.setAttribute("sandbox", "allow-scripts allow-forms allow-same-origin allow-popups");
  frame.style.cssText = "position:absolute;top:4%;left:4%;width:92%;height:92%;border:0;background:#fff;border-radius:6px;box-shadow:0 4px 24px rgba(0,0,0,.3);";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = "×";
  closeBtn.style.cssText = "position:absolute;top:calc(4% - 14px);right:calc(4% - 14px);width:30px;height:30px;border:0;border-radius:50%;background:#fff;color:#333;font:20px/30px sans-serif;cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.4);z-index:1;";
  overlay.appendChild(frame);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);

  function cleanup() {
    window.removeEventListener("message", handler);
    document.removeEventListener("keydown", onKey);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
  function parseData(d) {
    if (typeof d === "string") { try { return JSON.parse(d); } catch (e) { return {}; } }
    return d || {};
  }
  function handler(e) {
    if (e.source !== frame.contentWindow && e.origin !== base) return;
    const data = parseData(e.data);
    const type = data.type || data.event;
    if (type === "ONECATALOG_SELECTED") {
      const ids = data.productPublicIds || data.publicIds || [];
      cleanup();
      if (typeof onSelected === "function") onSelected(ids);
    } else if (type === "ONECATALOG_CLOSE") {
      cleanup();
    }
  }
  function onKey(e) { if (e.key === "Escape" || e.keyCode === 27) cleanup(); }

  window.addEventListener("message", handler);
  document.addEventListener("keydown", onKey);
  closeBtn.addEventListener("click", cleanup);
  overlay.addEventListener("click", function (ev) { if (ev.target === overlay) cleanup(); });
}
