import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { ToastController } from '@ionic/angular';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly swUpdate = inject(SwUpdate);
  private readonly toastController = inject(ToastController);
  private updatePendingRefresh = false;

  constructor() {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        void this.notifyAndRefresh();
      });
  }

  private async notifyAndRefresh(): Promise<void> {
    if (this.updatePendingRefresh) {
      return;
    }

    this.updatePendingRefresh = true;

    try {
      const toast = await this.toastController.create({
        message: 'App updated. Refreshing…',
        duration: 2000,
        position: 'top',
      });

      await toast.present();
      await toast.onDidDismiss();
      await this.swUpdate.activateUpdate();
      this.reloadPage();
    } catch {
      this.updatePendingRefresh = false;
    }
  }

  protected reloadPage(): void {
    this.document.defaultView?.location.reload();
  }
}
