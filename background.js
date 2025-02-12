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

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'start-recording') {
      const existingContexts = await chrome.runtime.getContexts({});
      let recording = false;

      const offscreenDocument = existingContexts.find(
          (c) => c.contextType === 'OFFSCREEN_DOCUMENT'
      );

      if (!offscreenDocument) {
          await chrome.offscreen.createDocument({
              url: 'offscreen.html',
              reasons: ['USER_MEDIA'],
              justification: 'Recording from chrome.tabCapture API'
          });
      } else {
          recording = offscreenDocument.documentUrl.endsWith('#recording');
      }

      if (recording) return;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const streamId = await chrome.tabCapture.getMediaStreamId({
          targetTabId: tab.id
      });

      chrome.runtime.sendMessage({
          type: 'start-recording',
          target: 'offscreen',
          data: streamId
      });

      // Enable stop button and disable start button
      chrome.runtime.sendMessage({ type: 'toggle-buttons', recording: true });
  }

  if (message.type === 'stop-recording') {
      chrome.runtime.sendMessage({
          type: 'stop-recording',
          target: 'offscreen'
      });

      // Enable start button and disable stop button
      chrome.runtime.sendMessage({ type: 'toggle-buttons', recording: false });
  }
});
