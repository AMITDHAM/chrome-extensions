chrome.runtime.onMessage.addListener(async (message) => {
  console.log("Received message in offscreen.js:", message);

  if (message.target === 'offscreen') {
    switch (message.type) {
      case 'start-recording':
        console.log("Starting recording...");
        startRecording(message.data);
        break;
      case 'stop-recording':
        console.log("Stopping recording...");
        stopRecording();
        break;
      default:
        console.error("Unrecognized message:", message.type);
    }
  }
});

let recorder;
let data = [];

async function startRecording(streamId) {
  if (recorder?.state === 'recording') {
    console.warn("Called startRecording while recording is in progress.");
    return;
  }

  console.log("Initializing media capture...");
  const media = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    }
  });

  console.log("Media stream captured.");

  // Continue to play the captured audio to the user.
  const output = new AudioContext();
  const source = output.createMediaStreamSource(media);
  source.connect(output.destination);

  // Start recording.
  const options = { mimeType: 'video/webm; codecs=vp9' };
  if (MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) {
    options.mimeType = 'video/mp4';
  }

  recorder = new MediaRecorder(media, options);
  data = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      console.log("Data available:", event.data);
      data.push(event.data);
    }
  };

  recorder.onstop = async () => {
    console.log("Recording stopped. Processing video...");
    const blob = new Blob(data, { type: 'video/mp4' });
    console.log("Video Blob size:", blob.size);

    const videoUrl = URL.createObjectURL(blob);

    // Send blob and URL together
    chrome.runtime.sendMessage({ type: 'video-recorded', videoBlob: blob, videoUrl });

    recorder = undefined;
    data = [];
  };

  recorder.start();
  console.log("Recording started...");
  window.location.hash = 'recording';
}

async function stopRecording() {
  if (!recorder) {
    console.warn("Stop recording called but recorder is not initialized.");
    return;
  }

  console.log("Stopping recorder...");
  recorder.stop();
  recorder.stream.getTracks().forEach((t) => t.stop());
  window.location.hash = '';
}
