// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log('ManageBac Exporter installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "storeData") {
    chrome.storage.local.get(['storedData'], (result) => {
      const existingData = result.storedData || [];
      const newData = [...existingData, ...request.data];
      chrome.storage.local.set({ storedData: newData });
    });
  }
});