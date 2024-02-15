/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionManagementService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { Memento } from 'vs/workbench/common/memento';
import { Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { Registry } from 'vs/platform/registry/common/platform';
import { IAction } from 'vs/base/common/actions';

import * as azdata from 'azdata';

import { entries } from 'sql/base/common/objects';
import { RestoreFeatureName, BackupFeatureName } from 'sql/workbench/common/actions';
import { toObject } from 'sql/base/common/map';
import { ConnectionProviderProperties, IConnectionProviderRegistry, Extensions as ConnectionExtensions } from 'sql/workbench/parts/connection/common/connectionProviderExtension';
import { ICapabilitiesService, ProviderFeatures, clientCapabilities } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';

const connectionRegistry = Registry.as<IConnectionProviderRegistry>(ConnectionExtensions.ConnectionProviderContributions);

interface ConnectionCache {
	[id: string]: ConnectionProviderProperties;
}

interface CapabilitiesMomento {
	connectionProviderCache: ConnectionCache;
}

/**
 * Capabilities service implementation class.  This class provides the ability
 * to discover the DMP capabilties that a DMP provider offers.
 */
export class CapabilitiesService extends Disposable implements ICapabilitiesService {
	_serviceBrand: any;

	private _momento: Memento;
	private _providers = new Map<string, ProviderFeatures>();
	private _featureUpdateEvents = new Map<string, Emitter<ProviderFeatures>>();
	private _legacyProviders = new Map<string, azdata.DataProtocolServerCapabilities>();

	private _onCapabilitiesRegistered = this._register(new Emitter<ProviderFeatures>());
	public readonly onCapabilitiesRegistered = this._onCapabilitiesRegistered.event;

	constructor(
		@IStorageService private _storageService: IStorageService,
		@IExtensionService extensionService: IExtensionService,
		@IExtensionManagementService extentionManagementService: IExtensionManagementService
	) {
		super();

		this._momento = new Memento('capabilities', this._storageService);

		if (!this.capabilities.connectionProviderCache) {
			this.capabilities.connectionProviderCache = {};
		}

		// handle in case some extensions have already registered (unlikley)
		entries(connectionRegistry.providers).map(v => {
			this.handleConnectionProvider({ id: v[0], properties: v[1] });
		});
		// register for when new extensions are added
		this._register(connectionRegistry.onNewProvider(this.handleConnectionProvider, this));

		// handle adding already known capabilities (could have caching problems)
		entries(this.capabilities.connectionProviderCache).map(v => {
			this.handleConnectionProvider({ id: v[0], properties: v[1] }, false);
		});

		extensionService.whenInstalledExtensionsRegistered().then(() => {
			this.cleanupProviders();
		});

		_storageService.onWillSaveState(() => this.shutdown());

		this._register(extentionManagementService.onDidUninstallExtension(({ identifier }) => {
			const connectionProvider = 'connectionProvider';
			extensionService.getExtensions().then(i => {
				let extension = i.find(c => c.identifier.value.toLowerCase() === identifier.id.toLowerCase());
				if (extension && extension.contributes
					&& extension.contributes[connectionProvider]
					&& extension.contributes[connectionProvider].providerId) {
					let id = extension.contributes[connectionProvider].providerId;
					delete this.capabilities.connectionProviderCache[id];
				}
			});
		}));
	}

	private cleanupProviders(): void {
		let knownProviders = Object.keys(connectionRegistry.providers);
		for (let key in this.capabilities.connectionProviderCache) {
			if (!knownProviders.includes(key)) {
				this._providers.delete(key);
				delete this.capabilities.connectionProviderCache[key];
			}
		}
	}

	private handleConnectionProvider(e: { id: string, properties: ConnectionProviderProperties }, isNew = true): void {

		let provider = this._providers.get(e.id);
		if (provider) {
			provider.connection = e.properties;
		} else {
			provider = {
				connection: e.properties
			};
			this._providers.set(e.id, provider);
		}
		if (!this._featureUpdateEvents.has(e.id)) {
			this._featureUpdateEvents.set(e.id, new Emitter<ProviderFeatures>());
		}

		if (isNew) {
			this.capabilities.connectionProviderCache[e.id] = e.properties;
			this._onCapabilitiesRegistered.fire(provider);
		}
	}

	/**
	 * Retrieve a list of registered server capabilities
	 */
	public getCapabilities(provider: string): ProviderFeatures {
		return this._providers.get(provider);
	}

	public getLegacyCapabilities(provider: string): azdata.DataProtocolServerCapabilities {
		return this._legacyProviders.get(provider);
	}

	public get providers(): { [id: string]: ProviderFeatures } {
		return toObject(this._providers);
	}

	private get capabilities(): CapabilitiesMomento {
		return this._momento.getMemento(StorageScope.GLOBAL) as CapabilitiesMomento;
	}

	/**
	 * Register the capabilities provider and query the provider for its capabilities
	 */
	public registerProvider(provider: azdata.CapabilitiesProvider): void {
		// request the capabilities from server
		provider.getServerCapabilities(clientCapabilities).then(serverCapabilities => {
			this._legacyProviders.set(serverCapabilities.providerName, serverCapabilities);
		});
	}

	/**
	 * Returns true if the feature is available for given connection
	 * @param featureComponent a component which should have the feature name
	 * @param connectionManagementInfo connectionManagementInfo
	 */
	public isFeatureAvailable(action: IAction, connectionManagementInfo: ConnectionManagementInfo): boolean {
		let isCloud = connectionManagementInfo && connectionManagementInfo.serverInfo && connectionManagementInfo.serverInfo.isCloud;
		let isMssql = connectionManagementInfo.connectionProfile.providerName === 'MSSQL';
		// TODO: The logic should from capabilities service.
		if (action) {
			let featureName: string = action.id;
			switch (featureName) {
				case BackupFeatureName:
					if (isMssql) {
						return connectionManagementInfo.connectionProfile.databaseName && !isCloud;
					} else {
						return !!connectionManagementInfo.connectionProfile.databaseName;
					}
				case RestoreFeatureName:
					if (isMssql) {
						return !isCloud;
					} else {
						return !!connectionManagementInfo.connectionProfile.databaseName;
					}
				default:
					return true;
			}
		} else {
			return true;
		}
	}

	private shutdown(): void {
		this._momento.saveMemento();
	}
}
