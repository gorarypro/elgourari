document.addEventListener('DOMContentLoaded', function() {
  "use strict";

  // --- Configuration ---
  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyp10uQxfT9J4U_4fmrKYA29iyrxgDVMWR2Q5TlM-jCUwD1aiond0MKHt5zKW9vTf2w5w/exec';

  const CASH_PLUS_DISPLAY_PHONE = "0664070513";   // Text shown for Cash Plus
  const WHATSAPP_NUMBER = "212664070513";        // For wa.me (no +, no leading 0)

  // Delivery zones (must match <option value=""> in theme.xml)
  const DELIVERY_ZONES = {
    'casablanca-center': { name: 'Casablanca Center',   fee: 0  },
    'casablanca-nearby': { name: 'Casablanca Nearby',   fee: 15 },
    'casablanca-far':    { name: 'Greater Casablanca',  fee: 25 }
  };

  // --- Global State ---
  let cart = [];
  let wishlist = [];
  let allProducts = [];

  // --- DOM Helper ---
  const $id = (id) => document.getElementById(id);

  // --- DOM Elements ---
  const menuSections          = $id('menuSections');
  const loadingContainer      = $id('loadingContainer');
  const errorContainer        = $id('errorContainer');
  const retryBtn              = $id('retryBtn');
  const filterContainer       = $id('filterContainer');
  const sidebarOverlay        = $id('sidebarOverlay');

  // Cart
  const cartSidebar           = $id('cartSidebar');
  const closeCartBtn          = $id('closeCart');
  const cartBody              = $id('cartBody');
  const cartTotal             = $id('cartTotal');
  const cartFooter            = $id('cartFooter');
  const emptyCartMessage      = $id('emptyCartMessage');
  const cartIcon              = $id('cartIcon');
  const floatingCart          = $id('floatingCart');
  const cartCountNav          = $id('cartCount');
  const floatingCartCount     = $id('floatingCartCount');
  const checkoutBtn           = $id('checkoutBtn');

  // Wishlist
  const wishlistSidebar       = $id('wishlistSidebar');
  const closeWishlistBtn      = $id('closeWishlist');
  const wishlistBody          = $id('wishlistBody');
  const emptyWishlistMessage  = $id('emptyWishlistMessage');
  const wishlistIcon          = $id('wishlistIcon');
  const floatingWishlist      = $id('floatingWishlist');
  const wishlistCountNav      = $id('wishlistCount');
  const floatingWishlistCount = $id('floatingWishlistCount');

  // Quick View
  const quickViewModal        = $id('quickViewModal');
  const closeQuickViewBtn     = $id('closeQuickView');
  const quickViewTitle        = $id('quickViewTitle');
  const quickViewImage        = $id('quickViewImage');
  const quickViewPrice        = $id('quickViewPrice');
  const quickViewDescription  = $id('quickViewDescription');
  const quickViewAddToCartBtn = $id('quickViewAddToCartBtn');
  const relatedProductsGrid   = $id('relatedProductsGrid');

  // Checkout Modal
  const phoneModal            = $id('phoneModal');
  const cancelCheckout        = $id('cancelCheckout');
  const confirmCheckout       = $id('confirmCheckout');
  const noThanksBtn           = $id('noThanksBtn');
  const addInfoBtn            = $id('addInfoBtn');
  const additionalInfo        = $id('additionalInfo');
  const deliveryZoneSelect    = $id('deliveryZone');
  const paymentMethodDelivery = $id('paymentMethodDelivery');
  const paymentMethodCashPlus = $id('paymentMethodCashPlus');
  const cashPlusInfo          = $id('cashPlusInfo');

  // Notification toast
  const notificationToast     = $id('notificationToast');

  // JSONP menu handler (called by Apps Script)
  window.handleMenuResponse = function(data) {
    try {
      if (data.error) throw new Error(`Apps Script error: ${data.error}`);

      allProducts = data.flatMap(cat => cat.posts || []);

      generateMenuHTML(data);
      populateFilterButtons(data);
      initializeFilters();
      initializeCart();
      initializeWishlist();
      initializeQuickView();

      if (loadingContainer) loadingContainer.style.display = 'none';
      if (menuSections) menuSections.style.display = 'block';
    } catch (err) {
      console.error('Error processing menu data:', err);
      showError(err.message);
    }
  };

  // --- Fetch menu with JSONP ---
  function fetchMenuData() {
    if (loadingContainer) {
      loadingContainer.style.display = 'flex';
    }
    if (errorContainer) errorContainer.style.display = 'none';
    if (menuSections) menuSections.style.display = 'none';

    const oldScript = $id('jsonp-menu-script');
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = 'jsonp-menu-script';
    script.src = `${WEB_APP_URL}?action=getMenu&callback=handleMenuResponse&v=${Date.now()}`;
    script.onerror = function() {
      showError(
        'A network error occurred. Please check:\n' +
        '1. Your internet connection.\n' +
        '2. Apps Script URL.\n' +
        '3. That the script is deployed for "Anyone".'
      );
    };
    document.body.appendChild(script);
  }

  function showError(message) {
    if (!errorContainer) return;
    const msgEl = errorContainer.querySelector('.error-message');
    if (msgEl) msgEl.textContent = message;
    if (loadingContainer) loadingContainer.style.display = 'none';
    errorContainer.style.display = 'block';
  }

  function populateFilterButtons(categories) {
    if (!filterContainer) return;
    filterContainer.innerHTML = '<button class="filter-btn active" data-filter="all">All</button>';
    categories.forEach(category => {
      if (category.posts && category.posts.length > 0) {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.setAttribute('data-filter', category.title);
        btn.textContent = category.title;
        btn.style.borderColor = `var(--${category.color}-filter)`;
        btn.style.color = `var(--${category.color}-filter)`;
        filterContainer.appendChild(btn);
      }
    });
  }

  // --- Build menu from JSON ---
  function generateMenuHTML(categories) {
    if (!menuSections) return;
    let sectionsHTML = '';
    categories.forEach(category => {
      if (!category.posts || category.posts.length === 0) return;
      sectionsHTML += `
        <div class="category-section" id="${category.title.toLowerCase()}-section">
          <div class="category-header ${category.color}">
            <div class="category-icon">${category.icon}</div>
            <h3 class="category-title">${category.title}</h3>
          </div>
          <p class="category-description">${category.description}</p>
          <div class="menu-grid">
            ${category.posts.map(post => `
              <div class="menu-item" data-id="${post.id}" data-category="${post.category}">
                <div class="menu-card">
                  <div class="card-img-container">
                    <img src="${post.imageUrl}" alt="${post.title}"
                         onerror="this.src='https://placehold.co/600x400/fe7301/white?text=Image+Error'">
                    <div class="product-card-overlay">
                      <button class="icon-btn quick-view-btn" data-id="${post.id}" aria-label="Quick View">
                        <i class="bi bi-eye"></i>
                      </button>
                      <button class="icon-btn wishlist-btn" data-id="${post.id}" aria-label="Add to Wishlist">
                        <i class="bi bi-heart"></i>
                      </button>
                    </div>
                    ${post.price > 0 ? `<span class="price-badge">${post.price} ${post.currency}</span>` : ''}
                    ${post.isSpecialOffer ? '<span class="special-offer">Special</span>' : ''}
                  </div>
                  <div class="card-body">
                    <h5 class="card-title">${post.title}</h5>
                    <p class="card-text">${post.shortDescription}</p>
                  </div>
                  <div class="card-footer">
                    <div class="price-tag">${post.price} ${post.currency}</div>
                    <button class="order-btn add-to-cart-btn" data-id="${post.id}">
                      <i class="bi bi-cart-plus"></i>
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });
    menuSections.innerHTML = sectionsHTML;
  }

  // --- Filters ---
  document.addEventListener("click", function(e) {
    if (e.target.matches("#retryBtn")) {
      fetchMenuData();
    }
  });


  function initializeFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const categorySections = document.querySelectorAll('.category-section');
    if (!filterBtns.length || !categorySections.length) return;

    filterBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        filterBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const filter = this.getAttribute('data-filter');

        categorySections.forEach(section => {
          if (filter === 'all') {
            section.style.display = 'block';
          } else {
            if (section.id === `${filter.toLowerCase()}-section`) {
              section.style.display = 'block';
              section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              section.style.display = 'none';
            }
          }
        });

        // update button styles
        filterBtns.forEach(b => {
          b.style.backgroundColor = '';
          b.style.color = '';
          const f = b.getAttribute('data-filter');
          const originalColor = f && f !== 'all'
            ? `var(--${f.toLowerCase()}-filter)`
            : `var(--primary)`;
          b.style.color = originalColor;
        });

        if (filter !== 'all') {
          this.style.backgroundColor = `var(--${filter.toLowerCase()}-filter)`;
          this.style.color = 'white';
        } else {
          this.style.backgroundColor = `var(--primary)`;
          this.style.color = 'white';
        }
      });
    });
  }

  // --- Helper: find product ---
  function getProductById(id) {
    return allProducts.find(p => p.id === id);
  }

  // --- Sidebar helpers ---
  function openSidebar(sidebar) {
    if (!sidebar) return;
    sidebar.classList.add('open');
    if (sidebarOverlay) sidebarOverlay.classList.add('show');
  }

  function closeSidebar(sidebar) {
    if (!sidebar) return;
    sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('show');
  }

  // --- Toast notification ---
  function showNotification(message, type = 'success') {
    if (!notificationToast) return;
    const toastBody = notificationToast.querySelector('.toast-body');
    if (!toastBody) return;

    if (type === 'success') {
      toastBody.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i> ${message}`;
      notificationToast.className = 'toast align-items-center text-white bg-success border-0';
    } else if (type === 'danger') {
      toastBody.innerHTML = `<i class="bi bi-heartbreak-fill me-2"></i> ${message}`;
      notificationToast.className = 'toast align-items-center text-white bg-danger border-0';
    } else {
      toastBody.innerHTML = `<i class="bi bi-info-circle-fill me-2"></i> ${message}`;
      notificationToast.className = 'toast align-items-center text-white bg-secondary border-0';
    }

    if (window.bootstrap && bootstrap.Toast) {
      const toast = new bootstrap.Toast(notificationToast, { autohide: true, delay: 2000 });
      toast.show();
    }
  }

  // =================================================================
  // CART
  // =================================================================
  function initializeCart() {
    cart = JSON.parse(localStorage.getItem('eventSushiCart')) || [];
    updateCartUI();

    if (cartIcon)       cartIcon.addEventListener('click', () => openSidebar(cartSidebar));
    if (floatingCart)   floatingCart.addEventListener('click', () => openSidebar(cartSidebar));
    if (closeCartBtn)   closeCartBtn.addEventListener('click', () => closeSidebar(cartSidebar));
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => {
      closeSidebar(cartSidebar);
      closeSidebar(wishlistSidebar);
    });

    // Add to cart from product cards
    document.body.addEventListener('click', e => {
      const btn = e.target.closest('.add-to-cart-btn');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      addItemToCart(id);
      showNotification('Added to cart!', 'success');
    });

    // Quantity changes in cart
    if (cartBody) {
      cartBody.addEventListener('click', e => {
        const decBtn = e.target.closest('.decrease-qty');
        const incBtn = e.target.closest('.increase-qty');
        if (decBtn) updateQuantity(decBtn.getAttribute('data-id'), -1);
        if (incBtn) updateQuantity(incBtn.getAttribute('data-id'),  1);
      });
    }

    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        if (!cart.length) return;
        closeSidebar(cartSidebar);
        if (phoneModal) phoneModal.classList.add('show');
      });
    }

    // Info toggle
    if (noThanksBtn)  noThanksBtn.addEventListener('click', () => { if (additionalInfo) additionalInfo.style.display = 'none'; });
    if (addInfoBtn)   addInfoBtn.addEventListener('click', () => { if (additionalInfo) additionalInfo.style.display = 'block'; });

    if (cancelCheckout) cancelCheckout.addEventListener('click', closePhoneModal);
    if (confirmCheckout) confirmCheckout.addEventListener('click', handleCheckout);

    // Payment method radio behaviour
    if (paymentMethodDelivery && paymentMethodCashPlus && cashPlusInfo) {
      paymentMethodDelivery.addEventListener('change', () => {
        cashPlusInfo.style.display = 'none';
      });
      paymentMethodCashPlus.addEventListener('change', () => {
        cashPlusInfo.style.display = 'block';
      });
    }
  }

  function addItemToCart(id) {
    const product = getProductById(id);
    if (!product) return;

    const index = cart.findIndex(item => item.id === id);
    if (index !== -1) {
      cart[index].quantity += 1;
    } else {
      cart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
  }

  function updateQuantity(id, change) {
    const index = cart.findIndex(item => item.id === id);
    if (index === -1) return;
    cart[index].quantity += change;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
    updateCartUI();
  }

  function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCountNav)      cartCountNav.textContent      = totalItems;
    if (floatingCartCount) floatingCartCount.textContent = totalItems;

    const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const currency = cart.length ? cart[0].currency : 'DH';
    if (cartTotal) cartTotal.textContent = `${totalPrice.toFixed(2)} ${currency}`;

    if (!cartBody || !emptyCartMessage || !cartFooter) return;

    if (!cart.length) {
      cartBody.innerHTML = '';
      emptyCartMessage.style.display = 'block';
      cartFooter.style.display = 'none';
    } else {
      emptyCartMessage.style.display = 'none';
      cartFooter.style.display = 'block';
      cartBody.innerHTML = cart.map(item => `
        <div class='sidebar-item' data-id='${item.id}'>
          <img src='${item.imageUrl}' alt='${item.title}'>
          <div class='sidebar-item-info'>
            <div class='sidebar-item-title'>${item.title}</div>
            <div class='sidebar-item-price'>${item.price} ${item.currency}</div>
          </div>
          <div class='sidebar-item-actions'>
            <button class='quantity-btn decrease-qty' data-id='${item.id}'>-</button>
            <span>${item.quantity}</span>
            <button class='quantity-btn increase-qty' data-id='${item.id}'>+</button>
          </div>
        </div>
      `).join('');
    }

    localStorage.setItem('eventSushiCart', JSON.stringify(cart));
  }

  function closePhoneModal() {
    if (phoneModal) phoneModal.classList.remove('show');
    if (additionalInfo) additionalInfo.style.display = 'none';

    const customerPhone   = $id('customerPhone');
    const customerName    = $id('customerName');
    const customerEmail   = $id('customerEmail');
    const customerAddress = $id('customerAddress');

    if (customerPhone)   customerPhone.value = '';
    if (customerName)    customerName.value = '';
    if (customerEmail)   customerEmail.value = '';
    if (customerAddress) customerAddress.value = '';

    if (paymentMethodDelivery) paymentMethodDelivery.checked = true;
    if (cashPlusInfo) cashPlusInfo.style.display = 'none';
  }

  let isProcessingCheckout = false;

  function handleCheckout() {
    if (isProcessingCheckout) return;
    if (!cart.length) return;

    const phoneInput   = $id('customerPhone');
    const nameInput    = $id('customerName');
    const emailInput   = $id('customerEmail');
    const addressInput = $id('customerAddress');

    const phone = phoneInput ? phoneInput.value.trim() : '';
    if (!phone) {
      alert('Please enter your phone number');
      return;
    }

    if (!deliveryZoneSelect || !deliveryZoneSelect.value) {
      alert('Please select your delivery zone');
      return;
    }

    const zoneKey = deliveryZoneSelect.value;
    const zone = DELIVERY_ZONES[zoneKey];
    if (!zone) {
      alert('Invalid delivery zone selected');
      return;
    }

    const paymentMethodInput = document.querySelector('input[name="paymentMethod"]:checked');
    if (!paymentMethodInput) {
      alert('Please select a payment method');
      return;
    }
    const paymentMethod = paymentMethodInput.value; // 'delivery' or 'cash-plus'

    isProcessingCheckout = true;

    const checkoutButtonText = $id('checkoutButtonText');
    const checkoutLoading    = $id('checkoutLoading');
    if (checkoutButtonText) checkoutButtonText.style.display = 'none';
    if (checkoutLoading)    checkoutLoading.style.display    = 'inline-block';

    const subtotal   = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = zone.fee;
    const grandTotal = subtotal + deliveryFee;
    const currency   = cart.length ? cart[0].currency : 'DH';
    const orderDetails = cart.map(item => `${item.quantity}x ${item.title}`).join(', ');

    const orderData = {
      phone: phone,
      name:    nameInput    && nameInput.value.trim()    ? nameInput.value.trim()    : 'Not provided',
      email:   emailInput   && emailInput.value.trim()   ? emailInput.value.trim()   : 'Not provided',
      address: addressInput && addressInput.value.trim() ? addressInput.value.trim() : 'Not provided',
      orderDetails:    orderDetails,
      subtotal:        `${subtotal.toFixed(2)} ${currency}`,
      deliveryFee:     `${deliveryFee.toFixed(2)} ${currency}`,
      totalAmount:     `${grandTotal.toFixed(2)} ${currency}`,
      deliveryZoneName: zone.name,
      paymentMethod:    paymentMethod
    };

    const callbackName = 'handleOrderResponse_' + Date.now();
    window[callbackName] = function(response) {
      if (response && response.status === 'success') {
        handleOrderSuccess(orderData);
      } else {
        console.error('Checkout error:', response && response.message);
        alert('There was an error placing your order. Please try again.');
        resetCheckoutButton();
      }
      delete window[callbackName];
      const script = $id('jsonp-order-script');
      if (script) script.remove();
    };

    const oldScript = $id('jsonp-order-script');
    if (oldScript) oldScript.remove();

    let params = `action=saveOrder&callback=${callbackName}`;
    Object.keys(orderData).forEach(key => {
      params += `&${encodeURIComponent(key)}=${encodeURIComponent(orderData[key])}`;
    });

    const script = document.createElement('script');
    script.id = 'jsonp-order-script';
    script.src = `${WEB_APP_URL}?${params}`;
    script.onerror = function() {
      alert('There was a problem processing your order. Please check your internet connection and try again.');
      resetCheckoutButton();
      delete window[callbackName];
      script.remove();
    };
    document.body.appendChild(script);
  }

  function resetCheckoutButton() {
    const checkoutButtonText = $id('checkoutButtonText');
    const checkoutLoading    = $id('checkoutLoading');
    if (checkoutButtonText) checkoutButtonText.style.display = 'inline';
    if (checkoutLoading)    checkoutLoading.style.display    = 'none';
    isProcessingCheckout = false;
  }

  function handleOrderSuccess(orderData) {
    showNotification('Order placed! Redirecting to WhatsApp...', 'success');

    let message = `Hello! I'd like to place an order for the following items:\n\n${orderData.orderDetails}\n\n`;
    message += `Subtotal: ${orderData.subtotal}\n`;
    message += `Delivery zone: ${orderData.deliveryZoneName}\n`;
    message += `Delivery fee: ${orderData.deliveryFee}\n`;
    message += `Total: ${orderData.totalAmount}\n\n`;

    message += `My details:\nPhone: ${orderData.phone}`;
    if (orderData.name   !== 'Not provided') message += `\nName: ${orderData.name}`;
    if (orderData.email  !== 'Not provided') message += `\nEmail: ${orderData.email}`;
    if (orderData.address!== 'Not provided') message += `\nAddress: ${orderData.address}`;

    if (orderData.paymentMethod === 'delivery') {
      message += `\n\nPayment method: Payment at delivery (cash).`;
    } else if (orderData.paymentMethod === 'cash-plus') {
      message += `\n\nPayment method: CASH PLUS.\nPlease pay to this number: ${CASH_PLUS_DISPLAY_PHONE}.`;
    }

    message += `\n\nPlease confirm my order. Thank you!`;

    setTimeout(() => {
      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

      cart = [];
      localStorage.removeItem('eventSushiCart');
      updateCartUI();
      closePhoneModal();
      resetCheckoutButton();
    }, 1500);
  }

  // =================================================================
  // WISHLIST
  // =================================================================
  function initializeWishlist() {
    wishlist = JSON.parse(localStorage.getItem('eventSushiWishlist')) || [];
    updateWishlistUI();

    if (wishlistIcon)    wishlistIcon.addEventListener('click', () => openSidebar(wishlistSidebar));
    if (floatingWishlist)floatingWishlist.addEventListener('click', () => openSidebar(wishlistSidebar));
    if (closeWishlistBtn)closeWishlistBtn.addEventListener('click', () => closeSidebar(wishlistSidebar));

    // Heart icon on product cards
    document.body.addEventListener('click', e => {
      const btn = e.target.closest('.wishlist-btn');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      toggleWishlistItem(id);
    });

    if (wishlistBody) {
      wishlistBody.addEventListener('click', e => {
        const removeBtn = e.target.closest('.remove-from-wishlist-btn');
        const addBtn    = e.target.closest('.add-to-cart-from-wishlist-btn');

        if (removeBtn) {
          const id = removeBtn.getAttribute('data-id');
          toggleWishlistItem(id, 'remove');
        }
        if (addBtn) {
          const id = addBtn.getAttribute('data-id');
          addItemToCart(id);
          showNotification('Added to cart!', 'success');
        }
      });
    }
  }

  function toggleWishlistItem(id, forceAction = null) {
    const product = getProductById(id);
    if (!product) return;

    const index = wishlist.findIndex(item => item.id === id);
    if (forceAction === 'remove' || index !== -1) {
      if (index !== -1) wishlist.splice(index, 1);
      if (forceAction !== 'remove') showNotification('Removed from wishlist', 'danger');
    } else {
      wishlist.push(product);
      showNotification('Added to wishlist!', 'info');
    }
    updateWishlistUI();
  }

  function updateWishlistUI() {
    const totalItems = wishlist.length;
    if (wishlistCountNav)      wishlistCountNav.textContent      = totalItems;
    if (floatingWishlistCount) floatingWishlistCount.textContent = totalItems;

    // Update heart icons
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
      const id = btn.getAttribute('data-id');
      const icon = btn.querySelector('i');
      const active = wishlist.some(item => item.id === id);
      if (!icon) return;
      if (active) {
        btn.classList.add('active');
        icon.classList.remove('bi-heart');
        icon.classList.add('bi-heart-fill');
      } else {
        btn.classList.remove('active');
        icon.classList.remove('bi-heart-fill');
        icon.classList.add('bi-heart');
      }
    });

    if (!wishlistBody || !emptyWishlistMessage) return;

    if (!wishlist.length) {
      wishlistBody.innerHTML = '';
      emptyWishlistMessage.style.display = 'block';
    } else {
      emptyWishlistMessage.style.display = 'none';
      wishlistBody.innerHTML = wishlist.map(item => `
        <div class='sidebar-item' data-id='${item.id}'>
          <img src='${item.imageUrl}' alt='${item.title}'>
          <div class='sidebar-item-info'>
            <div class='sidebar-item-title'>${item.title}</div>
            <div class='sidebar-item-price'>${item.price} ${item.currency}</div>
          </div>
          <div class='sidebar-item-actions'>
            <button class='add-to-cart-from-wishlist-btn add-to-cart-btn' data-id='${item.id}' aria-label="Add to Cart">
              <i class="bi bi-cart-plus"></i>
            </button>
            <button class='remove-from-wishlist-btn' data-id='${item.id}' aria-label="Remove from Wishlist">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `).join('');
    }

    localStorage.setItem('eventSushiWishlist', JSON.stringify(wishlist));
  }

  // =================================================================
  // QUICK VIEW
  // =================================================================
  function initializeQuickView() {
    if (!menuSections) return;

    menuSections.addEventListener('click', e => {
      const btn = e.target.closest('.quick-view-btn');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      openQuickView(id);
    });

    if (closeQuickViewBtn && quickViewModal) {
      closeQuickViewBtn.addEventListener('click', () => quickViewModal.classList.remove('show'));
    }

    if (quickViewAddToCartBtn) {
      quickViewAddToCartBtn.addEventListener('click', function() {
        const id = this.getAttribute('data-id');
        addItemToCart(id);
        showNotification('Added to cart!', 'success');
        if (quickViewModal) quickViewModal.classList.remove('show');
      });
    }
  }

  function openQuickView(id) {
    const product = getProductById(id);
    if (!product || !quickViewModal) return;

    if (quickViewTitle)       quickViewTitle.textContent       = product.title;
    if (quickViewImage)       quickViewImage.src               = product.imageUrl;
    if (quickViewPrice)       quickViewPrice.textContent       = `${product.price} ${product.currency}`;
    if (quickViewDescription) quickViewDescription.textContent = product.fullDescription || product.shortDescription || '';
    if (quickViewAddToCartBtn) quickViewAddToCartBtn.setAttribute('data-id', product.id);

    if (relatedProductsGrid) {
      const related = allProducts
        .filter(p => p.category === product.category && p.id !== product.id)
        .slice(0, 4);

      if (related.length) {
        relatedProductsGrid.innerHTML = related.map(item => `
          <div class="related-item">
            <img src="${item.imageUrl}" alt="${item.title}"
                 onerror="this.src='https://placehold.co/100x80/fe7301/white?text=No+Image'">
            <div class="related-item-title">${item.title}</div>
          </div>
        `).join('');
        relatedProductsGrid.parentElement.style.display = 'block';
      } else {
        relatedProductsGrid.parentElement.style.display = 'none';
      }
    }

    quickViewModal.classList.add('show');
  }

  // --- Start App ---
  fetchMenuData();
});
