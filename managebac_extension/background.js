// background.js for Manifest V3
console.log('ManageBac Calendar Sync background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    console.log('First time installation');
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);

  switch (request.action) {
    case 'clearScrapedData':
      // Clean up any stored scraping data
      chrome.storage.local.remove(['scrapedData']);
      break;

    case 'storeData':
      // Store scraped data temporarily
      chrome.storage.local.set({
        'scrapedData': request.data,
        'scrapeTimestamp': Date.now()
      });
      break;

    case 'getStoredData':
      // Retrieve stored data
      chrome.storage.local.get(['scrapedData', 'scrapeTimestamp'], (result) => {
        sendResponse({
          data: result.scrapedData || [],
          timestamp: result.scrapeTimestamp
        });
      });
      return true; // Keep message channel open

    default:
      console.log('Unknown action:', request.action);
  }
});

// Handle auth token changes/revocation
if (chrome.identity && chrome.identity.onSignInChanged) {
  chrome.identity.onSignInChanged.addListener((account, signedIn) => {
    console.log('Auth state changed:', account, signedIn);

    if (!signedIn) {
      // Clear any cached data when user signs out
      chrome.storage.local.remove(['scrapedData', 'userPreferences']);
    }
  });
}