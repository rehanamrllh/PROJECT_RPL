const STORAGE_KEY = "qr-cafe-order-state-v1";
const CHANNEL_NAME = "qr-cafe-realtime-channel";
const TAX_RATE = 0.1;

const MENU = [
  {
    id: "m1",
    name: "Caramel Latte",
    category: "Kopi",
    price: 28000,
    description: "Espresso lembut dengan caramel manis dan susu creamy.",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "m2",
    name: "Cappuccino",
    category: "Kopi",
    price: 26000,
    description: "Perpaduan espresso, susu, dan foam yang seimbang.",
    image:
      "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "m3",
    name: "Chicken Rice Bowl",
    category: "Makanan",
    price: 39000,
    description: "Nasi hangat, ayam crispy, sayuran, dan saus spesial.",
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "m4",
    name: "Croissant Butter",
    category: "Snack",
    price: 18000,
    description: "Croissant renyah dengan aroma butter yang wangi.",
    image:
      "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "m5",
    name: "Matcha Frappe",
    category: "Minuman",
    price: 32000,
    description: "Minuman dingin matcha dengan tekstur lembut dan segar.",
    image:
      "https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "m6",
    name: "Cheese Toast",
    category: "Snack",
    price: 21000,
    description: "Toast hangat dengan lelehan keju dan tekstur renyah.",
    image:
      "https://images.unsplash.com/photo-1567234669003-dce7a7a88821?auto=format&fit=crop&w=900&q=80",
  },
];

const TABLES = [
  {
    id: "t1",
    tableNumber: "T01",
    qrToken: "T01-7F3A",
  },
  {
    id: "t2",
    tableNumber: "T02",
    qrToken: "T02-3K9D",
  },
  {
    id: "t3",
    tableNumber: "T03",
    qrToken: "T03-9Q1B",
  },
  {
    id: "t4",
    tableNumber: "T04",
    qrToken: "T04-4M8X",
  },
];

const ORDER_STEPS = ["pending", "preparing", "ready", "served"];

const elements = {
  activeTitle: document.getElementById("active-title"),
  orderCount: document.getElementById("stat-order-count"),
  readyCount: document.getElementById("stat-ready-count"),
  paidCount: document.getElementById("stat-paid-count"),
  tableTokenPreview: document.getElementById("table-token-preview"),
  qrPreview: document.getElementById("qr-preview"),
  tableResult: document.getElementById("table-result"),
  qrInput: document.getElementById("qr-input"),
  scanBtn: document.getElementById("scan-btn"),
  menuGrid: document.getElementById("menu-grid"),
  menuCount: document.getElementById("menu-count"),
  basketEmpty: document.getElementById("basket-empty"),
  basketList: document.getElementById("basket-list"),
  orderNote: document.getElementById("order-note"),
  submitOrder: document.getElementById("submit-order"),
  customerStatus: document.getElementById("customer-status"),
  subtotal: document.getElementById("subtotal"),
  tax: document.getElementById("tax"),
  total: document.getElementById("total"),
  kitchenQueue: document.getElementById("kitchen-queue"),
  cashierList: document.getElementById("cashier-list"),
  customerView: document.getElementById("customer-view"),
  kitchenView: document.getElementById("kitchen-view"),
  cashierView: document.getElementById("cashier-view"),
  modeButtons: Array.from(document.querySelectorAll(".mode-btn")),
};

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const realtimeChannel =
  "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;

const state = loadState();
const draft = {
  qrToken: "",
  items: new Map(),
};

function loadState() {
  const fallback = {
    menus: MENU,
    tables: TABLES,
    orders: [],
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return {
      menus: Array.isArray(parsed.menus) && parsed.menus.length ? parsed.menus : MENU,
      tables: Array.isArray(parsed.tables) && parsed.tables.length ? parsed.tables : TABLES,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    };
  } catch (error) {
    console.warn("Gagal memuat state, gunakan data awal.", error);
    return fallback;
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emitUpdate(type, payload = {}) {
  persistState();
  const event = { type, payload, timestamp: Date.now() };
  if (realtimeChannel) {
    realtimeChannel.postMessage(event);
  }
  window.dispatchEvent(new CustomEvent("qr-cafe:update", { detail: event }));
}

function formatMoney(value) {
  return currency.format(value || 0);
}

function normalizeToken(value) {
  return String(value || "").trim().toUpperCase();
}

function findTableByToken(token) {
  const normalized = normalizeToken(token);
  return state.tables.find((table) => table.qrToken === normalized) || null;
}

function findMenu(menuId) {
  return state.menus.find((menu) => menu.id === menuId) || null;
}

function currentTable() {
  return findTableByToken(draft.qrToken);
}

function quantityFor(menuId) {
  return draft.items.get(menuId) || 0;
}

function setQuantity(menuId, nextQuantity) {
  if (nextQuantity <= 0) {
    draft.items.delete(menuId);
  } else {
    draft.items.set(menuId, nextQuantity);
  }
  renderBasket();
}

function getOrderTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

function buildOrderCode() {
  const orderNumber = state.orders.length + 1;
  return `ORD-${String(orderNumber).padStart(3, "0")}`;
}

function createOrder({ qrToken, note, items }) {
  const table = findTableByToken(qrToken);
  if (!table) {
    throw new Error("Token QR tidak valid atau meja belum terdaftar.");
  }

  if (!items.length) {
    throw new Error("Pilih minimal satu menu sebelum mengirim pesanan.");
  }

  const pricedItems = items.map((item) => ({
    menuId: item.menuId,
    menuName: item.menuName,
    qty: item.qty,
    unitPrice: item.unitPrice,
    lineTotal: item.qty * item.unitPrice,
  }));

  const totals = getOrderTotals(pricedItems);
  const order = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    orderCode: buildOrderCode(),
    tableId: table.id,
    tableNumber: table.tableNumber,
    qrToken: table.qrToken,
    note: note || "",
    items: pricedItems,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    status: "pending",
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.orders.unshift(order);
  emitUpdate("order-created", { order });
  return order;
}

function updateOrderStatus(orderId, nextStatus) {
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order) {
    return;
  }

  order.status = nextStatus;
  order.updatedAt = new Date().toISOString();
  emitUpdate("order-status-updated", { orderId, nextStatus });
}

function updatePaymentStatus(orderId, nextStatus) {
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order) {
    return;
  }

  order.paymentStatus = nextStatus;
  order.updatedAt = new Date().toISOString();
  emitUpdate("payment-status-updated", { orderId, nextStatus });
}

function parseTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("qr") || params.get("table") || "";
}

function hydrateDraftToken(token) {
  const normalized = normalizeToken(token);
  draft.qrToken = normalized;
  elements.qrInput.value = normalized;

  const table = findTableByToken(normalized);
  const activeToken = normalized || state.tables[0]?.qrToken || "T01-7F3A";
  const menuUrl = `${window.location.origin}${window.location.pathname}?qr=${encodeURIComponent(activeToken)}`;

  if (elements.qrPreview) {
    const qrData = encodeURIComponent(menuUrl);
    elements.qrPreview.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${qrData}`;
    elements.qrPreview.alt = `QR code menuju ${menuUrl}`;
  }

  if (table) {
    elements.tableResult.textContent = `Terhubung ke meja ${table.tableNumber} (${table.qrToken}).`;
    elements.customerStatus.textContent = `Siap menerima pesanan untuk ${table.tableNumber}.`;
    elements.tableTokenPreview.textContent = menuUrl;
  } else {
    elements.tableResult.textContent = normalized
      ? "Token belum cocok dengan meja mana pun."
      : "Belum ada meja yang dipilih.";
    elements.customerStatus.textContent = "Status pesanan akan tampil setelah dikirim.";
    elements.tableTokenPreview.textContent = menuUrl;
  }
}

function renderMenuCards() {
  elements.menuGrid.innerHTML = "";
  elements.menuCount.textContent = `${state.menus.length} menu aktif`;

  const template = document.getElementById("menu-card-template");

  state.menus.forEach((menu) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".menu-card");
    const image = fragment.querySelector("img");
    const title = fragment.querySelector("h4");
    const category = fragment.querySelector("p");
    const price = fragment.querySelector("strong");
    const description = fragment.querySelector(".menu-desc");
    const qty = fragment.querySelector(".qty");
    const minus = fragment.querySelector(".minus");
    const plus = fragment.querySelector(".plus");

    image.src = menu.image;
    image.alt = menu.name;
    title.textContent = menu.name;
    category.textContent = menu.category;
    price.textContent = formatMoney(menu.price);
    description.textContent = menu.description;
    qty.textContent = String(quantityFor(menu.id));

    minus.addEventListener("click", () => {
      setQuantity(menu.id, quantityFor(menu.id) - 1);
      qty.textContent = String(quantityFor(menu.id));
    });

    plus.addEventListener("click", () => {
      setQuantity(menu.id, quantityFor(menu.id) + 1);
      qty.textContent = String(quantityFor(menu.id));
    });

    elements.menuGrid.appendChild(card);
  });
}

function renderBasket() {
  const selectedItems = Array.from(draft.items.entries())
    .map(([menuId, qty]) => {
      const menu = findMenu(menuId);
      if (!menu) {
        return null;
      }

      return {
        menuId,
        menuName: menu.name,
        qty,
        unitPrice: menu.price,
        lineTotal: qty * menu.price,
      };
    })
    .filter(Boolean);

  const totals = getOrderTotals(selectedItems);

  elements.subtotal.textContent = formatMoney(totals.subtotal);
  elements.tax.textContent = formatMoney(totals.tax);
  elements.total.textContent = formatMoney(totals.total);

  elements.basketList.innerHTML = "";

  if (!selectedItems.length) {
    elements.basketEmpty.style.display = "block";
    return;
  }

  elements.basketEmpty.style.display = "none";

  selectedItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "basket-row";
    row.innerHTML = `
      <div>
        <strong>${item.menuName}</strong>
        <div class="meta">${item.qty} x ${formatMoney(item.unitPrice)}</div>
      </div>
      <strong>${formatMoney(item.lineTotal)}</strong>
    `;
    elements.basketList.appendChild(row);
  });
}

function formatTime(isoString) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

function renderKitchen() {
  const queue = state.orders.filter((order) => order.status !== "served");
  elements.kitchenQueue.innerHTML = "";

  if (!queue.length) {
    elements.kitchenQueue.innerHTML = '<div class="empty-state">Belum ada antrean masuk.</div>';
    return;
  }

  queue.forEach((order) => {
    const item = document.createElement("article");
    item.className = "queue-item";

    item.innerHTML = `
      <div class="queue-header">
        <div>
          <h4>${order.orderCode}</h4>
          <div class="queue-meta">Meja ${order.tableNumber} · ${formatTime(order.createdAt)}</div>
        </div>
        <span class="badge ${order.status}">${order.status}</span>
      </div>
      <div class="section-divider"></div>
      <div class="note">
        ${order.items.map((entry) => `${entry.qty}x ${entry.menuName}`).join(" · ")}
      </div>
      ${order.note ? `<p class="note">Catatan: ${order.note}</p>` : ""}
      <div class="queue-actions"></div>
    `;

    const actions = item.querySelector(".queue-actions");
    const nextStatusIndex = ORDER_STEPS.indexOf(order.status);
    const nextStatus = ORDER_STEPS[nextStatusIndex + 1];

    if (nextStatus) {
      const nextButton = document.createElement("button");
      nextButton.className = "ghost";
      nextButton.type = "button";
      nextButton.textContent = nextStatus === "preparing" ? "Mulai Masak" : nextStatus === "ready" ? "Siap" : "Selesai";
      nextButton.addEventListener("click", () => updateOrderStatus(order.id, nextStatus));
      actions.appendChild(nextButton);
    }

    const resetButton = document.createElement("button");
    resetButton.className = "ghost";
    resetButton.type = "button";
    resetButton.textContent = "Lunas";
    resetButton.addEventListener("click", () => updatePaymentStatus(order.id, "paid"));
    actions.appendChild(resetButton);

    elements.kitchenQueue.appendChild(item);
  });
}

function renderCashier() {
  elements.cashierList.innerHTML = "";

  if (!state.orders.length) {
    elements.cashierList.innerHTML = '<div class="empty-state">Belum ada pesanan untuk kasir.</div>';
    return;
  }

  state.orders.forEach((order) => {
    const item = document.createElement("article");
    item.className = "queue-item";

    item.innerHTML = `
      <div class="queue-header">
        <div>
          <h4>${order.orderCode}</h4>
          <div class="queue-meta">Meja ${order.tableNumber} · ${formatTime(order.createdAt)}</div>
        </div>
        <span class="badge ${order.paymentStatus === "paid" ? "paid" : order.status}">${order.paymentStatus === "paid" ? "paid" : order.status}</span>
      </div>
      <div class="section-divider"></div>
      <div class="note">Total: <strong>${formatMoney(order.total)}</strong></div>
      <div class="note">Pembayaran: ${order.paymentStatus}</div>
      <div class="queue-actions"></div>
    `;

    const actions = item.querySelector(".queue-actions");
    if (order.paymentStatus !== "paid") {
      const paidButton = document.createElement("button");
      paidButton.className = "ghost";
      paidButton.type = "button";
      paidButton.textContent = "Tandai Lunas";
      paidButton.addEventListener("click", () => updatePaymentStatus(order.id, "paid"));
      actions.appendChild(paidButton);
    }

    elements.cashierList.appendChild(item);
  });
}

function renderStats() {
  elements.orderCount.textContent = String(state.orders.length);
  elements.readyCount.textContent = String(state.orders.filter((order) => order.status === "ready").length);
  elements.paidCount.textContent = String(state.orders.filter((order) => order.paymentStatus === "paid").length);
}

function renderAll() {
  renderStats();
  renderMenuCards();
  renderBasket();
  renderKitchen();
  renderCashier();
}

function handleSubmitOrder() {
  try {
    const items = Array.from(draft.items.entries())
      .map(([menuId, qty]) => {
        const menu = findMenu(menuId);
        if (!menu) {
          return null;
        }
        return {
          menuId,
          menuName: menu.name,
          qty,
          unitPrice: menu.price,
        };
      })
      .filter(Boolean);

    const order = createOrder({
      qrToken: draft.qrToken,
      note: elements.orderNote.value.trim(),
      items,
    });

    draft.items.clear();
    elements.orderNote.value = "";
    hydrateDraftToken(order.qrToken);
    elements.customerStatus.textContent = `${order.orderCode} berhasil dikirim ke dapur dan kasir.`;
    renderAll();
  } catch (error) {
    elements.customerStatus.textContent = error.message;
  }
}

function switchView(view) {
  elements.modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  elements.customerView.classList.toggle("active", view === "customer");
  elements.kitchenView.classList.toggle("active", view === "kitchen");
  elements.cashierView.classList.toggle("active", view === "cashier");

  const titles = {
    customer: "Pesanan Pelanggan",
    kitchen: "Antrean Dapur",
    cashier: "Ringkasan Kasir",
  };

  elements.activeTitle.textContent = titles[view] || "Pilih Mode";
}

function syncFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    state.menus = Array.isArray(parsed.menus) ? parsed.menus : state.menus;
    state.tables = Array.isArray(parsed.tables) ? parsed.tables : state.tables;
    state.orders = Array.isArray(parsed.orders) ? parsed.orders : state.orders;
    renderAll();
  } catch (error) {
    console.warn("Sinkronisasi state gagal.", error);
  }
}

function attachEvents() {
  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  elements.scanBtn.addEventListener("click", () => {
    hydrateDraftToken(elements.qrInput.value);
  });

  elements.qrInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      hydrateDraftToken(elements.qrInput.value);
    }
  });

  elements.submitOrder.addEventListener("click", handleSubmitOrder);

  window.addEventListener("storage", syncFromStorage);
  window.addEventListener("qr-cafe:update", renderAll);

  if (realtimeChannel) {
    realtimeChannel.onmessage = syncFromStorage;
  }
}

function bootstrap() {
  const initialToken = parseTokenFromUrl() || state.tables[0]?.qrToken || "";
  elements.tableTokenPreview.textContent = `?qr=${state.tables[0]?.qrToken || "T01-XXXX"}`;
  hydrateDraftToken(initialToken);
  renderAll();
  attachEvents();
}

bootstrap();