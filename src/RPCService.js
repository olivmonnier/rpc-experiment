export class RPCService {
  constructor(config = {}) {
    this._pendingRequests = new Map();
    this._hosts = new Map();
    this._nextMessageId = 0;

    this._apiWrapper = {
      sendResponse: config.sendResponse,
      sendRequest: config.sendRequest,
      attachRequestHandler: config.attachRequestHandler,
      attachResponseHandler: config.attachResponseHandler
    };

    if (this._apiWrapper.attachRequestHandler) {
      this._apiWrapper.attachRequestHandler(this._handleRequest.bind(this));
    }
    if (this._apiWrapper.attachResponseHandler) {
      this._apiWrapper.attachResponseHandler(this._handleResponse.bind(this));
    }
  }

  /**
   * Associate an existing service/object to a host name.
   * We'll use that hostName to create the proxy
   * @param {string} hostName
   * @param {any} host
   */
  registerHost(hostName, host) {
    this._hosts.set(hostName, host)
  }

  /**
   * Create a proxy over a given host
   * @param {sring} hostName The host name of the host to proxy
   */
  createProxy(hostName) {
    const proxyedObject = {
      hostName: hostName
    };

    return new Proxy(
      proxyedObject,
      this._createHandler()
    );
  }

  /**
   * Create the es6 proxy handler object
   * @private
   */
  _createHandler() {
    return {
      get: (obj, methodName) => {
        if (methodName === "then" || methodName === "catch") return undefined;

        if (obj[methodName]) return obj[methodName];

        return (...args) => {
          return this._sendRequest(methodName, args, obj.hostName)
        }
      }
    }
  }

  /**
   * @private
   * @param {string} methodName
   * @param {string} args
   * @param {string} hostName
   */
  _sendRequest(methodName, args, hostName) {
    return new Promise((resolve, reject) => {
      const message = {
        id: this._nextMessageId++,
        type: 'request',
        request: {
          hostName,
          methodName,
          args
        }
      };

      this._pendingRequests.set(message.id, {
        resolve,
        reject,
        methodName,
        args,
        id: message.id
      });

      this._apiWrapper.sendRequest(message);
    })
  }

  /**
   *
   * @private
   * @param {RPCMessage} message
   */
  _handleRequest(message) {
    if (message.type === "request") {

      console.log("Handling request", message);

      const request = message.request;
      this._executeHostMethod(request.hostName, request.methodName, request.args)
        .then((returnValue) => {
          const rpcMessage = {
            id: message.id,
            type: "response",
            response: {
              returnValue: returnValue
            }
          };

          console.log("Sending response", rpcMessage);
          this._apiWrapper.sendResponse(rpcMessage);
        })
        .catch((err) => {
          const rpcMessage = {
            id: message.id,
            type: "response",
            response: {
              returnValue: null,
              err: err.toString()
            }
          };

          this._apiWrapper.sendResponse(rpcMessage);
        });
      return true;
    }
  }

  /**
   * @private
   * @param {RPCMessage} message
   */
  _handleResponse(message) {
    if (message.type === "response") {

      console.log("Handling response", message);

      const pendingRequest = this._pendingRequests.get(message.id);
      if (!pendingRequest) {
        console.warn(
          "RPCService received a response for a non pending request"
        );
        return;
      }

      this._pendingRequests.delete(message.id);

      const response = message.response;
      if (response.err) {
        pendingRequest.reject(response.err);
      } else {
        pendingRequest.resolve(response.returnValue);
      }
    }
  }

  /**
   * Execute the real metho on the source object.
   *
   * @private
   * @param {string} hostName
   * @param {strinng} methodName
   * @param {string} args
   */
  _executeHostMethod(hostName, methodName, args) {
    const host = this._hosts.get(hostName);
    if (!host) {
      return Promise.reject(`Invalid host name "${hostName}"`);
    }
    let method = host[methodName];

    if (typeof method !== "function") {
      return Promise.reject(
        `Invalid method name "${methodName}" on host "${hostName}"`
      );
    }

    try {
      let returnValue = method.apply(host, args);

      if (returnValue === undefined) {
        return Promise.resolve();
      }
      if (typeof returnValue.then !== "function") {
        return Promise.resolve(returnValue);
      }
      return returnValue;
    } catch (err) {
      return Promise.reject(err);
    }
  }
}