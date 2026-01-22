import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WaterQualityInjectionComponent } from './water-quality-injection.component';

describe('WaterQualityInjectionComponent', () => {
  let component: WaterQualityInjectionComponent;
  let fixture: ComponentFixture<WaterQualityInjectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WaterQualityInjectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WaterQualityInjectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
