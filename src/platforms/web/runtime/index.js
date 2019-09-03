/* @flow */

// platforms/web/runtime/index.js，该文件的作用是对Vue进行平台化的包装：
// 设置平台化的Vue.config
// 在Vue.options上混合了两个指令(directives)，分别是model和show
// 在Vue.options上混合了两个组件(components)，分别是Transiton和TransitionGroup
// 在Vue.prototype上添加了两个方法：__patch__和$mount

import Vue from 'core/index'
import config from 'core/config'
import { extend, noop } from 'shared/util'
import { mountComponent } from 'core/instance/lifecycle'
import { devtools, inBrowser } from 'core/util/index'

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement
} from 'web/util/index'

import { patch } from './patch'
import platformDirectives from './directives/index'
import platformComponents from './components/index'

// Vue.config其代理的值是从 core/config.js 文件导出的对象，这个对象最开始长成这样：
// Vue.config = {
//   optionMergeStrategies: Object.create(null),
//   silent: false,
//   productionTip: process.env.NODE_ENV !== 'production',
//   devtools: process.env.NODE_ENV !== 'production',
//   performance: false,
//   errorHandler: null,
//   warnHandler: null,
//   ignoredElements: [],
//   keyCodes: Object.create(null),
//   isReservedTag: no,
//   isReservedAttr: no,
//   isUnknownElement: no,
//   getTagNamespace: noop,
//   parsePlatformTagName: identity,
//   mustUseProp: no,
//   _lifecycleHooks: LIFECYCLE_HOOKS
// }

// install platform specific utils
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag
Vue.config.isReservedAttr = isReservedAttr
Vue.config.getTagNamespace = getTagNamespace
Vue.config.isUnknownElement = isUnknownElement

// 在执行下面两句代码之前，它长成这样：
// Vue.options = {
// 	components: {
// 		KeepAlive
// 	},
// 	directives: Object.create(null),
// 	filters: Object.create(null),
// 	_base: Vue
// }

// platformDirectives = {
//   model,
//   show
// }

// platformComponents = {
//   Transition,
//   TransitionGroup
// }

// install platform runtime directives & components 作用是在 Vue.options 上添加 web 平台运行时的特定组件和指令。
extend(Vue.options.directives, platformDirectives)
extend(Vue.options.components, platformComponents)

// Vue.options = {
// 	components: {
// 		KeepAlive,
// 		Transition,
// 		TransitionGroup
// 	},
// 	directives: {
// 		model,
// 		show
// 	},
// 	filters: Object.create(null),
// 	_base: Vue
// }

// install platform patch function
// 首先在 Vue.prototype 上添加 __patch__ 方法，如果在浏览器环境运行的话，这个方法的值为 patch 函数，否则是一个空函数 noop
Vue.prototype.__patch__ = inBrowser ? patch : noop

// public mount method
// 又在 Vue.prototype 上添加了 $mount 方法
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined
  return mountComponent(this, el, hydrating)
}

// devtools global hook
/* istanbul ignore next */
if (inBrowser) {
  setTimeout(() => {
    if (config.devtools) {
      if (devtools) {
        devtools.emit('init', Vue)
      } else if (
        process.env.NODE_ENV !== 'production' &&
        process.env.NODE_ENV !== 'test'
      ) {
        console[console.info ? 'info' : 'log'](
          'Download the Vue Devtools extension for a better development experience:\n' +
          'https://github.com/vuejs/vue-devtools'
        )
      }
    }
    if (process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'test' &&
      config.productionTip !== false &&
      typeof console !== 'undefined'
    ) {
      console[console.info ? 'info' : 'log'](
        `You are running Vue in development mode.\n` +
        `Make sure to turn on production mode when deploying for production.\n` +
        `See more tips at https://vuejs.org/guide/deployment.html`
      )
    }
  }, 0)
}

export default Vue
