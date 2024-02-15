/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OptionsDialog } from 'sql/workbench/browser/modal/optionsDialog';
import { AdvancedPropertiesController } from 'sql/workbench/parts/connection/browser/advancedPropertiesController';
import { ContextKeyServiceStub } from 'sqltest/stubs/contextKeyServiceStub';
import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { $ } from 'vs/base/browser/dom';

suite('Advanced properties dialog tests', () => {
	let advancedController: AdvancedPropertiesController;
	let providerOptions: azdata.ConnectionOption[];

	setup(() => {
		advancedController = new AdvancedPropertiesController(() => { }, null);
		providerOptions = [
			{
				name: 'a1',
				displayName: undefined,
				description: undefined,
				groupName: 'a',
				categoryValues: undefined,
				defaultValue: undefined,
				isIdentity: true,
				isRequired: true,
				specialValueType: null,
				valueType: ServiceOptionType.string
			},
			{
				name: 'b1',
				displayName: undefined,
				description: undefined,
				groupName: 'b',
				categoryValues: undefined,
				defaultValue: undefined,
				isIdentity: true,
				isRequired: true,
				specialValueType: null,
				valueType: ServiceOptionType.string
			},
			{
				name: 'noType',
				displayName: undefined,
				description: undefined,
				groupName: undefined,
				categoryValues: undefined,
				defaultValue: undefined,
				isIdentity: true,
				isRequired: true,
				specialValueType: null,
				valueType: ServiceOptionType.string
			},
			{
				name: 'a2',
				displayName: undefined,
				description: undefined,
				groupName: 'a',
				categoryValues: undefined,
				defaultValue: undefined,
				isIdentity: true,
				isRequired: true,
				specialValueType: null,
				valueType: ServiceOptionType.string
			},
			{
				name: 'b2',
				displayName: undefined,
				description: undefined,
				groupName: 'b',
				categoryValues: undefined,
				defaultValue: undefined,
				isIdentity: true,
				isRequired: true,
				specialValueType: null,
				valueType: ServiceOptionType.string
			}
		];
	});

	test('advanced dialog should open when showDialog in advancedController get called', () => {
		let isAdvancedDialogCalled = false;
		let options: { [name: string]: any } = {};
		let advanceDialog = TypeMoq.Mock.ofType(OptionsDialog, TypeMoq.MockBehavior.Strict,
			'', // title
			'', // name
			{}, // options
			undefined, // partsService
			undefined, // themeService
			undefined, // Context view service
			undefined, // instantiation Service
			undefined, // telemetry service
			new ContextKeyServiceStub() // contextkeyservice
		);
		advanceDialog.setup(x => x.open(TypeMoq.It.isAny(), TypeMoq.It.isAny())).callback(() => {
			isAdvancedDialogCalled = true;
		});
		advancedController.advancedDialog = advanceDialog.object;
		advancedController.showDialog(providerOptions, options);
		assert.equal(isAdvancedDialogCalled, true);
	});
});
