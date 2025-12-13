import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AlertHistoryComponent } from './alert-history.component';

describe('AlertHistoryComponent', () => {
  let component: AlertHistoryComponent;
  let fixture: ComponentFixture<AlertHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlertHistoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AlertHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
