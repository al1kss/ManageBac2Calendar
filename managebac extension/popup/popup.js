// Add new event listener for scrape button
document.getElementById('scrapeNow').addEventListener('click', async () => {
  const output = document.querySelector('.json-output');
  const statusBar = document.getElementById('statusBar');
  const statusText = statusBar.querySelector('.status-text');

  output.textContent = '';
  statusBar.classList.remove('hidden');
  statusText.textContent = 'Scraping timetable data...';

  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});


    const response = await chrome.tabs.sendMessage(tab.id, {action: "scrapeData"});


    if (!response?.data) {
      throw new Error('No data received');
    }

    output.textContent = JSON.stringify(response.data, null, 2);
    output.style.animation = 'fadeIn 0.3s ease';

    statusText.innerHTML = `✅ Scraped ${response.data.length} events!`;
    setTimeout(() => statusBar.classList.add('hidden'), 2000);

  } catch (error) {
    console.error('[ERROR] Scrape error:', error);
    output.textContent = `Error: ${error.message}`;
    statusText.innerHTML = `${error.message}`;
    statusBar.style.background = 'rgba(234,67,53,0.1)';
    setTimeout(() => statusBar.classList.add('hidden'), 50000);
  }
});

document.getElementById('sendData').addEventListener('click', async () => {
  const statusBar = document.getElementById('statusBar');
  const statusText = statusBar.querySelector('.status-text');
  const emailInput = document.getElementById('userEmail');

  console.log('[DEBUG] Resetting UI state');
  statusBar.classList.remove('hidden');
  statusBar.style.background = 'rgba(66,133,244,0.1)';
  statusText.innerHTML = 'Starting send operation...';
  statusText.style.color = 'inherit';

  try {
    console.log('[DEBUG] Validating email:', emailInput.value);
    if (!validateEmail(emailInput.value)) {
      throw new Error('Please enter a valid email address');
    }

    console.log('[DEBUG] Starting data scraping');
    statusText.innerHTML = '🔄 Scraping data from current page...';

    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const data = await chrome.tabs.sendMessage(tab.id, {action: "scrapeData"});
    console.log("data: ", data.data);

    console.log('[DEBUG] Preparing fetch request');
    statusText.innerHTML = 'Sending data to alikhan.studio...';
    const fetchOptions = {
      method: 'POST',
      headers: {'Content-Type': 'application/json',
                'X-Requested-With': 'Extension'
      },
      body: JSON.stringify({
        email: emailInput.value,
        data: data.data
      })
    };

    const response = await fetch('https://alikhan.studio/api/store-data.php', fetchOptions);
    console.log('[DEBUG] Raw response:', response);
    statusText.innerHTML = 'Request sent to alikhan.studio...';


    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await response.text();
      console.error('[ERROR] Server did not return JSON:', responseText);
      throw new Error('Server error: ' + responseText); // Include the server error in the message
    }

    // Parse the JSON response
    const result = await response.json();
    if (result.status === 'success') {
      statusBar.classList.remove('error');
      statusBar.classList.add('success');
      statusText.innerHTML = `✅ Data sent successfully! ${result.count} events saved.`;
    } else if (result.error) {
      statusBar.classList.remove('success');
      statusBar.classList.add('error');
      statusText.innerHTML = `❌ Error: ${result.error}`;
    } else {
      statusBar.classList.remove('success');
      statusBar.classList.add('error');
      statusText.innerHTML = '❌ Unexpected response from server.';
    }


  } catch (error) {
    console.error('[ERROR] Send operation failed:', error);
    statusText.innerHTML = `Error: ${error.message}`;
    statusBar.style.background = 'rgba(234,67,53,0.1)';
    statusText.style.color = '#ea4335';
  } finally {
    console.log('[DEBUG] Finalizing send operation');
    setTimeout(() => {
      statusBar.classList.add('hidden');
    }, 50000);
  }
});

// Add debug logs to helper functions
function validateEmail(email) {
  console.log('[DEBUG] Validating email:', email);
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  console.log('[DEBUG] Email validation result:', isValid);
  return isValid;
}

async function scrapeFromPage() {
  console.log('[DEBUG] Starting scrapeFromPage');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log('[DEBUG] Found tab:', tab);

  return new Promise((resolve, reject) => {
    console.log('[DEBUG] Executing content script');
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        console.error('[CONTENT SCRIPT] Sending scrapeData message', results);
        return chrome.runtime.sendMessage({ action: "scrapeData" });
      }
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.error('[ERROR] Scripting error:', chrome.runtime.lastError);
        reject(new Error('Could not connect to ManageBac page'));
        return;
      }
      console.log('[DEBUG] Scripting results:', results);
      resolve(results[0].result?.data || []);
    });
  });
}