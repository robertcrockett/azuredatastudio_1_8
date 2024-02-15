/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nativeWatchdog from 'native-watchdog';
import * as net from 'net';
import { onUnexpectedError } from 'vs/base/common/errors';
import { Event } from 'vs/base/common/event';
import { IMessagePassingProtocol } from 'vs/base/parts/ipc/common/ipc';
import { PersistentProtocol, ProtocolConstants } from 'vs/base/parts/ipc/common/ipc.net';
import { NodeSocket } from 'vs/base/parts/ipc/node/ipc.net';
import product from 'vs/platform/product/node/product';
import { IInitData, MainThreadConsoleShape } from 'vs/workbench/api/common/extHost.protocol';
import { MessageType, createMessageOfType, isMessageOfType, IExtHostSocketMessage, IExtHostReadyMessage } from 'vs/workbench/services/extensions/common/extensionHostProtocol';
import { ExtensionHostMain, IExitFn, ILogServiceFn } from 'vs/workbench/services/extensions/node/extensionHostMain';
import { VSBuffer } from 'vs/base/common/buffer';
import { createBufferSpdLogService } from 'vs/platform/log/node/spdlogService';
import { ExtensionHostLogFileName } from 'vs/workbench/services/extensions/common/extensions';
import { ISchemeTransformer } from 'vs/workbench/api/common/extHostLanguageFeatures';
import { IURITransformer } from 'vs/base/common/uriIpc';
import { exists } from 'vs/base/node/pfs';
import { realpath } from 'vs/base/node/extpath';
import { IHostUtils } from 'vs/workbench/api/node/extHostExtensionService';

// With Electron 2.x and node.js 8.x the "natives" module
// can cause a native crash (see https://github.com/nodejs/node/issues/19891 and
// https://github.com/electron/electron/issues/10905). To prevent this from
// happening we essentially blocklist this module from getting loaded in any
// extension by patching the node require() function.
(function () {
	const Module = require.__$__nodeRequire('module') as any;
	const originalLoad = Module._load;

	Module._load = function (request: string) {
		if (request === 'natives') {
			throw new Error('Either the extension or a NPM dependency is using the "natives" node module which is unsupported as it can cause a crash of the extension host. Click [here](https://go.microsoft.com/fwlink/?linkid=871887) to find out more');
		}

		return originalLoad.apply(this, arguments);
	};
})();

// custom process.exit logic...
const nativeExit: IExitFn = process.exit.bind(process);
function patchProcess(allowExit: boolean) {
	process.exit = function (code?: number) {
		if (allowExit) {
			nativeExit(code);
		} else {
			const err = new Error('An extension called process.exit() and this was prevented.');
			console.warn(err.stack);
		}
	} as (code?: number) => never;

	process.crash = function () {
		const err = new Error('An extension called process.crash() and this was prevented.');
		console.warn(err.stack);
	};
}

// use IPC messages to forward console-calls
function patchPatchedConsole(mainThreadConsole: MainThreadConsoleShape): void {
	// The console is already patched to use `process.send()`
	const nativeProcessSend = process.send!;
	process.send = (...args: any[]) => {
		if (args.length === 0 || !args[0] || args[0].type !== '__$console') {
			return nativeProcessSend.apply(process, args);
		}

		mainThreadConsole.$logExtensionHostMessage(args[0]);
	};
}

const createLogService: ILogServiceFn = initData => createBufferSpdLogService(ExtensionHostLogFileName, initData.logLevel, initData.logsLocation.fsPath);

interface IRendererConnection {
	protocol: IMessagePassingProtocol;
	initData: IInitData;
}

// This calls exit directly in case the initialization is not finished and we need to exit
// Otherwise, if initialization completed we go to extensionHostMain.terminate()
let onTerminate = function () {
	nativeExit();
};

function _createExtHostProtocol(): Promise<IMessagePassingProtocol> {
	if (process.env.VSCODE_EXTHOST_WILL_SEND_SOCKET) {

		return new Promise<IMessagePassingProtocol>((resolve, reject) => {

			let protocol: PersistentProtocol | null = null;

			let timer = setTimeout(() => {
				reject(new Error('VSCODE_EXTHOST_IPC_SOCKET timeout'));
			}, 60000);

			let disconnectWaitTimer: NodeJS.Timeout | null = null;

			process.on('message', (msg: IExtHostSocketMessage, handle: net.Socket) => {
				if (msg && msg.type === 'VSCODE_EXTHOST_IPC_SOCKET') {
					const initialDataChunk = VSBuffer.wrap(Buffer.from(msg.initialDataChunk, 'base64'));
					if (protocol) {
						// reconnection case
						if (disconnectWaitTimer) {
							clearTimeout(disconnectWaitTimer);
							disconnectWaitTimer = null;
						}
						protocol.beginAcceptReconnection(new NodeSocket(handle), initialDataChunk);
						protocol.endAcceptReconnection();
					} else {
						clearTimeout(timer);
						protocol = new PersistentProtocol(new NodeSocket(handle), initialDataChunk);
						protocol.onClose(() => onTerminate());
						resolve(protocol);

						protocol.onSocketClose(() => {
							// The socket has closed, let's give the renderer a certain amount of time to reconnect
							disconnectWaitTimer = setTimeout(() => {
								disconnectWaitTimer = null;
								onTerminate();
							}, ProtocolConstants.ReconnectionGraceTime);
						});
					}
				}
			});

			// Now that we have managed to install a message listener, ask the other side to send us the socket
			const req: IExtHostReadyMessage = { type: 'VSCODE_EXTHOST_IPC_READY' };
			if (process.send) {
				process.send(req);
			}
		});

	} else {

		const pipeName = process.env.VSCODE_IPC_HOOK_EXTHOST!;

		return new Promise<IMessagePassingProtocol>((resolve, reject) => {

			const socket = net.createConnection(pipeName, () => {
				socket.removeListener('error', reject);
				resolve(new PersistentProtocol(new NodeSocket(socket)));
			});
			socket.once('error', reject);

		});
	}
}

async function createExtHostProtocol(): Promise<IMessagePassingProtocol> {

	const protocol = await _createExtHostProtocol();

	return new class implements IMessagePassingProtocol {

		private _terminating = false;

		readonly onMessage: Event<any> = Event.filter(protocol.onMessage, msg => {
			if (!isMessageOfType(msg, MessageType.Terminate)) {
				return true;
			}
			this._terminating = true;
			onTerminate();
			return false;
		});

		send(msg: any): void {
			if (!this._terminating) {
				protocol.send(msg);
			}
		}
	};
}

function connectToRenderer(protocol: IMessagePassingProtocol): Promise<IRendererConnection> {
	return new Promise<IRendererConnection>((c, e) => {

		// Listen init data message
		const first = protocol.onMessage(raw => {
			first.dispose();

			const initData = <IInitData>JSON.parse(raw.toString());

			const rendererCommit = initData.commit;
			const myCommit = product.commit;

			if (rendererCommit && myCommit) {
				// Running in the built version where commits are defined
				if (rendererCommit !== myCommit) {
					nativeExit(55);
				}
			}

			// Print a console message when rejection isn't handled within N seconds. For details:
			// see https://nodejs.org/api/process.html#process_event_unhandledrejection
			// and https://nodejs.org/api/process.html#process_event_rejectionhandled
			const unhandledPromises: Promise<any>[] = [];
			process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
				unhandledPromises.push(promise);
				setTimeout(() => {
					const idx = unhandledPromises.indexOf(promise);
					if (idx >= 0) {
						promise.catch(e => {
							unhandledPromises.splice(idx, 1);
							console.warn(`rejected promise not handled within 1 second: ${e}`);
							if (e.stack) {
								console.warn(`stack trace: ${e.stack}`);
							}
							onUnexpectedError(reason);
						});
					}
				}, 1000);
			});

			process.on('rejectionHandled', (promise: Promise<any>) => {
				const idx = unhandledPromises.indexOf(promise);
				if (idx >= 0) {
					unhandledPromises.splice(idx, 1);
				}
			});

			// Print a console message when an exception isn't handled.
			process.on('uncaughtException', function (err: Error) {
				onUnexpectedError(err);
			});

			// Kill oneself if one's parent dies. Much drama.
			setInterval(function () {
				try {
					process.kill(initData.parentPid, 0); // throws an exception if the main process doesn't exist anymore.
				} catch (e) {
					onTerminate();
				}
			}, 1000);

			// In certain cases, the event loop can become busy and never yield
			// e.g. while-true or process.nextTick endless loops
			// So also use the native node module to do it from a separate thread
			let watchdog: typeof nativeWatchdog;
			try {
				watchdog = require.__$__nodeRequire('native-watchdog');
				watchdog.start(initData.parentPid);
			} catch (err) {
				// no problem...
				onUnexpectedError(err);
			}

			// Tell the outside that we are initialized
			protocol.send(createMessageOfType(MessageType.Initialized));

			c({ protocol, initData });
		});

		// Tell the outside that we are ready to receive messages
		protocol.send(createMessageOfType(MessageType.Ready));
	});
}

// patchExecArgv:
(function () {
	// when encountering the prevent-inspect flag we delete this
	// and the prior flag
	if (process.env.VSCODE_PREVENT_FOREIGN_INSPECT) {
		for (let i = 0; i < process.execArgv.length; i++) {
			if (process.execArgv[i].match(/--inspect-brk=\d+|--inspect=\d+/)) {
				process.execArgv.splice(i, 1);
				break;
			}
		}
	}
})();

export async function startExtensionHostProcess(
	uriTransformerFn: (initData: IInitData) => IURITransformer | null,
	schemeTransformerFn: (initData: IInitData) => ISchemeTransformer | null,
	outputChannelNameFn: (initData: IInitData) => string,
): Promise<void> {

	const protocol = await createExtHostProtocol();
	const renderer = await connectToRenderer(protocol);
	const { initData } = renderer;
	// setup things
	patchProcess(!!initData.environment.extensionTestsLocationURI); // to support other test frameworks like Jasmin that use process.exit (https://github.com/Microsoft/vscode/issues/37708)

	// host abstraction
	const hostUtils = new class NodeHost implements IHostUtils {
		exit(code: number) { nativeExit(code); }
		exists(path: string) { return exists(path); }
		realpath(path: string) { return realpath(path); }
	};


	const extensionHostMain = new ExtensionHostMain(
		renderer.protocol,
		initData,
		hostUtils,
		patchPatchedConsole,
		createLogService,
		uriTransformerFn(initData),
		schemeTransformerFn(initData),
		outputChannelNameFn(initData)
	);

	// rewrite onTerminate-function to be a proper shutdown
	onTerminate = () => extensionHostMain.terminate();
}
