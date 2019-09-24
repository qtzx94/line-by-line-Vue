/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
	set,
	del,
	observe,
	defineReactive,
	toggleObserving
} from '../observer/index'

import {
	warn,
	bind,
	noop,
	hasOwn,
	hyphenate,
	isReserved,
	handleError,
	nativeWatch,
	validateProp,
	isPlainObject,
	isServerRendering,
	isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
	enumerable: true,
	configurable: true,
	get: noop,
	set: noop
}

export function proxy(target: Object, sourceKey: string, key: string) { 
	// proxy 函数的原理是通过 Object.defineProperty 函数在实例对象 vm 上定义与 data 数据字段同名的访问器属性，并且这些属性代理的值是 vm._data 上对应属性的值
	// eg:
	// const ins = new Vue ({
	// 	data: {
	// 	  	a: 1
	// 	}
	// })
	// 当我们访问ins.a时实际访问的是ins._data.a。而ins._data才是真正的数据对象。
	sharedPropertyDefinition.get = function proxyGetter() {
		return this[sourceKey][key]
	}
	sharedPropertyDefinition.set = function proxySetter(val) {
		this[sourceKey][key] = val
	}
	Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState(vm: Component) {
	vm._watchers = []
	const opts = vm.$options
	if (opts.props) initProps(vm, opts.props) // 如果opts.props存在，即选项中有props，那么就调用initProps初始化props选项
	if (opts.methods) initMethods(vm, opts.methods)
	if (opts.data) {
		initData(vm)
	} else {
		observe(vm._data = {}, true /* asRootData */)
	}
	if (opts.computed) initComputed(vm, opts.computed)
	// 判断 opts.watch 是不是原生的 watch 对象, 因为在 Firefox 中原生提供了 Object.prototype.watch 函数，
	// 所以即使没有 opts.watch 选项, 如果在火狐浏览器中依然能够通过原型链访问到原生的 Object.prototype.watch。
	// 加了一层判断避免把原生 watch 函数误认为是我们预期的 opts.watch 选项
	if (opts.watch && opts.watch !== nativeWatch) { 
		initWatch(vm, opts.watch)
	}
}

function initProps(vm: Component, propsOptions: Object) {
	const propsData = vm.$options.propsData || {}
	const props = vm._props = {}
	// cache prop keys so that future props updates can iterate using Array
	// instead of dynamic object key enumeration.
	const keys = vm.$options._propKeys = []
	const isRoot = !vm.$parent
	// root instance props should be converted
	if (!isRoot) {
		toggleObserving(false)
	}
	for (const key in propsOptions) {
		keys.push(key)
		const value = validateProp(key, propsOptions, propsData, vm)
		/* istanbul ignore else */
		if (process.env.NODE_ENV !== 'production') {
			const hyphenatedKey = hyphenate(key)
			if (isReservedAttribute(hyphenatedKey) ||
				config.isReservedAttr(hyphenatedKey)) {
				warn(
					`"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
					vm
				)
			}
			defineReactive(props, key, value, () => {
				if (!isRoot && !isUpdatingChildComponent) {
					warn(
						`Avoid mutating a prop directly since the value will be ` +
						`overwritten whenever the parent component re-renders. ` +
						`Instead, use a data or computed property based on the prop's ` +
						`value. Prop being mutated: "${key}"`,
						vm
					)
				}
			})
		} else {
			defineReactive(props, key, value)
		}
		// static props are already proxied on the component's prototype
		// during Vue.extend(). We only need to proxy props defined at
		// instantiation here.
		if (!(key in vm)) {
			proxy(vm, `_props`, key)
		}
	}
	toggleObserving(true)
}

/**
 * @desc
 * 1.根据vm.$options.data选项获取真正想要的数据（此时vm.$options.data是函数）
 * 2.校验得到的数据是否是一个纯对象
 * 3.检查数据对象data上的键是否与props对象上的键冲突
 * 4.检查methods对象上的键是否与data对象上的键冲突
 * 5.在Vue实例对象上添加代理访问数据对象的同名属性
 * 6.最后调用observe函数开启响应式之路
 * @param {Component} vm
 */
function initData(vm: Component) {
	let data = vm.$options.data // data选项存在的时候，那么经过mergeOptions函数处理后，data选项必然是一个函数
	// data = vm._data = typeof data === 'function'
	// 	? getData(data, vm)
	// 	: data || {}
	data = vm._data = getData(data, vm) // 当通过getData拿到最终的数据对象后，将该对象赋值给vm._data属性，同时重写了data变量，此时data变量已经不是函数了，而是最终的数据对象
	if (!isPlainObject(data)) { // isPlainObject函数判断变量data是否是纯对象
		data = {}
		process.env.NODE_ENV !== 'production' && warn(
			'data functions should return an object:\n' +
			'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
			vm
		)
	}
	// proxy data on instance
	const keys = Object.keys(data)
	const props = vm.$options.props
	const methods = vm.$options.methods
	let i = keys.length
	while (i--) {
		const key = keys[i]
		if (process.env.NODE_ENV !== 'production') {
			if (methods && hasOwn(methods, key)) { // 判断data数据的key是否与methods对象中定义的函数名称相同
				warn(
					`Method "${key}" has already been defined as a data property.`,
					vm
				)
			}
		}
		if (props && hasOwn(props, key)) { // 判断data数据的key是否已经在props中有定义了，
			// 优先级关系：props优先级>data优先级>methods优先级，即如果一个key在props中定义了就不能在data中出现；如果一个key在data中出现了那就不能在methods中出现

			process.env.NODE_ENV !== 'production' && warn(
				`The data property "${key}" is already declared as a prop. ` +
				`Use prop default value instead.`,
				vm
			)
		} else if (!isReserved(key)) { // isReserved函数作用是判断定义在data中的key是否是保留键，通过判断一个字符串的第一个字符是不是$或_来决定其是否是保留的（Vue是不会代理那些键名以$或_开头的字段的，因为Vue自身的属性和方法都是以$或_开头的，所以这么做是为了避免与Vue自身的属性和方法相冲突。）
			// 如果key既不是以$开头，又不是以_开头，那么将执行proxy函数，实现实例对象的代理访问
			proxy(vm, `_data`, key)
		}
	}
	// observe data
	observe(data, true /* asRootData */)
}

// getData函数的作用是通过调用data函数获取真正的数据对象并返回，即data.call(vm, vm)
export function getData(data: Function, vm: Component): any {
	// #7573 disable dep collection when invoking data getters
	pushTarget()
	try {
		return data.call(vm, vm)
	} catch (e) {
		handleError(e, vm, `data()`)
		return {}
	} finally {
		popTarget()
	}
}

const computedWatcherOptions = { lazy: true }

function initComputed(vm: Component, computed: Object) {
	// $flow-disable-line
	const watchers = vm._computedWatchers = Object.create(null)
	// computed properties are just getters during SSR
	const isSSR = isServerRendering()

	for (const key in computed) {
		const userDef = computed[key]
		const getter = typeof userDef === 'function' ? userDef : userDef.get
		if (process.env.NODE_ENV !== 'production' && getter == null) {
			warn(
				`Getter is missing for computed property "${key}".`,
				vm
			)
		}

		if (!isSSR) {
			// create internal watcher for the computed property.
			watchers[key] = new Watcher(
				vm,
				getter || noop,
				noop,
				computedWatcherOptions
			)
		}

		// component-defined computed properties are already defined on the
		// component prototype. We only need to define computed properties defined
		// at instantiation here.
		if (!(key in vm)) {
			defineComputed(vm, key, userDef)
		} else if (process.env.NODE_ENV !== 'production') {
			if (key in vm.$data) {
				warn(`The computed property "${key}" is already defined in data.`, vm)
			} else if (vm.$options.props && key in vm.$options.props) {
				warn(`The computed property "${key}" is already defined as a prop.`, vm)
			}
		}
	}
}

export function defineComputed(
	target: any,
	key: string,
	userDef: Object | Function
) {
	const shouldCache = !isServerRendering()
	if (typeof userDef === 'function') {
		sharedPropertyDefinition.get = shouldCache
			? createComputedGetter(key)
			: createGetterInvoker(userDef)
		sharedPropertyDefinition.set = noop
	} else {
		sharedPropertyDefinition.get = userDef.get
			? shouldCache && userDef.cache !== false
				? createComputedGetter(key)
				: createGetterInvoker(userDef.get)
			: noop
		sharedPropertyDefinition.set = userDef.set || noop
	}
	if (process.env.NODE_ENV !== 'production' &&
		sharedPropertyDefinition.set === noop) {
		sharedPropertyDefinition.set = function () {
			warn(
				`Computed property "${key}" was assigned to but it has no setter.`,
				this
			)
		}
	}
	Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter(key) {
	return function computedGetter() {
		const watcher = this._computedWatchers && this._computedWatchers[key]
		if (watcher) {
			if (watcher.dirty) {
				watcher.evaluate()
			}
			if (Dep.target) {
				watcher.depend()
			}
			return watcher.value
		}
	}
}

function createGetterInvoker(fn) {
	return function computedGetter() {
		return fn.call(this, this)
	}
}

function initMethods(vm: Component, methods: Object) {
	const props = vm.$options.props
	for (const key in methods) {
		if (process.env.NODE_ENV !== 'production') {
			if (typeof methods[key] !== 'function') {
				warn(
					`Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
					`Did you reference the function correctly?`,
					vm
				)
			}
			if (props && hasOwn(props, key)) {
				warn(
					`Method "${key}" has already been defined as a prop.`,
					vm
				)
			}
			if ((key in vm) && isReserved(key)) {
				warn(
					`Method "${key}" conflicts with an existing Vue instance method. ` +
					`Avoid defining component methods that start with _ or $.`
				)
			}
		}
		vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
	}
}

function initWatch(vm: Component, watch: Object) {
	for (const key in watch) {
		const handler = watch[key]
		if (Array.isArray(handler)) {
			for (let i = 0; i < handler.length; i++) {
				createWatcher(vm, key, handler[i])
			}
		} else {
			createWatcher(vm, key, handler)
		}
	}
}

function createWatcher(
	vm: Component,
	expOrFn: string | Function,
	handler: any,
	options?: Object
) {
	if (isPlainObject(handler)) {
		options = handler
		handler = handler.handler
	}
	if (typeof handler === 'string') {
		handler = vm[handler]
	}
	return vm.$watch(expOrFn, handler, options)
}

export function stateMixin(Vue: Class<Component>) {
	// flow somehow has problems with directly declared definition object
	// when using Object.defineProperty, so we have to procedurally build up
	// the object here.
	const dataDef = {}
	// $data 属性实际上代理的是 _data 这个实例属性，而 $props 代理的是 _props 这个实例属性
	dataDef.get = function () { return this._data }
	const propsDef = {}
	propsDef.get = function () { return this._props }
	// 如果是生产环境，就为$data和$props设置set，实际上是提醒不能修改属性，两者皆为只读属性
	if (process.env.NODE_ENV !== 'production') {
		dataDef.set = function () {
			warn(
				'Avoid replacing instance root $data. ' +
				'Use nested data properties instead.',
				this
			)
		}
		propsDef.set = function () {
			warn(`$props is readonly.`, this)
		}
	}
	// 给Vue原型添加$data，$props属性，这两个属性定义分别写在dataDef、propsDef两个对象里面
	Object.defineProperty(Vue.prototype, '$data', dataDef)
	Object.defineProperty(Vue.prototype, '$props', propsDef)

	// 在Vue.prototype定义了三个方法
	Vue.prototype.$set = set
	Vue.prototype.$delete = del

	Vue.prototype.$watch = function (
		expOrFn: string | Function,
		cb: any,
		options?: Object
	): Function {
		const vm: Component = this
		if (isPlainObject(cb)) {
			return createWatcher(vm, expOrFn, cb, options)
		}
		options = options || {}
		options.user = true
		const watcher = new Watcher(vm, expOrFn, cb, options)
		if (options.immediate) {
			try {
				cb.call(vm, watcher.value)
			} catch (error) {
				handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
			}
		}
		return function unwatchFn() {
			watcher.teardown()
		}
	}
}
