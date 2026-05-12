import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { SellerInventoryFacade } from './seller-inventory.facade';

export const inventoryDirtyGuard: CanDeactivateFn<any> = () => {
  const facade = inject(SellerInventoryFacade);
  
  if (facade.hasChanges()) {
    return confirm('You have unsaved inventory changes. Do you want to discard them and leave?');
  }
  
  return true;
};
