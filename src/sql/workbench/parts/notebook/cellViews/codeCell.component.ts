/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { OnInit, Component, Input, Inject, forwardRef, ChangeDetectorRef, SimpleChange, OnChanges, HostListener } from '@angular/core';
import { CellView } from 'sql/workbench/parts/notebook/cellViews/interfaces';
import { ICellModel } from 'sql/workbench/parts/notebook/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/parts/notebook/models/notebookModel';
import { Deferred } from 'sql/base/common/promise';


export const CODE_SELECTOR: string = 'code-cell-component';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./codeCell.component.html'))
})

export class CodeCellComponent extends CellView implements OnInit, OnChanges {
	@Input() cellModel: ICellModel;
	@Input() set model(value: NotebookModel) {
		this._model = value;
	}
	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	@HostListener('document:keydown.escape', ['$event'])
	handleKeyboardEvent() {
		this.cellModel.active = false;
		this._model.activeCell = undefined;
	}

	private _model: NotebookModel;
	private _activeCellId: string;

	public inputDeferred: Deferred<string>;
	public stdIn: nb.IStdinMessage;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
	) {
		super();
	}

	ngOnInit() {
		if (this.cellModel) {
			this._register(this.cellModel.onOutputsChanged(() => {
				this._changeRef.detectChanges();
			}));
			// Register request handler, cleanup on dispose of this component
			this.cellModel.setStdInHandler({ handle: (msg) => this.handleStdIn(msg) });
			this._register({ dispose: () => this.cellModel.setStdInHandler(undefined) });
		}
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		for (let propName in changes) {
			if (propName === 'activeCellId') {
				let changedProp = changes[propName];
				this._activeCellId = changedProp.currentValue;
				break;
			}
		}
	}

	get model(): NotebookModel {
		return this._model;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}
	public layout() {

	}

	handleStdIn(msg: nb.IStdinMessage): void | Thenable<void> {
		if (msg) {
			this.stdIn = msg;
			this.inputDeferred = new Deferred();
			this._changeRef.detectChanges();
			return this.awaitStdIn();
		}
	}

	private async awaitStdIn(): Promise<void> {
		try {
			let value = await this.inputDeferred.promise;
			this.cellModel.future.sendInputReply({ value: value });
		} catch (err) {
			// Note: don't have a better way to handle completing input request. For now just canceling by sending empty string?
			this.cellModel.future.sendInputReply({ value: '' });
		} finally {
			// Clean up so no matter what, the stdIn request goes away
			this.stdIn = undefined;
			this.inputDeferred = undefined;
			this._changeRef.detectChanges();
		}
	}

	get isStdInVisible(): boolean {
		return !!(this.stdIn && this.inputDeferred);
	}
}
