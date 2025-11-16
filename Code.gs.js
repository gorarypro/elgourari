/**
 * =================================================================
 * CONFIGURATION
 * =================================================================
 */
// **IMPORTANT**: 1. Create a Google Sheet. 2. Copy the ID from its URL.
// Example: https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit
const SPREADSHEET_ID = '1e5LpsErDtDD2vD-O0mkzD6u7DS8xnnTfK7Ot5eU0eao'; // <-- PASTE YOUR SHEET ID HERE

// **IMPORTANT**: This is the name of the tab at the bottom of your sheet.
// I recommend renaming "Sheet1" to "Orders".
const SHEET_NAME = 'Orders';

// **IMPORTANT**: This is your Blogger feed URL.
const BLOG_FEED_URL = 'https://eventsushi1.blogspot.com/feeds/posts/default?alt=json&max-results=50';

// **IMPORTANT**: Email address to receive order notifications
const NOTIFICATION_EMAIL = 'gorarypro@gmail.com'; // <-- PASTE YOUR EMAIL ADDRESS HERE

// Cache expiration in seconds (2 hours = 7200 seconds)
const CACHE_EXPIRATION = 7200;


/**
 * =================================================================
 * HELPER FUNCTION - Creates JSONP response
 * This wraps the JSON in a function call to bypass CORS.
 * =================================================================
 */
function createJsonpResponse(data, callback) {
  const jsonpData = `${callback}(${JSON.stringify(data)})`;
  // We use JAVASCRIPT as the MimeType for JSONP
  const output = ContentService.createTextOutput(jsonpData);
  output.setMimeType(ContentService.MimeType.JAVASCRIPT);
  return output;
}

/**
 * =================================================================
 * MAIN GET REQUEST HANDLER (Handles ALL requests)
 * =================================================================
 */
function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback; // Get the callback function name

  if (!callback) {
    // We must have a callback to return JSONP
    return ContentService.createTextOutput("Error: 'callback' parameter is missing.")
      .setMimeType(ContentService.MimeType.TEXT);
  }

  // --- Route 1: Get the Menu ---
  if (action === 'getMenu') {
    try {
      const menuJson = getMenuData();
      return createJsonpResponse(JSON.parse(menuJson), callback);
    } catch (error) {
      Logger.log(`getMenu Error: ${error.message}`);
      return createJsonpResponse({ error: error.message }, callback);
    }
  } 
  
  // --- Route 2: Save an Order ---
  else if (action === 'saveOrder') {
    try {
      const orderData = {
        phone: e.parameter.phone,
        name: e.parameter.name,
        email: e.parameter.email,
        address: e.parameter.address,
        orderDetails: e.parameter.orderDetails,
        totalAmount: e.parameter.totalAmount,
        subtotal: e.parameter.subtotal,
        deliveryZoneName: e.parameter.deliveryZoneName,
        deliveryFee: e.parameter.deliveryFee,
        paymentMethod: e.parameter.paymentMethod
      };
      
      Logger.log(`Received order data: ${JSON.stringify(orderData)}`);
      
      const result = saveOrderToSheet(orderData);
      return createJsonpResponse(result, callback);
    } catch (error) {
      Logger.log(`saveOrder Error: ${error.message}`);
      return createJsonpResponse({ status: 'error', message: error.message }, callback);
    }
  } 
  
  // --- Invalid Action ---
  else {
    return createJsonpResponse({ error: 'Invalid action' }, callback);
  }
}

/**
 * =================================================================
 * SAVE ORDER TO SHEET
 * This function is called by doGet to save the order.
 * =================================================================
 */
function saveOrderToSheet(orderData) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    
    // Add headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp", 
        "Phone", 
        "Name", 
        "Email", 
        "Address", 
        "Order Details", 
        "Total Amount",
        "Delivery Zone",
        "Delivery Fee",
        "Subtotal",
        "Payment Method"
      ]);
    }
    
    const timestamp = new Date();
    
    // Append the new order
    sheet.appendRow([
      timestamp,
      orderData.phone,
      orderData.name,
      orderData.email,
      orderData.address,
      orderData.orderDetails,
      orderData.totalAmount,
      orderData.deliveryZoneName || 'Not provided',
      orderData.deliveryFee || '0',
      orderData.subtotal || orderData.totalAmount,
      orderData.paymentMethod || 'Not provided'
    ]);
    
    Logger.log(`Order successfully saved to sheet for customer: ${orderData.name}`);
    
    // Send email notification with order details
    try {
      Logger.log(`Attempting to send email notification to ${NOTIFICATION_EMAIL}`);
      const emailResult = sendOrderEmailNotification(orderData, timestamp);
      Logger.log(`Email notification result: ${emailResult}`);
    } catch (emailError) {
      Logger.log(`Email notification failed: ${emailError.message}`);
      Logger.log(`Email error stack: ${emailError.stack}`);
      // Continue even if email fails, as the order is already saved
    }
    
    // Return a success message
    return { status: 'success' };

  } catch (error) {
    Logger.log(`Sheet save error: ${error.message}`);
    // Return an error message
    return { status: 'error', message: error.message };
  }
}

/**
 * =================================================================
 * SEND ORDER EMAIL NOTIFICATION
 * This function sends an email with order details after saving to sheet.
 * =================================================================
 */
function sendOrderEmailNotification(orderData, timestamp) {
  try {
    // Verify the email address is set
    if (!NOTIFICATION_EMAIL || NOTIFICATION_EMAIL === 'your-email@example.com') {
      throw new Error('Notification email address is not configured');
    }
    
    Logger.log(`Preparing email notification for order from ${orderData.name}`);
    
    // Parse order details if it's a JSON string
    let orderItems = [];
    try {
      orderItems = JSON.parse(orderData.orderDetails);
      Logger.log(`Successfully parsed ${orderItems.length} order items`);
    } catch (e) {
      // If parsing fails, use the raw string
      orderItems = orderData.orderDetails;
      Logger.log(`Could not parse order details as JSON, using raw string: ${orderItems}`);
    }
    
    // Format order items for display
    let formattedItems = '';
    if (Array.isArray(orderItems)) {
      formattedItems = orderItems.map(item => 
        `${item.name} x${item.quantity} - ${item.price} ${item.currency || 'DH'}`
      ).join('\n');
    } else {
      formattedItems = orderItems;
    }
    
    // Create email subject
    const subject = `New Order Received - ${orderData.name} - ${timestamp.toLocaleString()}`;
    
    // Create email body
    const body = `
NEW ORDER RECEIVED

Order Date: ${timestamp.toLocaleString()}

CUSTOMER INFORMATION:
Name: ${orderData.name}
Phone: ${orderData.phone}
Email: ${orderData.email}
Address: ${orderData.address}

ORDER DETAILS:
 ${formattedItems}

ORDER SUMMARY:
Subtotal: ${orderData.subtotal || orderData.totalAmount} DH
Delivery Zone: ${orderData.deliveryZoneName || 'Not provided'}
Delivery Fee: ${orderData.deliveryFee || '0'} DH
Total Amount: ${orderData.totalAmount} DH
Payment Method: ${orderData.paymentMethod || 'Not provided'}

Please process this order as soon as possible.
`;
    
    Logger.log(`Sending email with subject: "${subject}"`);
    Logger.log(`Email body length: ${body.length} characters`);
    
    // Send the email
    GmailApp.sendEmail(
      NOTIFICATION_EMAIL,
      subject,
      body
    );
    
    const successMessage = `Order notification email successfully sent to ${NOTIFICATION_EMAIL}`;
    Logger.log(successMessage);
    return successMessage;
    
  } catch (error) {
    Logger.log(`Error sending order notification email: ${error.message}`);
    Logger.log(`Full error details: ${error.toString()}`);
    throw error;
  }
}

/**
 * =================================================================
 * TEST EMAIL FUNCTION - Run this manually to test email sending
 * =================================================================
 */
function testEmailSending() {
  try {
    const testOrderData = {
      name: 'Test Customer',
      phone: '+1234567890',
      email: 'test@example.com',
      address: '123 Test Street, Test City',
      orderDetails: JSON.stringify([
        { name: 'Test Item 1', quantity: 2, price: 50, currency: 'DH' },
        { name: 'Test Item 2', quantity: 1, price: 30, currency: 'DH' }
      ]),
      totalAmount: '130',
      subtotal: '130',
      deliveryZoneName: 'Test Zone',
      deliveryFee: '0',
      paymentMethod: 'Cash on Delivery'
    };
    
    const testTimestamp = new Date();
    
    Logger.log('Testing email sending function...');
    const result = sendOrderEmailNotification(testOrderData, testTimestamp);
    Logger.log(`Test result: ${result}`);
    return result;
  } catch (error) {
    Logger.log(`Test email failed: ${error.message}`);
    throw error;
  }
}

/**
 * =================================================================
 * GET MENU DATA (with Server-Side Caching)
 * This function fetches from Blogger OR cache and returns the data.
 * =================================================================
 */
function getMenuData() {
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get('menuData');
  
  // 1. If we have valid cache, return it immediately.
  if (cachedData != null) {
    Logger.log('Returning data from cache.');
    return cachedData;
  }
  
  // 2. If cache is empty, fetch new data from Blogger.
  Logger.log('Fetching fresh data from Blogger.');
  
  const response = UrlFetchApp.fetch(BLOG_FEED_URL, {
    muteHttpExceptions: true
  });
  
  const responseCode = response.getResponseCode();
  const data = response.getContentText();
  
  if (responseCode !== 200) {
    throw new Error(`Blogger API request failed with status ${responseCode}: ${data}`);
  }
  
  const bloggerJson = JSON.parse(data);
  const posts = bloggerJson.feed.entry || [];
  
  // 3. Define the categories
  const categories = {
    'Minibox': { title: 'Minibox', icon: '📦', description: 'Perfect portions for individual cravings.', color: 'minibox', posts: [] },
    'Box': { title: 'Box', icon: '🍱', description: 'Complete meals beautifully arranged.', color: 'box', posts: [] },
    'Appetizers': { title: 'Appetizers', icon: '🥟', description: 'Start your meal with our delicious appetizers.', color: 'appetizers', posts: [] },
    'Taco': { title: 'Taco', icon: '🌮', description: 'Fusion at its finest. Our sushi tacos.', color: 'taco', posts: [] }
  };
  
  // 4. Process Blogger posts into clean JSON
  posts.forEach(post => {
    const title = post.title.$t;
    
    // --- Extract full description and short description ---
    let fullDescription = '';
    let shortDescription = '';
    if (post.content && post.content.$t) {
      // Full description is the raw text, stripped of HTML
      fullDescription = post.content.$t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      // Short description is truncated
      shortDescription = fullDescription.substring(0, 100) + (fullDescription.length > 100 ? '...' : '');
    }
    
    // Extract image URL
    let imageUrl = 'https://placehold.co/600x400/fe7301/white?text=No+Image';
    if (post.content && post.content.$t) {
      const match = post.content.$t.match(/<img[^>]+src="([^"]+)"/);
      if (match && match[1]) {
        imageUrl = match[1];
      }
    } else if (post.media$thumbnail) {
      imageUrl = post.media$thumbnail.url.replace(/\/s72-c\//, '/s600/');
    }
    
    // Extract tags, price, and category
    let price = 0;
    let currency = 'DH';
    let isSpecialOffer = false;
    let postCategory = null;
    let tagsArray = [];
    
    if (post.category) {
      post.category.forEach(cat => {
        const term = cat.term;
        tagsArray.push(term);
        
        if (categories[term]) {
          postCategory = term;
        } else if (term.startsWith('price-')) {
          price = parseFloat(term.replace('price-', ''));
        } else if (term === 'special-offer') {
          isSpecialOffer = true;
        } else if (term.startsWith('currency-')) {
          currency = term.replace('currency-', '');
        }
      });
    }
    
    // --- Add to appropriate category ---
    // Item must have a category AND a price to be shown
    if (postCategory && categories[postCategory] && price > 0) {
      const postId = post.id.$t.split('.post-')[1];
      categories[postCategory].posts.push({
        id: postId,
        title: title,
        shortDescription: shortDescription,
        fullDescription: fullDescription,
        category: postCategory,
        imageUrl: imageUrl,
        price: price,
        currency: currency,
        isSpecialOffer: isSpecialOffer,
        tags: tagsArray
      });
    }
  });

  // 5. Convert the 'categories' object into an array
  const menuArray = Object.values(categories);
  const menuJson = JSON.stringify(menuArray);
  
  // 6. Save the clean data to cache
  cache.put('menuData', menuJson, CACHE_EXPIRATION);
  
  // 7. Return the clean data
  return menuJson;
}


/**
 * =================================================================
 * DO NOT USE (These are intentionally left blank)
 * =================================================================
 * We only use doGet for this JSONP-based script.
 */
function doPost(e) {
  // This function is not used in our JSONP-only solution.
}
function doOptions(e) {
  // This function is not used in our JSONP-only solution.
}

