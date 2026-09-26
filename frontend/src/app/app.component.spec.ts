import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let versionUpdates$: Subject<VersionEvent>;
  let toastController: jasmine.SpyObj<ToastController>;
  let toast: {
    present: jasmine.Spy<() => Promise<void>>;
    onDidDismiss: jasmine.Spy<() => Promise<void>>;
  };

  beforeEach(async () => {
    versionUpdates$ = new Subject<VersionEvent>();
    toast = {
      present: jasmine.createSpy('present').and.resolveTo(),
      onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo(),
    };
    toastController = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    toastController.create.and.resolveTo(toast as never);

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
    const reloadSpy = spyOn<any>(app, 'reloadPage').and.stub();

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'current' },
      latestVersion: { hash: 'latest' },
    });

    await fixture.whenStable();

    expect(toastController.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
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
