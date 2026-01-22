import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SensorInjectionComponent } from './sensor-injection.component';

describe('SensorInjectionComponent', () => {
  let component: SensorInjectionComponent;
  let fixture: ComponentFixture<SensorInjectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SensorInjectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SensorInjectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
