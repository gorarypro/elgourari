document.addEventListener("DOMContentLoaded", function () {

  /* ======================================================
     SAFE DOM GETTER (AUTO-CREATES IF BLOGGER DELETES)
     ====================================================== */
  function mustGet(id, fallbackHTML = "") {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.innerHTML = fallbackHTML;
      el.style.display = "none";
      document.body.appendChild(el);
      console.warn("Auto-created missing element:", id);
    }
    return el;
  }

  /* Blogger sometimes deletes or changes tags.
     We force-create all required targets. */
  const menuSections    = mustGet("menuSections", "<span></span>");
  const loadingContainer = mustGet("loadingContainer", "<span></span>");
  const errorContainer  = mustGet("errorContainer", "<span></span>");
  const filterContainer = mustGet("filterContainer", "<span></span>");

  const cartSidebar     = mustGet("cartSidebar");
  const wishlistSidebar = mustGet("wishlistSidebar");
  const sidebarOverlay  = mustGet("sidebarOverlay");

  const cartBody        = mustGet("cartBody");
  const emptyCartMessage = mustGet("emptyCartMessage");
  const cartFooter      = mustGet("cartFooter");
  const cartTotal       = mustGet("cartTotal");
  const cartCountNav    = mustGet("cartCount");
  const floatingCartCount = mustGet("floatingCartCount");

  const wishlistBody      = mustGet("wishlistBody");
  const emptyWishlistMessage = mustGet("emptyWishlistMessage");
  const wishlistCountNav  = mustGet("wishlistCount");
  const floatingWishlistCount = mustGet("floatingWishlistCount");

  const quickViewModal       = mustGet("quickViewModal");
  const quickViewTitle       = mustGet("quickViewTitle");
  const quickViewImage       = mustGet("quickViewImage");
  const quickViewPrice       = mustGet("quickViewPrice");
  const quickViewDescription = mustGet("quickViewDescription");
  const quickViewAddToCartBtn = mustGet("quickViewAddToCartBtn");
  const relatedProductsGrid   = mustGet("relatedProductsGrid");

  const phoneModal    = mustGet("phoneModal");
  const additionalInfo = mustGet("additionalInfo");

  /* ======================================================
     CONFIG
     ====================================================== */
  const WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbyp10uQxfT9J4U_4fmrKYA29iyrxgDVMWR2Q5TlM-jCUwD1aiond0MKHt5zKW9vTf2w5w/exec";

  const CASH_PLUS_PHONE = "0664070513";
  const WHATSAPP_NUMBER = "212664070513";

  const DELIVERY_ZONES = {
    "casablanca-center": { name: "Casablanca Center", fee: 0 },
    "casablanca-nearby": { name: "Casablanca Nearby", fee: 15 },
    "casablanca-far": { name: "Greater Casablanca", fee: 25 }
  };

  /* ======================================================
     GLOBALS
     ====================================================== */
  let cart = JSON.parse(localStorage.getItem("eventSushiCart") || "[]");
  let wishlist = JSON.parse(localStorage.getItem("eventSushiWishlist") || "[]");
  let allProducts = [];

  const $ = (id) => document.getElementById(id);

  /* ======================================================
     GLOBAL CLICK HANDLER
     ====================================================== */
  document.addEventListener("click", function (e) {
    const t = e.target.closest("*");
    if (!t) return;

    if (t.id === "cartIcon" || t.id === "floatingCart") openSidebar(cartSidebar);
    if (t.id === "closeCart") closeSidebar(cartSidebar);

    if (t.id === "wishlistIcon" || t.id === "floatingWishlist") openSidebar(wishlistSidebar);
    if (t.id === "closeWishlist") closeSidebar(wishlistSidebar);

    if (t.id === "sidebarOverlay") {
      closeSidebar(cartSidebar);
      closeSidebar(wishlistSidebar);
    }

    if (t.classList.contains("add-to-cart-btn")) {
      addItemToCart(t.dataset.id);
      showNotification("Added to cart!");
    }

    if (t.classList.contains("wishlist-btn")) toggleWishlistItem(t.dataset.id);

    if (t.classList.contains("remove-from-wishlist-btn")) toggleWishlistItem(t.dataset.id, "remove");

    if (t.classList.contains("add-to-cart-from-wishlist-btn")) {
      addItemToCart(t.dataset.id);
      showNotification("Added to cart!");
    }

    if (t.classList.contains("quick-view-btn"))
      openQuickView(t.dataset.id);

    if (t.id === "closeQuickView") quickViewModal.classList.remove("show");

    if (t.id === "quickViewAddToCartBtn") {
      addItemToCart(t.dataset.id);
      showNotification("Added to cart!");
      quickViewModal.classList.remove("show");
    }

    if (t.id === "retryBtn") fetchMenuData();

    if (t.id === "checkoutBtn" && cart.length > 0)
      phoneModal.classList.add("show");

    if (t.id === "cancelCheckout") closePhoneModal();

    if (t.id === "confirmCheckout") handleCheckout();

    if (t.id === "addInfoBtn") additionalInfo.style.display = "block";
    if (t.id === "noThanksBtn") additionalInfo.style.display = "none";
  });

  /* ======================================================
     LOAD MENU
     ====================================================== */
  window.handleMenuResponse = function (data) {
    try {
      allProducts = data.flatMap((c) => c.posts);

      generateMenuHTML(data);
      populateFilterButtons(data);
      updateCartUI();
      updateWishlistUI();

      loadingContainer.style.display = "none";
      menuSections.style.display = "block";

    } catch (err) {
      showError(err.message);
    }
  };

  function fetchMenuData() {
    loadingContainer.style.display = "flex";
    errorContainer.style.display = "none";
    menuSections.style.display = "none";

    const old = document.getElementById("jsonp-menu-script");
    if (old) old.remove();

    const s = document.createElement("script");
    s.id = "jsonp-menu-script";
    s.src =
      WEB_APP_URL +
      "?action=getMenu&callback=handleMenuResponse&v=" +
      Date.now();

    s.onerror = () => showError("Network error loading menu.");
    document.body.appendChild(s);
  }

  fetchMenuData();


  /* ======================================================
     MENU RENDER
     ====================================================== */
  function generateMenuHTML(categories) {
    let html = "";

    categories.forEach((c) => {
      if (!c.posts.length) return;

      html += `
      <div class="category-section" id="${c.title.toLowerCase()}-section">
        <div class="category-header ${c.color}">
          <div class="category-icon">${c.icon}</div>
          <h3 class="category-title">${c.title}</h3>
        </div>

        <p class="category-description">${c.description}</p>

        <div class="menu-grid">
          ${c.posts
            .map(
              (p) => `
            <div class="menu-item" data-id="${p.id}">
              <div class="menu-card">
                <div class="card-img-container">
                  <img src="${p.imageUrl}" alt="${p.title}">
                  <div class="product-card-overlay">
                    <button class="icon-btn quick-view-btn" data-id="${p.id}">
                      <i class="bi bi-eye"></i>
                    </button>
                    <button class="icon-btn wishlist-btn" data-id="${p.id}">
                      <i class="bi bi-heart"></i>
                    </button>
                  </div>
                  ${
                    p.price > 0
                      ? `<span class="price-badge">${p.price} ${p.currency}</span>`
                      : ""
                  }
                </div>

                <div class="card-body">
                  <h5>${p.title}</h5>
                  <p>${p.shortDescription}</p>
                </div>

                <div class="card-footer">
                  <div class="price-tag">${p.price} ${p.currency}</div>
                  <button class="order-btn add-to-cart-btn" data-id="${p.id}">
                    <i class="bi bi-cart-plus"></i>
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>`
            )
            .join("")}
        </div>
      </div>`;
    });

    menuSections.innerHTML = html;
  }

  /* ======================================================
     FILTER BUTTONS
     ====================================================== */
  function populateFilterButtons(categories) {
    let html = `<button class="filter-btn active" data-filter="all">All</button>`;

    categories.forEach((c) => {
      if (c.posts.length > 0)
        html += `<button class="filter-btn" data-filter="${c.title}">${c.title}</button>`;
    });

    filterContainer.innerHTML = html;

    filterContainer.addEventListener("click", function (e) {
      if (!e.target.matches(".filter-btn")) return;

      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));

      e.target.classList.add("active");

      const filter = e.target.dataset.filter.toLowerCase();
      document.querySelectorAll(".category-section").forEach((sec) => {
        if (filter === "all" || sec.id === filter + "-section")
          sec.style.display = "block";
        else sec.style.display = "none";
      });
    });
  }

  /* ======================================================
     CART
     ====================================================== */

  function addItemToCart(id) {
    const p = allProducts.find((x) => x.id === id);
    if (!p) return;

    const found = cart.find((i) => i.id === id);
    if (found) found.quantity++;
    else cart.push({ ...p, quantity: 1 });

    updateCartUI();
  }

  function updateCartUI() {
    const total = cart.reduce((s, i) => s + i.quantity, 0);

    cartCountNav.textContent = total;
    floatingCartCount.textContent = total;

    if (!cart.length) {
      emptyCartMessage.style.display = "block";
      cartFooter.style.display = "none";
      cartBody.innerHTML = "";
    } else {
      emptyCartMessage.style.display = "none";
      cartFooter.style.display = "block";

      cartBody.innerHTML = cart
        .map(
          (i) => `
        <div class="sidebar-item">
          <img src="${i.imageUrl}">
          <div class="sidebar-item-info">
            <div>${i.title}</div>
            <div>${i.price} ${i.currency}</div>
          </div>
          <div class="sidebar-item-actions">
            <button class="quantity-btn decrease-qty" data-id="${i.id}">-</button>
            <span>${i.quantity}</span>
            <button class="quantity-btn increase-qty" data-id="${i.id}">+</button>
          </div>
        </div>`
        )
        .join("");
    }

    cartTotal.textContent =
      cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2) + " DH";

    localStorage.setItem("eventSushiCart", JSON.stringify(cart));
  }

  document.addEventListener("click", function (e) {
    if (e.target.classList.contains("increase-qty")) {
      const item = cart.find((x) => x.id === e.target.dataset.id);
      if (item) item.quantity++;
      updateCartUI();
    }

    if (e.target.classList.contains("decrease-qty")) {
      const item = cart.find((x) => x.id === e.target.dataset.id);
      if (!item) return;
      item.quantity--;
      if (item.quantity <= 0)
        cart = cart.filter((x) => x.id !== item.id);
      updateCartUI();
    }
  });

  /* ======================================================
     WISHLIST
     ====================================================== */

  function toggleWishlistItem(id, force) {
    const p = allProducts.find((x) => x.id === id);
    if (!p) return;

    const index = wishlist.findIndex((x) => x.id === id);

    if (force === "remove" || index !== -1) wishlist.splice(index, 1);
    else wishlist.push(p);

    updateWishlistUI();
  }

  function updateWishlistUI() {
    wishlistCountNav.textContent = wishlist.length;
    floatingWishlistCount.textContent = wishlist.length;

    if (!wishlist.length) {
      emptyWishlistMessage.style.display = "block";
      wishlistBody.innerHTML = "";
      return;
    }

    emptyWishlistMessage.style.display = "none";

    wishlistBody.innerHTML = wishlist
      .map(
        (i) => `
      <div class="sidebar-item">
        <img src="${i.imageUrl}">
        <div class="sidebar-item-info">
          <div>${i.title}</div>
          <div>${i.price} ${i.currency}</div>
        </div>
        <div class="sidebar-item-actions">
          <button class="add-to-cart-from-wishlist-btn" data-id="${i.id}">
            <i class="bi bi-cart-plus"></i>
          </button>
          <button class="remove-from-wishlist-btn" data-id="${i.id}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>`
      )
      .join("");

    localStorage.setItem("eventSushiWishlist", JSON.stringify(wishlist));
  }

  /* ======================================================
     QUICK VIEW
     ====================================================== */

  function openQuickView(id) {
    const p = allProducts.find((x) => x.id === id);
    if (!p) return;

    quickViewTitle.textContent = p.title;
    quickViewImage.src = p.imageUrl;
    quickViewPrice.textContent = `${p.price} ${p.currency}`;
    quickViewDescription.textContent = p.fullDescription;
    quickViewAddToCartBtn.dataset.id = p.id;

    relatedProductsGrid.innerHTML = allProducts
      .filter((x) => x.category === p.category && x.id !== p.id)
      .slice(0, 4)
      .map(
        (x) => `
        <div class="related-item">
          <img src="${x.imageUrl}">
          <div class="related-item-title">${x.title}</div>
        </div>`
      )
      .join("");

    quickViewModal.classList.add("show");
  }

  /* ======================================================
     CHECKOUT
     ====================================================== */

  function closePhoneModal() {
    phoneModal.classList.remove("show");
    additionalInfo.style.display = "none";

    ["customerPhone", "customerName", "customerEmail", "customerAddress"].forEach(
      (id) => {
        const el = $(id);
        if (el) el.value = "";
      }
    );
  }

  function handleCheckout() {
    const phone = $("customerPhone")?.value?.trim();
    const zoneKey = $("deliveryZone")?.value;

    if (!phone) return alert("Enter phone number");
    if (!zoneKey) return alert("Select delivery zone");

    const zone = DELIVERY_ZONES[zoneKey];

    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + zone.fee;

    let msg = `Hello! I'd like to place an order:\n\n`;
    msg += cart.map((i) => `${i.quantity}x ${i.title}`).join("\n");
    msg += `\n\nSubtotal: ${subtotal} DH`;
    msg += `\nDelivery zone: ${zone.name}`;
    msg += `\nDelivery fee: ${zone.fee} DH`;
    msg += `\nTotal: ${total} DH\n\n`;
    msg += `Phone: ${phone}\n`;

    const pm = document.querySelector("input[name='paymentMethod']:checked")?.value;

    if (pm === "cash-plus")
      msg += `Payment Method: CASH PLUS\nPay to: ${CASH_PLUS_PHONE}`;
    else msg += `Payment Method: Cash on delivery`;

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );

    cart = [];
    localStorage.removeItem("eventSushiCart");
    updateCartUI();
    closePhoneModal();
  }

  /* ======================================================
     UTILS
     ====================================================== */

  function showNotification(msg) {
    const toast = $("notificationToast");
    if (!toast) return;

    toast.querySelector(".toast-body").textContent = msg;
    new bootstrap.Toast(toast, { delay: 2000 }).show();
  }

  function openSidebar(el) {
    el.classList.add("open");
    sidebarOverlay.classList.add("show");
  }

  function closeSidebar(el) {
    el.classList.remove("open");
    sidebarOverlay.classList.remove("show");
  }

});
