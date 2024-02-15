/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ipcRenderer as ipc } from 'electron';
import { Emitter, Event } from 'vs/base/common/event';
import { IMessagePassingProtocol } from 'vs/base/parts/ipc/common/ipc';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { ILabelService } from 'vs/platform/label/common/label';
import { ILogService } from 'vs/platform/log/common/log';
import product from 'vs/platform/product/node/product';
import pkg from 'vs/platform/product/node/package';
import { connectRemoteAgentExtensionHost, IRemoteExtensionHostStartParams, IConnectionOptions } from 'vs/platform/remote/common/remoteAgentConnection';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWindowService } from 'vs/platform/windows/common/windows';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { IInitData } from 'vs/workbench/api/common/extHost.protocol';
import { MessageType, createMessageOfType, isMessageOfType } from 'vs/workbench/services/extensions/common/extensionHostProtocol';
import { IExtensionHostStarter } from 'vs/workbench/services/extensions/common/extensions';
import { parseExtensionDevOptions } from 'vs/workbench/services/extensions/common/extensionDevOptions';
import { IRemoteAgentEnvironment } from 'vs/platform/remote/common/remoteAgentEnvironment';
import { IRemoteAuthorityResolverService } from 'vs/platform/remote/common/remoteAuthorityResolver';
import * as platform from 'vs/base/common/platform';
import { Schemas } from 'vs/base/common/network';
import { Disposable } from 'vs/base/common/lifecycle';
import { ILifecycleService } from 'vs/platform/lifecycle/common/lifecycle';
import { PersistentProtocol } from 'vs/base/parts/ipc/common/ipc.net';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { VSBuffer } from 'vs/base/common/buffer';
import { nodeWebSocketFactory } from 'vs/platform/remote/node/nodeWebSocketFactory';
import { IExtensionHostDebugService } from 'vs/workbench/services/extensions/common/extensionHostDebug';

export interface IInitDataProvider {
	readonly remoteAuthority: string;
	getInitData(): Promise<IRemoteAgentEnvironment>;
}

export class RemoteExtensionHostClient extends Disposable implements IExtensionHostStarter {

	private _onCrashed: Emitter<[number, string | null]> = this._register(new Emitter<[number, string | null]>());
	public readonly onCrashed: Event<[number, string | null]> = this._onCrashed.event;

	private _protocol: PersistentProtocol | null;

	private readonly _isExtensionDevHost: boolean;
	private readonly _isExtensionDevTestFromCli: boolean;

	private _terminating: boolean;

	constructor(
		private readonly _allExtensions: Promise<IExtensionDescription[]>,
		private readonly _initDataProvider: IInitDataProvider,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
		@IEnvironmentService private readonly _environmentService: IEnvironmentService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
		@IWindowService private readonly _windowService: IWindowService,
		@ILifecycleService private readonly _lifecycleService: ILifecycleService,
		@ILogService private readonly _logService: ILogService,
		@ILabelService private readonly _labelService: ILabelService,
		@IRemoteAuthorityResolverService private readonly remoteAuthorityResolverService: IRemoteAuthorityResolverService,
		@IExtensionHostDebugService private readonly _extensionHostDebugService: IExtensionHostDebugService
	) {
		super();
		this._protocol = null;
		this._terminating = false;

		this._register(this._lifecycleService.onShutdown(reason => this.dispose()));

		const devOpts = parseExtensionDevOptions(this._environmentService);
		this._isExtensionDevHost = devOpts.isExtensionDevHost;
		this._isExtensionDevTestFromCli = devOpts.isExtensionDevTestFromCli;
	}

	public start(): Promise<IMessagePassingProtocol> {
		const options: IConnectionOptions = {
			isBuilt: this._environmentService.isBuilt,
			commit: product.commit,
			webSocketFactory: nodeWebSocketFactory,
			addressProvider: {
				getAddress: async () => {
					const { host, port } = await this.remoteAuthorityResolverService.resolveAuthority(this._initDataProvider.remoteAuthority);
					return { host, port };
				}
			}
		};
		return this.remoteAuthorityResolverService.resolveAuthority(this._initDataProvider.remoteAuthority).then((resolvedAuthority) => {

			const startParams: IRemoteExtensionHostStartParams = {
				language: platform.language,
				debugId: this._environmentService.debugExtensionHost.debugId,
				break: this._environmentService.debugExtensionHost.break,
				port: this._environmentService.debugExtensionHost.port,
			};

			const extDevLocs = this._environmentService.extensionDevelopmentLocationURI;

			let debugOk = true;
			if (extDevLocs && extDevLocs.length > 0) {
				// TODO@AW: handles only first path in array
				if (extDevLocs[0].scheme === Schemas.file) {
					debugOk = false;
				}
			}

			if (!debugOk) {
				startParams.break = false;
			}

			return connectRemoteAgentExtensionHost(options, startParams).then(result => {
				let { protocol, debugPort } = result;
				const isExtensionDevelopmentDebug = typeof debugPort === 'number';
				if (debugOk && this._environmentService.isExtensionDevelopment && this._environmentService.debugExtensionHost.debugId && debugPort) {
					this._extensionHostDebugService.attachSession(this._environmentService.debugExtensionHost.debugId, debugPort, this._initDataProvider.remoteAuthority);
				}

				protocol.onClose(() => {
					this._onExtHostConnectionLost();
				});

				protocol.onSocketClose(() => {
					if (this._isExtensionDevHost) {
						this._onExtHostConnectionLost();
					}
				});

				// 1) wait for the incoming `ready` event and send the initialization data.
				// 2) wait for the incoming `initialized` event.
				return new Promise<IMessagePassingProtocol>((resolve, reject) => {

					let handle = setTimeout(() => {
						reject('timeout');
					}, 60 * 1000);

					const disposable = protocol.onMessage(msg => {

						if (isMessageOfType(msg, MessageType.Ready)) {
							// 1) Extension Host is ready to receive messages, initialize it
							this._createExtHostInitData(isExtensionDevelopmentDebug).then(data => protocol.send(VSBuffer.fromString(JSON.stringify(data))));
							return;
						}

						if (isMessageOfType(msg, MessageType.Initialized)) {
							// 2) Extension Host is initialized

							clearTimeout(handle);

							// stop listening for messages here
							disposable.dispose();

							// release this promise
							this._protocol = protocol;
							resolve(protocol);
							return;
						}

						console.error(`received unexpected message during handshake phase from the extension host: `, msg);
					});

				});
			});
		});
	}

	private _onExtHostConnectionLost(): void {
		if (this._terminating) {
			// Expected termination path (we asked the process to terminate)
			return;
		}

		// Unexpected termination
		if (!this._isExtensionDevHost) {
			this._onCrashed.fire([0, null]);
		}

		// Expected development extension termination: When the extension host goes down we also shutdown the window
		else if (!this._isExtensionDevTestFromCli) {
			this._windowService.closeWindow();
		}

		// When CLI testing make sure to exit with proper exit code
		else {
			ipc.send('vscode:exit', 0);
		}
	}

	private _createExtHostInitData(isExtensionDevelopmentDebug: boolean): Promise<IInitData> {
		return Promise.all([this._allExtensions, this._telemetryService.getTelemetryInfo(), this._initDataProvider.getInitData()]).then(([allExtensions, telemetryInfo, remoteExtensionHostData]) => {
			// Collect all identifiers for extension ids which can be considered "resolved"
			const resolvedExtensions = allExtensions.filter(extension => !extension.main).map(extension => extension.identifier);
			const hostExtensions = allExtensions.filter(extension => extension.main && extension.api === 'none').map(extension => extension.identifier);
			const workspace = this._contextService.getWorkspace();
			const r: IInitData = {
				commit: product.commit,
				version: pkg.version,
				parentPid: remoteExtensionHostData.pid,
				environment: {
					isExtensionDevelopmentDebug,
					appRoot: remoteExtensionHostData.appRoot,
					appSettingsHome: remoteExtensionHostData.appSettingsHome,
					appName: product.nameLong,
					appUriScheme: product.urlProtocol,
					appLanguage: platform.language,
					extensionDevelopmentLocationURI: this._environmentService.extensionDevelopmentLocationURI,
					extensionTestsLocationURI: this._environmentService.extensionTestsLocationURI,
					globalStorageHome: remoteExtensionHostData.globalStorageHome,
					userHome: remoteExtensionHostData.userHome
				},
				workspace: this._contextService.getWorkbenchState() === WorkbenchState.EMPTY ? null : {
					configuration: workspace.configuration,
					id: workspace.id,
					name: this._labelService.getWorkspaceLabel(workspace)
				},
				resolvedExtensions: resolvedExtensions,
				hostExtensions: hostExtensions,
				extensions: remoteExtensionHostData.extensions,
				telemetryInfo,
				logLevel: this._logService.getLevel(),
				logsLocation: remoteExtensionHostData.extensionHostLogsPath,
				autoStart: true,
				remoteAuthority: this._initDataProvider.remoteAuthority,
			};
			return r;
		});
	}

	getInspectPort(): number | undefined {
		return undefined;
	}

	dispose(): void {
		super.dispose();

		this._terminating = true;

		if (this._protocol) {
			// Send the extension host a request to terminate itself
			// (graceful termination)
			const socket = this._protocol.getSocket();
			this._protocol.send(createMessageOfType(MessageType.Terminate));
			this._protocol.sendDisconnect();
			this._protocol.dispose();
			socket.end();
			this._protocol = null;
		}
	}
}
