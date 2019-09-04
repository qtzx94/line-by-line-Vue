/* @flow */

import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import { unicodeRegExp } from './lang'
import { nativeWatch, hasSymbol } from './env'

import {
	ASSET_TYPES,
	LIFECYCLE_HOOKS
} from 'shared/constants'

import {
	extend,
	hasOwn,
	camelize,
	toRawType,
	capitalize,
	isBuiltInTag,
	isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies（选项覆盖策略） are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== 'production') {
	strats.el = strats.propsData = function (parent, child, vm, key) {
		if (!vm) {
			warn(
				`option "${key}" can only be used during instance ` +
				'creation with the `new` keyword.'
			)
		}
		return defaultStrat(parent, child)
	}
}

/**
 * Helper that recursively merges two data objects together.
 */
function mergeData(to: Object, from: ?Object): Object {
	if (!from) return to
	let key, toVal, fromVal

	const keys = hasSymbol
		? Reflect.ownKeys(from)
		: Object.keys(from)

	for (let i = 0; i < keys.length; i++) {
		key = keys[i]
		// in case the object is already observed...
		if (key === '__ob__') continue
		toVal = to[key]
		fromVal = from[key]
		if (!hasOwn(to, key)) {
			set(to, key, fromVal)
		} else if (
			toVal !== fromVal &&
			isPlainObject(toVal) &&
			isPlainObject(fromVal)
		) {
			mergeData(toVal, fromVal)
		}
	}
	return to
}

/**
 * Data
 */
export function mergeDataOrFn(
	parentVal: any,
	childVal: any,
	vm?: Component
): ?Function {
	if (!vm) {
		// in a Vue.extend merge, both should be functions
		if (!childVal) {
			return parentVal
		}
		if (!parentVal) {
			return childVal
		}
		// when parentVal & childVal are both present,
		// we need to return a function that returns the
		// merged result of both functions... no need to
		// check if parentVal is a function here because
		// it has to be a function to pass previous merges.
		return function mergedDataFn() {
			return mergeData(
				typeof childVal === 'function' ? childVal.call(this, this) : childVal,
				typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
			)
		}
	} else {
		return function mergedInstanceDataFn() {
			// instance merge
			const instanceData = typeof childVal === 'function'
				? childVal.call(vm, vm)
				: childVal
			const defaultData = typeof parentVal === 'function'
				? parentVal.call(vm, vm)
				: parentVal
			if (instanceData) {
				return mergeData(instanceData, defaultData)
			} else {
				return defaultData
			}
		}
	}
}

strats.data = function (
	parentVal: any,
	childVal: any,
	vm?: Component
): ?Function {
	if (!vm) {
		if (childVal && typeof childVal !== 'function') {
			process.env.NODE_ENV !== 'production' && warn(
				'The "data" option should be a function ' +
				'that returns a per-instance value in component ' +
				'definitions.',
				vm
			)

			return parentVal
		}
		return mergeDataOrFn(parentVal, childVal)
	}

	return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 */
function mergeHook(
	parentVal: ?Array<Function>,
	childVal: ?Function | ?Array<Function>
): ?Array<Function> {
	const res = childVal
		? parentVal
			? parentVal.concat(childVal)
			: Array.isArray(childVal)
				? childVal
				: [childVal]
		: parentVal
	return res
		? dedupeHooks(res)
		: res
}

function dedupeHooks(hooks) {
	const res = []
	for (let i = 0; i < hooks.length; i++) {
		if (res.indexOf(hooks[i]) === -1) {
			res.push(hooks[i])
		}
	}
	return res
}

LIFECYCLE_HOOKS.forEach(hook => {
	strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
function mergeAssets(
	parentVal: ?Object,
	childVal: ?Object,
	vm?: Component,
	key: string
): Object {
	const res = Object.create(parentVal || null)
	if (childVal) {
		process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
		return extend(res, childVal)
	} else {
		return res
	}
}

ASSET_TYPES.forEach(function (type) {
	strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
strats.watch = function (
	parentVal: ?Object,
	childVal: ?Object,
	vm?: Component,
	key: string
): ?Object {
	// work around Firefox's Object.prototype.watch...
	if (parentVal === nativeWatch) parentVal = undefined
	if (childVal === nativeWatch) childVal = undefined
	/* istanbul ignore if */
	if (!childVal) return Object.create(parentVal || null)
	if (process.env.NODE_ENV !== 'production') {
		assertObjectType(key, childVal, vm)
	}
	if (!parentVal) return childVal
	const ret = {}
	extend(ret, parentVal)
	for (const key in childVal) {
		let parent = ret[key]
		const child = childVal[key]
		if (parent && !Array.isArray(parent)) {
			parent = [parent]
		}
		ret[key] = parent
			? parent.concat(child)
			: Array.isArray(child) ? child : [child]
	}
	return ret
}

/**
 * Other object hashes.
 */
strats.props =
	strats.methods =
	strats.inject =
	strats.computed = function (
		parentVal: ?Object,
		childVal: ?Object,
		vm?: Component,
		key: string
	): ?Object {
		if (childVal && process.env.NODE_ENV !== 'production') {
			assertObjectType(key, childVal, vm)
		}
		if (!parentVal) return childVal
		const ret = Object.create(null)
		extend(ret, parentVal)
		if (childVal) extend(ret, childVal)
		return ret
	}
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
	return childVal === undefined
		? parentVal
		: childVal
}

/**
 * Validate component names 校验组件名字是否符合要求
 */
function checkComponents(options: Object) {
	for (const key in options.components) {
		validateComponentName(key)
	}
}

// 真正用来校验名字的函数
export function validateComponentName(name: string) {
	// 符合HTML5规范，由普通字符和中横线(-)组成，并且必须以字母开头。
	if (!new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)) {
		warn(
			'Invalid component name: "' + name + '". Component names ' +
			'should conform to valid custom element name in html5 specification.'
		)
	}
	// isBuiltInTag方法是用来检测你所注册的组件是否是内置的标签，slot 和 component 这个两个名字被 Vue 作为内置标签而存在的，你是不能够使用的，比如这样：
	// new Vue({
	// 	components: {
	// 	  'slot': myComponent
	// 	}
	// })
	// 你将会得到一个警告，该警告的内容就是 checkComponents 方法中的 warn 文案
	// config.isReservedTag方法检测是否是保留标签, 通过查看isReservedTag方法的实现，可知Vue 中 html 标签和部分 SVG 标签被认为是保留的。所以这段代码是在保证选项被合并前的合理合法。
	if (isBuiltInTag(name) || config.isReservedTag(name)) {
		warn(
			'Do not use built-in or reserved HTML elements as component ' +
			'id: ' + name
		)
	}
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
function normalizeProps(options: Object, vm: ?Component) {
	const props = options.props
	if (!props) return
	const res = {} // res变量用来保存规范化后的结果
	let i, val, name
	if (Array.isArray(props)) {
		i = props.length
		while (i--) {
			val = props[i]
			if (typeof val === 'string') { // props数组中的元素必须是字符串，否则在非生产环境下会给一个警告
				name = camelize(val) // camelize函数的作用是将中横线转驼峰
				res[name] = { type: null } // 然后在 res 对象上添加了与转驼峰后的 props 同名的属性，其值为 { type: null }，这就是实现了对字符串数组的规范化，将其规范为对象的写法，只不过 type 的值为 null。
			} else if (process.env.NODE_ENV !== 'production') {
				warn('props must be strings when using array syntax.')
			}
		}
	} else if (isPlainObject(props)) { // isPlainObject函数用来判断props是否是一个纯对象，
		// 如果是一个纯对象，也是需要规范化的，我们知道即使是纯对象也是有两种写法的如下：
		// props: {
		// 	// 第一种写法，直接写类型
		// 	someData1: Number,
		// 	// 第二种写法，对象
		// 	someData2: {
		// 		type: String,
		// 		default: ''
		// 	}
		// }
		// 最终第一种写法将被规范为对象的形式，具体实现是采用一个 for in 循环，检测 props 每一个键的值，如果值是一个纯对象那么直接使用，否则将值作为 type 的值：
		for (const key in props) {
			val = props[key]
			name = camelize(key)
			res[name] = isPlainObject(val)
				? val
				: { type: val }
		}
	} else if (process.env.NODE_ENV !== 'production') {
		// 在非生产环境下，警告中使用了来自 shared/util.js 文件的 toRawType 方法获取你所传递的 props 的真实数据类型
		warn(
			`Invalid value for option "props": expected an Array or an Object, ` +
			`but got ${toRawType(props)}.`,
			vm
		)
	}
	options.props = res
}

/**
 * Normalize all injections into Object-based format
 */

//  inject 选项，这个选项是 2.2.0 版本新增，它要配合 provide 选项一同使用，eg:
// 子组件
// const ChildComponent = {
// 	template: '<div>child component</div>',
// 	created: function () {
// 		// 这里的 data 是父组件注入进来的
// 		console.log(this.data)
// 	},
// 	inject: ['data'] // 数组形式
// inject: { // 对象形式
// 	  d: 'data'
// 	}
// }

// // 父组件
// var vm = new Vue({
// 	el: '#app',
// 	// 向子组件提供数据
// 	provide: {
// 		data: 'test provide' 
// 	},
// 	components: {
// 		ChildComponent
// 	}
// })

// 上面的代码中，在子组件的create钩子中访问了this.data，但是在子组件中并没有定义data这个数据，之所以能在没有定义的情况下使用，是因为使用了inject（意为注入）选项注入了这个数据
// 这个数据的来源是父组件通过provide提供的，父组件通过provide选项向子组件提供数据，然后子组件使用inject选项注入数据
function normalizeInject(options: Object, vm: ?Component) {
	const inject = options.inject
	if (!inject) return
	const normalized = options.inject = {} // 重写了 options.inject 的值为一个空的 JSON 对象，并定义了一个值同样为空 JSON 对象的变量 normalized。现在变量 normalized 和 options.inject 将拥有相同的引用，也就是说当修改 normalized 的时候，options.inject 也将受到影响。
	if (Array.isArray(inject)) { // 数组
		for (let i = 0; i < inject.length; i++) {
			normalized[inject[i]] = { from: inject[i] }
		}
	} else if (isPlainObject(inject)) { // 纯对象
		// 开发者所写的inject对象可能是这样的
		// inject: {
		// 	data1,
		// 	d2: 'data2',
		// 	data3: { someProperty: 'someValue' }
		// }
		// 我们将会把它规范化为：
		// inject: {
		// 	'data1': { from: 'data1' },
		// 	'd2': { from: 'data2' },
		// 	'data3': { from: 'data3', someProperty: 'someValue' }
		// }
		for (const key in inject) {
			const val = inject[key]
			normalized[key] = isPlainObject(val)
				? extend({ from: key }, val)  // 如果值为纯对象则使用extend进行混合
				: { from: val }
		}
	} else if (process.env.NODE_ENV !== 'production') {
		warn(
			`Invalid value for option "inject": expected an Array or an Object, ` +
			`but got ${toRawType(inject)}.`,
			vm
		)
	}
}

/**
 * Normalize raw function directives into object format.
 */

// directives 选项用来注册局部指令，比如下面的代码我们注册了两个局部指令分别是 v-test1 和 v-test2：
{/* <div id="app" v-test1 v-test2>{{ test }}</div> */}

// var vm = new Vue({
// 	el: '#app',
// 	data: {
// 		test: 1
// 	},
// 	// 注册两个局部指令
// 	directives: {
// 		test1: {
// 			bind: function () {
// 				console.log('v-test1')
// 			}
// 		},
// 		test2: function () {
// 			console.log('v-test2')
// 		}
// 	}
// })
// 上述代码中注册了两个局部指令，但是注册方法不同，v-test1指令使用对象语法，v-test2指令使用函数，所以要进行规范化
function normalizeDirectives(options: Object) {
	const dirs = options.directives
	if (dirs) {
		for (const key in dirs) {
			const def = dirs[key]
			if (typeof def === 'function') { // 当发现你注册的指令是一个函数的时候，则将该函数作为对象形式的 bind 属性和 update 属性的值
				dirs[key] = { bind: def, update: def }
			}
		}
	}
}

function assertObjectType(name: string, value: any, vm: ?Component) {
	if (!isPlainObject(value)) {
		warn(
			`Invalid value for option "${name}": expected an Object, ` +
			`but got ${toRawType(value)}.`,
			vm
		)
	}
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
// 合并两个选项对象为一个新的对象
// 这个函数在实例化和继承的时候都有用到
// 注意：
// 1.这个函数将产生一个新的对象
// 2.这个函数不仅在实例化对象（即_init方法中）的时候用到，在继承（Vue.extend）中也有用到
export function mergeOptions(
	parent: Object,
	child: Object,
	vm?: Component
): Object {
	if (process.env.NODE_ENV !== 'production') { // 非生产环境下
		checkComponents(child)
	}

	// 这说明 child 参数除了是普通的选项对象外，还可以是一个函数，如果是函数的话就取该函数的 options 静态属性作为新的 child，我们想一想什么样的函数具有 options 静态属性呢？
	// 现在我们知道 Vue 构造函数本身就拥有这个属性，其实通过 Vue.extend 创造出来的子类也是拥有这个属性的。所以这就允许我们在进行选项合并的时候，去合并一个 Vue 实例构造者的选项了。
	if (typeof child === 'function') {
		child = child.options
	}

	// 三个规范化选项的函数，以 props 为例，我们知道在 Vue 中，我们在使用 props 的时候有两种写法，
	// 一种是使用字符串数组，如下：
	// const ChildComponent = {
	// 	props: ['someData']
	// }
	// 另外一种是使用对象语法：
	// const ChildComponent = {
	// 	props: {
	// 		someData: {
	// 		type: Number,
	// 		default: 0
	// 		}
	// 	}
	// }
	// 无论开发者使用哪一种写法，在内部都将其规范成同一种方式，这样在选项合并的时候就能够统一处理，这就是下面三个函数的作用
	normalizeProps(child, vm)
	normalizeInject(child, vm) // Inject意为注入
	normalizeDirectives(child) // Directive意为指令

	// Apply extends and mixins on the child options,
	// but only if it is a raw options object that isn't
	// the result of another mergeOptions call.
	// Only merged options has the _base property.
	if (!child._base) {
		if (child.extends) {
			parent = mergeOptions(parent, child.extends, vm)
		}
		if (child.mixins) {
			for (let i = 0, l = child.mixins.length; i < l; i++) {
				parent = mergeOptions(parent, child.mixins[i], vm)
			}
		}
	}

	const options = {}
	let key
	for (key in parent) {
		mergeField(key)
	}
	for (key in child) {
		if (!hasOwn(parent, key)) {
			mergeField(key)
		}
	}
	function mergeField(key) {
		const strat = strats[key] || defaultStrat
		options[key] = strat(parent[key], child[key], vm, key)
	}
	return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset(
	options: Object,
	type: string,
	id: string,
	warnMissing?: boolean
): any {
	/* istanbul ignore if */
	if (typeof id !== 'string') {
		return
	}
	const assets = options[type]
	// check local registration variations first
	if (hasOwn(assets, id)) return assets[id]
	const camelizedId = camelize(id)
	if (hasOwn(assets, camelizedId)) return assets[camelizedId]
	const PascalCaseId = capitalize(camelizedId)
	if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
	// fallback to prototype chain
	const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
	if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
		warn(
			'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
			options
		)
	}
	return res
}
