console.log('Content script loaded!');

function scrapeTimetable() {
  console.log('Scraping started...');
  const events = [];

  // Extract days from table header
  const days = Array.from(document.querySelectorAll('thead tr th'))
    .map(th => th.textContent.trim())
    .filter(day => day.length > 0); // Get actual day names from header

  // Find all timetable cells with classes
  document.querySelectorAll('td.period-classes.with-period').forEach(td => {
    const classWrappers = td.querySelectorAll('.class-wrapper');
    const dayIndex = Array.from(td.parentElement.children).indexOf(td);
    const day = days[dayIndex] || `Day ${dayIndex + 1}`;

    classWrappers.forEach(wrapper => {
      try {
        const classInfo = wrapper.querySelector('.class-info');
        if (!classInfo) return;

        // Extract time
        const timeElement = classInfo.querySelector('.period-duration');
        const [startTime, endTime] = timeElement?.textContent.split(' - ') || [];

        // Extract subject name
        const subjectElement = classInfo.querySelector('.class-name a');
        const subject = subjectElement?.textContent.trim();

        // Extract location (last text-ellipsis element in class-info)
        const textElements = classInfo.querySelectorAll('.text-ellipsis');
        const location = textElements.length > 0
          ? textElements[textElements.length - 1].textContent.trim()
          : 'Unknown location';

        if (startTime && endTime && subject) {
          events.push({
            day: day,
            start_time: startTime.trim(),
            end_time: endTime.trim(),
            subject: subject,
            location: location,
          });
        }
      } catch (error) {
        console.error('Error parsing class:', error);
      }
    });
  });

  return events;
}

// Add at the beginning of content.js
if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  // Register message listener properly
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrapeData") {
      try {
        if (!document.querySelector('thead tr th')) {
          throw new Error('Timetable structure not found');
        }
        const data = scrapeTimetable();
        console.log('Scraped data:', data);
        sendResponse({ data: data });
      } catch (error) {
        console.error('Scraping failed:', error);
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