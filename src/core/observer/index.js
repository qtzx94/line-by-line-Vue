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

//  Vue数据响应系统的原理的核心是通过Object.defineProperty函数将数据对象的属性转化成访问器属性（即添加get和set方法），从而使得我们能够拦截到属性的读取和设置，
//  但是同时Vue无法拦截到对象（或数组）添加属性（或元素）的操作，所以用Vue.set和Vue.get来解决这个问题
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

		// 数组有很多实例方法，并且有些方法会改变数组自身的值，我们称其为变异方法，这些方法有：push、pop、shift、unshift、splice、sort 以及 reverse 等,
		// 这个时候我们就要考虑一件事，即当用户调用这些变异方法改变数组时需要触发依赖。
		if (Array.isArray(value)) {
			if (hasProto) { // hasProto是一个布尔值，用来检测当前环境是否可以使用__proto__属性（一个对象的 __proto__ 属性指向了它构造函数的原型，但这是一个在 ES2015 中才被标准化的属性，IE11 及更高版本才能够使用）
				protoAugment(value, arrayMethods) // 无论是 protoAugment 函数还是 copyAugment 函数，他们的目的只有一个：把数组实例与代理原型或与代理原型中定义的函数联系起来，从而拦截数组变异方法。
			} else {
				copyAugment(value, arrayMethods, arrayKeys)
			}
			this.observeArray(value) // observeArray函数的作用：递归的观测那些类型为数组或对象的数组元素
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
function protoAugment(target, src: Object) { // 通过设置数组实例的 __proto__ 属性，让其指向一个代理原型(scr)，从而做到拦截
	/* eslint-disable no-proto */
	target.__proto__ = src // 将数组的实例原型指向代理原型（arrayMethods）
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
		def(target, key, src[key]) //  def 函数在数组实例上定义与数组变异方法同名的且不可枚举的函数，这样就实现了拦截操作
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

// 在javaScript中，对象的属性分成两种类型：数据属性和访问器属性

/**
 * 一、数据属性：
 * 1.数据属性：它包含的是一个数据值的位置，在这可以对数据值进行读写
 * 2.数据属性包含四个特性：
 *      configurable: 表示能否通过delete删除属性从而重新定义属性，能否修改属性的特性，或能否把属性修改为访问器属性，默认为true
 *      enumerable：表示能否通过for-in循环返回属性
 *      writable： 表示能否修改属性的值
 *      value：包含该属性的数据值。默认为undefined
 *   
 *   通过Object.getOwnPropertyDescriptor(obj, key)获取指定属性的描述
 *   通过Object.definePorperty(obj, key, descriptor)修改指定单个属性的默认特性
 */

/**
 * 二、访问器属性：
 * 1.访问器属性：这个属性不包含数据值，包含的是一对get和set方法，在读写访问器属性时，就是通过这两个方法来进行操作处理的
 * 2.访问器属性包含四个特性：
 *     configurable: 表示能否通过delete删除属性从而重新定义属性，能否修改属性的特性，或能否把属性修改为访问器属性，默认为false
 *     enumerable：表示能否通过for-in循环返回属性
 *     Get：在读取属性时调用的函数，默认值为undefined
 *     Set：在写入属性时调用的函数，默认值为undefined
 * 
 *   访问器属性不能直接定义，要通过Object.defineProperty()这个方法来定义
 *   
 */

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
	// 当只传递两个参数时，说明没有传递第三个参数 val，那么此时需要根据 key 主动去对象上获取相应的值，即执行 if 语句块内的代码：val = obj[key]

	// 定义响应式数据时行为的不一致问题：当数据对象的某一个属性只拥有get拦截器函数而没有set拦截器函数时，此时该属性不会被深度观测，但经过defineReactive函数处理后，该属性将被重新定义getter和setter，此时该属性即拥有get函数又拥有set函数
	// 并且当我们尝试给该属性重新赋值时，新的值将被观测，此时出现矛盾：原本该属性不会被深度观测，但是重新赋值之后，新的值却被观测了，
	// 所以为解决上述问题，当属性拥有原本的setter时，即使拥有getter也要获取属性值并观测之，即(!getter || setter)
	if ((!getter || setter) && arguments.length === 2) { //这两个条件要同时满足才能会根据 key 去对象 obj 上取值：val = obj[key]，否则就不会触发取值的动作，
		// 触发不了取值的动作就意味着 val 的值为 undefined，这会导致 if 语句块后面的那句深度观测的代码无效，即不会深度观测。
		// 如果数据对象的某个属性原本就拥有自己的 get 函数，那么这个属性就不会被深度观测，因为当属性原本存在 getter 时，是不会触发取值动作的，
		// 即 val = obj[key] 不会执行，所以 val 是 undefined，这就导致在后面深度观测的语句中传递给 observe 函数的参数是 undefined
		val = obj[key]
	}

	// 将依赖收集到其他容器中，将同样的依赖分别收集到两个不同容器（1.dep，2.childOb.dep）中的原因：收集的依赖的触发时机不同，即作用不同
	// 第一个容器里收集的依赖触发时机是当属性值被修改时触发，即在set函数中触发：dep.notify()
	// 第二个容器里收集的依赖触发时机是在使用$set或Vue.set给数据对象添加新属性时触发（因为js语言的限制，没有proxy之前Vue无法拦截到给对象添加属性的操作，所以Vue提供了$set和Vue.set方法给对象添加新属性的同时触发依赖）
	// __ob__ 属性以及 __ob__.dep 的主要作用是为了添加、删除属性时有能力触发依赖，而这就是 Vue.set 或 Vue.delete 的原理。
	let childOb = !shallow && observe(val)
	Object.defineProperty(obj, key, {
		enumerable: true,
		configurable: true,
		get: function reactiveGetter() { // 收集依赖，返回属性值
			const value = getter ? getter.call(obj) : val // getter保存的是属性原型的get函数，如果getter存在那么直接调用该函数，并以该函数的返回值作为属性的值，如果getter不存在则使用val作为属性的值
			if (Dep.target) { // Dep.target的值是要被收集的依赖(观察者)
				// 这里闭包引用了上面的dep常量，注意：每一个数据字段都通过闭包引用着属于自己的 dep 常量
				//（因为在 walk 函数中通过循环遍历了所有数据对象的属性，并调用 defineReactive 函数，所以每次调用 defineReactive 定义访问器属性时，该属性的 setter/getter 都闭包引用了一个属于自己的“筐”。）
				dep.depend() // 作用是收集依赖
				if (childOb) {
					childOb.dep.depend()
					if (Array.isArray(value)) {
						dependArray(value)
					}
				}
			}
			return value
		},
		set: function reactiveSetter(newVal) { // 返回正确的属性值，触发相应的依赖
			const value = getter ? getter.call(obj) : val // 取得属性原有的值，拿原有的值和新值作比较，只有在原值和新值不相等的情况下才需要触发依赖和重新设置新属性值
			/* eslint-disable no-self-compare */
			// (newVal !== newVal && value !== value) js中当一个值与自身不全等时，这个值为NaN，即NaN === NaN  // false
			// 所以此处value !== value说明该属性原有值就是NaN，同时newVal !== newVal说明该属性设置的新值也是NaN，
			// 所以这个时候新旧值都是 NaN，等价于属性的值没有变化，所以自然不需要做额外的处理了，set 函数直接 return
			if (newVal === value || (newVal !== newVal && value !== value)) {
				return
			}
			/* eslint-enable no-self-compare */
			if (process.env.NODE_ENV !== 'production' && customSetter) { // customSetter 函数的作用，用来打印辅助信息（定义initRender函数的时候，有提到customSetter的作用）
				customSetter()
			}
			// #7981: for accessor properties without setter
			if (getter && !setter) return
			if (setter) { // 判断setter（常量setter用来存储属性原有的set函数）是否存在
				setter.call(obj, newVal) // 如果属性原来拥有自身的set函数，则使用该函数设置属性的值，从而保证属性原有的设置操作不受影响
			} else {
				val = newVal // 如果属性原本就没有set函数，那么就设置val的值：val=newVal
			}
			// 由于属性被设置了新的值，那么假如我们为属性设置的新值是一个数组或者纯对象，那么该数组或纯对象是未被观测的，所以需要对新值进行观测
			childOb = !shallow && observe(newVal) // !shallow值为true说明需要深度观测
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
		(isUndef(target) || isPrimitive(target)) // isUndef函数用来判断一个值是否是undefined或null，isPrimitive函数用来判断一个值是否是原始类型值（即：string、number、boolean以及 symbol。）
	) {
		warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
	}
	if (Array.isArray(target) && isValidArrayIndex(key)) { // isValidArrayIndex函数用来校验key是否是有效的数组索引
		target.length = Math.max(target.length, key) // 将数组的长度修改为 target.length 和 key 中的较大者，否则如果当要设置的元素的索引大于数组长度时 splice 无效
		target.splice(key, 1, val) // splice(index, howmany, item1) index（必选）: 从何处开始添加/删除元素（数组元素下标），
																 // howmany（可选）：应该删除多少元素，可以是0，如果省略该参数，则删除从index开始到数组结尾的所有元素，
																 // item（可选）：要添加到数组的新元素
		return val
	}
	if (key in target && !(key in Object.prototype)) { // 如果target不是一个数组，就是纯对象了，假设该属性已经在对象上有定义了，那么只需要直接设置该属性的值即可，这将自动触发响应，
													   // 因为已存在的属性是响应式的。这两个条件保证了 key 在 target 对象上，或在 target 的原型链上，同时必须不能在 Object.prototype 上
		target[key] = val
		return val
	}
	const ob = (target: any).__ob__
	if (target._isVue || (ob && ob.vmCount)) { // Vue 实例对象拥有 _isVue 属性，target._isVue表示当前正在使用VUe.set/$set函数为Vue实例对象添加属性，为了避免属性覆盖的情况出现，Vue.set/$set 函数不允许这么做，在非生产环境下会打印警告信息
		process.env.NODE_ENV !== 'production' && warn(
			'Avoid adding reactive properties to a Vue instance or its root $data ' +
			'at runtime - declare it upfront in the data option.'
		)
		return val
	}
	if (!ob) { // target 也许原本就是非响应的，这个时候 target.__ob__ 是不存在的，所以当发现 target.__ob__ 不存在时，就简单的赋值即可
		target[key] = val
		return val
	}
	defineReactive(ob.value, key, val) // 使用definedReactive函数设置属性值，这是为了保证新添加的属性是响应式的
	ob.dep.notify() // 调用了 __ob__.dep.notify() 从而触发响应。这就是添加全新属性触发响应的原理
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
		// 该函数将通过 for 循环遍历数组，并取得数组每一个元素的值，如果该元素的值拥有 __ob__ 对象和 __ob__.dep 对象，那说明该元素也是一个对象或数组，
		// 此时只需要手动执行 __ob__.dep.depend() 即可达到收集依赖的目的。同时如果发现数组的元素仍然是一个数组，那么需要递归调用 dependArray 继续收集依赖。
		// 为什么数组需要这样处理，而纯对象不需要呢？那是因为数组的索引是非响应式的。

		// 数据响应系统对纯对象和数组的处理方式是不同：
		// 	对于纯对象只需要逐个将对象的属性重定义为访问器属性，并且当属性的值同样为纯对象时进行递归定义即可，
		// 	而对于数组的处理则是通过拦截数组变异方法的方式，也就是说如下代码是触发不了响应的：
		// const ins = new Vue({
		// 	data: {
		// 		arr: [1, 2]
		// 	}
		// })

		// ins.arr[0] = 3  // 不能触发响应
		// 上面的代码中我们试图修改 arr 数组的第一个元素，但这么做是触发不了响应的，因为对于数组来讲，其索引并不是“访问器属性”。正是因为数组的索引不是”访问器属性“，
		// 所以当有观察者依赖数组的某一个元素时是触发不了这个元素的 get 函数的，当然也就收集不到依赖。这个时候就是 dependArray 函数发挥作用的时候了。

		e = value[i]
		e && e.__ob__ && e.__ob__.dep.depend()
		if (Array.isArray(e)) {
			dependArray(e)
		}
	}
}
