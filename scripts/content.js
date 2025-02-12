let logs = [];

function captureConsoleLogs() {
    ['log', 'warn', 'error'].forEach((method) => {
        const original = console[method];
        console[method] = function (...args) {
            logs.push(`[${method.toUpperCase()}] ${args.map(String).join(' ')}`);
            original.apply(console, args);
        };
    });
}

function captureNetworkLogs() {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        logs.push(`[NETWORK] Fetch Request: ${args[0]}`);
        try {
            const response = await originalFetch.apply(this, args);
            logs.push(`[NETWORK] Response: ${response.status} ${response.statusText}`);
            return response;
        } catch (error) {
            logs.push(`[NETWORK] Fetch Error: ${error.message}`);
            throw error;
        }
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        logs.push(`[NETWORK] XHR Request: ${method} ${url}`);
        return originalOpen.apply(this, [method, url, ...rest]);
    };
}

// Start capturing logs
captureConsoleLogs();
captureNetworkLogs();

// Listen for messages from the side panel or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'get-logs') {
        sendResponse({ logs: logs.join('\n') });
    }
});
