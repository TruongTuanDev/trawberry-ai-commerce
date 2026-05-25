# Reviews API

## Purpose

Verified product reviews let customers review only products they actually bought and received. Reviews are then aggregated into:

- public product rating summaries
- public shop rating summaries
- seller review management
- admin moderation

This phase does not create fake ratings and does not support open public reviews from non-buyers.

## Rules

- only authenticated customers can create or edit customer reviews
- the review must belong to a real purchased order item
- the order item must belong to the same customer
- the order must be completed or delivered
- each order item can be reviewed only once per customer
- seller can reply only to reviews for their own shop
- admin can hide or restore reviews

## Data model

`ProductReview`

- `id`
- `productId`
- `shopId`
- `sellerId`
- `customerId`
- `orderId`
- `orderItemId`
- `rating` (`1..5`)
- `comment`
- `fitFeedback`
- `status`: `PUBLISHED | HIDDEN | REPORTED`
- `sellerReply`
- `sellerRepliedAt`
- `hiddenReason`
- `createdAt`
- `updatedAt`

`ProductReviewImage`

- `id`
- `reviewId`
- `url`
- `storageKey`
- `mimeType`
- `sizeBytes`
- `width`
- `height`
- `createdAt`

## Customer APIs

### `POST /api/customer/reviews`

Creates a verified review for one purchased order item.

Example body:

```json
{
  "orderId": "order_123",
  "orderItemId": "order_item_456",
  "productId": "product_789",
  "rating": 5,
  "comment": "Excellent quality.",
  "fitFeedback": "TRUE_TO_SIZE"
}
```

### `GET /api/customer/reviews`

Lists the authenticated customer's own reviews.

### `PATCH /api/customer/reviews/:reviewId`

Updates the authenticated customer's own review.

### `POST /api/customer/reviews/:reviewId/images`

Uploads one review image for the authenticated customer's own review.

Rules:

- maximum `5` images per review
- allowed MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
- maximum size: `5 MB` per image
- no video support in this phase

## Public APIs

### `GET /api/public/products/:productId/reviews`

Returns published reviews only plus rating summary.

Example response:

```json
{
  "items": [
    {
      "id": "review_1",
      "rating": 5,
      "comment": "Excellent quality.",
      "fitFeedback": "TRUE_TO_SIZE",
      "status": "PUBLISHED",
      "sellerReply": "Thanks for your feedback.",
      "images": [
        {
          "id": "image_1",
          "url": "http://localhost:3001/uploads/review-images/shop_1/review_1/photo.png",
          "mimeType": "image/png",
          "sizeBytes": 182341
        }
      ],
      "createdAt": "2026-05-26T08:00:00.000Z",
      "customer": {
        "maskedName": "Alice E."
      }
    }
  ],
  "summary": {
    "averageRating": 5,
    "ratingCount": 1,
    "countsByRating": {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 1
    }
  }
}
```

### `GET /api/public/products/:id`

Now includes rating summary fields used by product detail and cards:

- `averageRating`
- `feedbackCount`

## Seller APIs

### `GET /api/shops/:shopId/reviews`

Lists reviews for one seller-owned shop.

### `PATCH /api/shops/:shopId/reviews/:reviewId/reply`

Adds or updates the seller reply for one seller-owned review.

Example body:

```json
{
  "reply": "Thanks for your feedback."
}
```

## Admin APIs

### `GET /api/admin/reviews`

Lists all reviews for moderation.

### `PATCH /api/admin/reviews/:reviewId/hide`

Hides a review from public surfaces.

Example body:

```json
{
  "reason": "Hidden by moderation."
}
```

### `PATCH /api/admin/reviews/:reviewId/restore`

Restores a hidden review to public visibility.

## Error codes

Stable backend codes used by the frontend localization layer:

- `REVIEW_ORDER_NOT_COMPLETED`
- `REVIEW_NOT_VERIFIED_PURCHASE`
- `REVIEW_ALREADY_EXISTS`
- `REVIEW_PRODUCT_NOT_IN_ORDER`
- `REVIEW_RATING_INVALID`
- `REVIEW_COMMENT_REQUIRED`
- `REVIEW_IMAGE_TOO_LARGE`
- `REVIEW_IMAGE_TYPE_INVALID`
- `REVIEW_IMAGE_LIMIT_EXCEEDED`
- `REVIEW_IMAGE_UPLOAD_FAILED`

## Non-goals in this phase

- no review video upload
- no abuse/reporting workflow beyond basic moderation state
- no public anonymous reviews
- no fake ratings or seeded synthetic review counts

## Public review image visibility

- public review APIs return images only for `PUBLISHED` reviews
- hidden reviews must not expose text or images publicly
- hidden reviews must not contribute to public rating aggregates
