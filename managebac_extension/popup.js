class ManageBacSync {
  constructor() {
    this.accessToken = null;
    this.userInfo = null;
    this.scrapedData = [];
    this.init();
  }

  async init() {
    await this.checkAuthStatus();
    this.setupEventListeners();
    this.updateUI();
  }

  setupEventListeners() {
    document.getElementById('signInBtn').addEventListener('click', () => this.signIn());
    document.getElementById('signOutBtn').addEventListener('click', () => this.signOut());
    document.getElementById('scrapeBtn').addEventListener('click', () => this.scrapeData());
    document.getElementById('syncBtn').addEventListener('click', () => this.syncToCalendar());
  }

  async checkAuthStatus() {
    try {
      // Try to get cached token
      const token = await this.getAuthToken(false);
      if (token) {
        this.accessToken = token;
        await this.loadUserInfo();
      }
    } catch (error) {
      console.log('No cached auth token:', error);
    }
  }

  async getAuthToken(interactive = false) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('Chrome Identity Error:', chrome.runtime.lastError);
          reject(new Error(`Chrome Identity Error: ${chrome.runtime.lastError.message}`));
        } else if (token) {
          console.log('Successfully got auth token');
          resolve(token);
        } else {
          reject(new Error('No token received from Chrome Identity API'));
        }
      });
    });
  }

  async signIn() {
    this.showStatus('Signing in...', 'loading');

    try {
      // Force interactive auth to show OAuth prompt
      console.log('Attempting Chrome Identity API sign-in...');
      this.accessToken = await this.getAuthToken(true); // true = interactive
      await this.loadUserInfo();
      this.updateUI();
      this.showStatus('Signed in successfully!', 'success');
    } catch (error) {
      console.error('Chrome Identity API failed:', error);

      // Fallback to web auth flow
      try {
        this.showStatus('Trying alternative sign-in method...', 'loading');
        await this.signInWithWebAuthFlow();
      } catch (webError) {
        console.error('Web auth flow failed:', webError);
        this.showStatus(`Sign in failed: ${webError.message}`, 'error');
      }
    }
  }

  async signInWithWebAuthFlow() {
    return new Promise((resolve, reject) => {
      // Get client ID from manifest
      const manifest = chrome.runtime.getManifest();
      const clientId = manifest.oauth2.client_id;

      if (!clientId || clientId.includes('REPLACE_WITH')) {
        reject(new Error('Client ID not configured in manifest.json'));
        return;
      }

      const redirectUrl = chrome.identity.getRedirectURL();
      const scopes = [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ].join(' ');

      const authUrl = `https://accounts.google.com/oauth/authorize?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `response_type=token&` +
        `redirect_uri=${encodeURIComponent(redirectUrl)}&` +
        `scope=${encodeURIComponent(scopes)}`;

      console.log('Launching web auth flow with URL:', authUrl);
      console.log('Redirect URL:', redirectUrl);

      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          const error = chrome.runtime.lastError?.message || 'Authorization failed';
          console.error('Web auth flow error:', error);
          reject(new Error(error));
          return;
        }

        console.log('Auth flow response URL:', responseUrl);

        try {
          // Extract access token from response URL
          const urlParams = new URLSearchParams(responseUrl.split('#')[1]);
          const accessToken = urlParams.get('access_token');

          if (accessToken) {
            this.accessToken = accessToken;
            this.loadUserInfo().then(() => {
              this.updateUI();
              this.showStatus('Signed in successfully!', 'success');
              resolve();
            }).catch(reject);
          } else {
            reject(new Error('No access token received from OAuth flow'));
          }
        } catch (parseError) {
          console.error('Error parsing auth response:', parseError);
          reject(new Error('Failed to parse authorization response'));
        }
      });
    });
  }

  async signOut() {
    return new Promise((resolve) => {
      // First, revoke the token if we have one
      if (this.accessToken) {
        fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }).catch(error => {
          console.log('Token revocation failed (this is okay):', error);
        });
      }

      // Clear all cached tokens
      chrome.identity.clearAllCachedAuthTokens(() => {
        // Clear extension state
        this.accessToken = null;
        this.userInfo = null;
        this.scrapedData = [];

        // Clear any stored data
        chrome.storage.local.clear(() => {
          this.updateUI();
          this.showStatus('Signed out successfully', 'success');
          resolve();
        });
      });
    });
  }

  async loadUserInfo() {
    if (!this.accessToken) return;

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (response.ok) {
        this.userInfo = await response.json();
        console.log('User info loaded:', this.userInfo);
      } else {
        throw new Error(`Failed to load user info: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to load user info:', error);
      throw error;
    }
  }

  // FIXED SCRAPING METHOD - NO MORE CONNECTION ERRORS
  async scrapeData() {
    this.showStatus('Extracting timetable data...', 'loading');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url.includes('managebac.com') && !tab.url.includes('demo-managebac.vercel.app')) {
        throw new Error('Please navigate to ManageBac or the demo site first');
      }

      console.log('Starting direct script injection for scraping...');

      // Use direct script injection - NO MORE chrome.tabs.sendMessage!
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // This function runs directly in the page context
          function scrapePageData() {
            console.log('Direct scraping started on:', window.location.hostname);
            const events = [];

            try {
              // Original ManageBac scraping logic that works for both sites
              const dayHeaders = Array.from(document.querySelectorAll('thead tr th'))
                .map(th => th.textContent.trim())
                .filter(day => day.length > 0 && !day.includes('Period'));

              console.log('Day headers found:', dayHeaders);

              const periodCells = document.querySelectorAll('td.period-classes.with-period');
              console.log('Found period cells:', periodCells.length);

              periodCells.forEach((td) => {
                const classWrappers = td.querySelectorAll('.class-wrapper');

                const row = td.parentElement;
                const cellIndex = Array.from(row.children).indexOf(td);
                const dayIndex = cellIndex - 1;
                const day = dayHeaders[dayIndex] || `Day ${dayIndex + 1}`;

                classWrappers.forEach(wrapper => {
                  try {
                    const classInfo = wrapper.querySelector('.class-info');
                    if (!classInfo) return;

                    const timeElement = classInfo.querySelector('.period-duration');
                    if (!timeElement) return;

                    const timeText = timeElement.textContent.trim();
                    const timeParts = timeText.split(' - ');
                    if (timeParts.length !== 2) return;

                    const [startTime, endTime] = timeParts;

                    const subjectElement = classInfo.querySelector('.class-name a') ||
                                          classInfo.querySelector('.class-name');
                    if (!subjectElement) return;

                    const subject = subjectElement.textContent.trim();

                    let location = 'No location';
                    const locationSelectors = [
                      '.text-ellipsis:last-child',
                      '.class-location',
                      '.period-location',
                      '.text-ellipsis'
                    ];

                    for (const selector of locationSelectors) {
                      const locationElement = classInfo.querySelector(selector);
                      if (locationElement && locationElement.textContent.trim() !== subject) {
                        location = locationElement.textContent.trim();
                        break;
                      }
                    }

                    const event = {
                      day: day,
                      start_time: startTime.trim(),
                      end_time: endTime.trim(),
                      subject: subject,
                      location: location
                    };

                    events.push(event);
                    console.log('Extracted event:', event);

                  } catch (error) {
                    console.error('Error parsing class wrapper:', error);
                  }
                });
              });

              console.log(`Scraping completed. Found ${events.length} events.`);
              return events;

            } catch (error) {
              console.error('Direct scraping failed:', error);
              throw error;
            }
          }

          return scrapePageData();
        }
      });

      if (results && results[0] && results[0].result) {
        this.scrapedData = results[0].result;
        this.updateDataPreview();
        this.updateUI();

        if (this.scrapedData.length > 0) {
          this.showStatus(`Found ${this.scrapedData.length} events!`, 'success');
        } else {
          this.showStatus('No timetable data found. Make sure you\'re on the timetable page.', 'warning');
        }
      } else {
        throw new Error('Failed to scrape data from page');
      }

    } catch (error) {
      console.error('Scraping failed:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  updateDataPreview() {
    const preview = document.getElementById('dataPreview');
    const output = document.getElementById('dataOutput');
    const count = document.getElementById('eventCount');

    if (this.scrapedData.length > 0) {
      preview.classList.remove('hidden');
      output.textContent = JSON.stringify(this.scrapedData.slice(0, 3), null, 2);
      count.textContent = this.scrapedData.length;
    } else {
      preview.classList.add('hidden');
    }
  }

  async syncToCalendar() {
    if (!this.accessToken || this.scrapedData.length === 0) {
      this.showStatus('Please sign in and extract data first', 'error');
      return;
    }

    this.showStatus('Syncing to Google Calendar...', 'loading');
    this.showProgress(0, 'Preparing events...');

    try {
      const events = this.convertToCalendarEvents(this.scrapedData);
      const total = events.length;
      let completed = 0;

      for (const event of events) {
        await this.createCalendarEvent(event);
        completed++;
        const progress = (completed / total) * 100;
        this.showProgress(progress, `Created ${completed}/${total} events`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.hideProgress();
      this.showStatus(`Successfully synced ${total} events!`, 'success');

    } catch (error) {
      console.error('Sync failed:', error);
      this.hideProgress();
      this.showStatus(`Sync failed: ${error.message}`, 'error');
    }
  }

  convertToCalendarEvents(data) {
    const currentYear = new Date().getFullYear();
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('Using device timezone:', userTimezone);
    const events = [];

    for (const item of data) {
      try {
        const date = this.parseEventDate(item.day, currentYear);
        const startTime = this.parseTime(item.start_time);
        const endTime = this.parseTime(item.end_time);
        const startDateTime = `${date}T${startTime}`;
        const endDateTime = `${date}T${endTime}`;

        events.push({
          summary: item.subject,
          location: item.location,
          start: {
            dateTime: startDateTime,
            timeZone: userTimezone
          },
          end: {
            dateTime: endDateTime,
            timeZone: userTimezone
          },
          description: `Imported from ManageBac\nClass: ${item.subject}\nLocation: ${item.location}\nTimezone: ${userTimezone}`
        });
      } catch (error) {
        console.warn('Failed to convert event:', item, error);
      }
    }

    return events;
  }

  parseEventDate(dayStr, year) {
    // Parse formats like "Tue, Apr 1" or "Tuesday, April 1"
    const monthMap = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
      'January': '01', 'February': '02', 'March': '03', 'April': '04',
      'June': '06', 'July': '07', 'August': '08',
      'September': '09', 'October': '10', 'November': '11', 'December': '12'
    };

    const parts = dayStr.replace(/,/g, '').split(/\s+/);
    const monthStr = parts[1];
    const day = parts[2];

    const month = monthMap[monthStr];
    if (!month) throw new Error(`Unknown month: ${monthStr}`);

    return `${year}-${month}-${day.padStart(2, '0')}`;
  }

  parseTime(timeStr) {
    // Convert time like "8:00 AM" to 24-hour format "HH:MM:SS"
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours, 10);
    minutes = parseInt(minutes, 10);
    if (modifier === 'PM' && hours !== 12) {
      hours += 12;
    }
    if (modifier === 'AM' && hours === 12) {
      hours = 0;
    }
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    return `${hoursStr}:${minutesStr}:00`;
  }

  async createCalendarEvent(event) {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create event');
    }

    return response.json();
  }

  showStatus(message, type = 'info') {
    const statusBar = document.getElementById('statusBar');
    const statusText = document.getElementById('statusText');
    const spinner = document.getElementById('spinner');
    const statusIcon = document.getElementById('statusIcon');

    // Add entrance animation
    statusBar.classList.remove('hidden');
    statusBar.classList.add('animate-slide-right');

    // Clear previous status classes
    statusBar.className = statusBar.className.replace(/status-\w+/g, '');
    statusBar.classList.add('mb-4', 'status-bar', `status-${type}`, 'animate-slide-right');

    statusText.textContent = message;

    // Set icons and show/hide spinner based on type
    if (type === 'loading') {
      spinner.classList.remove('hidden');
      statusIcon.textContent = '';
    } else {
      spinner.classList.add('hidden');
      const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
      };
      statusIcon.textContent = icons[type] || icons.info;
    }

    // Auto-hide non-loading messages with longer duration and smoother transition
    if (type !== 'loading') {
      const duration = type === 'error' ? 6000 : type === 'warning' ? 5000 : 4000; // Different durations

      setTimeout(() => {
        statusBar.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        statusBar.style.opacity = '0';
        statusBar.style.transform = 'translateX(100%) scale(0.95)';

        setTimeout(() => {
          statusBar.classList.add('hidden');
          statusBar.style.opacity = '';
          statusBar.style.transform = '';
          statusBar.style.transition = '';
        }, 600);
      }, duration);
    }
  }

  showProgress(percentage, text) {
    const progressSection = document.getElementById('syncProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const progressPercent = document.getElementById('progressPercent');

    progressSection.classList.remove('hidden');
    progressSection.classList.add('animate-fade-in');

    // Smooth progress bar animation
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = text;
    progressPercent.textContent = `${Math.round(percentage)}%`;

    // Add glow effect when reaching 100%
    if (percentage >= 100) {
      progressBar.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.6)';
    }
  }

  hideProgress() {
    const progressSection = document.getElementById('syncProgress');
    progressSection.style.opacity = '0';
    progressSection.style.transform = 'translateY(20px)';
    setTimeout(() => {
      progressSection.classList.add('hidden');
      progressSection.style.opacity = '';
      progressSection.style.transform = '';
    }, 300);
  }

  updateUI() {
    const signInSection = document.getElementById('signInSection');
    const userSection = document.getElementById('userSection');
    const scrapeSection = document.getElementById('scrapeSection');
    const syncSection = document.getElementById('syncSection');

    if (this.accessToken && this.userInfo) {
      // Signed in - animate transitions with staggered timing
      signInSection.classList.add('hidden');
      userSection.classList.remove('hidden');
      userSection.classList.add('animate-slide-up');

      setTimeout(() => {
        scrapeSection.classList.remove('hidden');
        scrapeSection.classList.add('animate-slide-up');
      }, 200);

      // Update user info with animations
      const avatar = document.getElementById('userAvatar');
      const name = document.getElementById('userName');
      const email = document.getElementById('userEmail');

      avatar.src = this.userInfo.picture;
      name.textContent = this.userInfo.name;
      email.textContent = this.userInfo.email;

      // Add loading animation to avatar
      avatar.onload = () => {
        avatar.style.transform = 'scale(1.1)';
        setTimeout(() => {
          avatar.style.transform = 'scale(1)';
          avatar.style.transition = 'transform 0.3s ease';
        }, 200);
      };

      // Show sync section if data is available
      if (this.scrapedData.length > 0) {
        setTimeout(() => {
          syncSection.classList.remove('hidden');
          syncSection.classList.add('animate-slide-up');
        }, 400);
      } else {
        syncSection.classList.add('hidden');
      }
    } else {
      // Not signed in - reset animations
      signInSection.classList.remove('hidden');
      userSection.classList.add('hidden');
      scrapeSection.classList.add('hidden');
      syncSection.classList.add('hidden');

      // Remove animation classes for clean state
      [userSection, scrapeSection, syncSection].forEach(section => {
        section.classList.remove('animate-slide-up', 'animate-fade-in');
      });
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ManageBacSync();

  // Initialize footer animation
  const footer = document.getElementById('footer');
  if (footer) {
    // Add a small delay for better effect
    setTimeout(() => {
      footer.classList.add('animate-in');
    }, 800);
  }
});
