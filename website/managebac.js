let mbCredentials = {};

// Save ManageBac credentials
function saveMBcredentials() {
    mbCredentials = {
        username: document.getElementById('mbUsername').value,
        password: document.getElementById('mbPassword').value
    };
    
    // In production, encrypt credentials before storing
    localStorage.setItem(`mbCreds_${userProfile.email}`, JSON.stringify(mbCredentials));
    alert('Credentials saved securely');
}

// Sync calendar
async function syncCalendar() {
    const statusElement = document.getElementById('syncStatus');
    statusElement.innerHTML = '<div class="status-loading">⏳ Connecting to ManageBac...</div>';
    
    try {
        const timetable = await fetchMBtimetable();
        statusElement.innerHTML = '<div class="status-loading">📡 Syncing with Google Calendar...</div>';
        
        await createCalendarEvents(timetable);
        
        statusElement.innerHTML = `
            <div class="status-success">
                ✅ Successfully synced ${timetable.length} events!
                <div class="sync-summary">
                    First event: ${timetable[0].subject}<br>
                    Last event: ${timetable[timetable.length-1].subject}
                </div>
            </div>
        `;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusElement.innerHTML = '';
        }, 5000);

    } catch (error) {
        statusElement.innerHTML = `
            <div class="status-error">
                ❌ Sync failed: ${error.message}
                <button onclick="syncCalendar()" class="retry-btn">Retry</button>
            </div>
        `;
    }
}
// Example ManageBac API call
async function fetchMBtimetable() {
    // Replace with actual ManageBac API integration
    return [
        {
            title: 'Math Class',
            start: '2025-03-07T09:00:00',
            end: '2025-03-07T10:00:00'
        }
    ];
}

