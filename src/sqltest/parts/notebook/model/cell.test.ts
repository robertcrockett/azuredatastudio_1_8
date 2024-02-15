/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import { nb } from 'azdata';

import * as objects from 'vs/base/common/objects';

import { CellTypes } from 'sql/workbench/parts/notebook/models/contracts';
import { ModelFactory } from 'sql/workbench/parts/notebook/models/modelFactory';
import { NotebookModelStub } from '../common';
import { EmptyFuture } from 'sql/workbench/services/notebook/common/sessionManager';
import { ICellModel } from 'sql/workbench/parts/notebook/models/modelInterfaces';
import { Deferred } from 'sql/base/common/promise';

suite('Cell Model', function (): void {
	let factory = new ModelFactory();
	test('Should set default values if none defined', async function (): Promise<void> {
		let cell = factory.createCell(undefined, undefined);
		should(cell.cellType).equal(CellTypes.Code);
		should(cell.source).equal('');
	});

	test('Should update values', async function (): Promise<void> {
		let cell = factory.createCell(undefined, undefined);
		cell.setOverrideLanguage('sql');
		should(cell.language).equal('sql');
		cell.source = 'abcd';
		should(cell.source).equal('abcd');
	});

	test('Should match ICell values if defined', async function (): Promise<void> {
		let output: nb.IStreamResult = {
			output_type: 'stream',
			text: 'Some output',
			name: 'stdout'
		};
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Markdown,
			source: 'some *markdown*',
			outputs: [output],
			metadata: { language: 'python' },
			execution_count: 1
		};
		let cell = factory.createCell(cellData, undefined);
		should(cell.cellType).equal(cellData.cell_type);
		should(cell.source).equal(cellData.source);
		should(cell.outputs).have.length(1);
		should(cell.outputs[0].output_type).equal('stream');
		should((<nb.IStreamResult>cell.outputs[0]).text).equal('Some output');
	});


	test('Should set cell language to python if defined as python in languageInfo', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: 'print(\'1\')',
			metadata: { language: 'python' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: 'python',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		should(cell.language).equal('python');
	});

	test('Should set cell language to python if defined as pyspark in languageInfo', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: 'print(\'1\')',
			metadata: { language: 'python' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: 'pyspark',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		should(cell.language).equal('python');
	});

	test('Should keep cell language as python if cell has language override', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: 'print(\'1\')',
			metadata: { language: 'python' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: 'scala',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		should(cell.language).equal('python');
	});

	test('Should set cell language to python if no language defined', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: 'print(\'1\')',
			metadata: { language: 'python' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: '',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		should(cell.language).equal('python');
	});

	suite('Model Future handling', function (): void {
		let future: TypeMoq.Mock<EmptyFuture>;
		let cell: ICellModel;
		const stdInDefaultMessage: nb.IStdinMessage = {
			channel: 'stdin',
			type: 'stdin',
			parent_header: undefined,
			metadata: undefined,
			header: <nb.IHeader>{
				msg_type: 'stream'
			},
			content: {
				prompt: 'Prompt',
				password: false
			}
		};
		setup(() => {
			future = TypeMoq.Mock.ofType(EmptyFuture);
			cell = factory.createCell({
				cell_type: CellTypes.Code,
				source: 'print "Hello"',
				metadata: { language: 'python' },
				execution_count: 1
			}, {
					notebook: new NotebookModelStub({
						name: '',
						version: '',
						mimetype: 'x-scala'
					}),
					isTrusted: false
				});
		});

		test('should send and handle incoming messages', async () => {
			// Given a future
			let onReply: nb.MessageHandler<nb.IShellMessage>;
			let onIopub: nb.MessageHandler<nb.IIOPubMessage>;
			future.setup(f => f.setReplyHandler(TypeMoq.It.isAny())).callback((handler) => onReply = handler);
			future.setup(f => f.setIOPubHandler(TypeMoq.It.isAny())).callback((handler) => onIopub = handler);
			let outputs: ReadonlyArray<nb.ICellOutput> = undefined;
			cell.onOutputsChanged((o => outputs = o));

			// When I set it on the cell
			cell.setFuture(future.object);

			// Then I expect outputs to have been cleared
			should(outputs).have.length(0);
			should(onReply).not.be.undefined();
			// ... And when I send an IoPub message
			let message: nb.IIOPubMessage = {
				channel: 'iopub',
				type: 'iopub',
				parent_header: undefined,
				metadata: undefined,
				header: <nb.IHeader>{
					msg_type: 'stream'
				},
				content: {
					text: 'Printed hello world'
				}
			};
			onIopub.handle(message);
			// Then I expect an output to be added
			should(outputs).have.length(1);
			should(outputs[0].output_type).equal('stream');

			message = objects.deepClone(message);
			message.header.msg_type = 'display_data';
			onIopub.handle(message);
			should(outputs[1].output_type).equal('display_data');
		});

		test('stdin should return void if no handler registered', async () => {
			// Given stdIn does not have a request handler setup
			let onStdIn: nb.MessageHandler<nb.IStdinMessage>;
			future.setup(f => f.setStdInHandler(TypeMoq.It.isAny())).callback((handler) => onStdIn = handler);

			// When I set it on the cell
			cell.setFuture(future.object);

			// Then I expect stdIn to have been hooked up
			should(onStdIn).not.be.undefined();
			// ... And when I send a stdIn request message
			let result = onStdIn.handle(stdInDefaultMessage);
			// Then I expect the promise to resolve
			await result;
			future.verify(f => f.sendInputReply(TypeMoq.It.isAny()), TypeMoq.Times.never());
		});

		test('stdin should wait on handler if handler registered', async () => {
			// Given stdIn has a handler set up
			let onStdIn: nb.MessageHandler<nb.IStdinMessage>;
			future.setup(f => f.setStdInHandler(TypeMoq.It.isAny())).callback((handler) => onStdIn = handler);

			let deferred = new Deferred<void>();
			let stdInMessage: nb.IStdinMessage = undefined;
			cell.setStdInHandler({
				handle: (msg: nb.IStdinMessage) => {
					stdInMessage = msg;
					return deferred.promise;
				}
			});

			// When I send a stdIn request message
			cell.setFuture(future.object);
			let result = onStdIn.handle(stdInDefaultMessage);
			deferred.resolve();
			// Then I expect promise to resolve since it should wait on upstream handling
			await result;
			// And I expect message to have been passed upstream and no message sent from the cell
			should(stdInMessage).not.be.undefined();
			should(stdInMessage.content.prompt).equal(stdInDefaultMessage.content.prompt);
			should(stdInMessage.content.password).equal(stdInDefaultMessage.content.password);
			future.verify(f => f.sendInputReply(TypeMoq.It.isAny()), TypeMoq.Times.never());
		});
		test('stdin should send default response if there is upstream error', async () => {
			// Given stdIn has a handler set up
			let onStdIn: nb.MessageHandler<nb.IStdinMessage>;
			future.setup(f => f.setStdInHandler(TypeMoq.It.isAny())).callback((handler) => onStdIn = handler);

			let deferred = new Deferred<void>();
			let stdInMessage: nb.IStdinMessage = undefined;
			cell.setStdInHandler({
				handle: (msg: nb.IStdinMessage) => {
					stdInMessage = msg;
					return deferred.promise;
				}
			});

			// When I send a stdIn request message
			cell.setFuture(future.object);
			let result = onStdIn.handle(stdInDefaultMessage);
			deferred.reject('Something went wrong');
			// Then I expect promise to resolve since it should wait on upstream handling
			await result;
			future.verify(f => f.sendInputReply(TypeMoq.It.isAny()), TypeMoq.Times.once());
		});

		test('should delete transient tag while handling incoming messages', async () => {
			// Given a future
			let onIopub: nb.MessageHandler<nb.IIOPubMessage>;
			future.setup(f => f.setIOPubHandler(TypeMoq.It.isAny())).callback((handler) => onIopub = handler);
			let outputs: ReadonlyArray<nb.ICellOutput> = undefined;
			cell.onOutputsChanged((o => outputs = o));

			//Set the future
			cell.setFuture(future.object);

			// ... And when I send an IoPub message
			let message: nb.IIOPubMessage = {
				channel: 'iopub',
				type: 'iopub',
				parent_header: undefined,
				metadata: undefined,
				header: <nb.IHeader>{
					msg_type: 'display_data'
				},
				content: {
					text: 'Printed hello world',
					transient: 'transient data'
				}
			};
			onIopub.handle(message);
			//Output array's length should be 1
			//'transient' tag should no longer exist in the output
			should(outputs).have.length(1);
			should(outputs[0]['transient']).be.undefined();
		});

		test('should dispose old future', async () => {
			let oldFuture = TypeMoq.Mock.ofType(EmptyFuture);
			cell.setFuture(oldFuture.object);

			cell.setFuture(future.object);

			oldFuture.verify(f => f.dispose(), TypeMoq.Times.once());
		});
	});

});
