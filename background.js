chrome.runtime.onInstalled.addListener(() => {
  console.log("Background script installed and running.");
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    await chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html' });
    console.log('Side panel opened successfully.');
  } catch (error) {
    console.error('Error opening side panel:', error);
  }
});

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({});
  const offscreenExists = existingContexts.some((c) => c.contextType === "OFFSCREEN_DOCUMENT");

  if (!offscreenExists) {
    console.log("🛠 Creating offscreen document...");
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Required for video recording"
    });
  } else {
    console.log("✅ Offscreen document already exists.");
  }
}

// Ensure offscreen page exists when extension starts
chrome.runtime.onInstalled.addListener(() => {
  ensureOffscreenDocument();
});

// Handle messages
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.target === "offscreen") {
    await ensureOffscreenDocument();
    chrome.runtime.sendMessage(message);
  }

  if (message.type === 'start-recording') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });

    chrome.runtime.sendMessage({
      type: 'start-recording',
      target: 'offscreen',
      data: streamId
    });

    currentTabId = tab.id;
    debugLogs = [];
    networkLogs = [];
    attachDebugger(currentTabId);

    chrome.runtime.sendMessage({ type: 'toggle-buttons', recording: true });
  }

  if (message.type === 'stop-recording') {
    chrome.runtime.sendMessage({ type: 'stop-recording', target: 'offscreen' });

    if (currentTabId) {
      chrome.debugger.detach({ tabId: currentTabId }, () => console.log("⛔ Debugger detached."));
    }
    createDebugLogFile();

    chrome.runtime.sendMessage({ type: 'toggle-buttons', recording: false });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'video-recorded') {
      console.log("📩 Received video blob from offscreen.js. Uploading...");
      
      // Convert Blob to File for upload if needed
      const file = new File([message.videoBlob], "recorded_video.mp4", { type: "video/mp4" });
  
      uploadVideo(file);
    }
  });
  
});

// Logging & Debugging
let debugLogs = [];
let networkLogs = [];
let currentTabId = null;

// Attach Debugger to Capture Console Logs
function attachDebugger(tabId) {
  chrome.debugger.attach({ tabId }, "1.0", () => {
    console.log("✅ Debugger attached to tab:", tabId);
    chrome.debugger.sendCommand({ tabId }, "Console.enable");
  });

  chrome.debugger.onEvent.addListener((source, method, params) => {
    if (method === "Console.messageAdded") {
      debugLogs.push(params.message.text);
    }
  });
}

// Capture Network Logs
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId === currentTabId) {
      networkLogs.push(`[${details.method}] ${details.url} → ${details.statusCode}`);
    }
  },
  { urls: ["<all_urls>"] }
);

// Generate & Send Debug Log File
function createDebugLogFile() {
  const logData = [
    "===== Console Logs =====",
    ...debugLogs,
    "\n===== Network Logs =====",
    ...networkLogs,
  ].join("\n");

  // Send raw log data to sidepanel.js
  chrome.runtime.sendMessage({ type: "debug-log-data", logData });
}

// Upload Video (Moved from offscreen.js)
async function uploadVideo(videoBlob) {
  console.log("📤 Preparing video for upload...");

  if (!(videoBlob instanceof Blob)) {
      console.error("❌ videoBlob is not a valid Blob. Received:", videoBlob);
      return;
  }

  const formData = new FormData();
  formData.append("videoFile", videoBlob, "recorded-video.mp4");

  console.log("🌐 Sending API request...");
  try {
      const response = await fetch("https://deal.hubstools.com/upload", {
          method: "POST",
          body: formData,
      });

      console.log("📡 API response status:", response.status);

      if (!response.ok) {
          throw new Error(`Upload failed with status: ${response.status}`);
      }

      const jsonResponse = await response.json();
      console.log("✅ Upload successful:", jsonResponse);

      // Send upload result to side panel
      chrome.runtime.sendMessage({ type: 'video-uploaded', uploadResponse: jsonResponse });
  } catch (error) {
      console.error("❌ Upload failed:", error);
      chrome.runtime.sendMessage({ type: 'upload-error', error: error.message });
  }
}
