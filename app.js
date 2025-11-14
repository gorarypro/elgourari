document.addEventListener("DOMContentLoaded", function () {

  // =============================
  // CONFIG
  // =============================
  const WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbyp10uQxfT9J4U_4fmrKYA29iyrxgDVMWR2Q5TlM-jCUwD1aiond0MKHt5zKW9vTf2w5w/exec";

  const CASH_PLUS_PHONE = "0664070513";
  const WHATSAPP_NUMBER = "212664070513";

  const DELIVERY_ZONES = {
    "casablanca-center": { name: "Casablanca Center", fee: 0 },
    "casablanca-nearby": { name: "Casablanca Nearby", fee: 15 },
    "casablanca-far": { name: "Greater Casablanca", fee: 25 },
  };

  // =============================
  // GLOBALS
  // =============================
  let cart = JSON.parse(localStorage.getItem("eventSushiCart") || "[]");
  let wishlist = JSON.parse(localStorage.getItem("eventSushiWishlist") || "[]");
  let allProducts = [];

  // Cache DOM safely
  const $ = (id) => document.getElementById(id);

  const menuSections = $("menuSections");
  const loadingContainer = $("loadingContainer");
  const errorContainer = $("errorContainer");
  const filterContainer = $("filterContainer");

  const cartSidebar = $("cartSidebar");
  const wishlistSidebar = $("wishlistSidebar");
  const sidebarOverlay = $("sidebarOverlay");

  const cartBody = $("cartBody");
  const cartFooter = $("cartFooter");
  const cartTotal = $("cartTotal");
  const emptyCartMessage = $("emptyCartMessage");
  const cartCountNav = $("cartCount");
  const floatingCartCount = $("floatingCartCount");

  const wishlistBody = $("wishlistBody");
  const emptyWishlistMessage = $("emptyWishlistMessage");
  const wishlistCountNav = $("wishlistCount");
  const floatingWishlistCount = $("floatingWishlistCount");

  const quickViewModal = $("quickViewModal");
  const quickViewTitle = $("quickViewTitle");
  const quickViewImage = $("quickViewImage");
  const quickViewPrice = $("quickViewPrice");
  const quickViewDescription = $("quickViewDescription");
  const quickViewAddToCartBtn = $("quickViewAddToCartBtn");
  const relatedProductsGrid = $("relatedProductsGrid");

  const phoneModal = $("phoneModal");
  const additionalInfo = $("additionalInfo");

  // =============================
  // SAFE EVENT DELEGATION (Fixes Null Errors)
  // =============================

  document.addEventListener("click", function (e) {
    const target = e.target.closest("*");

    // CART OPEN
    if (target?.id === "cartIcon" || target?.id === "floatingCart")
      openSidebar(cartSidebar);

    // WISHLIST OPEN
    if (target?.id === "wishlistIcon" || target?.id === "floatingWishlist")
      openSidebar(wishlistSidebar);

    // CLOSE SIDEBAR
    if (target?.id === "closeCart") closeSidebar(cartSidebar);
    if (target?.id === "closeWishlist") closeSidebar(wishlistSidebar);

    // OVERLAY CLOSE
    if (target?.id === "sidebarOverlay") {
      closeSidebar(cartSidebar);
      closeSidebar(wishlistSidebar);
    }

    // ADD TO CART
    if (target?.classList.contains("add-to-cart-btn")) {
      const id = target.getAttribute("data-id");
      addItemToCart(id);
      showNotification("Added to cart!");
    }

    // WISHLIST TOGGLE
    if (target?.classList.contains("wishlist-btn")) {
      toggleWishlistItem(target.getAttribute("data-id"));
    }

    // QUICK VIEW OPEN
    if (target?.classList.contains("quick-view-btn")) {
      openQuickView(target.getAttribute("data-id"));
    }

    // QUICK VIEW CLOSE
    if (target?.id === "closeQuickView") {
      quickViewModal.classList.remove("show");
    }

    // QUICK VIEW ADD TO CART
    if (target?.id === "quickViewAddToCartBtn") {
      addItemToCart(target.getAttribute("data-id"));
      showNotification("Added to cart!");
      quickViewModal.classList.remove("show");
    }

    // RETRY MENU LOAD (fixes your NULL error)
    if (target?.id === "retryBtn") fetchMenuData();

    // CHECKOUT BUTTON
    if (target?.id === "checkoutBtn") {
      if (cart.length > 0) phoneModal.classList.add("show");
    }

    // CANCEL CHECKOUT
    if (target?.id === "cancelCheckout") {
      closePhoneModal();
    }

    // CONFIRM ORDER
    if (target?.id === "confirmCheckout") {
      handleCheckout();
    }

    // ADDITIONAL INFO
    if (target?.id === "addInfoBtn") {
      additionalInfo.style.display = "block";
    }
    if (target?.id === "noThanksBtn") {
      additionalInfo.style.display = "none";
    }

    // WISHLIST REMOVE
    if (target?.classList.contains("remove-from-wishlist-btn")) {
      toggleWishlistItem(target.getAttribute("data-id"), "remove");
    }

    // ADD FROM WISHLIST
    if (target?.classList.contains("add-to-cart-from-wishlist-btn")) {
      addItemToCart(target.getAttribute("data-id"));
      showNotification("Added to cart!");
    }
  });

  // =============================
  // FETCH MENU (JSONP)
  // =============================
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

  // =============================
  // MENU RENDER
  // =============================

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
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
    });

    menuSections.innerHTML = html;
  }

  function populateFilterButtons(categories) {
    let html = `<button class="filter-btn active" data-filter="all">All</button>`;

    categories.forEach((c) => {
      if (c.posts.length > 0) {
        html += `<button class="filter-btn" data-filter="${c.title}">${c.title}</button>`;
      }
    });

    filterContainer.innerHTML = html;

    // filter click
    filterContainer.addEventListener("click", function (e) {
      if (!e.target.matches(".filter-btn")) return;

      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));

      e.target.classList.add("active");

      const id = e.target.dataset.filter.toLowerCase();
      document
        .querySelectorAll(".category-section")
        .forEach((section) => {
          if (id === "all" || section.id === id + "-section")
            section.style.display = "block";
          else section.style.display = "none";
        });
    });
  }

  // =============================
  // CART LOGIC
  // =============================

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

      let html = "";
      cart.forEach((i) => {
        html += `
        <div class="sidebar-item">
          <img src="${i.imageUrl}" alt="${i.title}">
          <div class="sidebar-item-info">
            <div>${i.title}</div>
            <div>${i.price} ${i.currency}</div>
          </div>
          <div class="sidebar-item-actions">
            <button class="quantity-btn decrease-qty" data-id="${i.id}">-</button>
            <span>${i.quantity}</span>
            <button class="quantity-btn increase-qty" data-id="${i.id}">+</button>
          </div>
        </div>`;
      });

      cartBody.innerHTML = html;
    }

    cartTotal.textContent =
      cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2) + " DH";

    localStorage.setItem("eventSushiCart", JSON.stringify(cart));
  }

  // quantity editor
  document.addEventListener("click", function (e) {
    if (e.target.classList.contains("increase-qty")) {
      const id = e.target.dataset.id;
      const item = cart.find((i) => i.id === id);
      item.quantity++;
      updateCartUI();
    }
    if (e.target.classList.contains("decrease-qty")) {
      const id = e.target.dataset.id;
      const item = cart.find((i) => i.id === id);
      item.quantity--;
      if (item.quantity <= 0)
        cart = cart.filter((x) => x.id !== id);
      updateCartUI();
    }
  });

  // =============================
  // WISHLIST
  // =============================
  function toggleWishlistItem(id, force) {
    const item = allProducts.find((x) => x.id === id);
    if (!item) return;

    const index = wishlist.findIndex((x) => x.id === id);

    if (force === "remove" || index !== -1) {
      wishlist.splice(index, 1);
    } else {
      wishlist.push(item);
    }

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
          <button class='add-to-cart-from-wishlist-btn' data-id='${i.id}'>
            <i class="bi bi-cart-plus"></i>
          </button>
          <button class='remove-from-wishlist-btn' data-id='${i.id}'>
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>`
      )
      .join("");

    localStorage.setItem("eventSushiWishlist", JSON.stringify(wishlist));
  }

  // =============================
  // QUICK VIEW
  // =============================
  function openQuickView(id) {
    const p = allProducts.find((x) => x.id === id);
    if (!p) return;

    quickViewTitle.textContent = p.title;
    quickViewImage.src = p.imageUrl;
    quickViewPrice.textContent = p.price + " " + p.currency;
    quickViewDescription.textContent = p.fullDescription;
    quickViewAddToCartBtn.dataset.id = p.id;

    const related = allProducts
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

    relatedProductsGrid.innerHTML = related;
    quickViewModal.classList.add("show");
  }

  // =============================
  // CHECKOUT
  // =============================

  function closePhoneModal() {
    phoneModal.classList.remove("show");
    additionalInfo.style.display = "none";
    $("customerPhone").value = "";
    $("customerName").value = "";
    $("customerEmail").value = "";
    $("customerAddress").value = "";
  }

  function handleCheckout() {
    const phone = $("customerPhone").value.trim();
    const zoneKey = $("deliveryZone").value;

    if (!phone) return alert("Enter phone number");
    if (!zoneKey) return alert("Select delivery zone");

    const zone = DELIVERY_ZONES[zoneKey];

    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + zone.fee;

    let message = `Hello! I'd like to place an order:\n\n`;
    message += cart.map((i) => `${i.quantity}x ${i.title}`).join("\n");
    message += `\n\nSubtotal: ${subtotal} DH`;
    message += `\nDelivery zone: ${zone.name}`;
    message += `\nDelivery fee: ${zone.fee} DH`;
    message += `\nTotal: ${total} DH\n\n`;
    message += `Phone: ${phone}\n`;

    const pm = document.querySelector('input[name="paymentMethod"]:checked').value;

    if (pm === "cash-plus") {
      message += `Payment Method: CASH PLUS\nPay to: ${CASH_PLUS_PHONE}`;
    } else {
      message += `Payment Method: Cash on delivery`;
    }

    const wa = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      message
    )}`;

    window.open(wa, "_blank");

    cart = [];
    localStorage.removeItem("eventSushiCart");
    updateCartUI();
    closePhoneModal();
  }

  // =============================
  // UTILS
  // =============================
  function showNotification(msg) {
    const el = $("notificationToast");
    el.querySelector(".toast-body").textContent = msg;
    new bootstrap.Toast(el, { delay: 2000 }).show();
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

