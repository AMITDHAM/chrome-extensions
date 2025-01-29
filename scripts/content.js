// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "startRecording") {
    console.log("Starting screen recording...");

    navigator.mediaDevices
      .getDisplayMedia({ video: true, audio: true })
      .then((stream) => {
        let recordedChunks = [];
        const mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunks, { type: "video/webm" });
          const videoKey = 'video_' + Date.now();
          chrome.storage.local.set({ [videoKey]: blob }, () => {
            chrome.runtime.sendMessage({ type: "recordingComplete", videoKey });
          });
        };

        mediaRecorder.start();
        chrome.runtime.sendMessage({ type: "recordingStarted" });
      })
      .catch((error) => {
        console.error("Error starting recording:", error.message);
      });
  }
});

// Capture console logs
const originalConsoleLog = console.log;
console.log = function (...args) {
  originalConsoleLog.apply(console, args);
  chrome.runtime.sendMessage(
    {
      type: "captureConsoleLog",
      log: args.join(" "),
    },
    (response) => {
      if (chrome.runtime.lastError) {
        originalConsoleLog("Error sending console log:", chrome.runtime.lastError.message);
      } else {
        originalConsoleLog("Console log sent:", response);
      }
    }
  );
};

// Capture network logs (Fetch API)
const originalFetch = window.fetch;
window.fetch = function (...args) {
  console.log("Intercepted fetch call:", args[0]);
  return originalFetch.apply(this, args).then((response) => {
    chrome.runtime.sendMessage(
      {
        type: "captureNetworkLog",
        url: args[0],
        status: response.status,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.log("Error sending network log:", chrome.runtime.lastError.message);
        }
      }
    );
    return response;
  });
};

// Capture network logs (XMLHttpRequest)
const originalXMLHttpRequest = window.XMLHttpRequest;
window.XMLHttpRequest = function () {
  const xhr = new originalXMLHttpRequest();
  xhr.addEventListener("readystatechange", function () {
    if (xhr.readyState === 4) {
      console.log("Intercepted XHR call:", xhr.responseURL);
      chrome.runtime.sendMessage(
        {
          type: "captureNetworkLog",
          url: xhr.responseURL,
          status: xhr.status,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.log("Error sending network log:", chrome.runtime.lastError.message);
          }
        }
      );
    }
  });
  return xhr;
};
