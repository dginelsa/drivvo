import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthPage } from './auth/auth.page';
import { authGuard } from './auth.guard';

const routes: Routes = [
  { path: 'auth', component: AuthPage },
  {
    path: 'home',
    canActivate: [authGuard],
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, useHash: true })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
