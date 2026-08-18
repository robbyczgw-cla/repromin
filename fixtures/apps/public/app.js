const products = [
  { id: "widget-a", name: "Widget A", price: 19, kind: "widgets", stock: true, desc: "Everyday widget" },
  { id: "widget-b", name: "Widget B", price: 29, kind: "widgets", stock: true, desc: "Sturdier widget" },
  { id: "crash-widget", name: "Crash Widget", price: 49, kind: "widgets", stock: true, desc: "Known-bad SKU used by the killer demo" },
  { id: "gadget-c", name: "Gadget C", price: 39, kind: "gadgets", stock: true, desc: "Blinkenlights" },
  { id: "gadget-d", name: "Gadget D", price: 59, kind: "gadgets", stock: false, desc: "Backordered" },
  { id: "spare-e", name: "Spare E", price: 9, kind: "widgets", stock: true, desc: "Spare part" },
];

const state = {
  view: "home",
  cookies: null,
  cart: [],
  wishlist: [],
  compare: [],
  product: null,
  currency: "USD",
  search: "",
  sort: "featured",
  filters: { widgets: false, gadgets: false, inStock: false },
  experimental: false,
  promoUnlocked: false,
  promo: "",
  revealed: false,
  confirmedReveal: false,
  surveyBlocked: false,
};

function $(id) {
  return document.getElementById(id);
}

function show(view) {
  state.view = view;
  for (const el of document.querySelectorAll(".view")) el.classList.add("hidden");
  const node = $("view-" + view);
  if (node) node.classList.remove("hidden");
  if (view === "shop") renderShop();
  if (view === "cart") renderCart();
  if (view === "compare") renderList("compare-list", state.compare);
  if (view === "wishlist") renderList("wishlist-list", state.wishlist);
  if (view === "secret") renderSecret();
}

function renderShop() {
  let items = products.filter((p) => p.name.toLowerCase().includes(state.search.toLowerCase()));
  if (state.filters.widgets) items = items.filter((p) => p.kind === "widgets");
  if (state.filters.gadgets) items = items.filter((p) => p.kind === "gadgets");
  if (state.filters.inStock) items = items.filter((p) => p.stock);
  if (state.sort === "price") items = [...items].sort((a, b) => a.price - b.price);
  if (state.sort === "name") items = [...items].sort((a, b) => a.name.localeCompare(b.name));
  $("product-grid").innerHTML = items
    .map(
      (p) => `<div class="card" data-product="${p.id}">
        <h3>${p.name}</h3>
        <p>$${p.price}</p>
        <button class="open-product" data-id="${p.id}" id="open-${p.id}">View</button>
      </div>`,
    )
    .join("");
  for (const btn of document.querySelectorAll(".open-product")) {
    btn.addEventListener("click", () => openProduct(btn.getAttribute("data-id")));
  }
}

function openProduct(id) {
  const p = products.find((x) => x.id === id);
  state.product = p;
  $("product-name").textContent = p.name;
  $("product-desc").textContent = p.desc;
  $("product-price").textContent = p.price + " " + state.currency;
  $("product-status").textContent = "";
  show("product");
}

function renderCart() {
  $("cart-items").innerHTML = state.cart
    .map((id, i) => `<li>${id} <button class="remove-item" data-i="${i}">remove</button></li>`)
    .join("");
  $("cart-status").textContent = state.cart.length ? "CART_HAS_ITEMS" : "CART_EMPTY";
  $("cart-count").textContent = String(state.cart.length);
  for (const btn of document.querySelectorAll(".remove-item")) {
    btn.addEventListener("click", () => {
      state.cart.splice(Number(btn.getAttribute("data-i")), 1);
      renderCart();
    });
  }
}

function renderList(id, items) {
  $(id).innerHTML = items.map((x) => `<li>${x}</li>`).join("");
}

function renderSecret() {
  if (state.revealed && state.confirmedReveal) {
    $("secret-panel").classList.remove("hidden");
    $("secret-panel").textContent = "SECRET_PANEL_BUG";
  } else {
    $("secret-panel").classList.add("hidden");
    $("secret-panel").textContent = "";
  }
}

function showModal(text) {
  $("checkout-modal-text").textContent = text;
  $("checkout-modal").classList.remove("hidden");
}

function placeOrder() {
  state.promo = $("promo").value.trim() || state.promo;
  if (state.surveyBlocked) {
    showModal("SURVEY_REQUIRED");
    return;
  }
  if (state.cart.length === 0) {
    showModal("CART_EMPTY");
    return;
  }
  const hasCrash = state.cart.includes("crash-widget");
  const promoOk = state.promo === "SAVE20";
  // Fixture B: the NaN crash is gated behind two independent setup flags.
  const gated = state.experimental && state.promoUnlocked;
  if (hasCrash && promoOk && (gated || !needsGate())) {
    showModal("PAYMENT_GATEWAY_CRASH: order total is NaN");
    return;
  }
  showModal("ORDER_PLACED");
}

function needsGate() {
  return document.body.dataset.gate === "1";
}

function applyPromo() {
  const code = $("promo").value.trim();
  if (needsGate() && !state.promoUnlocked) {
    $("promo-status").textContent = "PROMO_LOCKED";
    return;
  }
  state.promo = code;
  $("promo-status").textContent = code ? "PROMO_APPLIED:" + code : "PROMO_CLEARED";
}

$("accept-cookies").onclick = () => {
  state.cookies = "accept";
  $("cookie-banner").classList.add("hidden");
};
$("reject-cookies").onclick = () => {
  state.cookies = "reject";
  $("cookie-banner").classList.add("hidden");
};
$("cookie-settings").onclick = () => {
  $("cookie-banner").dataset.expanded = "1";
};
$("open-newsletter").onclick = () => $("newsletter-popup").classList.remove("hidden");
$("newsletter-close").onclick = () => $("newsletter-popup").classList.add("hidden");
$("newsletter-submit").onclick = () => {
  $("newsletter-status").textContent = "SUBSCRIBED";
  $("newsletter-popup").classList.add("hidden");
};
$("open-survey").onclick = () => {
  // Mild flake used by fixture F: sometimes this action poisons later checkout.
  if (Math.random() < 0.35) {
    state.surveyBlocked = true;
    $("survey-block").classList.remove("hidden");
  } else {
    $("survey-block").classList.add("hidden");
  }
};
$("survey-dismiss").onclick = () => $("survey-block").classList.add("hidden");

for (const btn of document.querySelectorAll("[data-nav]")) {
  btn.addEventListener("click", () => show(btn.getAttribute("data-nav")));
}

$("search-btn").onclick = () => {
  state.search = $("search").value;
  renderShop();
};
$("search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    state.search = $("search").value;
    renderShop();
  }
});
$("sort").onchange = () => {
  state.sort = $("sort").value;
  renderShop();
};
$("filter-widgets").onchange = () => {
  state.filters.widgets = $("filter-widgets").checked;
  renderShop();
};
$("filter-gadgets").onchange = () => {
  state.filters.gadgets = $("filter-gadgets").checked;
  renderShop();
};
$("filter-in-stock").onchange = () => {
  state.filters.inStock = $("filter-in-stock").checked;
  renderShop();
};
$("clear-filters").onclick = () => {
  state.filters = { widgets: false, gadgets: false, inStock: false };
  $("filter-widgets").checked = false;
  $("filter-gadgets").checked = false;
  $("filter-in-stock").checked = false;
  renderShop();
};
$("currency").onchange = () => {
  state.currency = $("currency").value;
};
$("add-to-cart").onclick = () => {
  if (!state.product) return;
  const qty = Math.max(1, Number($("product-qty").value || 1));
  for (let i = 0; i < qty; i++) state.cart.push(state.product.id);
  $("product-status").textContent = "ADDED:" + state.product.id;
  renderCart();
};
$("add-to-wishlist").onclick = () => {
  if (state.product) state.wishlist.push(state.product.id);
};
$("add-to-compare").onclick = () => {
  if (state.product) state.compare.push(state.product.id);
};
$("clear-compare").onclick = () => {
  state.compare = [];
  renderList("compare-list", state.compare);
};
$("clear-wishlist").onclick = () => {
  state.wishlist = [];
  renderList("wishlist-list", state.wishlist);
};
$("apply-promo").onclick = applyPromo;
$("enable-experimental").onclick = () => {
  state.experimental = true;
  $("flag-status").textContent = "EXPERIMENTAL_ON" + (state.promoUnlocked ? "+PROMO_UNLOCKED" : "");
};
$("unlock-promo").onclick = () => {
  state.promoUnlocked = true;
  $("flag-status").textContent = (state.experimental ? "EXPERIMENTAL_ON+" : "") + "PROMO_UNLOCKED";
};
$("place-order").onclick = placeOrder;
$("close-modal").onclick = () => $("checkout-modal").classList.add("hidden");
$("save-profile").onclick = () => {
  $("account-status").textContent = "PROFILE_SAVED";
};
$("open-addresses").onclick = () => {
  $("account-status").textContent = "ADDRESSES";
};
$("open-payments").onclick = () => {
  $("account-status").textContent = "PAYMENTS";
};
$("read-post-1").onclick = () => {
  $("blog-status").textContent = "POST_1";
};
$("read-post-2").onclick = () => {
  $("blog-status").textContent = "POST_2";
};
$("read-post-3").onclick = () => {
  $("blog-status").textContent = "POST_3";
};
$("faq-shipping").onclick = () => {
  $("help-status").textContent = "FAQ_SHIPPING";
};
$("faq-returns").onclick = () => {
  $("help-status").textContent = "FAQ_RETURNS";
};
$("faq-billing").onclick = () => {
  $("help-status").textContent = "FAQ_BILLING";
};
$("contact-support").onclick = () => {
  $("help-status").textContent = "SUPPORT_SENT";
};
$("promo-summer").onclick = () => {
  $("hero-copy").textContent = "Summer sale is on";
};
$("promo-clearance").onclick = () => {
  $("hero-copy").textContent = "Clearance aisle";
};
$("promo-new").onclick = () => {
  $("hero-copy").textContent = "New arrivals";
};
$("reveal-secret").onclick = () => {
  state.revealed = true;
};
$("confirm-reveal").onclick = () => {
  state.confirmedReveal = true;
  renderSecret();
};

// Hash routes so tests can deep-link if needed.
window.addEventListener("hashchange", () => {
  const view = location.hash.replace("#", "");
  if (view) show(view);
});
if (location.hash) show(location.hash.replace("#", ""));

const params = new URLSearchParams(location.search);
if (params.get("gate") === "1") document.body.dataset.gate = "1";
document.body.dataset.app = "repromin-shop";
