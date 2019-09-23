/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin(Vue: Class<Component>) {
	Vue.prototype._init = function (options?: Object) {
		const vm: Component = this // 声明了常量vm，其值为this，也就是当前这个Vue实例
		// a uid
		vm._uid = uid++ // 在实例上声明了一个唯一标示：_uid，实际上_uid就是一个Vue实例的实例属性

		let startTag, endTag
		/* istanbul ignore if */
		if (process.env.NODE_ENV !== 'production' && config.performance && mark) { // 在非生产环境下，并且 config.performance 和 mark 都为真
			// Vue 提供了全局配置 Vue.config.performance，我们通过将其设置为 true，即可开启性能追踪，你可以追踪四个场景的性能：
			// 1、组件初始化(component init)
			// 2、编译(compile)，将模板(template)编译成渲染函数
			// 3、渲染(render)，其实就是渲染函数的性能，或者说渲染函数执行且生成虚拟DOM(vnode)的性能
			// 4、打补丁(patch)，将虚拟DOM渲染为真实DOM的性能

			// 其中组件初始化的性能追踪就是我们在 _init 方法中看到的那样去实现的，其实现的方式就是在初始化的代码的开头和结尾分别使用 mark 函数打上两个标记，然后通过 measure 函数对这两个标记点进行性能计算
			startTag = `vue-perf-start:${vm._uid}`
			endTag = `vue-perf-end:${vm._uid}`
			mark(startTag)
		}

		// a flag to avoid this being observed
		vm._isVue = true // 在Vue实例上添加_isVue属性，用来标识一个对象是Vue实例，即如果发现一个对象有_isVue属性并且值为true，那么代表该对象是Vue实例，这样可以避免该对象被响应系统观测
		// merge options
		if (options && options._isComponent) { // 其中 options 就是我们调用 Vue 时传递的参数选项，_isComponent是一个内部选项，是在 Vue 创建组件的时候才会有的
			// optimize internal component instantiation 优化内部组件实例化
			// since dynamic options merging is pretty slow, and none of the
			// internal component options needs special treatment
			initInternalComponent(vm, options)
		} else {
			vm.$options = mergeOptions(
				resolveConstructorOptions(vm.constructor), // resolveConstructorOptions函数的作用：解析构造函数的options（该函数返回值是options，说明该函数的作用是用来获取当前实例构造者的options属性）, 
														   // 当通过new Vue()时，vm.constructor指Vue的构造函数；
														   // 当通过Vue.extend创造一个子类并使用子类创造实例时，那么vm.constructor就是子类；
														   // eg：
														   // const Sub = Vue.extend();
														   // const s = new Sub();
														   // 此时s.constructor就是Sub而非Vue
				options || {}, // options 就是我们调用 Vue 构造函数时透传进来的对象
				vm // 当前实例
			)
		}
		/* istanbul ignore else */
		// 第二步： renderProxy
		if (process.env.NODE_ENV !== 'production') {
			initProxy(vm)
		} else {
			vm._renderProxy = vm
		}
		// expose real self
		vm._self = vm // 在Vue实例对象vm上添加了_self属性，指向真实的实例本身
		// 第三步： vm的生命周期相关变量初始化
		initLifecycle(vm)
		// 第四步：vm的事件监听初始化
		initEvents(vm)
		initRender(vm)
		callHook(vm, 'beforeCreate')
		initInjections(vm) // resolve injections before data/props
		// 第五步： vm的状态初始化，prop/data/computed/method/watch都在这里完成初始化，因此也是Vue实例create的关键。
		initState(vm)
		initProvide(vm) // resolve provide after data/props
		callHook(vm, 'created')

		/* istanbul ignore if */
		if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
			vm._name = formatComponentName(vm, false)
			mark(endTag)
			measure(`vue ${vm._name} init`, startTag, endTag)
		}

		// 第六步：render & mount
		if (vm.$options.el) {
			vm.$mount(vm.$options.el)
		}
	}
}

export function initInternalComponent(vm: Component, options: InternalComponentOptions) {
	const opts = vm.$options = Object.create(vm.constructor.options)
	// doing this because it's faster than dynamic enumeration.
	const parentVnode = options._parentVnode
	opts.parent = options.parent
	opts._parentVnode = parentVnode

	const vnodeComponentOptions = parentVnode.componentOptions
	opts.propsData = vnodeComponentOptions.propsData
	opts._parentListeners = vnodeComponentOptions.listeners
	opts._renderChildren = vnodeComponentOptions.children
	opts._componentTag = vnodeComponentOptions.tag

	if (options.render) {
		opts.render = options.render
		opts.staticRenderFns = options.staticRenderFns
	}
}

export function resolveConstructorOptions(Ctor: Class<Component>) {
	let options = Ctor.options // 通过new Vue() 创建时，Ctor.options即指Vue.options，内容如下：
	// Vue.options = {
	// 	components: {
	// 		KeepAlive
	// 		Transition,
	// 		TransitionGroup
	// 	},
	// 	directives:{
	// 		model,
	// 		show
	// 	},
	// 	filters: Object.create(null),
	// 	_base: Vue
	// }

	// 判断该类是否是Vue的子类
	// eg：
	// const Sub = Vue.extend();
	// console.log(Sub.super) // Vue
	// 即super这个属性是和Vue.extend有关系的
	if (Ctor.super) {
		const superOptions = resolveConstructorOptions(Ctor.super) // 递归调用resolveConstructorOptions函数，此时参数是构造者的父类
		const cachedSuperOptions = Ctor.superOptions
		// 判断父类中的options 有没有发生变化
		if (superOptions !== cachedSuperOptions) {
			// super option changed,
			// need to resolve new options.
			Ctor.superOptions = superOptions
			// check if there are any late-modified/attached options (#4976)
			const modifiedOptions = resolveModifiedOptions(Ctor)
			// update base extend options
			if (modifiedOptions) {
				extend(Ctor.extendOptions, modifiedOptions)
			}
			options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
			if (options.name) {
				options.components[options.name] = Ctor
			}
		}
	}
	return options
}

function resolveModifiedOptions(Ctor: Class<Component>): ?Object {
	let modified
	const latest = Ctor.options
	const sealed = Ctor.sealedOptions
	for (const key in latest) {
		if (latest[key] !== sealed[key]) {
			if (!modified) modified = {}
			modified[key] = latest[key]
		}
	}
	return modified
}
