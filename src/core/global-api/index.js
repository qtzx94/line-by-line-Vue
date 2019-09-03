/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI(Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  // 在Vue的构造函数上添加config只读属性，并且当你试图设置其值时，在非生产环境下会给你一个友好的提示
  Object.defineProperty(Vue, 'config', configDef) // Vue.config代理的是从core/config.js文件导出的对象

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // Vue.util以及util下的四个方法不视作公共API的一部分，除非你已经意识到某些风险，否则不要去依赖他们。
  // 并且，在官方文档上也并没有介绍这个全局API，所以能不用尽量不要用。

  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // 在Vue上添加了几个属性 
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  // Vue.observable = <T>(obj: T): T => {
  //   observe(obj)
  //   return obj
  // }

  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue

  // 59-66行执行完后:
  // Vue.options = {
  //   compontents: Object.create(null),
  //   directives: Object.create(null),
  //   filters: Object.create(null),
  //   _base: Vue
  // }

  // 将builtInComponents属性混到Vue.options.components中
  // 其中 builtInComponents该文件如下：
  // import KeepAlive from './keep-alive'

  // export default {
  //   KeepAlive
  // }

  // 所以最终：
  // Vue.options.components = {
  //   KeepAlive
  // }
  extend(Vue.options.components, builtInComponents)

  // extend源码如下：
  // /**
  //  * Mix properties into target object.
  //  */
  // export function extend (to: Object, _from: ?Object): Object {
  //   for (const key in _from) {
  //     to[key] = _from[key]
  //   }
  //   return to
  // }
  // 描述：将 _from 对象的属性混合到 to 对象中

  // 参数：

  // {Object} to 目标对象
  // {Object} _from 源对象
  // 返回值：混合后的 to 对象

  // 那么到现在为止，Vue.options 已经变成了这样：

  // Vue.options = {
  //   components: {
  //     KeepAlive
  //   },
  //   directives: Object.create(null),
  //   filters: Object.create(null),
  //   _base: Vue
  // }

  // 全局方法
  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
