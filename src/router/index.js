import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: 'AI 财务应用中心' }
  },
  {
    path: '/finance',
    name: 'finance',
    component: () => import('../views/FinanceChatView.vue'),
    meta: { title: '财务小助手' }
  },
  {
    path: '/manus',
    name: 'manus',
    component: () => import('../views/ManusChatView.vue'),
    meta: { title: 'AI 超级智能体' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.afterEach((to) => {
  document.title = to.meta.title || 'AI 财务应用中心'
})

export default router
