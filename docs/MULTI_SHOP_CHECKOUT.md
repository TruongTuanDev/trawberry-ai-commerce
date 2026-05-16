# Multi-shop Checkout Split Orders

## Decision

Multi-shop cart checkout now creates one independent order per shop. There is no parent marketplace order in this phase.

The checkout response keeps the legacy first-order fields for old consumers and adds split-order fields for cart checkout:

```json
{
  "orderId": "first-order-id",
  "orderCode": "ORD-...",
  "totalAmount": "200",
  "orders": [
    {
      "orderId": "order-a",
      "orderCode": "ORD-...",
      "shopId": "shop-a",
      "shopName": "Shop A",
      "totalAmount": "200",
      "itemsCount": 2
    }
  ],
  "orderCodes": ["ORD-..."],
  "grandTotal": "800"
}
```

Current checkout also creates a parent marketplace receipt:

- `checkoutId`
- `checkoutCode`
- `grandTotal`
- child `orders[]`

The first `orderId` and `orderCode` remain backward compatible for existing single-order consumers.

## Customer Flow

1. Customer adds items from one or more shops to the localStorage cart.
2. `/cart` groups items by shop and shows each shop subtotal plus grand total.
3. `/checkout` submits all cart items to `POST /api/checkout/orders`.
4. Backend validates all items first.
5. Backend groups validated items by `product.shopId`.
6. Backend creates one order per shop in one transaction.
7. Customer receives one `checkoutCode` for the parent receipt.
8. Customer sees one confirmation card per created shop order and tracks each order separately.

## Backend Rules

- Frontend price and totals are ignored.
- Product, variant, price, checkout readiness, shop activity, seller approval, and stock are validated before any order is created.
- Any invalid item fails the entire checkout.
- Stock deduction uses the existing variant-level stock/reserved-stock transaction path.
- If a concurrent stock change is detected, the transaction fails and no partial orders remain.
- Each order contains only items for its own shop.

## Payment And Delivery

- Payment remains per order.
- Each split order starts with its own `paymentStatus`.
- Customer uploads payment proof per order.
- Seller reviews payment per order.
- Delivery remains per order/shop through the existing seller-managed manual delivery flow.
- Customer tracking remains one order code plus phone per shop order.

## Seller Isolation

Seller order and payment APIs remain shop-scoped through existing guards. Seller A sees only the order created for Shop A; Seller B sees only the order created for Shop B.

## Verification

- Backend receipt/history smoke: `npm run smoke:customer-order-history`
- Backend smoke: `npm run smoke:multi-shop-checkout`
- Frontend E2E: `npm run test:e2e:multi-shop-checkout`
- Frontend receipt/history E2E: `npm run test:e2e:customer-order-history`

## Future Phase

Future work can add combined payment routing or marketplace-level support workflows on top of the existing parent receipt.
