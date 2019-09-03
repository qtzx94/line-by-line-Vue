import Vue from './instance/index' // 从Vue的出生文件导入Vue，主要作用是定义Vue构造函数，并对其原型添加属性和方法，即实例的属性和方法
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'

// 给Vue构造函数添加静态方法和属性
initGlobalAPI(Vue)

// 在Vue.prototype上添加了$isServer只读属性，该属性代理了来自core/util/env.js文件的isServerRendering方法
Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

// 在Vue.prototype上添加了$ssrContext只读属性
Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// expose FunctionalRenderContext for ssr runtime helper installation
// 在Vue构造函数上定义了FunctionalRenderContext静态属性，之所以在Vue的构造函数上暴露该属性，是为了在ssr中使用它
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

// Vue.version存储了当前Vue的版本号
Vue.version = '__VERSION__'

// 导出Vue（为Vue添加全局API，即静态方法和属性）
export default Vue
