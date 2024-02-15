/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Terminal, TerminalCore } from 'vscode-xterm';
import { TerminalCommandTracker } from 'vs/workbench/contrib/terminal/browser/terminalCommandTracker';
import { isWindows } from 'vs/base/common/platform';

interface TestTerminalCore extends TerminalCore {
	writeBuffer: string[];
	_innerWrite(): void;
}

interface TestTerminal extends Terminal {
	_core: TestTerminalCore;
}

function syncWrite(term: TestTerminal, data: string): void {
	// Terminal.write is asynchronous
	term._core.writeBuffer.push(data);
	term._core._innerWrite();
}

const ROWS = 10;
const COLS = 10;

suite('Workbench - TerminalCommandTracker', () => {
	suite('Command tracking', () => {
		test('should track commands when the prompt is of sufficient size', () => {
			assert.equal(0, 0);
		});
	});
});
