/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITreeViewDataProvider, ITreeItem as vsITreeItem, IViewDescriptor, ITreeView as vsITreeView } from 'vs/workbench/common/views';
import { IConnectionProfile } from 'azdata';

export interface ITreeComponentItem extends vsITreeItem {
	checked?: boolean;
	enabled?: boolean;
	onCheckedChanged?: (checked: boolean) => void;
	children?: ITreeComponentItem[];
}

export interface IModelViewTreeViewDataProvider extends ITreeViewDataProvider {
	refresh(itemsToRefreshByHandle: { [treeItemHandle: string]: ITreeComponentItem });
}

export interface ITreeItem extends vsITreeItem {
	providerHandle?: string;
	childProvider?: string;
	payload?: IConnectionProfile; // its possible we will want this to be more generic
	sqlIcon?: string;
}

export interface ITreeView extends vsITreeView {

	collapse(itemOrItems: ITreeItem | ITreeItem[]): Thenable<void>;

}

export type TreeViewItemHandleArg = {
	$treeViewId: string,
	$treeItemHandle: string,
	$treeItem?: ITreeItem,
	$treeContainerId?: string
};

export interface ICustomViewDescriptor extends IViewDescriptor {

	readonly treeView: ITreeView;

}
