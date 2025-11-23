import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FiltresComponent } from './filtres.component';

describe('FiltresComponent', () => {
  let component: FiltresComponent;
  let fixture: ComponentFixture<FiltresComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FiltresComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FiltresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
