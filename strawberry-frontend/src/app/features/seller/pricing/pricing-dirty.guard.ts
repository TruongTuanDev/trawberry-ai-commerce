import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { SellerPricingFacade } from './seller-pricing.facade';

export const pricingDirtyGuard: CanDeactivateFn<any> = () => {
  const facade = inject(SellerPricingFacade);
  
  if (facade.hasChanges()) {
    return confirm('You have unsaved pricing changes. Do you want to discard them and leave?');
  }
  
  return true;
};
