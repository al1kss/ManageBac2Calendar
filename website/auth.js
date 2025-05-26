let accessToken = null;
let userProfile = null;

// Initialize Google Auth properly
function initGoogleAuth() {
    google.accounts.id.initialize({
        client_id: '462466054893-lof00ggsu69q10ntig0po3jsksbmhm7t.apps.googleusercontent.com',
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: false
    });

    // Render button with proper configuration
    google.accounts.id.renderButton(
        document.getElementById('googleButtonContainer'),
        {
            type: 'standard',
            size: 'large',
            theme: 'filled_blue',
            text: 'signin_with',
            shape: 'rectangular',
            width: '300'
        }
    );

    checkSavedSession();
}

async function handleCredentialResponse(response) {
    try {
        // Get access token properly
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: '462466054893-lof00ggsu69q10ntig0po3jsksbmhm7t.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/calendar.events profile',
            callback: async (tokenResponse) => {
                accessToken = tokenResponse.access_token;
                await loadUserProfile();
                saveSession();
                updateUI();
            },
            error_callback: (error) => {
                console.error('Token Error:', error);
                clearSession();
            }
        });
        
        tokenClient.requestAccessToken();
    } catch (error) {
        console.error('Auth Error:', error);
        clearSession();
    }
}

// Updated checkSavedSession
async function checkSavedSession() {
    const savedSession = localStorage.getItem('googleSession');
    if(savedSession) {
        const session = JSON.parse(savedSession);
        if(new Date() < new Date(session.expiry)) {
            accessToken = session.accessToken;
            try {
                await loadUserProfile();
                updateUI();
            } catch (error) {
                clearSession();
            }
        } else {
            clearSession();
        }
    }
}

// Updated UI Handling
function updateUI() {
    const syncSection = document.getElementById('syncSection');
    const profileSection = document.getElementById('userProfile');
    
    if (accessToken && userProfile) {
        syncSection.classList.remove('hidden');
        profileSection.innerHTML = `
            <div class="profile-card">
                <img src="${userProfile.picture}" alt="Profile" class="profile-pic">
                <div class="profile-info">
                    <h3>${userProfile.name}</h3>
                    <p>${userProfile.email}</p>
                    <button onclick="logout()" class="logout-btn">Logout</button>
                </div>
            </div>
        `;
    } else {
        syncSection.classList.add('hidden');
        profileSection.innerHTML = '';
    }
}

// Fixed logout function
function logout() {
    google.accounts.id.disableAutoSelect();
    clearSession();
    window.location.reload();
}
// Save session to localStorage
function saveSession() {
    const session = {
        accessToken,
        expiry: new Date().getTime() + 3600 * 24000 // 24 hour
    };
    localStorage.setItem('googleSession', JSON.stringify(session));
}

// Clear session data
function clearSession() {
    localStorage.removeItem('googleSession');
    accessToken = null;
    userProfile = null;
    updateUI();
}

// Load user profile
async function loadUserProfile() {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        userProfile = await response.json();
    } catch (error) {
        console.error('Profile Load Error:', error);
        clearSession();
    }
}


// Initialize on load
async function loadDatabase() {
    const databaseView = document.getElementById('databaseView');
    databaseView.innerHTML = '<div class="loading">Loading database...</div>';

    try {
        const userEmail = userProfile.email.trim().toLowerCase(); // Ensure consistent casing and trim spaces
        const emailHash = CryptoJS.MD5(userEmail).toString();
        const response = await fetch(`/api/storage/${emailHash}.json`);

        if (!response.ok) {
            throw new Error("Failed to fetch data");
        }

        const data = await response.json();
        
        if (data.length > 0) {
            databaseView.innerHTML = `
                <div class="database-header">
                    <h3>Stored Events (${data.length})</h3>
                </div>
                ${data.map(event => `
                    <div class="database-item">
                        <div class="event-meta">
                            <span class="event-day">${event.day}</span>
                            <span class="event-time">${event.start_time} - ${event.end_time}</span>
                        </div>
                        <div class="event-main">
                            <h4 class="event-title">${event.subject}</h4>
                            <p class="event-location">${event.location}</p>
                        </div>
                    </div>
                `).join('')}
            `;
        } else {
            databaseView.innerHTML = '<div class="error">No data found</div>';
        }
    } catch (error) {
        console.error("Database loading error:", error);
        databaseView.innerHTML = '<div class="error">Failed to load database</div>';
    }
}


const monthMapping = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12'
};
const year = "2025";

// Helper function: Convert time string (e.g. "8:00 AM") to 24-hour format "HH:MM:SS"
function parseTime(timeStr) {
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

// Helper function: Parse a day string like "Tue, Apr 1" into an ISO date string using year 2025
function parseEventDate(dayStr) {
    dayStr = dayStr.replace(/\s+/g, ' ').trim();
    // Expecting format "Tue, Apr 1"
    const parts = dayStr.split(', ');
    if (parts.length !== 2) {
        throw new Error("Invalid day format");
    }
    const [, rest] = parts; // rest is "Apr 1"
    const [monthAbbrev, dayNumber] = rest.split(' ');
    const month = monthMapping[monthAbbrev];
    const dayPadded = dayNumber.padStart(2, '0');
    return `${year}-${month}-${dayPadded}`;
}

// Function to create Google Calendar events from the events array
async function createCalendarEvents(events, accessToken) {
    for (const event of events) {
        // Build ISO datetime strings
        const date = parseEventDate(event.day);
        const startTime = parseTime(event.start_time);
        const endTime = parseTime(event.end_time);
        const startDateTime = `${date}T${startTime}`;
        const endDateTime = `${date}T${endTime}`;

        // Post the event to the Google Calendar API
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                summary: event.subject,
                location: event.location,
                start: { dateTime: startDateTime, timeZone: 'Asia/Tokyo' },
                end: { dateTime: endDateTime, timeZone: 'Asia/Tokyo' }
            })
        });

        const data = await response.json();
        console.log("Calendar API response:", data);
        if (!response.ok) {
            throw new Error(data.error ? data.error.message : "Failed to create event");
        }
    }
}

async function deleteStorageFile(emailHash) {
    try {
        // Construct the file name, e.g., "20e44b3b530c6dc091076f6539db41a3.json"
	let userEmail = userProfile.email.trim().toLowerCase();
        const emailHash = CryptoJS.MD5(userEmail).toString();
        const fileName = `${emailHash}.json`;

        const response = await fetch(`/api/clear-data.php?file=${fileName}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete file');
        }
        console.log('File deleted successfully');
    } catch (error) {
        console.error('Error deleting file:', error);
    }
}

async function syncDatabase() {
    if (!confirm('This will clear all stored data after syncing. Continue?')) return;
    try {
        let userEmail = userProfile.email.trim().toLowerCase(); // Ensure consistent formatting
        const emailHash = CryptoJS.MD5(userEmail).toString();
        const response = await fetch(`/api/storage/${emailHash}.json`);
        if (!response.ok) {
            throw new Error("Failed to fetch stored events");
        }
        const events = await response.json();
        
        // Assumes accessToken is available from your auth context (e.g. in userProfile)
	const savedSession = localStorage.getItem('googleSession');
	if (savedSession) {
		const session = JSON.parse(savedSession)
                const accessToken = userProfile.accessToken; // Adjust this if needed
	} else {
	    throw new Error("Refresh your page")
	}

        
        await createCalendarEvents(events, accessToken);
        
        // Optionally: Clear stored data here if required
	await deleteStorageFile();
        loadDatabase(); // Refresh the database view
        
        alert(`Synced ${events.length} events to Google Calendar!`);
    } catch (error) {
        console.error("Sync error:", error);
        alert(`Sync failed: ${error.message}`);
    }
}
