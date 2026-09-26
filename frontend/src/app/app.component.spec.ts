import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let versionUpdates$: Subject<VersionEvent>;
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
    toastController = {
      create: vi.fn().mockResolvedValue(toast),
    };

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: versionUpdates$.asObservable(),
          },
        },
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

  it('notifies the user and refreshes when an update is ready', async () => {
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
    expect(reloadSpy).toHaveBeenCalled();
  });
});
