console.log('ManageBac scraper loaded for:', window.location.hostname);

function scrapeTimetable() {
  console.log('Starting timetable scraping...');
  const events = [];

  try {
    // Check if we're on the demo site or real ManageBac
    const isDemoSite = window.location.hostname.includes('demo-managebac.vercel.app');

    if (isDemoSite) {
      return scrapeDemoSite();
    } else {
      return scrapeRealManageBac();
    }

  } catch (error) {
    console.error('Scraping failed:', error);
    throw new Error('Failed to scrape timetable. Make sure you\'re on the timetable page.');
  }
}

function scrapeDemoSite() {
  console.log('Scraping demo ManageBac site...');
  const events = [];

  try {
    // Find the timetable structure in the demo site
    const table = document.querySelector('table');
    if (!table) {
      throw new Error('No timetable table found');
    }

    // Get day headers from the first row
    const headerRow = table.querySelector('tr');
    const dayHeaders = Array.from(headerRow.querySelectorAll('th, td'))
      .slice(1) // Skip the first "Period" column
      .map(th => th.textContent.trim())
      .filter(day => day.length > 0);

    console.log('Found day headers:', dayHeaders);

    // Get all data rows (skip header row)
    const dataRows = Array.from(table.querySelectorAll('tr')).slice(1);

    dataRows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll('td'));

      // Skip the first cell (period number/name)
      const periodCells = cells.slice(1);

      periodCells.forEach((cell, cellIndex) => {
        const cellText = cell.textContent.trim();

        // Skip empty cells, breaks, and cells without time info
        if (!cellText ||
            cellText.includes('Break') ||
            cellText.includes('Legend') ||
            !cellText.includes('AM') && !cellText.includes('PM')) {
          return;
        }

        try {
          // Parse the cell content
          const lines = cellText.split('\n').map(line => line.trim()).filter(line => line);

          if (lines.length >= 2) {
            // First line should contain time
            const timeLine = lines[0];
            const timeMatch = timeLine.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);

            if (timeMatch) {
              const [, startTime, endTime] = timeMatch;

              // Second line should contain location/subject
              const subject = lines[1] || 'Unknown Subject';
              const location = lines[1] || 'Unknown Location';

              // Get the day from headers
              const day = dayHeaders[cellIndex] || `Day ${cellIndex + 1}`;

              events.push({
                day: day,
                start_time: startTime.trim(),
                end_time: endTime.trim(),
                subject: subject,
                location: location
              });

              console.log('Extracted event:', {
                day,
                start_time: startTime.trim(),
                end_time: endTime.trim(),
                subject,
                location
              });
            }
          }
        } catch (error) {
          console.error('Error parsing cell:', cellText, error);
        }
      });
    });

    console.log(`Successfully scraped ${events.length} events from demo site`);
    return events;

  } catch (error) {
    console.error('Demo site scraping failed:', error);
    throw new Error('Failed to scrape demo timetable');
  }
}

function scrapeRealManageBac() {
  console.log('Scraping real ManageBac site...');
  const events = [];

  try {
    // Extract days from table header
    const dayHeaders = Array.from(document.querySelectorAll('thead tr th'))
      .map(th => th.textContent.trim())
      .filter(day => day.length > 0 && !day.includes('Time'));

    console.log('Found day headers:', dayHeaders);

    // Find all timetable cells with classes
    const periodCells = document.querySelectorAll('td.period-classes.with-period');
    console.log(`Found ${periodCells.length} period cells`);

    periodCells.forEach((td, index) => {
      const classWrappers = td.querySelectorAll('.class-wrapper');

      // Determine which day this cell belongs to
      const row = td.parentElement;
      const cellIndex = Array.from(row.children).indexOf(td);
      const dayIndex = cellIndex - 1; // Subtract 1 for time column
      const day = dayHeaders[dayIndex] || `Day ${dayIndex + 1}`;

      classWrappers.forEach(wrapper => {
        try {
          const classInfo = wrapper.querySelector('.class-info');
          if (!classInfo) return;

          // Extract time information
          const timeElement = classInfo.querySelector('.period-duration');
          if (!timeElement) return;

          const timeText = timeElement.textContent.trim();
          const timeParts = timeText.split(' - ');
          if (timeParts.length !== 2) return;

          const [startTime, endTime] = timeParts;

          // Extract subject name
          const subjectElement = classInfo.querySelector('.class-name a') ||
                                classInfo.querySelector('.class-name');
          if (!subjectElement) return;

          const subject = subjectElement.textContent.trim();

          // Extract location (try multiple selectors)
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

          // Create event object
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

    // If no events found, try alternative scraping method
    if (events.length === 0) {
      console.log('No events found with primary method, trying alternative...');
      return scrapeAlternativeMethod();
    }

    console.log(`Successfully scraped ${events.length} events`);
    return events;

  } catch (error) {
    console.error('Real ManageBac scraping failed:', error);
    throw new Error('Failed to scrape real ManageBac timetable');
  }
}

function scrapeAlternativeMethod() {
  console.log('Trying alternative scraping method...');
  const events = [];

  try {
    // Look for any table cells that might contain schedule data
    const allCells = document.querySelectorAll('td');

    allCells.forEach(cell => {
      const text = cell.textContent.trim();

      // Look for time patterns (e.g., "9:00 AM - 10:00 AM")
      const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);

      if (timeMatch) {
        // Found a time, try to extract other info
        const subject = extractSubjectFromCell(cell);
        const location = extractLocationFromCell(cell);
        const day = extractDayFromCell(cell);

        if (subject) {
          events.push({
            day: day || 'Unknown',
            start_time: timeMatch[1],
            end_time: timeMatch[2],
            subject: subject,
            location: location || 'No location'
          });
        }
      }
    });

    return events;
  } catch (error) {
    console.error('Alternative scraping failed:', error);
    return [];
  }
}

function extractSubjectFromCell(cell) {
  // Look for links or emphasized text that might be the subject
  const subjectSelectors = ['a', 'strong', 'b', '.class-name', '.subject'];

  for (const selector of subjectSelectors) {
    const element = cell.querySelector(selector);
    if (element) {
      const text = element.textContent.trim();
      if (text && !text.match(/\d{1,2}:\d{2}/)) { // Not a time
        return text;
      }
    }
  }

  // If no specific element found, try to extract from text content
  const lines = cell.textContent.split('\n').map(line => line.trim()).filter(line => line);
  if (lines.length >= 2) {
    // Usually the second line is the subject
    return lines[1];
  }

  return null;
}

function extractLocationFromCell(cell) {
  // Look for location indicators
  const text = cell.textContent;
  const locationMatch = text.match(/Room\s+(\w+\d+)|(\w+\d+\w*)/i);
  return locationMatch ? locationMatch[0] : null;
}

function extractDayFromCell(cell) {
  // Try to find day information from table headers or context
  const row = cell.parentElement;
  const table = row.closest('table');

  if (table) {
    const headerRow = table.querySelector('thead tr, tr:first-child');
    if (headerRow) {
      const cellIndex = Array.from(row.children).indexOf(cell);
      const dayHeader = headerRow.children[cellIndex];
      if (dayHeader) {
        return dayHeader.textContent.trim();
      }
    }
  }

  return null;
}

// Message listener for extension communication
if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);

    if (request.action === "scrapeData") {
      try {
        // Check if we're on a supported page
        const isManageBac = window.location.hostname.includes('managebac.com');
        const isDemoSite = window.location.hostname.includes('demo-managebac.vercel.app');

        if (!isManageBac && !isDemoSite) {
          throw new Error('Please navigate to ManageBac or the demo site first');
        }

        // Check if timetable elements exist
        const timetableExists = document.querySelector('table') ||
                              document.querySelector('thead tr th') ||
                              document.querySelector('.period-classes');

        if (!timetableExists) {
          throw new Error('No timetable found. Please navigate to your timetable page.');
        }

        const data = scrapeTimetable();
        console.log('Sending scraped data:', data);
        sendResponse({ data: data });

      } catch (error) {
        console.error('Scraping error:', error);
        sendResponse({ error: error.message });
      }
      return true; // Keep the message channel open
    }
  });

  // Cleanup listener on page unload
  window.addEventListener('beforeunload', () => {
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({action: "clearScrapedData"});
    }
  });
} else {
  console.error('Extension context unavailable');
}