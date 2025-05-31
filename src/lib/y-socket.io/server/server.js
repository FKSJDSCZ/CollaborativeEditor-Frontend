#!/usr/bin/env node
"use strict";
var C = Object.create;
var y = Object.defineProperty;
var Y = Object.getOwnPropertyDescriptor;
var _ = Object.getOwnPropertyNames;
var L = Object.getPrototypeOf, N = Object.prototype.hasOwnProperty;
var E = (s, i, e, t) => {
  if (i && typeof i == "object" || typeof i == "function")
    for (let n of _(i))
      !N.call(s, n) && n !== e && y(s, n, { get: () => i[n], enumerable: !(t = Y(i, n)) || t.enumerable });
  return s;
};
var p = (s, i, e) => (e = s != null ? C(L(s)) : {}, E(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  i || !s || !s.__esModule ? y(e, "default", { value: s, enumerable: !0 }) : e,
  s
));

// src/server/server.ts
var U = p(require("http")), D = require("socket.io");

// src/server/y-socket-io.ts
var o = p(require("yjs")), m = p(require("y-protocols/awareness")), v = require("y-leveldb");

// src/server/document.ts
var w = p(require("yjs")), u = p(require("y-protocols/awareness")), O = process.env.GC !== "false" && process.env.GC !== "0", d = class extends w.Doc {
  /**
   * Document constructor.
   * @constructor
   * @param {string} name Name for the document
   * @param {Namespace} namespace The namespace connection
   * @param {Callbacks} callbacks The document callbacks
   */
  constructor(e, t, n) {
    super({ gc: O });
    /**
     * Handles the document's update and emit eht changes to clients.
     * @type {(update: Uint8Array) => void}
     * @param {Uint8Array} update
     * @private
     */
    this.onUpdateDoc = (e) => {
      var t;
      if (((t = this.callbacks) == null ? void 0 : t.onUpdate) != null)
        try {
          this.callbacks.onUpdate(this, e);
        } catch (n) {
          console.warn(n);
        }
      this.namespace.emit("sync-update", e);
    };
    /**
     * Handles the awareness update and emit the changes to clients.
     * @type {({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }, _socket: Socket | null) => void}
     * @param {AwarenessChange} awarenessChange
     * @param {Socket | null} _socket
     * @private
     */
    this.onUpdateAwareness = ({ added: e, updated: t, removed: n }, a) => {
      var c;
      let l = e.concat(t, n), r = u.encodeAwarenessUpdate(this.awareness, l);
      if (((c = this.callbacks) == null ? void 0 : c.onChangeAwareness) != null)
        try {
          this.callbacks.onChangeAwareness(this, r);
        } catch (P) {
          console.warn(P);
        }
      this.namespace.emit("awareness-update", r);
    };
    this.name = e, this.namespace = t, this.awareness = new u.Awareness(this), this.awareness.setLocalState(null), this.callbacks = n, this.awareness.on("update", this.onUpdateAwareness), this.on("update", this.onUpdateDoc);
  }
  /**
   * Destroy the document and remove the listeners.
   * @type {() => Promise<void>}
   */
  async destroy() {
    var e;
    if (((e = this.callbacks) == null ? void 0 : e.onDestroy) != null)
      try {
        await this.callbacks.onDestroy(this);
      } catch (t) {
        console.warn(t);
      }
    this.awareness.off("update", this.onUpdateAwareness), this.off("update", this.onUpdateDoc), this.namespace.disconnectSockets(), super.destroy();
  }
};

// src/server/y-socket-io.ts
var S = require("lib0/observable"), h = class extends S.Observable {
  /**
   * YSocketIO constructor.
   * @constructor
   * @param {Server} io Server instance from Socket IO
   * @param {YSocketIOConfiguration} configuration (Optional) The YSocketIO configuration
   */
  constructor(e, t) {
    var n;
    super();
    /**
     * @type {Map<string, Document>}
     */
    this._documents = /* @__PURE__ */ new Map();
    /**
     * @type {string | undefined | null}
     */
    this._levelPersistenceDir = null;
    /**
     * @type {Persistence | null}
     */
    this.persistence = null;
    /**
     * @type {Namespace | null}
     */
    this.nsp = null;
    /**
     * This function initializes the socket event listeners to synchronize document changes.
     *
     *  The synchronization protocol is as follows:
     *  - A client emits the sync step one event (`sync-step-1`) which sends the document as a state vector
     *    and the sync step two callback as an acknowledgment according to the socket io acknowledgments.
     *  - When the server receives the `sync-step-1` event, it executes the `syncStep2` acknowledgment callback and sends
     *    the difference between the received state vector and the local document (this difference is called an update).
     *  - The second step of the sync is to apply the update sent in the `syncStep2` callback parameters from the server
     *    to the document on the client side.
     *  - There is another event (`sync-update`) that is emitted from the client, which sends an update for the document,
     *    and when the server receives this event, it applies the received update to the local document.
     *  - When an update is applied to a document, it will fire the document's "update" event, which
     *    sends the update to clients connected to the document's namespace.
     * @private
     * @type {(socket: Socket, doc: Document) => void}
     * @param {Socket} socket The socket connection
     * @param {Document} doc The document
     */
    this.initSyncListeners = (e, t) => {
      e.on("sync-step-1", (n, a) => {
        a(o.encodeStateAsUpdate(t, new Uint8Array(n)));
      }), e.on("sync-update", (n) => {
        o.applyUpdate(t, n, null);
      });
    };
    /**
     * This function initializes socket event listeners to synchronize awareness changes.
     *
     *  The awareness protocol is as follows:
     *  - A client emits the `awareness-update` event by sending the awareness update.
     *  - The server receives that event and applies the received update to the local awareness.
     *  - When an update is applied to awareness, the awareness "update" event will fire, which
     *    sends the update to clients connected to the document namespace.
     * @private
     * @type {(socket: Socket, doc: Document) => void}
     * @param {Socket} socket The socket connection
     * @param {Document} doc The document
     */
    this.initAwarenessListeners = (e, t) => {
      e.on("awareness-update", (n) => {
        m.applyAwarenessUpdate(t.awareness, new Uint8Array(n), e);
      });
    };
    /**
     *  This function initializes socket event listeners for general purposes.
     *
     *  When a client has been disconnected, check the clients connected to the document namespace,
     *  if no connection remains, emit the `all-document-connections-closed` event
     *  parameters and if LevelDB persistence is enabled, persist the document in LevelDB and destroys it.
     * @private
     * @type {(socket: Socket, doc: Document) => void}
     * @param {Socket} socket The socket connection
     * @param {Document} doc The document
     */
    this.initSocketListeners = (e, t) => {
      e.on("disconnect", async () => {
        (await e.nsp.allSockets()).size === 0 && (this.emit("all-document-connections-closed", [t]), this.persistence != null && (await this.persistence.writeState(t.name, t), await t.destroy()));
      });
    };
    /**
     * This function is called when a client connects and it emit the `sync-step-1` and `awareness-update`
     * events to the client to start the sync.
     * @private
     * @type {(socket: Socket, doc: Document) => void}
     * @param {Socket} socket The socket connection
     * @param {Document} doc The document
     */
    this.startSynchronization = (e, t) => {
      e.emit("sync-step-1", o.encodeStateVector(t), (n) => {
        o.applyUpdate(t, new Uint8Array(n), this);
      }), e.emit("awareness-update", m.encodeAwarenessUpdate(t.awareness, Array.from(t.awareness.getStates().keys())));
    };
    this.io = e, this._levelPersistenceDir = (n = t == null ? void 0 : t.levelPersistenceDir) != null ? n : process.env.YPERSISTENCE, this._levelPersistenceDir != null && this.initLevelDB(this._levelPersistenceDir), this.configuration = t;
  }
  /**
   * YSocketIO initialization.
   *
   *  This method set ups a dynamic namespace manager for namespaces that match with the regular expression `/^\/yjs\|.*$/`
   *  and adds the connection authentication middleware to the dynamics namespaces.
   *
   *  It also starts socket connection listeners.
   * @type {() => void}
   */
  initialize() {
    this.nsp = this.io.of(/^\/yjs\|.*$/), this.nsp.use(async (e, t) => {
      var n;
      return ((n = this.configuration) == null ? void 0 : n.authenticate) == null || await this.configuration.authenticate(e.handshake) ? t() : t(new Error("Unauthorized"));
    }), this.nsp.on("connection", async (e) => {
      var a;
      let t = e.nsp.name.replace(/\/yjs\|/, ""), n = await this.initDocument(t, e.nsp, (a = this.configuration) == null ? void 0 : a.gcEnabled);
      this.initSyncListeners(e, n), this.initAwarenessListeners(e, n), this.initSocketListeners(e, n), this.startSynchronization(e, n);
    });
  }
  /**
   * The document map's getter. If you want to delete a document externally, make sure you don't delete
   * the document directly from the map, instead use the "destroy" method of the document you want to delete,
   * this way when you destroy the document you are also closing any existing connection on the document.
   * @type {Map<string, Document>}
   */
  get documents() {
    return this._documents;
  }
  /**
   * This method creates a yjs document if it doesn't exist in the document map. If the document exists, get the map document.
   *
   *  - If document is created:
   *      - Binds the document to LevelDB if LevelDB persistence is enabled.
   *      - Adds the new document to the documents map.
   *      - Emit the `document-loaded` event
   * @private
   * @param {string} name The name for the document
   * @param {Namespace} namespace The namespace of the document
   * @param {boolean} gc Enable/Disable garbage collection (default: gc=true)
   * @returns {Promise<Document>} The document
   */
  async initDocument(e, t, n = !0) {
    var l;
    let a = (l = this._documents.get(e)) != null ? l : new d(e, t, {
      onUpdate: (r, c) => this.emit("document-update", [r, c]),
      onChangeAwareness: (r, c) => this.emit("awareness-update", [r, c]),
      onDestroy: async (r) => {
        this._documents.delete(r.name), this.emit("document-destroy", [r]);
      }
    });
    return a.gc = n, this._documents.has(e) || (this.persistence != null && await this.persistence.bindState(e, a), this._documents.set(e, a), this.emit("document-loaded", [a])), a;
  }
  /**
   * This method sets persistence if enabled.
   * @private
   * @param {string} levelPersistenceDir The directory path where the persistent Level database is stored
   */
  initLevelDB(e) {
    let t = new v.LeveldbPersistence(e);
    this.persistence = {
      provider: t,
      bindState: async (n, a) => {
        let l = await t.getYDoc(n), r = o.encodeStateAsUpdate(a);
        await t.storeUpdate(n, r), o.applyUpdate(a, o.encodeStateAsUpdate(l)), a.on("update", async (c) => await t.storeUpdate(n, c));
      },
      writeState: async (n, a) => {
      }
    };
  }
};

// src/server/server.ts
var g, z = (g = process.env.HOST) != null ? g : "localhost", A, f = parseInt(`${(A = process.env.PORT) != null ? A : 1234}`), b = U.default.createServer((s, i) => {
  i.writeHead(200, { "Content-Type": "application/json" }), i.end(JSON.stringify({ ok: !0 }));
}), k = new D.Server(b), x = new h(k, {
  // authenticate: (handshake) => handshake.auth.token === 'valid-token',
  // OR
  // authenticate: (handshake) => {
  //   return new Promise<boolean>(resolve => {
  //     setTimeout(() => resolve(handshake.auth.token === 'valid-token'), 2000)
  //   })
  // },
  // levelPersistenceDir: './storage-location',
  // gcEnabled: true,
});
x.initialize();
k.on("connection", (s) => {
  console.log(`[connection] Connected with user: ${s.id}`), s.on("disconnect", () => {
    console.log(`[disconnect] Disconnected with user: ${s.id}`);
  });
});
b.listen(f, z, void 0, () => console.log(`Server running on port ${f}`));
//# sourceMappingURL=server.js.map