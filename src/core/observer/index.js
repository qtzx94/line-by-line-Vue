/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
	def,
	warn,
	hasOwn,
	hasProto,
	isObject,
	isPlainObject,
	isPrimitive,
	isUndef,
	isValidArrayIndex,
	isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving(value: boolean) {
	shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer { // Observer类的实例对象拥有三个实例属性：value、dep、vmCount 。两个实例方法：walk、observerArray
	value: any;
	dep: Dep;
	vmCount: number; // number of vms that have this object as root $data

	constructor(value: any) { // 构造函数接受一个参数，即数据对象
		this.value = value // 实例对象的value属性（即this.value）引用了数据对象（即value）
		this.dep = new Dep() // 实例对象的dep属性，保存了一个新创建的dep实例对象，Dep是一个收集依赖的容器
		this.vmCount = 0
		def(value, '__ob__', this) // 使用def函数（就是对Object.defineProperty函数的封装），为数据对象定义一个__ob__属性，这个属性的值就是当前Observer实例对象，这里使用def函数定义
								   // __ob__属性是因为这样可以定义不可枚举的属性，后面遍历数据对象的时候就能够防止遍历到__ob__属性

		// // eg：假设我们的数据对象如下：
		
		// const data = {
		// 	a: 1
		// }
		// // 那么经过 def 函数处理之后，data 对象应该变成如下这个样子：

		// const data = {
		// 	a: 1,
		// 	// __ob__ 是不可枚举的属性
		// 	__ob__: {
		// 		value: data, // value 属性指向 data 数据对象本身，这是一个循环引用
		// 		dep: dep实例对象, // new Dep()
		// 		vmCount: 0
		// 	}
		// }
		
		if (Array.isArray(value)) {
			if (hasProto) {
				protoAugment(value, arrayMethods)
			} else {
				copyAugment(value, arrayMethods, arrayKeys)
			}
			this.observeArray(value)
		} else { // 数据对象是一个纯对象
			this.walk(value)
		}
	}

	/**
	 * Walk through all properties and convert them into
	 * getter/setters. This method should only be called when
	 * value type is Object.
	 */
	walk(obj: Object) {
		const keys = Object.keys(obj) // 获取对象属性所有可枚举的属性
		for (let i = 0; i < keys.length; i++) { // for循环遍历这些属性，同时为每个属性调用了defineReactive函数
			defineReactive(obj, keys[i])
		}
	}

	/**
	 * Observe a list of Array items.
	 */
	observeArray(items: Array<any>) {
		for (let i = 0, l = items.length; i < l; i++) {
			observe(items[i])
		}
	}
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment(target, src: Object) {
	/* eslint-disable no-proto */
	target.__proto__ = src
	/* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment(target: Object, src: Object, keys: Array<string>) {
	for (let i = 0, l = keys.length; i < l; i++) {
		const key = keys[i]
		def(target, key, src[key])
	}
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe(value: any, asRootData: ?boolean): Observer | void { // asRootData代表将要被观测的数据是否是根级数据
	if (!isObject(value) || value instanceof VNode) { // 如果要观测的数据不是一个对象或者是VNode实例，则直接return
		return
	}
	let ob: Observer | void // ob变量用来保存Observer实例
	if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) { // 使用hasOwn函数检测数据对象value自身是否含有__ob__属性，并且__ob__属性应该是observer的实例，所以if分支的作用是来避免重复观测一个数据
		ob = value.__ob__  // 将数据对象自身的__ob__属性的值作为ob的值，__ob__：当一个数据对象被观测之后将会在该对象上定义__ob__属性
	} else if (
		shouldObserve && // shouldObserve为true说明对数据进行观测
		!isServerRendering() && // 非服务器端渲染
		(Array.isArray(value) || isPlainObject(value)) && // 数据对象是数组或纯对象
		Object.isExtensible(value) && // 被观测的对象必须是可扩展的。一个普通的对象默认就是可扩展的，以下三个方法都可以使得一个对象变得不可扩展：
																										// Object.preventExtensions()、
																										// Object.freeze()、
																										// Object.seal()
		!value._isVue // Vue实例对象拥有_isVue属性，所以这个条件用来避免Vue实例对象被观测
	) {
		ob = new Observer(value) // 当一个对象满足以上5个条件时，会创建一个Observer实例，对数据对象进行观测
	}
	if (asRootData && ob) {
		ob.vmCount++
	}
	return ob
}

/**
 * Define a reactive property on an Object.
 */
// defineReactive函数的核心就是将数据对象的数据属性转换为访问器属性，即为数据对象的属性设置一对getter/setter
export function defineReactive(
	obj: Object, // 数据对象
	key: string, // 属性键名
	val: any,
	customSetter?: ?Function,
	shallow?: boolean
) {
	const dep = new Dep()

	const property = Object.getOwnPropertyDescriptor(obj, key) // 通过Object.getOwnPropertyDescriptor函数获取该字段可能已有的属性描述对象并保存在property常量中
	if (property && property.configurable === false) {
		return
	}

	// cater for pre-defined getter/setters
	const getter = property && property.get
	const setter = property && property.set
	if ((!getter || setter) && arguments.length === 2) { // 当只传递两个参数时，说明没有传递第三个参数 val，那么此时需要根据 key 主动去对象上获取相应的值，即执行 if 语句块内的代码：val = obj[key]
		val = obj[key]
	}

	let childOb = !shallow && observe(val)
	Object.defineProperty(obj, key, {
		enumerable: true,
		configurable: true,
		get: function reactiveGetter() {
			const value = getter ? getter.call(obj) : val
			if (Dep.target) {
				// 这里闭包引用了上面的dep常量，注意：每一个数据字段都通过闭包引用着属于自己的 dep 常量
				//（因为在 walk 函数中通过循环遍历了所有数据对象的属性，并调用 defineReactive 函数，所以每次调用 defineReactive 定义访问器属性时，该属性的 setter/getter 都闭包引用了一个属于自己的“筐”。）
				dep.depend()
				if (childOb) {
					childOb.dep.depend()
					if (Array.isArray(value)) {
						dependArray(value)
					}
				}
			}
			return value
		},
		set: function reactiveSetter(newVal) {
			const value = getter ? getter.call(obj) : val
			/* eslint-disable no-self-compare */
			if (newVal === value || (newVal !== newVal && value !== value)) {
				return
			}
			/* eslint-enable no-self-compare */
			if (process.env.NODE_ENV !== 'production' && customSetter) {
				customSetter()
			}
			// #7981: for accessor properties without setter
			if (getter && !setter) return
			if (setter) {
				setter.call(obj, newVal)
			} else {
				val = newVal
			}
			childOb = !shallow && observe(newVal)
			dep.notify()
		}
	})
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set(target: Array<any> | Object, key: any, val: any): any {
	if (process.env.NODE_ENV !== 'production' &&
		(isUndef(target) || isPrimitive(target))
	) {
		warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
	}
	if (Array.isArray(target) && isValidArrayIndex(key)) {
		target.length = Math.max(target.length, key)
		target.splice(key, 1, val)
		return val
	}
	if (key in target && !(key in Object.prototype)) {
		target[key] = val
		return val
	}
	const ob = (target: any).__ob__
	if (target._isVue || (ob && ob.vmCount)) {
		process.env.NODE_ENV !== 'production' && warn(
			'Avoid adding reactive properties to a Vue instance or its root $data ' +
			'at runtime - declare it upfront in the data option.'
		)
		return val
	}
	if (!ob) {
		target[key] = val
		return val
	}
	defineReactive(ob.value, key, val)
	ob.dep.notify()
	return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del(target: Array<any> | Object, key: any) {
	if (process.env.NODE_ENV !== 'production' &&
		(isUndef(target) || isPrimitive(target))
	) {
		warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
	}
	if (Array.isArray(target) && isValidArrayIndex(key)) {
		target.splice(key, 1)
		return
	}
	const ob = (target: any).__ob__
	if (target._isVue || (ob && ob.vmCount)) {
		process.env.NODE_ENV !== 'production' && warn(
			'Avoid deleting properties on a Vue instance or its root $data ' +
			'- just set it to null.'
		)
		return
	}
	if (!hasOwn(target, key)) {
		return
	}
	delete target[key]
	if (!ob) {
		return
	}
	ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array<any>) {
	for (let e, i = 0, l = value.length; i < l; i++) {
		e = value[i]
		e && e.__ob__ && e.__ob__.dep.depend()
		if (Array.isArray(e)) {
			dependArray(e)
		}
	}
}
