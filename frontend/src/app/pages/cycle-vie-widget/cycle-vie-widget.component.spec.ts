import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CycleVieWidgetComponent } from './cycle-vie-widget.component';

describe('CycleVieWidgetComponent', () => {
  let component: CycleVieWidgetComponent;
  let fixture: ComponentFixture<CycleVieWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CycleVieWidgetComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CycleVieWidgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
