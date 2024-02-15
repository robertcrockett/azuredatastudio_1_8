/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import * as azdata from 'azdata';
import 'mocha';
import { SchemaCompareDialog } from './../dialogs/schemaCompareDialog';
import { SchemaCompareResult } from './../schemaCompareResult';
import { SchemaCompareTestService } from './testSchemaCompareService';

// Mock test data
const mockConnectionProfile: azdata.IConnectionProfile = {
		connectionName: 'My Connection',
		serverName: 'My Server',
		databaseName: 'My Server',
		userName: 'My User',
		password: 'My Pwd',
		authenticationType: 'SqlLogin',
		savePassword: false,
		groupFullName: 'My groupName',
		groupId: 'My GroupId',
		providerName: 'My Server',
		saveProfile: true,
		id: 'My Id',
		options: null
};

const mocksource: string = 'source.dacpac';
const mocktarget: string = 'target.dacpac';

const mockSourceEndpoint: azdata.SchemaCompareEndpointInfo = {
	endpointType: azdata.SchemaCompareEndpointType.Dacpac,
	serverName: '',
	databaseName: '',
	ownerUri: '',
	packageFilePath: mocksource
};

const mockTargetEndpoint: azdata.SchemaCompareEndpointInfo = {
	endpointType: azdata.SchemaCompareEndpointType.Dacpac,
	serverName: '',
	databaseName: '',
	ownerUri: '',
	packageFilePath: mocktarget
};

describe('SchemaCompareDialog.openDialog', function(): void {
	it('Should be correct when created.', async function(): Promise<void> {
		let dialog = new SchemaCompareDialog();
		await dialog.openDialog(mockConnectionProfile);

		should(dialog.dialog.title).equal('Schema Compare');
		should(dialog.dialog.okButton.label).equal('Ok');
		should(dialog.dialog.okButton.enabled).equal(false); // Should be false when open
	});
});

describe('SchemaCompareResult.start', function(): void {
	it('Should be correct when created.', async function(): Promise<void> {
		let sc = new SchemaCompareTestService();
		azdata.dataprotocol.registerSchemaCompareServicesProvider(sc);

		let result = new SchemaCompareResult(mocksource, mocktarget, mockSourceEndpoint, mockTargetEndpoint);
		let promise = new Promise(resolve => setTimeout(resolve, 3000)); // to ensure comparision result view is initialized
		await promise;
		await result.start();

		should(result.getComparisionResult() === undefined);
		await result.execute();

		should(result.getComparisionResult() !== undefined);
		should(result.getComparisionResult().operationId !== undefined);
	});
});
