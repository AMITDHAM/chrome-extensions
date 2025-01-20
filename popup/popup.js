const startButton = document.getElementById("startRecording");
const stopButton = document.getElementById("stopRecording");
const screenshotButton = document.getElementById("takeScreenshot");

startButton.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "startRecording" });
  startButton.disabled = true;
  stopButton.disabled = false;
});

stopButton.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "stopRecording" });
  startButton.disabled = false;
  stopButton.disabled = true;
});

screenshotButton.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "takeScreenshot" });
});
