/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeDataProvider, EventEmitter, Event, TreeItem } from 'vscode';
import * as azdata from 'azdata';
import { AppContext } from '../../appContext';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { TreeNode } from '../treeNode';
import { AzureResourceAccountTreeNode } from './accountTreeNode';
import { AzureResourceAccountNotSignedInTreeNode } from './accountNotSignedInTreeNode';
import { AzureResourceMessageTreeNode } from '../messageTreeNode';
import { AzureResourceContainerTreeNodeBase } from './baseTreeNodes';
import { AzureResourceErrorMessageUtil, equals } from '../utils';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { IAzureResourceAccountService } from '../../azureResource/interfaces';
import { AzureResourceServiceNames } from '../constants';


export class AzureResourceTreeProvider implements TreeDataProvider<TreeNode>, IAzureResourceTreeChangeHandler {
	public isSystemInitialized: boolean = false;

	private accountService: IAzureResourceAccountService;
	private accounts: azdata.Account[];
	private _onDidChangeTreeData = new EventEmitter<TreeNode>();
	private loadingAccountsPromise: Promise<void>;

	public constructor(public readonly appContext: AppContext) {
		if (appContext) {
			this.hookAccountService(appContext);
		}
	}

	private hookAccountService(appContext: AppContext): void {
		this.accountService = appContext.getService<IAzureResourceAccountService>(AzureResourceServiceNames.accountService);
		if (this.accountService) {
			this.accountService.onDidChangeAccounts((e: azdata.DidChangeAccountsParams) => {
				// the onDidChangeAccounts event will trigger in many cases where the accounts didn't actually change
				// the notifyNodeChanged event triggers a refresh which triggers a getChildren which can trigger this callback
				// this below check short-circuits the infinite callback loop
				this.setSystemInitialized();
				if (!equals(e.accounts, this.accounts)) {
					this.accounts = e.accounts;
					this.notifyNodeChanged(undefined);
				}
			});
		}
	}

	public async getChildren(element?: TreeNode): Promise<TreeNode[]> {
		if (element) {
			return element.getChildren(true);
		}

		if (!this.isSystemInitialized) {
			if (!this.loadingAccountsPromise) {
				this.loadingAccountsPromise = this.loadAccounts();
			}
			return [AzureResourceMessageTreeNode.create(localize('azure.resource.tree.treeProvider.loadingLabel', 'Loading ...'), undefined)];
		}

		try {
			if (this.accounts && this.accounts.length > 0) {
				return this.accounts.map((account) => new AzureResourceAccountTreeNode(account, this.appContext, this));
			} else {
				return [new AzureResourceAccountNotSignedInTreeNode()];
			}
		} catch (error) {
			return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), undefined)];
		}
	}

	private async loadAccounts(): Promise<void> {
		try {
			this.accounts = await this.appContext.getService<IAzureResourceAccountService>(AzureResourceServiceNames.accountService).getAccounts();
			// System has been initialized
			this.setSystemInitialized();
			this._onDidChangeTreeData.fire(undefined);
		} catch (err) {
			// Skip for now, we can assume that the accounts changed event will eventually notify instead
			this.isSystemInitialized = false;
		}
	}

	private setSystemInitialized(): void {
		this.isSystemInitialized = true;
		this.loadingAccountsPromise = undefined;
	}

	public get onDidChangeTreeData(): Event<TreeNode> {
		return this._onDidChangeTreeData.event;
	}

	public notifyNodeChanged(node: TreeNode): void {
		this._onDidChangeTreeData.fire(node);
	}

	public async refresh(node: TreeNode, isClearingCache: boolean): Promise<void> {
		if (isClearingCache) {
			if ((node instanceof AzureResourceContainerTreeNodeBase)) {
				node.clearCache();
			}
		}

		this._onDidChangeTreeData.fire(node);
	}

	public getTreeItem(element: TreeNode): TreeItem | Thenable<TreeItem> {
		return element.getTreeItem();
	}
}
