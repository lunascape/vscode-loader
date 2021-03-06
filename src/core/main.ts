/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

// Limitation: To load jquery through the loader, always require 'jquery' and add a path for it in the loader configuration

declare var doNotInitLoader;
var define;

namespace AMDLoader {

	let moduleManager: ModuleManager = null;
	let DefineFunc: IDefineFunc = null;
	let RequireFunc: IRequireFunc = null;

	function createGlobalAMDFuncs(): void {

		const _defineFunc = function (id: any, dependencies: any, callback: any): void {
			if (typeof id !== 'string') {
				callback = dependencies;
				dependencies = id;
				id = null;
			}
			if (typeof dependencies !== 'object' || !Array.isArray(dependencies)) {
				callback = dependencies;
				dependencies = null;
			}
			if (!dependencies) {
				dependencies = ['require', 'exports', 'module'];
			}

			if (id) {
				moduleManager.defineModule(id, dependencies, callback, null, null);
			} else {
				moduleManager.enqueueDefineAnonymousModule(dependencies, callback);
			}
		};

		DefineFunc = <any>_defineFunc;
		DefineFunc.amd = {
			jQuery: true
		};

		const _requireFunc_config = function (params: IConfigurationOptions, shouldOverwrite: boolean = false): void {
			moduleManager.configure(params, shouldOverwrite);
		};

		const _requireFunc = function () {
			if (arguments.length === 1) {
				if ((arguments[0] instanceof Object) && !Array.isArray(arguments[0])) {
					_requireFunc_config(arguments[0]);
					return;
				}
				if (typeof arguments[0] === 'string') {
					return moduleManager.synchronousRequire(arguments[0]);
				}
			}
			if (arguments.length === 2 || arguments.length === 3) {
				if (Array.isArray(arguments[0])) {
					moduleManager.defineModule(Utilities.generateAnonymousModule(), arguments[0], arguments[1], arguments[2], null);
					return;
				}
			}
			throw new Error('Unrecognized require call');
		};

		RequireFunc = <any>_requireFunc;
		RequireFunc.config = _requireFunc_config;
		RequireFunc.getConfig = function (): IConfigurationOptions {
			return moduleManager.getConfig().getOptionsLiteral();
		};

		RequireFunc.reset = function (): void {
			moduleManager = moduleManager.reset();
		};

		RequireFunc.getBuildInfo = function (): IBuildModuleInfo[] {
			return moduleManager.getBuildInfo();
		};

		RequireFunc.getStats = function (): LoaderEvent[] {
			return moduleManager.getLoaderEvents();
		};
	}

	export function init(): void {
		createGlobalAMDFuncs();

		const env = Environment.detect();
		const scriptLoader: IScriptLoader = createScriptLoader(env);
		moduleManager = new ModuleManager(env, scriptLoader, DefineFunc, RequireFunc, Utilities.getHighPerformanceTimestamp());

		if (env.isNode) {
			var _nodeRequire = (global.require || require);
			var nodeRequire = function (what) {
				moduleManager.getRecorder().record(LoaderEventType.NodeBeginNativeRequire, what);
				try {
					return _nodeRequire(what);
				} finally {
					moduleManager.getRecorder().record(LoaderEventType.NodeEndNativeRequire, what);
				}
			};

			global.nodeRequire = nodeRequire;
			(<any>RequireFunc).nodeRequire = nodeRequire;
		}

		if (env.isNode && !env.isElectronRenderer) {
			module.exports = RequireFunc;
			// These two defs are fore the local closure defined in node in the case that the loader is concatenated
			define = function () {
				DefineFunc.apply(null, arguments);
			};
			require = <any>RequireFunc;
		} else {
			// The global variable require can configure the loader
			if (typeof global.require !== 'undefined' && typeof global.require !== 'function') {
				RequireFunc.config(global.require);
			}
			if (!env.isElectronRenderer) {
				global.define = define = DefineFunc;
			} else {
				define = function () {
					DefineFunc.apply(null, arguments);
				};
			}
			global.require = RequireFunc;
			global.require.__$__nodeRequire = nodeRequire;
		}
	}

	if (
		typeof doNotInitLoader === 'undefined' &&
		(typeof global.define !== 'function' || !global.define.amd)
	) {
		init();
	}
}
