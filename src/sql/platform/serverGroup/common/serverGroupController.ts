/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';

export interface IServerGroupDialogCallbacks {
	onAddGroup(groupName: string): void;
	onClose(): void;
}
export const IServerGroupController = createDecorator<IServerGroupController>('serverGroupController');
export interface IServerGroupController {
	_serviceBrand: any;
	showCreateGroupDialog(connectionManagementService: IConnectionManagementService, callbacks?: IServerGroupDialogCallbacks): Promise<void>;
	showEditGroupDialog(connectionManagementService: IConnectionManagementService, group: ConnectionProfileGroup): Promise<void>;
}
