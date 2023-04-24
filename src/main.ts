import { RPCClient, RPCServer } from "./RPCService.js";

const params = new URLSearchParams(window.location.search);
const paramChannel = params.get("channel");
const channel = new BroadcastChannel("ChannelDataService");

const dataService = {
  processData<T>(data: T) {
    if (!Array.isArray(data)) return data;

    return data.reduce((prev, curr) => prev + curr, 0);
  },
};

if (paramChannel === "1") {
  console.log("Channel 1")
  // First Window
  const rpcClient = new RPCClient({
    sendRequest(message) {
      channel.postMessage(message);
    },
    attachResponseHandler(handler) {
      channel.onmessage = (m) => {
        handler(m.data);
      };
    },
  });
  const proxy = rpcClient.createProxy("DataService");

  document.getElementById("btnRunTest")?.addEventListener("click", async () => {
    const result = await proxy.processData([1, 4, 9]);
    console.log("Result", result);
  });
}

if (paramChannel === "2") {
  console.log("Channel 2")
  // Second Window
  const rpcServer = new RPCServer({
    attachRequestHandler(handler) {
      channel.onmessage = (m) => handler(m.data);
    },
    sendResponse(message) {
      channel.postMessage(message);
    },
  });
  rpcServer.registerHost("DataService", dataService);
}

