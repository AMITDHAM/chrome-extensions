let mediaRecorder;
let recordedChunks = [];
let screenshotKey = ''; // For storing the key of the screenshot in chrome.storage
let consoleLogs = [];
let networkLogs = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message.type);

  if (message.type === "startRecording") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        console.log("Active tab found, executing script to start recording...");
        injectLogCaptureScript(tabs[0].id);
        startScreenRecording();
      }
    });
  } else if (message.type === "stopRecording") {
    console.log("Stopping recording...");
    if (mediaRecorder) {
      mediaRecorder.stop();
      console.log("Recording stopped.");
    } else {
      console.log("No active recording to stop.");
    }
  } else if (message.type === "takeScreenshot") {
    console.log("Taking screenshot...");
    chrome.tabs.captureVisibleTab((screenshotUrl) => {
      screenshotKey = 'screenshot_' + Date.now(); // Generate a unique key
      chrome.storage.local.set({ [screenshotKey]: screenshotUrl }, () => {
        console.log(`Screenshot saved. Use the key: ${screenshotKey}`);
        console.log("To retrieve the URL, run this in the console:");
        console.log(`chrome.storage.local.get("${screenshotKey}", console.log)`);
    
        // Open the screenshot in a new tab
        chrome.tabs.create({
          url: screenshotUrl,
        });
      });
    });
    
  } else if (message.type === "captureConsoleLog") {
    consoleLogs.push(message.log);
  } else if (message.type === "captureNetworkLog") {
    networkLogs.push({ url: message.url, status: message.status });
  } else if (message.type === "videoReady") {
    const blob = message.blob;
    const videoUrl = URL.createObjectURL(blob);

    console.log("Video Blob URL:", videoUrl); // Log the Blob URL
    chrome.storage.local.set({ videoUrl }, () => {
      console.log("Video URL stored in storage.");
    });

    // Open the video in a new tab
    chrome.tabs.create({
      url: videoUrl,
    });
  }
});

function startScreenRecording() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          navigator.mediaDevices
            .getDisplayMedia({ video: true, audio: true })
            .then((stream) => {
              const mediaRecorder = new MediaRecorder(stream);
              let recordedChunks = [];

              mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                  recordedChunks.push(event.data);
                }
              };

              mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: "video/webm" });
                const videoUrl = URL.createObjectURL(blob);

                chrome.runtime.sendMessage({ type: "videoReady", blob });
              };

              mediaRecorder.start();
              window.mediaRecorder = mediaRecorder; // Save to window for control
            })
            .catch((error) => {
              chrome.runtime.sendMessage({ type: "error", message: error.message });
            });
        },
      });
    }
  });
}

// Inject script to capture console logs and network logs
function injectLogCaptureScript(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      // Capture console logs
      const originalConsoleLog = console.log;
      console.log = function (...args) {
        originalConsoleLog.apply(console, args);
        chrome.runtime.sendMessage({
          type: "captureConsoleLog",
          log: args.join(" "),
        });
      };

      // Capture network logs (XHR, Fetch)
      const originalFetch = window.fetch;
      window.fetch = function (...args) {
        return originalFetch.apply(this, args).then((response) => {
          chrome.runtime.sendMessage({
            type: "captureNetworkLog",
            url: args[0],
            status: response.status,
          });
          return response;
        });
      };

      const originalXMLHttpRequest = window.XMLHttpRequest;
      window.XMLHttpRequest = function () {
        const xhr = new originalXMLHttpRequest();
        xhr.addEventListener("readystatechange", function () {
          if (xhr.readyState === 4) {
            chrome.runtime.sendMessage({
              type: "captureNetworkLog",
              url: xhr.responseURL,
              status: xhr.status,
            });
          }
        });
        return xhr;
      };
    },
  });
}
