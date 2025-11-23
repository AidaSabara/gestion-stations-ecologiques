import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StationAuthModalComponent } from './station-auth-modal.component';

describe('StationAuthModalComponent', () => {
  let component: StationAuthModalComponent;
  let fixture: ComponentFixture<StationAuthModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StationAuthModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StationAuthModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
