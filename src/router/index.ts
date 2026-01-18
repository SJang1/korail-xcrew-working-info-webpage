import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import PrivacyView from '../views/PrivacyView.vue'
import AdminLoginView from '../views/AdminLoginView.vue'
import AdminDashboardView from '../views/AdminDashboardView.vue'
import AdminUserDetailView from '../views/AdminUserDetailView.vue'
import AdminSettingsView from '../views/AdminSettingsView.vue'
import PromotionApp from '../views/PromotionApp.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      beforeEnter: (to, from, next) => {
        if (localStorage.getItem('app_user')) {
          next('/dashboard');
        } else {
          next();
        }
      },
      component: LoginView,
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      beforeEnter: (to, from, next) => {
        if (!localStorage.getItem('app_user') && !localStorage.getItem('admin_user')) {
          next('/');
        } else {
          next();
        }
      }
    },
    {
      "path": "/app",
      name: "application install",
      component: PromotionApp,
    },
    {
        path: '/privacy',
        name: 'privacy',
        component: PrivacyView,
    },
    // Admin Routes
    {
        path: '/adm',
        redirect: '/adm/dashboard',
    },
    {
        path: '/adm/login',
        name: 'admin-login',
        component: AdminLoginView
    },
    {
        path: '/adm/dashboard',
        name: 'admin-dashboard',
        component: AdminDashboardView,
        beforeEnter: (to, from, next) => {
            if (!localStorage.getItem('admin_user')) {
                next('/adm/login');
            } else {
                next();
            }
        }
    },
    {
        path: '/adm/settings',
        name: 'admin-settings',
        component: AdminSettingsView,
        beforeEnter: (to, from, next) => {
            if (!localStorage.getItem('admin_user')) {
                next('/adm/login');
            } else {
                next();
            }
        }
    },
    {
        path: '/adm/user/:username',
        name: 'admin-user-detail',
        component: AdminUserDetailView,
        beforeEnter: (to, from, next) => {
            if (!localStorage.getItem('admin_user')) {
                next('/adm/login');
            } else {
                next();
            }
        }
    }
  ],
})

export default router