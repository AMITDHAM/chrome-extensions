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
  