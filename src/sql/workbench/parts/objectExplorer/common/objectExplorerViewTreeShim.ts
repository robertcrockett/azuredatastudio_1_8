/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Deferred } from 'sql/base/common/promise';
import { TreeNode } from 'sql/workbench/parts/objectExplorer/common/treeNode';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionType, IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ITreeItem } from 'sql/workbench/common/views';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { hash } from 'vs/base/common/hash';
import { Disposable } from 'vs/base/common/lifecycle';
import { generateUuid } from 'vs/base/common/uuid';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { TreeItemCollapsibleState } from 'vs/workbench/common/views';
import { localize } from 'vs/nls';

export const SERVICE_ID = 'oeShimService';
export const IOEShimService = createDecorator<IOEShimService>(SERVICE_ID);

export interface IOEShimService {
	_serviceBrand: any;
	getChildren(node: ITreeItem, viewId: string): Promise<ITreeItem[]>;
	disconnectNode(viewId: string, node: ITreeItem): Promise<boolean>;
	providerExists(providerId: string): boolean;
	isNodeConnected(viewId: string, node: ITreeItem): boolean;
}

export class OEShimService extends Disposable implements IOEShimService {
	_serviceBrand: any;

	private sessionMap = new Map<number, string>();
	private nodeHandleMap = new Map<number, string>();

	constructor(
		@IObjectExplorerService private oe: IObjectExplorerService,
		@IConnectionManagementService private cm: IConnectionManagementService,
		@IConnectionDialogService private cd: IConnectionDialogService,
		@ICapabilitiesService private capabilities: ICapabilitiesService
	) {
		super();
	}

	private async createSession(viewId: string, providerId: string, node: ITreeItem): Promise<string> {
		let connProfile = new ConnectionProfile(this.capabilities, node.payload);
		connProfile.saveProfile = false;
		if (this.cm.providerRegistered(providerId)) {
			connProfile = await this.connectOrPrompt(connProfile);
		} else {
			// Throw and expect upstream handler to notify about the error
			// TODO: In the future should use extension recommendations to prompt for correct extension
			throw new Error(localize('noProviderFound', "Cannot expand as the required connection provider '{0}' was not found", providerId));
		}
		let sessionResp = await this.oe.createNewSession(providerId, connProfile);
		let sessionId = sessionResp.sessionId;
		await new Promise((resolve, reject) => {
			let listener = this.oe.onUpdateObjectExplorerNodes(e => {
				if (e.connection.id === connProfile.id) {
					if (e.errorMessage) {
						listener.dispose();
						reject(new Error(e.errorMessage));
						return;
					}
					let rootNode = this.oe.getSession(sessionResp.sessionId).rootNode;
					// this is how we know it was shimmed
					if (rootNode.nodePath) {
						this.nodeHandleMap.set(generateNodeMapKey(viewId, node), rootNode.nodePath);
					}
				}
				listener.dispose();
				resolve(sessionResp.sessionId);
			});
		});
		return sessionId;
	}

	private async connectOrPrompt(connProfile: ConnectionProfile): Promise<ConnectionProfile> {
		connProfile = await new Promise(async (resolve, reject) => {
			await this.cm.connect(connProfile, undefined, { showConnectionDialogOnError: true, showFirewallRuleOnError: true, saveTheConnection: false, showDashboard: false, params: undefined }, {
				onConnectSuccess: async (e, profile) => {
					let existingConnection = this.cm.findExistingConnection(profile);
					connProfile = new ConnectionProfile(this.capabilities, existingConnection);
					connProfile = <ConnectionProfile>await this.cm.addSavedPassword(connProfile);
					resolve(connProfile);
				},
				onConnectCanceled: () => {
					reject(new Error(localize('loginCanceled', 'User canceled')));
				},
				onConnectReject: undefined,
				onConnectStart: undefined,
				onDisconnect: undefined
			});
		});
		return connProfile;
	}

	public async disconnectNode(viewId: string, node: ITreeItem): Promise<boolean> {
		// we assume only nodes with payloads can be connected
		// check to make sure we have an existing connection
		let key = generateSessionMapKey(viewId, node);
		let session = this.sessionMap.get(key);
		if (session) {
			let closed = (await this.oe.closeSession(node.childProvider, this.oe.getSession(session))).success;
			if (closed) {
				this.sessionMap.delete(key);
			}
			return closed;
		}
		return Promise.resolve(false);
	}

	private async getOrCreateSession(viewId: string, node: ITreeItem): Promise<string> {
		// verify the map is correct
		let key = generateSessionMapKey(viewId, node);
		if (!this.sessionMap.has(key)) {
			this.sessionMap.set(key, await this.createSession(viewId, node.childProvider, node));
		}
		return this.sessionMap.get(key);
	}

	public async getChildren(node: ITreeItem, viewId: string): Promise<ITreeItem[]> {
		if (node.payload) {
			let sessionId = await this.getOrCreateSession(viewId, node);
			let requestHandle = this.nodeHandleMap.get(generateNodeMapKey(viewId, node)) || node.handle;
			let treeNode = new TreeNode(undefined, undefined, undefined, requestHandle, undefined, undefined, undefined, undefined, undefined, undefined);
			treeNode.connection = new ConnectionProfile(this.capabilities, node.payload);
			return this.oe.resolveTreeNodeChildren({
				success: undefined,
				sessionId,
				rootNode: undefined,
				errorMessage: undefined
			}, treeNode).then(e => e.map(n => this.treeNodeToITreeItem(viewId, n, node)));
		} else {
			return Promise.resolve([]);
		}
	}

	private treeNodeToITreeItem(viewId: string, node: TreeNode, parentNode: ITreeItem): ITreeItem {
		let handle = generateUuid();
		let nodePath = node.nodePath;
		let icon: string = '';
		if (node.iconType) {
			icon = (typeof node.iconType === 'string') ? node.iconType : node.iconType.id;
		} else {
			icon = node.nodeTypeId;
			if (node.nodeStatus) {
				icon = node.nodeTypeId + '_' + node.nodeStatus;
			}
			if (node.nodeSubType) {
				icon = node.nodeTypeId + '_' + node.nodeSubType;
			}
		}
		icon = icon.toLowerCase();
		let newTreeItem: ITreeItem = {
			parentHandle: node.parent.id,
			handle,
			collapsibleState: node.isAlwaysLeaf ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed,
			label: {
				label: node.label
			},
			childProvider: node.childProvider || parentNode.childProvider,
			providerHandle: parentNode.childProvider,
			payload: node.payload || parentNode.payload,
			contextValue: node.nodeTypeId,
			sqlIcon: icon
		};
		this.nodeHandleMap.set(generateNodeMapKey(viewId, newTreeItem), nodePath);
		return newTreeItem;
	}

	public providerExists(providerId: string): boolean {
		return this.oe.providerRegistered(providerId);
	}

	public isNodeConnected(viewId: string, node: ITreeItem): boolean {
		return this.sessionMap.has(generateSessionMapKey(viewId, node));
	}
}

function generateSessionMapKey(viewId: string, node: ITreeItem): number {
	return hash([viewId, node.childProvider, node.payload]);
}

function generateNodeMapKey(viewId: string, node: ITreeItem): number {
	return hash([viewId, node.handle]);
}
