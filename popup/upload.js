const params = new URLSearchParams(window.location.search);
const videoKey = params.get('videoKey');
const screenshotKey = params.get('screenshotKey');
const contentDiv = document.getElementById("content");

// Retrieve video or screenshot from chrome.storage based on the key
if (videoKey) {
  chrome.storage.local.get([videoKey, "consoleLogs", "networkLogs"], (result) => {
    const videoUrl = result[videoKey];
    const consoleLogs = result.consoleLogs || [];
    const networkLogs = result.networkLogs || [];

    if (videoUrl) {
      // Create a video element to display the recorded video
      const videoElement = document.createElement("video");
      videoElement.id = "video";
      videoElement.controls = true;
      videoElement.src = videoUrl;
      contentDiv.appendChild(videoElement);

      // Display the logs
      const logsDiv = document.createElement("div");
      logsDiv.innerHTML = `<h2>Console Logs</h2><pre>${consoleLogs.join('\n')}</pre><h2>Network Logs</h2><pre>${networkLogs.join('\n')}</pre>`;
      contentDiv.appendChild(logsDiv);
    } else {
      contentDiv.innerHTML = "Video not found.";
    }
  });
} else if (screenshotKey) {
  chrome.storage.local.get([screenshotKey], (result) => {
    const screenshotUrl = result[screenshotKey];
    if (screenshotUrl) {
      // Create an img element to display the screenshot
      const imgElement = document.createElement("img");
      imgElement.id = "screenshot";
      imgElement.src = screenshotUrl;
      contentDiv.appendChild(imgElement);
    } else {
      contentDiv.innerHTML = "Screenshot not found.";
    }
  });
} else {
  contentDiv.innerHTML = "No video or screenshot available.";
}
