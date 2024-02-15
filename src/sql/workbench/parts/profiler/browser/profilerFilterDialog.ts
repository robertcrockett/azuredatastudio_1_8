/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/profilerFilterDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import * as TelemetryKeys from 'sql/platform/telemetry/telemetryKeys';
import { attachButtonStyler, attachModalDialogStyler, attachInputBoxStyler } from 'sql/platform/theme/common/styler';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { ProfilerInput } from 'sql/workbench/parts/profiler/browser/profilerInput';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { generateUuid } from 'vs/base/common/uuid';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { ProfilerFilter, ProfilerFilterClause, ProfilerFilterClauseOperator } from 'sql/workbench/services/profiler/common/interfaces';
import { ILogService } from 'vs/platform/log/common/log';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';


const ClearText: string = localize('profilerFilterDialog.clear', "Clear All");
const ApplyText: string = localize('profilerFilterDialog.apply', "Apply");
const OkText: string = localize('profilerFilterDialog.ok', "OK");
const CancelText: string = localize('profilerFilterDialog.cancel', "Cancel");
const DialogTitle: string = localize('profilerFilterDialog.title', "Filters");
const RemoveText: string = localize('profilerFilterDialog.remove', "Remove");
const AddText: string = localize('profilerFilterDialog.add', "Add");
const AddClausePromptText: string = localize('profilerFilterDialog.addClauseText', "Click here to add a clause");
const TitleIconClass: string = 'icon filterLabel';

const FieldText: string = localize('profilerFilterDialog.fieldColumn', "Field");
const OperatorText: string = localize('profilerFilterDialog.operatorColumn', "Operator");
const ValueText: string = localize('profilerFilterDialog.valueColumn', "Value");

const Equals: string = '=';
const NotEquals: string = '<>';
const LessThan: string = '<';
const LessThanOrEquals: string = '<=';
const GreaterThan: string = '>';
const GreaterThanOrEquals: string = '>=';
const IsNull: string = localize('profilerFilterDialog.isNullOperator', "Is Null");
const IsNotNull: string = localize('profilerFilterDialog.isNotNullOperator', "Is Not Null");
const Contains: string = localize('profilerFilterDialog.containsOperator', "Contains");
const NotContains: string = localize('profilerFilterDialog.notContainsOperator', "Not Contains");
const StartsWith: string = localize('profilerFilterDialog.startsWithOperator', "Starts With");
const NotStartsWith: string = localize('profilerFilterDialog.notStartsWithOperator', "Not Starts With");

const Operators = [Equals, NotEquals, LessThan, LessThanOrEquals, GreaterThan, GreaterThanOrEquals, GreaterThan, GreaterThanOrEquals, IsNull, IsNotNull, Contains, NotContains, StartsWith, NotStartsWith];

export class ProfilerFilterDialog extends Modal {

	private _clauseBuilder: HTMLElement;
	private _okButton: Button;
	private _cancelButton: Button;
	private _clearButton: Button;
	private _applyButton: Button;
	private _addClauseButton: Button;
	private _input: ProfilerInput;
	private _clauseRows: ClauseRowUI[] = [];


	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@IContextViewService private contextViewService: IContextViewService
	) {
		super('', TelemetryKeys.ProfilerFilter, telemetryService, layoutService, clipboardService, themeService, logService, contextKeyService, { isFlyout: false, hasTitleIcon: true });
	}

	public open(input: ProfilerInput) {
		this._input = input;
		this.render();
		this.show();
		this._okButton.focus();
	}

	public dispose(): void {

	}

	public render() {
		super.render();
		this.title = DialogTitle;
		this.titleIconClassName = TitleIconClass;
		this._register(attachModalDialogStyler(this, this._themeService));
		this._addClauseButton = this.addFooterButton(AddText, () => this.addClauseRow(false), 'left');
		this._clearButton = this.addFooterButton(ClearText, () => this.handleClearButtonClick(), 'left');
		this._applyButton = this.addFooterButton(ApplyText, () => this.filterSession());
		this._okButton = this.addFooterButton(OkText, () => this.handleOkButtonClick());
		this._cancelButton = this.addFooterButton(CancelText, () => this.hide());
		this._register(attachButtonStyler(this._okButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));
		this._register(attachButtonStyler(this._clearButton, this._themeService));
		this._register(attachButtonStyler(this._applyButton, this._themeService));
		this._register(attachButtonStyler(this._addClauseButton, this._themeService));
	}

	protected renderBody(container: HTMLElement) {
		const body = DOM.append(container, DOM.$('.profiler-filter-dialog'));
		this._clauseBuilder = DOM.append(body, DOM.$('table.profiler-filter-clause-table'));
		const headerRow = DOM.append(this._clauseBuilder, DOM.$('tr'));
		DOM.append(headerRow, DOM.$('td')).innerText = FieldText;
		DOM.append(headerRow, DOM.$('td')).innerText = OperatorText;
		DOM.append(headerRow, DOM.$('td')).innerText = ValueText;
		DOM.append(headerRow, DOM.$('td')).innerText = '';

		this._input.filter.clauses.forEach(clause => {
			this.addClauseRow(true, clause.field, this.convertToOperatorString(clause.operator), clause.value);
		});

		const prompt = DOM.append(body, DOM.$('.profiler-filter-add-clause-prompt', { tabIndex: '0' }));
		prompt.innerText = AddClausePromptText;
		DOM.addDisposableListener(prompt, DOM.EventType.CLICK, () => this.addClauseRow(false));
		DOM.addStandardDisposableListener(prompt, DOM.EventType.KEY_DOWN, (e: StandardKeyboardEvent) => {
			if (e.equals(KeyCode.Space) || e.equals(KeyCode.Enter)) {
				this.addClauseRow(false);
				e.stopPropagation();
			}
		});
	}

	protected layout(height?: number): void {
		// Nothing to re-layout
	}

	/* espace key */
	protected onClose() {
		this.hide();
	}

	/* enter key */
	protected onAccept() {
		this.handleOkButtonClick();
	}

	private handleOkButtonClick(): void {
		this.filterSession();
		this.hide();
	}

	private handleClearButtonClick() {
		this._clauseRows.forEach(clause => {
			clause.row.remove();
		});
		this._clauseRows = [];
	}

	private createSelectBox(container: HTMLElement, options: string[], selectedOption: string, ariaLabel: string): SelectBox {
		const dropdown = new SelectBox(options, selectedOption, this.contextViewService, undefined, { ariaLabel: ariaLabel });
		dropdown.render(container);
		this._register(attachSelectBoxStyler(dropdown, this._themeService));
		return dropdown;
	}

	private filterSession() {
		this._input.filterSession(this.getFilter());
	}

	private getFilter(): ProfilerFilter {
		const clauses: ProfilerFilterClause[] = [];

		this._clauseRows.forEach(row => {
			clauses.push({
				field: row.field.value,
				operator: this.convertToOperatorEnum(row.operator.value),
				value: row.value.value
			});
		});

		return {
			clauses: clauses
		};
	}

	private addClauseRow(setInitialValue: boolean, field?: string, operator?: string, value?: string): any {
		const row = DOM.append(this._clauseBuilder, DOM.$('tr'));
		const clauseId = generateUuid();

		const columns = this._input.columns.map(column => column.name);
		const fieldDropDown = this.createSelectBox(DOM.append(row, DOM.$('td')), columns, columns[0], FieldText);

		const operatorDropDown = this.createSelectBox(DOM.append(row, DOM.$('td')), Operators, Operators[0], OperatorText);

		const valueText = new InputBox(DOM.append(row, DOM.$('td')), undefined, {});
		this._register(attachInputBoxStyler(valueText, this._themeService));

		const removeCell = DOM.append(row, DOM.$('td'));
		const removeClauseButton = DOM.append(removeCell, DOM.$('.profiler-filter-remove-condition.icon.remove', {
			'tabIndex': '0',
			'aria-label': RemoveText,
			'title': RemoveText
		}));

		DOM.addStandardDisposableListener(removeClauseButton, DOM.EventType.KEY_DOWN, (e: StandardKeyboardEvent) => {
			if (e.equals(KeyCode.Space) || e.equals(KeyCode.Enter)) {
				this.removeRow(clauseId);
				e.stopPropagation();
			}
		});

		DOM.addDisposableListener(removeClauseButton, DOM.EventType.CLICK, (e: MouseEvent) => {
			this.removeRow(clauseId);
		});

		if (setInitialValue) {
			fieldDropDown.selectWithOptionName(field);
			operatorDropDown.selectWithOptionName(operator);
			valueText.value = value;
		}

		this._clauseRows.push({
			id: clauseId,
			row,
			field: fieldDropDown,
			operator: operatorDropDown,
			value: valueText
		});
	}

	private removeRow(clauseId: string) {
		const idx = this._clauseRows.findIndex((entry) => { return entry.id === clauseId; });
		if (idx !== -1) {
			this._clauseRows[idx].row.remove();
			this._clauseRows.splice(idx, 1);
		}
	}
	private convertToOperatorEnum(operator: string): ProfilerFilterClauseOperator {
		switch (operator) {
			case Equals:
				return ProfilerFilterClauseOperator.Equals;
			case NotEquals:
				return ProfilerFilterClauseOperator.NotEquals;
			case LessThan:
				return ProfilerFilterClauseOperator.LessThan;
			case LessThanOrEquals:
				return ProfilerFilterClauseOperator.LessThanOrEquals;
			case GreaterThan:
				return ProfilerFilterClauseOperator.GreaterThan;
			case GreaterThanOrEquals:
				return ProfilerFilterClauseOperator.GreaterThanOrEquals;
			case IsNull:
				return ProfilerFilterClauseOperator.IsNull;
			case IsNotNull:
				return ProfilerFilterClauseOperator.IsNotNull;
			case Contains:
				return ProfilerFilterClauseOperator.Contains;
			case NotContains:
				return ProfilerFilterClauseOperator.NotContains;
			case StartsWith:
				return ProfilerFilterClauseOperator.StartsWith;
			case NotStartsWith:
				return ProfilerFilterClauseOperator.NotStartsWith;
			default:
				throw new Error(`Not a valid operator: ${operator}`);
		}
	}

	private convertToOperatorString(operator: ProfilerFilterClauseOperator): string {
		switch (operator) {
			case ProfilerFilterClauseOperator.Equals:
				return Equals;
			case ProfilerFilterClauseOperator.NotEquals:
				return NotEquals;
			case ProfilerFilterClauseOperator.LessThan:
				return LessThan;
			case ProfilerFilterClauseOperator.LessThanOrEquals:
				return LessThanOrEquals;
			case ProfilerFilterClauseOperator.GreaterThan:
				return GreaterThan;
			case ProfilerFilterClauseOperator.GreaterThanOrEquals:
				return GreaterThanOrEquals;
			case ProfilerFilterClauseOperator.IsNull:
				return IsNull;
			case ProfilerFilterClauseOperator.IsNotNull:
				return IsNotNull;
			case ProfilerFilterClauseOperator.Contains:
				return Contains;
			case ProfilerFilterClauseOperator.NotContains:
				return NotContains;
			case ProfilerFilterClauseOperator.StartsWith:
				return StartsWith;
			case ProfilerFilterClauseOperator.NotStartsWith:
				return NotStartsWith;
			default:
				throw new Error(`Not a valid operator: ${operator}`);
		}
	}
}

interface ClauseRowUI {
	id: string;
	row: HTMLElement;
	field: SelectBox;
	operator: SelectBox;
	value: InputBox;
}
