import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let versionUpdates$: Subject<VersionEvent>;
  let swUpdate: {
    activateUpdate: ReturnType<typeof vi.fn>;
    isEnabled: boolean;
    versionUpdates: ReturnType<Subject<VersionEvent>['asObservable']>;
  };
  let toastController: { create: ReturnType<typeof vi.fn> };
  let toast: {
    present: ReturnType<typeof vi.fn>;
    onDidDismiss: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    versionUpdates$ = new Subject<VersionEvent>();
    toast = {
      present: vi.fn().mockResolvedValue(undefined),
      onDidDismiss: vi.fn().mockResolvedValue(undefined),
    };
    swUpdate = {
      activateUpdate: vi.fn().mockResolvedValue(true),
      isEnabled: true,
      versionUpdates: versionUpdates$.asObservable(),
    };
    toastController = {
      create: vi.fn().mockResolvedValue(toast),
    };

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      providers: [
        { provide: SwUpdate, useValue: swUpdate },
        { provide: ToastController, useValue: toastController },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('notifies the user, activates the update, and refreshes when an update is ready', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const reloadSpy = vi.spyOn(app as AppComponent & { reloadPage: () => void }, 'reloadPage');
    reloadSpy.mockImplementation(() => undefined);

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'current' },
      latestVersion: { hash: 'latest' },
    });

    await fixture.whenStable();

    expect(toastController.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'App updated. Refreshing…',
        duration: 2000,
        position: 'top',
      })
    );
    expect(toast.present).toHaveBeenCalled();
    expect(toast.onDidDismiss).toHaveBeenCalled();
    expect(swUpdate.activateUpdate).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('ignores later update-ready events after the refresh flow starts', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    vi.spyOn(app as AppComponent & { reloadPage: () => void }, 'reloadPage').mockImplementation(() => undefined);

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'current' },
      latestVersion: { hash: 'latest' },
    });
    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'current-2' },
      latestVersion: { hash: 'latest-2' },
    });

    await fixture.whenStable();

    expect(toastController.create).toHaveBeenCalledTimes(1);
    expect(swUpdate.activateUpdate).toHaveBeenCalledTimes(1);
  });

  it('retries later when update activation does not complete', async () => {
    swUpdate.activateUpdate.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const reloadSpy = vi.spyOn(app as AppComponent & { reloadPage: () => void }, 'reloadPage');
    reloadSpy.mockImplementation(() => undefined);

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'current' },
      latestVersion: { hash: 'latest' },
    });

    await fixture.whenStable();

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(toastController.create).toHaveBeenCalledTimes(1);
    expect(swUpdate.activateUpdate).toHaveBeenCalledTimes(1);

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'current-2' },
      latestVersion: { hash: 'latest-2' },
    });

    await fixture.whenStable();

    expect(toastController.create).toHaveBeenCalledTimes(2);
    expect(swUpdate.activateUpdate).toHaveBeenCalledTimes(2);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
