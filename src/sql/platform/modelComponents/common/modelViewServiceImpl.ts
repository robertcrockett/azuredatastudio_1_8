/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IModelViewService } from 'sql/platform/modelComponents/common/modelViewService';
import { Event, Emitter } from 'vs/base/common/event';
import { IModelView } from 'sql/platform/model/common/modelViewService';

export class ModelViewService implements IModelViewService {
	_serviceBrand: any;

	private _onRegisteredModelView = new Emitter<IModelView>();
	public readonly onRegisteredModelView: Event<IModelView> = this._onRegisteredModelView.event;

	public registerModelView(view: IModelView) {
		this._onRegisteredModelView.fire(view);
	}
}
