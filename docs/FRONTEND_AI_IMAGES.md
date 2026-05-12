# Frontend AI Images

## Scope
`frontend-next` now exposes the seller-facing AI image creation flow on:
- `/seller/products/[id]/images`

The frontend only talks to `backend-nest`. It does not call `ai-service` directly.

## UI Flow
1. seller opens a product image page
2. seller clicks `Generate AI Image`
3. modal opens and shows:
   - remaining AI credits
   - front image selector
   - optional back image selector
   - optional model reference selector
   - quantity `1..10`
   - task type
   - style preset
   - optional prompt
4. frontend creates an AI task in `backend-nest`
5. page polls task status every `2` seconds
6. when task completes, generated images are shown
7. seller can:
   - preview a generated image
   - attach it to the product gallery
8. gallery refreshes and shows the attached image as `AI_GENERATED`

## Backend APIs Used
- `GET /api/shops/:shopId/ai-credits`
- `POST /api/shops/:shopId/products/:productId/ai-images/tasks`
- `GET /api/shops/:shopId/ai-images/tasks/:taskId`
- `POST /api/shops/:shopId/products/:productId/ai-images/:generatedImageId/attach`
- `GET /api/shops/:shopId/products/:productId/images`
- `PATCH /api/shops/:shopId/products/:productId/images/:imageId`
- `DELETE /api/shops/:shopId/products/:productId/images/:imageId`

## UX Notes
- submit is disabled when:
  - no front image is selected
  - remaining credits are lower than requested quantity
  - submit is already in progress
- modal shows:
  - remaining credits
  - credit cost
  - projected balance after task creation
- task polling stops when:
  - status becomes `COMPLETED`
  - status becomes `FAILED`
  - polling reaches the page timeout cap
- failed tasks display `errorMessage`

## Components
- `src/app/seller/products/[id]/images/page.tsx`
- `src/components/products/ai-image-generate-modal.tsx`
- `src/components/products/ai-task-panel.tsx`
- `src/components/products/product-image-gallery.tsx`
- `src/lib/seller-api.ts`

## Verification
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `backend-nest npm run smoke:ai-service-integration`: pass
