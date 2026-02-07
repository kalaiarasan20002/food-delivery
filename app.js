/* Food Delivery UI
  - Category filter
  - Search
  - Cart logic (add/remove)
  - Quantity update
  - Price calculation (subtotal + delivery + tax)
  - LocalStorage persistence
*/

const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];

const formatINR = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;

// ---- Sample Products (replace with your real items)
const PRODUCTS = [
  { id: "p1", name: "Classic Burger", category: "Burger", price: 149, eta: "20-30 min", badge: "b1" },
  { id: "p2", name: "Cheese Burger", category: "Burger", price: 179, eta: "20-30 min", badge: "b1" },
  { id: "p3", name: "Chicken Shawarma", category: "Wraps", price: 159, eta: "25-35 min", badge: "b2" },
  { id: "p4", name: "Veg Shawarma", category: "Wraps", price: 129, eta: "25-35 min", badge: "b2" },

  { id: "p5", name: "Masala Dosa", category: "South Indian", price: 99, eta: "15-25 min", badge: "b3" },
  { id: "p6", name: "Idli (2 pcs)", category: "South Indian", price: 59, eta: "15-25 min", badge: "b3" },
  { id: "p7", name: "Parotta + Salna", category: "South Indian", price: 89, eta: "20-30 min", badge: "b3" },

  { id: "p8", name: "Chicken Biryani", category: "Biryani", price: 219, eta: "30-40 min", badge: "b4" },
  { id: "p9", name: "Veg Biryani", category: "Biryani", price: 189, eta: "30-40 min", badge: "b4" },

  { id: "p10", name: "French Fries", category: "Sides", price: 79, eta: "15-25 min", badge: "b1" },
  { id: "p11", name: "Cold Coffee", category: "Drinks", price: 99, eta: "10-20 min", badge: "b2" },
  { id: "p12", name: "Fresh Lime Soda", category: "Drinks", price: 69, eta: "10-20 min", badge: "b2" },
];

// ---- State
const LS_KEY = "kalai_food_cart_v1";
let cart = loadCart(); // { [id]: {id, qty} }

let activeCategory = "All";
let searchQuery = "";

// ---- Elements
const productsGrid = $("#productsGrid");
const categoryFilters = $("#categoryFilters");
const resultsCount = $("#resultsCount");

const cartCount = $("#cartCount");
const cartSubtitle = $("#cartSubtitle");
const cartItems = $("#cartItems");

const subtotalEl = $("#subtotal");
const deliveryEl = $("#delivery");
const taxEl = $("#tax");
const totalEl = $("#total");
const checkoutNote = $("#checkoutNote");

const searchInput = $("#searchInput");
const clearSearchBtn = $("#clearSearchBtn");

const clearCartBtn = $("#clearCartBtn");
const checkoutBtn = $("#checkoutBtn");

// Mobile drawer cart
const openCartBtn = $("#openCartBtn");
const cartDrawer = $("#cartDrawer");
const closeCartBtn = $("#closeCartBtn");

const cartSubtitleMobile = $("#cartSubtitleMobile");
const cartItemsMobile = $("#cartItemsMobile");
const subtotalMobile = $("#subtotalMobile");
const deliveryMobile = $("#deliveryMobile");
const taxMobile = $("#taxMobile");
const totalMobile = $("#totalMobile");
const checkoutNoteMobile = $("#checkoutNoteMobile");
const clearCartBtnMobile = $("#clearCartBtnMobile");
const checkoutBtnMobile = $("#checkoutBtnMobile");

// ---- Init
renderCategories();
renderProducts();
renderCart();

// ---- Categories
function getCategories() {
  const cats = [...new Set(PRODUCTS.map(p => p.category))].sort();
  return ["All", ...cats];
}

function renderCategories() {
  const cats = getCategories();
  categoryFilters.innerHTML = cats.map(cat => `
    <button class="filter-btn ${cat === activeCategory ? "active" : ""}" data-cat="${cat}">
      ${cat}
    </button>
  `).join("");

  categoryFilters.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    $$(".filter-btn", categoryFilters).forEach(b => b.classList.toggle("active", b.dataset.cat === activeCategory));
    renderProducts();
  });
}

// ---- Products render (filter + search)
function getVisibleProducts() {
  const q = searchQuery.trim().toLowerCase();

  return PRODUCTS.filter(p => {
    const catOk = (activeCategory === "All") || (p.category === activeCategory);
    const qOk = !q || (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    return catOk && qOk;
  });
}

function renderProducts() {
  const visible = getVisibleProducts();
  resultsCount.textContent = `${visible.length} item(s) found`;

  productsGrid.innerHTML = visible.map((p) => {
    const inCartQty = cart[p.id]?.qty || 0;
    return `
      <article class="card">
        <div class="card__top">
          <div class="badge ${p.badge}">🍽️</div>
          <div>
            <h3 class="title">${escapeHTML(p.name)}</h3>
            <p class="sub">${escapeHTML(p.category)} • ${escapeHTML(p.eta)}</p>
          </div>
        </div>

        <div class="priceRow">
          <div class="price">${formatINR(p.price)}</div>
          <div class="chip">${inCartQty ? `In cart: ${inCartQty}` : "Popular"}</div>
        </div>

        <div class="card__actions">
          <button class="btn btn--primary btn--full" data-add="${p.id}">
            Add to Cart
          </button>
        </div>
      </article>
    `;
  }).join("");

  productsGrid.addEventListener("click", onAddToCartClick, { once: true });
}

function onAddToCartClick(e) {
  const btn = e.target.closest("[data-add]");
  if (!btn) {
    productsGrid.addEventListener("click", onAddToCartClick, { once: true });
    return;
  }
  const id = btn.dataset.add;
  addToCart(id, 1);
  renderProducts(); // update "in cart" chip
  productsGrid.addEventListener("click", onAddToCartClick, { once: true });
}

// ---- Search
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderProducts();
});

clearSearchBtn.addEventListener("click", () => {
  searchQuery = "";
  searchInput.value = "";
  renderProducts();
});

// ---- Cart logic
function addToCart(id, qty) {
  const cur = cart[id]?.qty || 0;
  cart[id] = { id, qty: cur + qty };
  if (cart[id].qty <= 0) delete cart[id];
  persistCart();
  renderCart();
}

function setQty(id, qty) {
  if (qty <= 0) {
    delete cart[id];
  } else {
    cart[id] = { id, qty };
  }
  persistCart();
  renderCart();
}

function clearCart() {
  cart = {};
  persistCart();
  renderCart();
  renderProducts();
}

clearCartBtn.addEventListener("click", clearCart);
clearCartBtnMobile.addEventListener("click", clearCart);

// ---- Cart render
function renderCart() {
  const items = getCartItems();
  const itemCount = items.reduce((s, it) => s + it.qty, 0);

  cartCount.textContent = itemCount;
  cartSubtitle.textContent = `${itemCount} item(s)`;
  cartSubtitleMobile.textContent = `${itemCount} item(s)`;

  // Items list
  const html = items.length ? items.map(it => `
    <div class="cartItem">
      <div class="cartItem__top">
        <div>
          <div class="cartItem__name">${escapeHTML(it.name)}</div>
          <div class="cartItem__meta">${escapeHTML(it.category)} • ${escapeHTML(it.eta)}</div>
        </div>
        <div class="cartItem__price">${formatINR(it.price * it.qty)}</div>
      </div>

      <div class="qtyRow">
        <div class="qtyControls">
          <button class="qbtn" data-dec="${it.id}" aria-label="Decrease quantity">−</button>
          <div class="qnum">${it.qty}</div>
          <button class="qbtn" data-inc="${it.id}" aria-label="Increase quantity">+</button>
        </div>
        <button class="remove" data-rm="${it.id}">Remove</button>
      </div>
    </div>
  `).join("") : `<div class="muted">Cart is empty. Add something tasty 😄</div>`;

  cartItems.innerHTML = html;
  cartItemsMobile.innerHTML = html;

  // Bind item actions (desktop + mobile share same handlers)
  bindCartHandlers(cartItems);
  bindCartHandlers(cartItemsMobile);

  // Totals
  const totals = calcTotals(items);
  subtotalEl.textContent = formatINR(totals.subtotal);
  deliveryEl.textContent = formatINR(totals.delivery);
  taxEl.textContent = formatINR(totals.tax);
  totalEl.textContent = formatINR(totals.total);

  subtotalMobile.textContent = formatINR(totals.subtotal);
  deliveryMobile.textContent = formatINR(totals.delivery);
  taxMobile.textContent = formatINR(totals.tax);
  totalMobile.textContent = formatINR(totals.total);

  const note = items.length ? `Estimated delivery: ${totals.deliveryEta}` : "";
  checkoutNote.textContent = note;
  checkoutNoteMobile.textContent = note;

  // Checkout buttons
  const disabled = items.length === 0;
  checkoutBtn.disabled = disabled;
  checkoutBtnMobile.disabled = disabled;
  checkoutBtn.style.opacity = disabled ? ".6" : "1";
  checkoutBtnMobile.style.opacity = disabled ? ".6" : "1";
}

function bindCartHandlers(root) {
  root.onclick = (e) => {
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    const rm  = e.target.closest("[data-rm]");

    if (inc) {
      const id = inc.dataset.inc;
      addToCart(id, 1);
      renderProducts();
      return;
    }
    if (dec) {
      const id = dec.dataset.dec;
      addToCart(id, -1);
      renderProducts();
      return;
    }
    if (rm) {
      const id = rm.dataset.rm;
      delete cart[id];
      persistCart();
      renderCart();
      renderProducts();
      return;
    }
  };
}

function getCartItems() {
  return Object.values(cart)
    .map(({ id, qty }) => {
      const p = PRODUCTS.find(x => x.id === id);
      if (!p) return null;
      return { ...p, qty };
    })
    .filter(Boolean);
}

// ---- Totals (change rules here)
function calcTotals(items) {
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);

  // Delivery rule:
  // - Free if subtotal >= 499
  // - Else 40
  const delivery = subtotal === 0 ? 0 : (subtotal >= 499 ? 0 : 40);

  // Tax: 5% on subtotal
  const tax = subtotal * 0.05;

  const total = subtotal + delivery + tax;

  // Delivery ETA based on cart size (simple demo)
  const count = items.reduce((s, it) => s + it.qty, 0);
  const deliveryEta = count <= 2 ? "20-30 min" : (count <= 5 ? "30-40 min" : "40-55 min");

  return { subtotal, delivery, tax, total, deliveryEta };
}

// ---- Checkout (demo)
checkoutBtn.addEventListener("click", () => fakeCheckout());
checkoutBtnMobile.addEventListener("click", () => fakeCheckout());

function fakeCheckout() {
  const items = getCartItems();
  if (!items.length) return;

  const totals = calcTotals(items);
  alert(
    `✅ Order placed!\n\nItems: ${items.reduce((s,i)=>s+i.qty,0)}\nTotal: ${formatINR(totals.total)}\nETA: ${totals.deliveryEta}\n\n(இந்த demo-ல backend இல்லை)`
  );
  clearCart();
  closeDrawer();
}

// ---- Drawer (mobile cart)
openCartBtn.addEventListener("click", () => {
  // only open drawer on small screens (still works on desktop too)
  cartDrawer.classList.add("show");
  cartDrawer.setAttribute("aria-hidden", "false");
});
closeCartBtn.addEventListener("click", closeDrawer);
cartDrawer.addEventListener("click", (e) => { if (e.target === cartDrawer) closeDrawer(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

function closeDrawer() {
  cartDrawer.classList.remove("show");
  cartDrawer.setAttribute("aria-hidden", "true");
}

// ---- Storage
function persistCart() {
  localStorage.setItem(LS_KEY, JSON.stringify(cart));
}
function loadCart() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// ---- Utils
function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
