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
        totalAmount: e.parameter.totalAmount
      };
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
        "Total Amount"
      ]);
    }
    
    // Append the new order
    sheet.appendRow([
      new Date(),
      orderData.phone,
      orderData.name,
      orderData.email,
      orderData.address,
      orderData.orderDetails,
      orderData.totalAmount
    ]);
    
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
    
    // --- NEW: Extract full description and short description ---
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
        shortDescription: shortDescription,  // <-- NEW
        fullDescription: fullDescription,  // <-- NEW
        category: postCategory,          // <-- NEW (for related products)
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
