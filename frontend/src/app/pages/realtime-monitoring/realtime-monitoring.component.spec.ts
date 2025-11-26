import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RealtimeMonitoringComponent } from './realtime-monitoring.component';

describe('RealtimeMonitoringComponent', () => {
  let component: RealtimeMonitoringComponent;
  let fixture: ComponentFixture<RealtimeMonitoringComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RealtimeMonitoringComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RealtimeMonitoringComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
