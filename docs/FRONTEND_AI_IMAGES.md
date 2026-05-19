# Frontend AI Images

## Scope
`frontend-next` now exposes the seller-facing AI image creation flow on:
- `/seller/products/[id]/images`
- `/seller/ai-images`

The frontend only talks to `backend-nest`. It does not call `ai-service` directly.

## UI Flow
1. seller opens either `/seller/products/[id]/images` or `/seller/ai-images`
2. seller selects one product and creates an AI task
3. form/modal shows:
   - remaining AI credits
   - runtime mode badge
   - front image selector
   - optional back image selector
   - optional model reference selector
   - quantity
   - task mode / style
   - optional prompt
4. frontend creates an AI task in `backend-nest`
5. page polls task status every `2` seconds
6. when task completes, generated images are shown
7. seller can:
   - preview a generated image
   - attach it to the product gallery
8. gallery refreshes and shows the attached image as `AI_GENERATED`
9. virtual try-on remains `Coming soon` until a verified backend flow exists

## Backend APIs Used
- `GET /api/shops/:shopId/ai-credits`
- `GET /api/shops/:shopId/ai-images/runtime`
- `POST /api/shops/:shopId/products/:productId/ai-images/tasks`
- `GET /api/shops/:shopId/ai-images/tasks`
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
- `src/app/seller/ai-images/page.tsx`
- `src/components/ai/seller-ai-images-workspace.tsx`
- `src/app/seller/products/[id]/images/page.tsx`
- `src/components/products/ai-image-generate-modal.tsx`
- `src/components/products/ai-task-panel.tsx`
- `src/components/products/product-image-gallery.tsx`
- `src/lib/seller-api.ts`

## Verification
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npm run test:e2e:seller-ai-images`: pass
- `backend-nest npm run smoke:ai-service-integration`: pass
