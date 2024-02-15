/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { TreeItemCollapsibleState } from 'vscode';
import { AppContext } from '../../appContext';
import { TreeNode } from '../treeNode';
import { CmsResourceTreeNodeBase } from './baseTreeNodes';
import { CmsResourceItemType } from '../constants';
import { ICmsResourceTreeChangeHandler } from './treeChangeHandler';
import { RegisteredServerTreeNode } from './registeredServerTreeNode';
import { ServerGroupTreeNode } from './serverGroupTreeNode';
import { CmsResourceMessageTreeNode } from '../messageTreeNode';

const localize = nls.loadMessageBundle();

export class CmsResourceTreeNode extends CmsResourceTreeNodeBase {

	private _serverGroupNodes: ServerGroupTreeNode[] = [];

	public constructor(
		name: string,
		description: string,
		ownerUri: string,
		private _connection: azdata.connection.Connection,
		appContext: AppContext,
		treeChangeHandler: ICmsResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super(name, description, ownerUri, appContext, treeChangeHandler, parent);
	}

	public async getChildren(): Promise<TreeNode[]> {
		try {
			let nodes: CmsResourceTreeNodeBase[] = [];
			if (!this.ownerUri) {
				this._ownerUri = await this.appContext.cmsUtils.getUriForConnection(this.connection);
			}
			return this.appContext.cmsUtils.createCmsServer(this.connection, this.name, this.description).then((result) => {
				if (result) {
					if (result.registeredServersList) {
						result.registeredServersList.forEach((registeredServer) => {
							nodes.push(new RegisteredServerTreeNode(
								registeredServer.name,
								registeredServer.description,
								registeredServer.serverName,
								registeredServer.relativePath,
								this.ownerUri,
								this.appContext,
								this.treeChangeHandler, this));
						});
					}
					if (result.registeredServerGroups) {
						if (result.registeredServerGroups) {
							this._serverGroupNodes = [];
							result.registeredServerGroups.forEach((serverGroup) => {
								let serverGroupNode = new ServerGroupTreeNode(
									serverGroup.name,
									serverGroup.description,
									serverGroup.relativePath,
									this.ownerUri,
									this.appContext,
									this.treeChangeHandler, this);
								nodes.push(serverGroupNode);
								this._serverGroupNodes.push(serverGroupNode);
							});
						}
					}
					if (nodes.length > 0) {
						return nodes.sort((node1, node2) => node1.name > node2.name ? 1 : -1);
					} else {
						return [CmsResourceMessageTreeNode.create(CmsResourceTreeNode.noResourcesLabel, undefined)];
					}
				}
			}, (error) => {
				let errorText = localize('cms.errors.expandCmsFail', 'The Central Management Server {0} could not be found or is offline', this.name);
				this.appContext.apiWrapper.showErrorMessage(error ? error : errorText);
				return [];
			});
		} catch {
			return [];
		}
	}

	public getTreeItem(): azdata.TreeItem | Promise<azdata.TreeItem> {
		const item = new azdata.TreeItem(this.name, TreeItemCollapsibleState.Collapsed);
		item.contextValue = CmsResourceItemType.cmsNodeContainer;
		item.id = this._id;
		item.tooltip = this.description;
		item.iconPath = {
			dark: this.appContext.extensionContext.asAbsolutePath('resources/light/centralmanagement_server.svg'),
			light: this.appContext.extensionContext.asAbsolutePath('resources/light/centralmanagement_server.svg')
		};
		return item;
	}

	public getNodeInfo(): azdata.NodeInfo {
		return {
			label: this.name,
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: CmsResourceItemType.cmsNodeContainer,
			nodeSubType: undefined,
			iconType: CmsResourceItemType.cmsNodeContainer
		};
	}

	public get nodePathValue(): string {
		return this._id;
	}

	public get connection(): azdata.connection.Connection {
		return this._connection;
	}

	public get serverGroupNodes(): ServerGroupTreeNode[] {
		return this._serverGroupNodes;
	}

	public static readonly noResourcesLabel = localize('cms.resource.cmsResourceTreeNode.noResourcesLabel', 'No resources found');
}
