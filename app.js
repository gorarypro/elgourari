document.addEventListener('DOMContentLoaded', function() {
  
  // --- Configuration ---
  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyp10uQxfT9J4U_4fmrKYA29iyrxgDVMWR2Q5TlM-jCUwD1aiond0MKHt5zKW9vTf2w5w/exec';
  const WHATSAPP_NUMBER = "212664070513"; // Your WhatsApp number
  const CASH_PLUS_PHONE = "0664070513"; // Your Cash Plus number

  const DELIVERY_ZONES = {
    "casablanca-center": { name: "Casablanca Center", fee: 0 },
    "casablanca-nearby": { name: "Casablanca Nearby", fee: 15 },
    "casablanca-far": { name: "Greater Casablanca", fee: 25 }
  };

  // --- Global State ---
  let cart = [];
  let wishlist = [];
  let allProducts = []; // To store all products for quick lookup

  // --- DOM Elements ---
  const menuSections = document.getElementById('menuSections');
  const loadingContainer = document.getElementById('loadingContainer');
  const errorContainer = document.getElementById('errorContainer');
  const retryBtn = document.getElementById('retryBtn');
  const filterContainer = document.getElementById('filterContainer');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  // Cart DOM
  const cartSidebar = document.getElementById('cartSidebar');
  const closeCartBtn = document.getElementById('closeCart');
  const cartBody = document.getElementById('cartBody');
  const cartTotal = document.getElementById('cartTotal');
  const cartFooter = document.getElementById('cartFooter');
  const emptyCartMessage = document.getElementById('emptyCartMessage');
  const cartIcon = document.getElementById('cartIcon');
  const floatingCart = document.getElementById('floatingCart');
  const cartCountNav = document.getElementById('cartCount');
  const floatingCartCount = document.getElementById('floatingCartCount');
  const checkoutBtn = document.getElementById('checkoutBtn');

  // Wishlist DOM
  const wishlistSidebar = document.getElementById('wishlistSidebar');
  const closeWishlistBtn = document.getElementById('closeWishlist');
  const wishlistBody = document.getElementById('wishlistBody');
  const emptyWishlistMessage = document.getElementById('emptyWishlistMessage');
  const wishlistIcon = document.getElementById('wishlistIcon');
  const floatingWishlist = document.getElementById('floatingWishlist');
  const wishlistCountNav = document.getElementById('wishlistCount');
  const floatingWishlistCount = document.getElementById('floatingWishlistCount');

  // Quick View Modal DOM
  const quickViewModal = document.getElementById('quickViewModal');
  const closeQuickViewBtn = document.getElementById('closeQuickView');
  const quickViewTitle = document.getElementById('quickViewTitle');
  const quickViewImage = document.getElementById('quickViewImage');
  const quickViewPrice = document.getElementById('quickViewPrice');
  const quickViewDescription = document.getElementById('quickViewDescription');
  const quickViewAddToCartBtn = document.getElementById('quickViewAddToCartBtn');
  const relatedProductsGrid = document.getElementById('relatedProductsGrid');

  // Phone Modal DOM
  const phoneModal = document.getElementById('phoneModal');
  const cancelCheckout = document.getElementById('cancelCheckout');
  const confirmCheckout = document.getElementById('confirmCheckout');
  const noThanksBtn = document.getElementById('noThanksBtn');
  const addInfoBtn = document.getElementById('addInfoBtn');
  const additionalInfo = document.getElementById('additionalInfo');

  // --- Global function to handle menu data response ---
  window.handleMenuResponse = function(data) {
    try {
      if (!data || data.error) {
        throw new Error(data.error || `Invalid menu data received.`);
      }
      
      // Store all products in a flat array for easy lookup
      allProducts = data.flatMap(category => category.posts);

      // 1. Generate the HTML from the clean data
      generateMenuHTML(data);
      
      // 2. Populate filter buttons from the data
      populateFilterButtons(data);

      // 3. Initialize core functionalities
      initializeFilters();
      initializeCart();
      initializeWishlist();
      initializeQuickView();
      
      // Show the menu
      if(loadingContainer) loadingContainer.style.display = 'none';
      if(menuSections) menuSections.style.display = 'block';

    } catch (error) {
      console.error('Error processing menu data:', error);
      showError(error.message);
    }
  }

  /**
   * Fetches the menu data using the JSONP (script tag) method.
   */
  function fetchMenuData() {
    if(loadingContainer) loadingContainer.style.display = 'flex';
    if(errorContainer) errorContainer.style.display = 'none';
    if(menuSections) menuSections.style.display = 'none';

    const oldScript = document.getElementById('jsonp-menu-script');
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = 'jsonp-menu-script';
    script.src = `${WEB_APP_URL}?action=getMenu&callback=handleMenuResponse&v=${new Date().getTime()}`;
    
    script.onerror = function() {
      showError(`A network error occurred. Please check: \n1. Your internet connection. \n2. That the Apps Script URL is correct. \n3. That the script is deployed for "Anyone".`);
    };
    
    document.body.appendChild(script);
  }

  function showError(message) {
    if(errorContainer) {
        const errorMsgEl = errorContainer.querySelector('.error-message');
        if (errorMsgEl) {
            errorMsgEl.textContent = message;
        }
        errorContainer.style.display = 'block';
    }
    if(loadingContainer) loadingContainer.style.display = 'none';
  }

  function populateFilterButtons(categories) {
      if (!filterContainer) return;
      filterContainer.innerHTML = '<button class="filter-btn active" data-filter="all">All</button>';
      categories.forEach(category => {
          if (category.posts.length > 0) {
              const btn = document.createElement('button');
              btn.className = 'filter-btn';
              btn.setAttribute('data-filter', category.title);
              btn.textContent = category.title;
              // Set border/color based on category style
              const filterColor = `var(--${category.color}-filter, var(--primary))`;
              btn.style.borderColor = filterColor;
              btn.style.color = filterColor;
              filterContainer.appendChild(btn);
          }
      });
  }

  /**
   * Generates the menu HTML from the processed JSON data.
   */
  function generateMenuHTML(categories) {
    if (!menuSections) return;
    let sectionsHTML = '';
    categories.forEach(category => {
      if (category.posts.length > 0) {
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
                      <img src="${post.imageUrl}" alt="${post.title}" onerror="this.src='https://placehold.co/600x400/fe7301/white?text=Image+Error'">
                      
                      <!-- NEW: Overlay for Quick View / Wishlist -->
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
      }
    });
    menuSections.innerHTML = sectionsHTML;
  }
  
  if (retryBtn) retryBtn.addEventListener('click', fetchMenuData);
  
  function initializeFilters() {
    if (!filterContainer) return;
    
    filterContainer.addEventListener('click', function(e) {
      if (!e.target.matches('.filter-btn')) return;

      const btn = e.target;
      const filter = btn.getAttribute('data-filter');
      
      // Update button active state
      filterContainer.querySelectorAll('.filter-btn').forEach(b => {
          b.classList.remove('active');
          // Reset styles
          b.style.backgroundColor = '';
          const filterName = b.getAttribute('data-filter');
          const originalColor = filterName ? `var(--${filterName.toLowerCase()}-filter, var(--primary))` : `var(--primary)`;
          
          if (filterName !== 'all') {
              b.style.color = originalColor;
              b.style.borderColor = originalColor;
          } else {
              b.style.color = `var(--primary)`;
              b.style.borderColor = `var(--primary)`;
          }
      });
      
      // Apply active style to clicked button
      if (filter !== 'all') {
          const activeColor = filter ? `var(--${filter.toLowerCase()}-filter, var(--primary))` : `var(--primary)`;
          btn.style.backgroundColor = activeColor;
          btn.style.borderColor = activeColor;
          btn.style.color = 'white';
      } else {
          btn.style.backgroundColor = `var(--primary)`;
          btn.style.borderColor = `var(--primary)`;
          btn.style.color = 'white';
      }
      btn.classList.add('active');

      // Filter sections
      document.querySelectorAll('.category-section').forEach(section => {
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
    });
  }

  // --- Helper function to find a product by its ID ---
  function getProductById(id) {
    return allProducts.find(p => p.id === id);
  }

  // --- Show/Hide Sidebar Overlay ---
  function openSidebar(sidebar) {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarOverlay) sidebarOverlay.classList.add('show');
  }

  function closeSidebar(sidebar) {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('show');
  }

  // --- Show Notification Toast ---
  function showNotification(message, type = 'success') {
    const toastEl = document.getElementById('notificationToast');
    if (!toastEl || typeof bootstrap === 'undefined' || !bootstrap.Toast) {
        console.warn('Toast element or Bootstrap JS not found.');
        return;
    }
    const toastBody = toastEl.querySelector('.toast-body');
    if (!toastBody) return;
    
    // Set message and icon
    if (type === 'success') {
        toastBody.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i> ${message}`;
        toastEl.className = 'toast align-items-center text-white bg-success border-0';
    } else if (type === 'danger') {
        toastBody.innerHTML = `<i class="bi bi-heartbreak-fill me-2"></i> ${message}`;
        toastEl.className = 'toast align-items-center text-white bg-danger border-0';
    } else {
        toastBody.innerHTML = `<i class="bi bi-info-circle-fill me-2"></i> ${message}`;
        toastEl.className = 'toast align-items-center text-white bg-info border-0';
    }
    
    const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { autohide: true, delay: 2000 });
    toast.show();
  }

  /**
   * =================================================================
   * CART LOGIC
   * =================================================================
   */
  function initializeCart() {
    cart = JSON.parse(localStorage.getItem('eventSushiCart')) || [];
    updateCartUI();

    // Event Listeners
    if (cartIcon) cartIcon.addEventListener('click', () => openSidebar(cartSidebar));
    if (floatingCart) floatingCart.addEventListener('click', () => openSidebar(cartSidebar));
    if (closeCartBtn) closeCartBtn.addEventListener('click', () => closeSidebar(cartSidebar));
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => {
        closeSidebar(cartSidebar);
        closeSidebar(wishlistSidebar);
    });

    // Add to Cart (Event Delegation for all buttons)
    document.body.addEventListener('click', e => {
      const btn = e.target.closest('.add-to-cart-btn');
      if (btn) {
        const id = btn.getAttribute('data-id');
        addItemToCart(id);
        showNotification('Added to cart!');
      }
    });

    // Handle clicks inside cart body
    if (cartBody) cartBody.addEventListener('click', e => {
      const decreaseBtn = e.target.closest('.decrease-qty');
      const increaseBtn = e.target.closest('.increase-qty');
      if (decreaseBtn) {
        updateQuantity(decreaseBtn.getAttribute('data-id'), -1);
      }
      if (increaseBtn) {
        updateQuantity(increaseBtn.getAttribute('data-id'), 1);
      }
    });

    if (checkoutBtn) checkoutBtn.addEventListener('click', () => {
      if (cart.length === 0) return;
      closeSidebar(cartSidebar);
      if (phoneModal) phoneModal.classList.add('show');
    });

    // Phone modal listeners
    if (noThanksBtn) noThanksBtn.addEventListener('click', () => { if (additionalInfo) additionalInfo.style.display = 'none' });
    if (addInfoBtn) addInfoBtn.addEventListener('click', () => { if (additionalInfo) additionalInfo.style.display = 'block' });
    if (cancelCheckout) cancelCheckout.addEventListener('click', closePhoneModal);
    if (confirmCheckout) confirmCheckout.addEventListener('click', handleCheckout);
  }

  function addItemToCart(id) {
    const product = getProductById(id);
    if (!product) return;

    const existingItemIndex = cart.findIndex(item => item.id === id);
    if (existingItemIndex !== -1) {
      cart[existingItemIndex].quantity += 1;
    } else {
      cart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
  }

  function updateQuantity(id, change) {
    const itemIndex = cart.findIndex(item => item.id === id);
    if (itemIndex !== -1) {
      cart[itemIndex].quantity += change;
      if (cart[itemIndex].quantity <= 0) {
        cart.splice(itemIndex, 1);
      }
      updateCartUI();
    }
  }

  function updateCartUI() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    if (cartCountNav) cartCountNav.textContent = totalItems;
    if (floatingCartCount) floatingCartCount.textContent = totalItems;
    
    const totalPrice = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    if (cartTotal) cartTotal.textContent = `${totalPrice.toFixed(2)} ${cart.length > 0 ? cart[0].currency : 'DH'}`;
    
    if (cart.length === 0) {
      if (cartBody) cartBody.innerHTML = ''; // Clear items
      if (emptyCartMessage) emptyCartMessage.style.display = 'block';
      if (cartFooter) cartFooter.style.display = 'none';
    } else {
      if (emptyCartMessage) emptyCartMessage.style.display = 'none';
      if (cartFooter) cartFooter.style.display = 'block';
      let cartHTML = '';
      cart.forEach(item => {
        cartHTML += `
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
        `;
      });
      if (cartBody) cartBody.innerHTML = cartHTML;
    }
    localStorage.setItem('eventSushiCart', JSON.stringify(cart));
  }
  
  function closePhoneModal() {
    if (phoneModal) phoneModal.classList.remove('show');
    if (additionalInfo) additionalInfo.style.display = 'none';
    const phoneEl = document.getElementById('customerPhone');
    const nameEl = document.getElementById('customerName');
    const emailEl = document.getElementById('customerEmail');
    const addressEl = document.getElementById('customerAddress');
    const zoneEl = document.getElementById('deliveryZone');
    const paymentEl = document.getElementById('paymentMethodDelivery');

    if (phoneEl) phoneEl.value = '';
    if (nameEl) nameEl.value = '';
    if (emailEl) emailEl.value = '';
    if (addressEl) addressEl.value = '';
    if (zoneEl) zoneEl.selectedIndex = 0;
    if (paymentEl) paymentEl.checked = true;
  }

  let isProcessingCheckout = false;

  function handleCheckout() {
    if (isProcessingCheckout) return;

    const phone = document.getElementById('customerPhone')?.value;
    const zoneKey = document.getElementById('deliveryZone')?.value;
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    
    if (!phone || !/^\+?[0-9\s-]{8,}$/.test(phone)) {
        return alert("Please enter a valid phone number.");
    }
    if (!zoneKey) {
        return alert("Please select a delivery zone.");
    }
    
    const zone = DELIVERY_ZONES[zoneKey];
    if (!zone) {
        return alert("Invalid delivery zone selected.");
    }

    isProcessingCheckout = true;
    const btnText = document.getElementById('checkoutButtonText');
    const btnLoading = document.getElementById('checkoutLoading');
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'inline-block';
    
    const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const totalAmount = subtotal + zone.fee;
    const orderDetails = cart.map(item => `${item.quantity}x ${item.title}`).join(', ');
    const currency = cart.length > 0 ? cart[0].currency : 'DH';
    
    const orderData = {
      phone: phone,
      name: document.getElementById('customerName')?.value || 'Not provided',
      email: document.getElementById('customerEmail')?.value || 'Not provided',
      address: document.getElementById('customerAddress')?.value || 'Not provided',
      orderDetails: orderDetails,
      totalAmount: `${totalAmount.toFixed(2)} ${currency}`,
      subtotal: `${subtotal.toFixed(2)} ${currency}`,
      deliveryZoneName: zone.name,
      deliveryFee: `${zone.fee.toFixed(2)} ${currency}`,
      paymentMethod: paymentMethod
    };

    const callbackName = 'handleOrderResponse' + new Date().getTime();

    window[callbackName] = function(response) {
      if (response.status === 'success') {
        handleOrderSuccess(orderData);
      } else {
        console.error('Checkout error:', response.message);
        alert('There was an error placing your order. Please try again.');
        resetCheckoutButton();
      }
      // Clean up global function and script tag
      try {
        delete window[callbackName];
      } catch(e) {
        window[callbackName] = undefined; // fallback
      }
      const script = document.getElementById('jsonp-order-script');
      if (script) script.remove();
    };

    const oldScript = document.getElementById('jsonp-order-script');
    if (oldScript) oldScript.remove();

    let params = `action=saveOrder&callback=${callbackName}`;
    for (const key in orderData) {
      params += `&${encodeURIComponent(key)}=${encodeURIComponent(orderData[key])}`;
    }

    const script = document.createElement('script');
    script.id = 'jsonp-order-script';
    script.src = `${WEB_APP_URL}?${params}`;
    
    script.onerror = function() {
      alert('There was a problem proceeding your order. Please check your internet connection and try again.');
      resetCheckoutButton();
      try {
        delete window[callbackName];
      } catch(e) {
        window[callbackName] = undefined;
      }
      script.remove();
    };
    
    document.body.appendChild(script);
  }

  function resetCheckoutButton() {
    const btnText = document.getElementById('checkoutButtonText');
    const btnLoading = document.getElementById('checkoutLoading');
    if (btnText) btnText.style.display = 'inline';
    if (btnLoading) btnLoading.style.display = 'none';
    isProcessingCheckout = false;
  }

  function handleOrderSuccess(orderData) {
    showNotification('Order placed! Redirecting to WhatsApp...', 'success');
    
    let message = `Hello! I'd like to place an order for the following items:\n\n${orderData.orderDetails}\n\n`;
    message += `Subtotal: ${orderData.subtotal}\n`;
    message += `Delivery Zone: ${orderData.deliveryZoneName}\n`;
    message += `Delivery Fee: ${orderData.deliveryFee}\n`;
    message += `------------------\n`;
    message += `Total: ${orderData.totalAmount}\n\n`;
    message += `My details:\nPhone: ${orderData.phone}`;
    if (orderData.name !== 'Not provided') message += `\nName: ${orderData.name}`;
    if (orderData.address !== 'Not provided') message += `\nAddress: ${orderData.address}`;
    
    if (orderData.paymentMethod === 'cash-plus') {
      message += `\nPayment Method: CASH PLUS (Pay to: ${CASH_PLUS_PHONE})`;
    } else {
      message += `\nPayment Method: Cash on Delivery`;
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
    }, 2000);
  }

  /**
   * =================================================================
   * WISHLIST LOGIC
   * =================================================================
   */
  function initializeWishlist() {
    wishlist = JSON.parse(localStorage.getItem('eventSushiWishlist')) || [];
    updateWishlistUI();

    // Event Listeners
    if (wishlistIcon) wishlistIcon.addEventListener('click', () => openSidebar(wishlistSidebar));
    if (floatingWishlist) floatingWishlist.addEventListener('click', () => openSidebar(wishlistSidebar));
    if (closeWishlistBtn) closeWishlistBtn.addEventListener('click', () => closeSidebar(wishlistSidebar));

    // Add/Remove from Wishlist (Event Delegation)
    document.body.addEventListener('click', e => {
      const btn = e.target.closest('.wishlist-btn');
      if (btn) {
        const id = btn.getAttribute('data-id');
        toggleWishlistItem(id);
      }
    });

    // Handle clicks inside wishlist body
    if (wishlistBody) wishlistBody.addEventListener('click', e => {
      const removeBtn = e.target.closest('.remove-from-wishlist-btn');
      const addBtn = e.target.closest('.add-to-cart-from-wishlist-btn');
      
      if (removeBtn) {
        const id = removeBtn.getAttribute('data-id');
        toggleWishlistItem(id, 'remove');
        showNotification('Removed from wishlist', 'danger');
      }
      
      if (addBtn) {
        const id = addBtn.getAttribute('data-id');
        addItemToCart(id);
        showNotification('Added to cart!', 'success');
        // Optionally remove from wishlist after adding to cart
        // toggleWishlistItem(id, 'remove'); 
      }
    });
  }

  function toggleWishlistItem(id, forceAction = null) {
    const product = getProductById(id);
    if (!product) return;

    const itemIndex = wishlist.findIndex(item => item.id === id);
    
    if (forceAction === 'remove' || itemIndex !== -1) {
      wishlist.splice(itemIndex, 1);
      if (forceAction !== 'remove') showNotification('Removed from wishlist', 'danger');
    } else if (forceAction === 'add' || itemIndex === -1) {
      wishlist.push(product);
      showNotification('Added to wishlist!', 'info');
    }
    
    updateWishlistUI();
  }

  function updateWishlistUI() {
    const totalItems = wishlist.length;
    if (wishlistCountNav) wishlistCountNav.textContent = totalItems;
    if (floatingWishlistCount) floatingWishlistCount.textContent = totalItems;

    // Update heart icons on all product cards
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
      const id = btn.getAttribute('data-id');
      const icon = btn.querySelector('i');
      if (!icon) return;
      
      if (wishlist.some(item => item.id === id)) {
        btn.classList.add('active');
        icon.classList.replace('bi-heart', 'bi-heart-fill');
      } else {
        btn.classList.remove('active');
        icon.classList.replace('bi-heart-fill', 'bi-heart');
      }
    });

    // Update wishlist sidebar
    if (wishlist.length === 0) {
      if (wishlistBody) wishlistBody.innerHTML = ''; // Clear items
      if (emptyWishlistMessage) emptyWishlistMessage.style.display = 'block';
    } else {
      if (emptyWishlistMessage) emptyWishlistMessage.style.display = 'none';
      let wishlistHTML = '';
      wishlist.forEach(item => {
        wishlistHTML += `
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
        `;
      });
      if (wishlistBody) wishlistBody.innerHTML = wishlistHTML;
    }
    
    localStorage.setItem('eventSushiWishlist', JSON.stringify(wishlist));
  }

  /**
   * =================================================================
   * QUICK VIEW LOGIC
   * =================================================================
   */
  function initializeQuickView() {
    // Event Delegation for Quick View buttons
    if (menuSections) menuSections.addEventListener('click', e => {
      const btn = e.target.closest('.quick-view-btn');
      if (btn) {
        const id = btn.getAttribute('data-id');
        openQuickView(id);
      }
    });

    if (closeQuickViewBtn) closeQuickViewBtn.addEventListener('click', () => {
        if (quickViewModal) quickViewModal.classList.remove('show');
    });
    
    // Add to cart from quick view
    if (quickViewAddToCartBtn) quickViewAddToCartBtn.addEventListener('click', function() {
      const id = this.getAttribute('data-id');
      addItemToCart(id);
      showNotification('Added to cart!', 'success');
      if (quickViewModal) quickViewModal.classList.remove('show');
    });
  }

  function openQuickView(id) {
    const product = getProductById(id);
    if (!product) return;

    // 1. Populate Modal Content
    if (quickViewTitle) quickViewTitle.textContent = product.title;
    if (quickViewImage) quickViewImage.src = product.imageUrl;
    if (quickViewPrice) quickViewPrice.textContent = `${product.price} ${product.currency}`;
    if (quickViewDescription) quickViewDescription.textContent = product.fullDescription; // Use fullDescription
    if (quickViewAddToCartBtn) quickViewAddToCartBtn.setAttribute('data-id', product.id);

    // 2. Generate Related Products
    const relatedProducts = allProducts.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
    
    if (relatedProductsGrid) {
        if (relatedProducts.length > 0) {
            relatedProductsGrid.innerHTML = relatedProducts.map(item => `
            <div class="related-item">
                <img src="${item.imageUrl}" alt="${item.title}" onerror="this.src='https://placehold.co/100x80/fe7301/white?text=No+Image'">
                <div class="related-item-title">${item.title}</div>
            </div>
            `).join('');
            if (relatedProductsGrid.parentElement) relatedProductsGrid.parentElement.style.display = 'block';
        } else {
            relatedProductsGrid.innerHTML = '';
            if (relatedProductsGrid.parentElement) relatedProductsGrid.parentElement.style.display = 'none';
        }
    }

    // 3. Show Modal
    if (quickViewModal) quickViewModal.classList.add('show');
  }

  // --- Initial Call to Start the App ---
  fetchMenuData();

}); // End of DOMContentLoaded
