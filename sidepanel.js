// sidepanel.js

document.addEventListener("DOMContentLoaded", () => {
    const startButton = document.getElementById("startButton");
    const stopButton = document.getElementById("stopButton");
    const sendToJiraButton = document.getElementById("sendToJira");
    const copyButton = document.getElementById("copyButton");
    const notes = document.getElementById("notes");
    const recordingInfo = document.getElementById("recordingInfo");
    const recordingSummary = document.getElementById("recordingSummary");
    const downloadLinks = document.getElementById("downloadLinks");
    const downloadScreenShare = document.getElementById("downloadScreenShare");
    const downloadDebugLog = document.getElementById("downloadDebugLog");
    const warningMessage = document.getElementById("warningMessage");
    const upgradeButton = document.getElementById("upgradeButton");
    const progressBar = document.getElementById("progressBar");
    const recordingTab = document.getElementById("recordingTab");
    const screenCaptureTab = document.getElementById("screenCaptureTab");
    const recordingContent = document.getElementById("recordingContent");
    const screenCaptureContent = document.getElementById("screenCaptureContent");
    const screenshotButton = document.getElementById("screenshotButton");
    const timerDisplay = document.getElementById("timer");

    function sendMessageToBackground(message) {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("Background script might not be ready yet:", chrome.runtime.lastError.message);
            } else {
                console.log("Response:", response);
            }
        });
    }


    function addListener(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`${event} listener not attached: Element missing`);
        }
    }

    document.getElementById('startButton').addEventListener('click', async () => {
        chrome.runtime.sendMessage({ type: 'start-recording' });
    });

    document.getElementById('stopButton').addEventListener('click', async () => {
        chrome.runtime.sendMessage({ type: 'stop-recording' });
    });
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'toggle-buttons') {
            document.getElementById('startButton').disabled = message.recording;
            document.getElementById('stopButton').disabled = !message.recording;
        }
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'video-recorded') {
            const downloadLink = document.getElementById('downloadScreenShare');
            downloadLink.href = message.videoUrl;
            downloadLink.download = 'recorded_video.mp4';

            // Show the download section
            document.getElementById('downloadLinks').style.display = 'block';
        }
    });


    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "debug-log-data") {
            console.log("📥 Received log data in side panel");

            const blob = new Blob([message.logData], { type: "text/plain" });
            const url = URL.createObjectURL(blob);

            // Update download link in the UI
            const downloadLink = document.getElementById("downloadDebugLog");
            downloadLink.href = url;
            downloadLink.download = "debug-log.txt";

            // Show the download button
            document.getElementById("downloadLinks").style.display = "block";
        }
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'video-uploaded') {
            document.getElementById('notes').value = JSON.stringify(message.uploadResponse?.result, null, 2);
        } else if (message.type === 'upload-error') {
            document.getElementById('notes').value = `Upload Failed: ${message.error}`;
        }
    });

    addListener(recordingTab, "click", () => {
        recordingContent.style.display = "block";
        screenCaptureContent.style.display = "none";
    });

    addListener(screenCaptureTab, "click", () => {
        recordingContent.style.display = "none";
        screenCaptureContent.style.display = "block";
    });

    if (progressBar) {
        progressBar.value = 0; // Reset progress on load
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "recordingSaved") {
            const webmLink = document.createElement("a");
            webmLink.href = message.url;
            webmLink.download = "recording.mp4";
            webmLink.textContent = "Download MP4";
            downloadLinks.appendChild(webmLink);
            downloadLinks.appendChild(document.createElement("br"));
        } else if (message.action === "mp4Ready") {
            const mp4Link = document.createElement("a");
            mp4Link.href = message.url;
            mp4Link.download = "recording.mp4";
            mp4Link.textContent = "Download MP4";
            downloadLinks.appendChild(mp4Link);
        }
    });
});
