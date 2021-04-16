import { RPCService } from '../../src/RPCService.js';
import dataService from '../dataService.js';

const params = new URLSearchParams(window.location.search);
const paramChannel = params.get("channel");
const channel = new BroadcastChannel('ChannelDataService');

if (paramChannel === "1") {
  // First Window
  const rpcService = new RPCService({
    sendRequest(message) {
      channel.postMessage(message)
    },
    attachResponseHandler(handler) {
      channel.onmessage = m => {
        handler(m.data)
      }
    }
  });
  const proxy = rpcService.createProxy("DataService");

  document.getElementById('btnRunTest').addEventListener('click', async () => {
    const result = await proxy.processData([1, 4, 9]);
    console.log('Result', result)
  });
}

if (paramChannel === "2") {
  // Second Window
  const rpcService2 = new RPCService({
    attachRequestHandler(handler) {
      channel.onmessage = m => handler(m.data)
    },
    sendResponse(message) {
      channel.postMessage(message)
    }
  });
  rpcService2.registerHost('DataService', dataService);
}