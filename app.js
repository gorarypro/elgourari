// This wrapper ensures the script only runs after the
// entire HTML document is loaded and ready.
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

  /* ======================================================
        1. DEFINE ALL DOM ELEMENT VARIABLES
       ====================================================== */
  const menuSections = mustGet("menuSections", "<span></span>");
  const loadingContainer = mustGet("loadingContainer", "<span></span>");
  const errorContainer = mustGet("errorContainer", "<span></span>");
  const filterContainer = mustGet("filterContainer", "<span></span>");

  const cartSidebar = mustGet("cartSidebar");
  const wishlistSidebar = mustGet("wishlistSidebar");
  const sidebarOverlay = mustGet("sidebarOverlay");

  const cartBody = mustGet("cartBody");
  const emptyCartMessage = mustGet("emptyCartMessage");
  const cartFooter = mustGet("cartFooter");
  const cartTotal = mustGet("cartTotal");
  const cartCountNav = mustGet("cartCount");
  const floatingCartCount = mustGet("floatingCartCount");

  const wishlistBody = mustGet("wishlistBody");
  const emptyWishlistMessage = mustGet("emptyWishlistMessage");
  const wishlistCountNav = mustGet("wishlistCount");
  const floatingWishlistCount = mustGet("floatingWishlistCount");

  const quickViewModal = mustGet("quickViewModal");
  const quickViewTitle = mustGet("quickViewTitle");
  const quickViewImage = mustGet("quickViewImage");
  const quickViewPrice = mustGet("quickViewPrice");
  const quickViewDescription = mustGet("quickViewDescription");
  const quickViewAddToCartBtn = mustGet("quickViewAddToCartBtn");
  const relatedProductsGrid = mustGet("relatedProductsGrid");

  const phoneModal = mustGet("phoneModal");
  const additionalInfo = mustGet("additionalInfo");

  /* ======================================================
        2. CONFIG & GLOBALS
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

  let cart = JSON.parse(localStorage.getItem("eventSushiCart") || "[]");
  let wishlist = JSON.parse(localStorage.getItem("eventSushiWishlist") || "[]");
  let allProducts = [];

  const $ = (id) => document.getElementById(id);

  /* ======================================================
        3. DEFINE ALL FUNCTIONS
       ====================================================== */

  // Global click handler
  document.addEventListener("click", function (e) {
    const t = e.target.closest(
      "button, a, [data-id], [id^='close'], [id$='Icon'], #sidebarOverlay, #floatingCart, #floatingWishlist"
    );
    if (!t) return;

    // Sidebar controls
    if (t.id === "cartIcon" || t.id === "floatingCart") openSidebar(cartSidebar);
    if (t.id === "closeCart") closeSidebar(cartSidebar);
    if (t.id === "wishlistIcon" || t.id === "floatingWishlist") openSidebar(wishlistSidebar);
    if (t.id === "closeWishlist") closeSidebar(wishlistSidebar);
    if (t.id === "sidebarOverlay") {
      closeSidebar(cartSidebar);
      closeSidebar(wishlistSidebar);
    }

    // Cart and Wishlist actions
    if (t.classList.contains("add-to-cart-btn") && t.dataset.id) {
      addItemToCart(t.dataset.id);
      showNotification("Added to cart!");
    }
    if (t.classList.contains("wishlist-btn") && t.dataset.id) {
      toggleWishlistItem(t.dataset.id);
    }
    if (t.classList.contains("remove-from-wishlist-btn") && t.dataset.id) {
      toggleWishlistItem(t.dataset.id, "remove");
    }
    if (t.classList.contains("add-to-cart-from-wishlist-btn") && t.dataset.id) {
      addItemToCart(t.dataset.id);
      showNotification("Added to cart!");
    }

    // Quick View
    if (t.classList.contains("quick-view-btn") && t.dataset.id) {
      openQuickView(t.dataset.id);
    }
    if (t.id === "closeQuickView") quickViewModal.classList.remove("show");
    if (t.id === "quickViewAddToCartBtn" && t.dataset.id) {
      addItemToCart(t.dataset.id);
      showNotification("Added to cart!");
      quickViewModal.classList.remove("show");
    }

    // Menu / Checkout Modals
    if (t.id === "retryBtn") fetchMenuData();
    if (t.id === "checkoutBtn" && cart.length > 0) phoneModal.classList.add("show");
    if (t.id === "cancelCheckout") closePhoneModal();
    if (t.id === "confirmCheckout") handleCheckout();
    if (t.id === "addInfoBtn") additionalInfo.style.display = "block";
    if (t.id === "noThanksBtn") additionalInfo.style.display = "none";
  });

  // Cart quantity listener
  cartBody.addEventListener("click", function (e) {
    if (e.target.classList.contains("increase-qty")) {
      const item = cart.find((x) => x.id === e.target.dataset.id);
      if (item) item.quantity++;
      updateCartUI();
    }
    if (e.target.classList.contains("decrease-qty")) {
      const item = cart.find((x) => x.id === e.target.dataset.id);
      if (!item) return;
      item.quantity--;
      if (item.quantity <= 0) cart = cart.filter((x) => x.id !== item.id);
      updateCartUI();
    }
  });

  // Show Error
  function showError(msg) {
    loadingContainer.style.display = "none";
    menuSections.style.display = "none";
    errorContainer.style.display = "block";
    let errorMsgEl = errorContainer.querySelector('.error-message');
    if (!errorMsgEl) {
      errorMsgEl = document.createElement('p');
      errorMsgEl.className = 'error-message';
      errorContainer.appendChild(errorMsgEl);
    }
    errorMsgEl.textContent = "Error: " + msg;

    let retryBtn = errorContainer.querySelector('#retryBtn');
    if (!retryBtn) {
      retryBtn = document.createElement('button');
      retryBtn.id = 'retryBtn';
      retryBtn.textContent = 'Try Again';
      retryBtn.className = 'btn btn-primary';
      errorContainer.appendChild(retryBtn);
      // Note: The main click listener will handle the 'retryBtn' click
    }
  }

  // Fetch Menu
  function fetchMenuData() {
    // These variables are now guaranteed to exist
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

    s.onerror = () => showError("Network error: Could not load menu script.");
    document.body.appendChild(s);
  }

  // Render Menu
  function generateMenuHTML(categories) {
    let html = "";
    categories.forEach((c) => {
      if (!c.posts || !c.posts.length) return;
      html += `
      <div class="category-section" id="${String(c.title).toLowerCase()}-section">
        <div class="category-header ${c.color || ''}">
          <div class="category-icon">${c.icon || '🍣'}</div>
          <h3 class="category-title">${c.title || 'Category'}</h3>
        </div>
        <p class="category-description">${c.description || ''}</p>
        <div class="menu-grid">
          ${c.posts
          .map(
            (p) => `
          <div class="menu-item" data-id="${p.id}">
            <div class="menu-card">
              <div class="card-img-container">
                <img src="${p.imageUrl}" alt="${p.title}" 
                      onerror="this.src='https://placehold.co/600x400/fe7301/white?text=Image+Error'">
                <div class="product-card-overlay">
                  <button class="icon-btn quick-view-btn" data-id="${p.id}" title="Quick View">
                    <i class="bi bi-eye"></i>
                  </button>
                  <button class="icon-btn wishlist-btn" data-id="${p.id}" title="Add to Wishlist">
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

  // Render Filters
  function populateFilterButtons(categories) {
    let html = `<button class="filter-btn active" data-filter="all">All</button>`;
    categories.forEach((c) => {
      if (c.posts && c.posts.length > 0)
        html += `<button class="filter-btn" data-filter="${c.title}">${c.title}</button>`;
    });
    filterContainer.innerHTML = html;
    filterContainer.addEventListener("click", function (e) {
      if (!e.target.matches(".filter-btn")) return;
      Array.from(filterContainer.children).forEach(
        (b) => b.classList.remove("active")
      );
      e.target.classList.add("active");
      const filter = e.target.dataset.filter.toLowerCase();
      document.querySelectorAll(".category-section").forEach((sec) => {
        sec.style.display = (filter === "all" || sec.id === filter + "-section") ? "block" : "none";
      });
    });
  }

  // Cart Functions
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
        <img src="${i.imageUrl}" onerror="this.src='https://placehold.co/100x100/fe7301/white?text=Img'">
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

  // Wishlist Functions
  function toggleWishlistItem(id, force) {
    const p = allProducts.find((x) => x.id === id);
    if (!p) return;
    const index = wishlist.findIndex((x) => x.id === id);
    if (force === "remove" || index !== -1) {
      wishlist.splice(index, 1);
      showNotification("Removed from wishlist");
    } else {
      wishlist.push(p);
      showNotification("Added to wishlist!");
    }
    updateWishlistUI();
  }

  function updateWishlistUI() {
    wishlistCountNav.textContent = wishlist.length;
    floatingWishlistCount.textContent = wishlist.length;
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
      const id = btn.dataset.id;
      const icon = btn.querySelector('i');
      if (icon && wishlist.some(item => item.id === id)) {
        icon.classList.remove('bi-heart');
        icon.classList.add('bi-heart-fill');
        btn.classList.add('active');
      } else if (icon) {
        icon.classList.remove('bi-heart-fill');
        icon.classList.add('bi-heart');
        btn.classList.remove('active');
      }
    });

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
        <img src="${i.imageUrl}" onerror="this.src='https://placehold.co/100x100/fe7301/white?text=Img'">
        <div class="sidebar-item-info">
          <div>${i.title}</div>
          <div>${i.price} ${i.currency}</div>
        </div>
        <div class="sidebar-item-actions">
          <button class="icon-btn add-to-cart-from-wishlist-btn" data-id="${i.id}" title="Add to Cart">
            <i class="bi bi-cart-plus"></i>
          </button>
          <button class="icon-btn remove-from-wishlist-btn" data-id="${i.id}" title="Remove">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>`
      )
      .join("");
    localStorage.setItem("eventSushiWishlist", JSON.stringify(wishlist));
  }

  // Quick View
  function openQuickView(id) {
    const p = allProducts.find((x) => x.id === id);
    if (!p) return;
    quickViewTitle.textContent = p.title;
    quickViewImage.src = p.imageUrl;
    quickViewImage.onerror = () => { quickViewImage.src = 'https://placehold.co/600x400/fe7301/white?text=Image+Error'; };
    quickViewPrice.textContent = `${p.price} ${p.currency}`;
    quickViewDescription.textContent = p.fullDescription || p.shortDescription;
    quickViewAddToCartBtn.dataset.id = p.id;
    relatedProductsGrid.innerHTML = allProducts
      .filter((x) => x.category === p.category && x.id !== p.id)
      .slice(0, 4)
      .map(
        (x) => `
      <div class="related-item">
        <img src="${x.imageUrl}" onerror="this.src='https://placehold.co/100x100/fe7301/white?text=Img'">
        <div class="related-item-title">${x.title}</div>
      </div>`
      )
      .join("");
    quickViewModal.classList.add("show");
  }

  // Checkout
  function closePhoneModal() {
    phoneModal.classList.remove("show");
    additionalInfo.style.display = "none";
    ["customerPhone", "customerName", "customerEmail", "customerAddress"].forEach(
      (id) => {
        const el = $(id);
        if (el) el.value = "";
      }
    );
    if ($("deliveryZone")) $("deliveryZone").selectedIndex = 0;
    const pmDelivery = $("paymentMethodDelivery");
    if (pmDelivery) pmDelivery.checked = true;
  }

  function handleCheckout() {
    const phone = $("customerPhone")?.value?.trim();
    const zoneKey = $("deliveryZone")?.value;

    if (!phone || !/^\+?[0-9\s-]{8,}$/.test(phone)) {
      return alert("Please enter a valid phone number.");
    }
    if (!zoneKey) return alert("Please select a delivery zone.");

    const zone = DELIVERY_ZONES[zoneKey];
    if (!zone) return alert("Invalid delivery zone selected.");

    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + zone.fee;

    let msg = `Hello! I'd like to place an order:\n\n`;
    msg += cart.map((i) => `${i.quantity}x ${i.title} (${i.price} DH each)`).join("\n");
    msg += `\n\nSubtotal: ${subtotal.toFixed(2)} DH`;
    msg += `\nDelivery Zone: ${zone.name}`;
    msg += `\nDelivery Fee: ${zone.fee.toFixed(2)} DH`;
    msg += `\n------------------`;
    msg += `\nTotal: ${total.toFixed(2)} DH\n\n`;
    msg += `Phone: ${phone}\n`;

    const name = $("customerName")?.value?.trim();
    const email = $("customerEmail")?.value?.trim();
    const address = $("customerAddress")?.value?.trim();
    if (name) msg += `Name: ${name}\n`;
    if (email) msg += `Email: ${email}\n`;
    if (address) msg += `Address: ${address}\n`;

    const pm = document.querySelector("input[name='paymentMethod']:checked")?.value;
    if (pm === "cash-plus")
      msg += `\nPayment Method: CASH PLUS\n(Will pay to: ${CASH_PLUS_PHONE})`;
    else msg += `\nPayment Method: Cash on Delivery`;

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );

    cart = [];
    localStorage.removeItem("eventSushiCart");
    updateCartUI();
    closePhoneModal();
  }

  // Utils
  function showNotification(msg) {
    const toastEl = $("notificationToast");
    if (!toastEl) return;
    if (typeof bootstrap === 'undefined' || !bootstrap.Toast) {
      console.warn('Bootstrap Toast not available');
      return;
    }
    const toastBody = toastEl.querySelector(".toast-body");
    if (toastBody) toastBody.textContent = msg;
    const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2000 });
    toast.show();
  }

  function openSidebar(el) {
    if (el) el.classList.add("open");
    if (sidebarOverlay) sidebarOverlay.classList.add("show");
  }

  function closeSidebar(el) {
    if (el) el.classList.remove("open");
    if (sidebarOverlay) sidebarOverlay.classList.remove("show");
  }

  /* ======================================================
        4. DEFINE THE GLOBAL CALLBACK
       ====================================================== */
  // This MUST be on the window object to be found by the JSONP script
  window.handleMenuResponse = function (data) {
    try {
      if (!data || !Array.isArray(data)) {
        throw new Error("Invalid menu data received.");
      }
      allProducts = data.flatMap((c) => c.posts || []);

      // These functions and variables are all defined and available
      // because this is called *after* DOMContentLoaded
      generateMenuHTML(data);
      populateFilterButtons(data);
      updateCartUI();
      updateWishlistUI();

      // This is the line that caused the error. It will now work.
      loadingContainer.style.display = "none";
      menuSections.style.display = "block";

    } catch (err) {
      console.error("handleMenuResponse error:", err);
      showError(err.message);
    }
  };

  /* ======================================================
        5. INITIALIZE THE APP
       ====================================================== */
  // All elements are loaded, all functions are defined.
  // Now, we fetch the data.
  fetchMenuData();

}); // This closes the DOMContentLoaded wrapper
