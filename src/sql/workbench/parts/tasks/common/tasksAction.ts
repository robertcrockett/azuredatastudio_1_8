/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { ITaskService } from 'sql/platform/tasks/common/tasksService';
import { TaskNode, TaskExecutionMode, TaskStatus } from 'sql/platform/tasks/common/tasksNode';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import Severity from 'vs/base/common/severity';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

export class CancelAction extends Action {
	public static ID = 'taskHistory.cancel';
	public static LABEL = localize('cancelTask.cancel', 'Cancel');

	constructor(
		id: string,
		label: string,
		@ITaskService private _taskService: ITaskService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService
	) {
		super(id, label);
	}
	public run(element: TaskNode): Promise<boolean> {
		if (element instanceof TaskNode) {
			this._taskService.cancelTask(element.providerName, element.id).then((result) => {
				if (!result) {
					let error = localize('errorMsgFromCancelTask', 'The task is failed to cancel.');
					this.showError(error);
				}
			}, error => {
				this.showError(error);
				return Promise.resolve(true);
			});
		}
		return Promise.resolve(true);
	}

	private showError(errorMessage: string) {
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
		}
	}
}

export class ScriptAction extends Action {
	public static ID = 'taskHistory.script';
	public static LABEL = localize('taskAction.script', 'Script');

	constructor(
		id: string,
		label: string,
		@IQueryEditorService private _queryEditorService: IQueryEditorService
	) {
		super(id, label);
	}

	public run(element: TaskNode): Promise<boolean> {
		if (element instanceof TaskNode) {
			if (element.script && element.script !== '') {
				this._queryEditorService.newSqlEditor(element.script);
			}
		}
		return Promise.resolve(true);
	}
}
