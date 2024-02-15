/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as TypeMoq from 'typemoq';
import assert = require('assert');
import { EOL } from 'os';
import { ResourceTypeService } from '../services/resourceTypeService';
import { IPlatformService } from '../services/platformService';
import { ToolsService } from '../services/toolsService';

suite('Resource Type Service Tests', function (): void {

	test('test resource types', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const toolsService = new ToolsService();
		const resourceTypeService = new ResourceTypeService(mockPlatformService.object, toolsService);
		// index 0: platform name, index 1: number of expected resource types
		const platforms: { platform: string; resourceTypeCount: number }[] = [
			{ platform: 'win32', resourceTypeCount: 2 },
			{ platform: 'darwin', resourceTypeCount: 2 },
			{ platform: 'linux', resourceTypeCount: 2 }];
		const totalResourceTypeCount = 2;
		platforms.forEach(platformInfo => {
			mockPlatformService.reset();
			mockPlatformService.setup(service => service.platform()).returns(() => platformInfo.platform);
			mockPlatformService.setup(service => service.showErrorMessage(TypeMoq.It.isAnyString()));
			const resourceTypes = resourceTypeService.getResourceTypes(true);
			assert.equal(resourceTypes.length, platformInfo.resourceTypeCount, `number of resource types for platform:${platformInfo.resourceTypeCount} does not meet expected value.`);
		});

		const allResourceTypes = resourceTypeService.getResourceTypes(false);
		assert.equal(allResourceTypes.length, totalResourceTypeCount, `number of resource types does not meet expected value.`);

		const validationErrors = resourceTypeService.validateResourceTypes(allResourceTypes);
		assert(validationErrors.length === 0, `Validation errors detected in the package.json: ${validationErrors.join(EOL)}.`);
	});
});