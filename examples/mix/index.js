import { RPCService } from '../../src/RPCService.js';

const worker = new Worker("worker.js", { type: "module" });
const channel = new BroadcastChannel('ChannelDataService');
const rpcService = new RPCService({
  sendRequest(message) {
    worker.postMessage(message)
  },
  attachResponseHandler(handler) {
    worker.onmessage = m => {
      handler(m.data)
    }
  }
});
const proxy = rpcService.createProxy("DataService");

channel.onmessage = m => {
  console.log('Result', m.data.response.returnValue)
}

document.getElementById('btnRunTest').addEventListener('click', () => {
  proxy.processData([1, 4, 9]);
});