let mediaRecorder;
let recordedChunks = [];
let screenshotKey = '';
let consoleLogs = [];
let networkLogs = [];
let videoBlobUrl = '';

// Handle messages from the popup or other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message.type);

  switch (message.type) {
    case "startRecording":
      handleStartRecording();
      break;

    case "stopRecording":
      handleStopRecording();
      break;

    case "takeScreenshot":
      handleTakeScreenshot();
      break;

    case "recordingBlobUrl":
      handleRecordingBlobUrl(message);
      break;

    case "captureConsoleLog":
      captureConsoleLog(message.log);
      break;

    case "captureNetworkLog":
      captureNetworkLog(message.url, message.status);
      break;

    default:
      console.warn("Unknown message type:", message.type);
  }
});

function handleStartRecording() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      console.log("Injecting log capture script...");
      injectLogCaptureScript(tabs[0].id);
      startScreenRecording(tabs[0].id);
    } else {
      console.error("No active tab found.");
    }
  });
}

function handleStopRecording() {
  if (mediaRecorder) {
    mediaRecorder.stop();
    console.log("Recording stopped.");
    saveLogs();
  } else {
    console.warn("No active recording to stop.");
  }
}

function handleTakeScreenshot() {
  console.log("Taking screenshot...");
  chrome.tabs.captureVisibleTab((screenshotUrl) => {
    if (chrome.runtime.lastError) {
      console.error("Failed to take screenshot:", chrome.runtime.lastError.message);
      return;
    }

    screenshotKey = `screenshot_${Date.now()}`;
    chrome.storage.local.set({ [screenshotKey]: screenshotUrl }, () => {
      console.log(`Screenshot saved with key: ${screenshotKey}`);
      chrome.tabs.create({ url: screenshotUrl });
    });
  });
}

function handleRecordingBlobUrl(message) {
  console.log("Video Blob URL received:", message.blobUrl);

  videoBlobUrl = message.blobUrl;

  chrome.storage.local.set({ videoBlobUrl }, () => {
    console.log("Video Blob URL saved.");
  });

  // Upload video and handle response
  uploadVideo(videoBlobUrl)
    .then((response) => {
      console.log("Video uploaded successfully.");
      createResultTab(response || {});
    })
    .catch((error) => {
      console.error("Error uploading video:", error);
      createResultTab(); // Default response
    });
}




function startScreenRecording(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
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
            const blob = new Blob(recordedChunks, { type: "video/mp4" });
            const blobUrl = URL.createObjectURL(blob);
            chrome.runtime.sendMessage({ type: "recordingBlobUrl", blobUrl });
          };

          mediaRecorder.start();
          window.mediaRecorder = mediaRecorder;
        })
        .catch((error) => {
          chrome.runtime.sendMessage({ type: "error", message: error.message });
        });
    },
  });
}

function injectLogCaptureScript(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      console.log("Log capture script injected.");

      // Capture console logs
      const originalConsoleLog = console.log;
      console.log = function (...args) {
        originalConsoleLog.apply(console, args);
        chrome.runtime.sendMessage({ type: "captureConsoleLog", log: args.join(" ") });
      };

      // Capture network logs (fetch and XHR)
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
        xhr.addEventListener("readystatechange", () => {
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

function captureConsoleLog(log) {
  consoleLogs.push(log);
  console.log("Captured console log:", log);
}

function captureNetworkLog(url, status) {
  networkLogs.push({ url, status });
  console.log("Captured network log:", { url, status });
}

function saveLogs() {
  const logContent = `
    Console Logs:
    ${consoleLogs.join("\n")}
    
    Network Logs:
    ${networkLogs.map(log => `URL: ${log.url}, Status: ${log.status}`).join("\n")}
  `;
  console.log("Final logs:", logContent);
  chrome.storage.local.set({ consoleLogs, networkLogs }, () => {
    console.log("Logs saved for later access.");
  });
}

async function uploadVideo(blobUrl) {
  const response = await fetch(blobUrl);
  const videoBlob = await response.blob();

  const MAX_FILE_SIZE = 30 * 1024 * 1024;
  if (videoBlob.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds the allowed limit of 30MB.");
  }

  const formData = new FormData();
  formData.append("videoFile", videoBlob, "recorded-video.mp4");

  const uploadResponse = await fetch("https://deal.hubstools.com/upload", {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed with status: ${uploadResponse.status}`);
  }

  return await uploadResponse.json();
}

function createResultTab(response = {}) {
  const content = `
    <html>
      <body>
        <h1>Recording Result</h1>
        <video controls src="${videoBlobUrl}" style="max-width: 100%; height: auto;"></video>
        <h2>Console Logs</h2>
        <pre>${consoleLogs.join("\n")}</pre>
        <h2>Network Logs</h2>
        <pre>${networkLogs.map(log => `URL: ${log.url}, Status: ${log.status}`).join("\n")}</pre>
        <h2>Uploaded Video Details</h2>
        <p><strong>Title:</strong> ${response.title || "No title available"}</p>
        <p><strong>Environment:</strong> ${response.environment || "No environment details"}</p>
        <p><strong>Precondition:</strong> ${response.precondition || "No precondition provided"}</p>
        <p><strong>Steps to Reproduce:</strong> ${response.stepsToReproduce || "No steps to reproduce provided"}</p>
      </body>
    </html>
  `;

  const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(content);

  chrome.tabs.create({ url: dataUrl });
}

function attachDebugger(tabId) {
  chrome.debugger.attach({ tabId }, "1.3", () => {
    console.log("Debugger attached to tab:", tabId);

    chrome.debugger.sendCommand({ tabId }, "Console.enable");

    chrome.debugger.onEvent.addListener((source, method, params) => {
      if (method === "Console.messageAdded") {
        consoleLogs.push(params.message.text); // Capture tab's console logs
      }
    });
  });
}

function detachDebugger(tabId) {
  chrome.debugger.detach({ tabId }, () => {
    console.log("Debugger detached from tab:", tabId);
  });
}


