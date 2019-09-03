// 从五个文件导入五个方法
import { initMixin } from './init'
import { stateMixin } from './state'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { renderMixin } from './render'
import { warn } from '../util/index'

// 定义Vue构造函数
function Vue (options) {
  // process.env.NODE_ENV !== 'production' 表示非生产环境
  if (process.env.NODE_ENV !== 'production' && 
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 当执行new Vue()后，this._init(options)将被执行
  this._init(options)
}

// 将Vue作为参数传递给导入的五个方法：
// 每个*Mixin方法的作用是包装Vue.prototype，在其上挂载一些属性和方法
initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

// 导出Vue（此时原型被包装（添加了属性和方法））
export default Vue
