/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto) // arrayMethods对象的原型是真正的数组构造函数的原型

const methodsToPatch = [
	'push',
	'pop',
	'shift',
	'unshift',
	'splice',
	'sort',
	'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
	// cache original method
	const original = arrayProto[method] // 缓存了数组原本的变异方法
	def(arrayMethods, method, function mutator(...args) {
		const result = original.apply(this, args) // 将数组原本变异方法的返回值赋值给result常量
		const ob = this.__ob__ // this是数组实例本身, 无论是数组还是对象，都会被定义一个__ob__属性，并且__ob__.dep中收集了所有该对象（或数组）的依赖（观察者）
		let inserted // 用来保存新增的元素
		switch (method) {
			case 'push':
			case 'unshift':
				inserted = args // 遇到push和unshift操作时，新增元素即传递给这两个方法的参数即args
				break
			case 'splice': 
				inserted = args.slice(2) // splice函数从第三个参数到最后一个参数都是数组新增元素
				break
		}
		if (inserted) ob.observeArray(inserted)
		// notify change
		ob.dep.notify() // 当调用数组变异方法时，必然修改了数组，这时需要将该数组的所有依赖（观察者）全部拿出来执行
		return result // 保证了拦截函数的功能与数组原本变异方法的功能是一致的
	})
})
